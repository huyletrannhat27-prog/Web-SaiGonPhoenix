const Booking = require('../models/Booking');
const Review = require('../models/Review');
const User = require('../models/User');

const TIME_ZONE = 'Asia/Ho_Chi_Minh';
const statusLabels = { pending: 'Chờ xác nhận', confirmed: 'Chờ phục vụ', completed: 'Hoàn thành', cancelled: 'Đã hủy', expired: 'Quá hạn' };

function vietnamBoundary(value, endOfDay = false) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
    const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+07:00`);
    return Number.isNaN(date.getTime()) ? null : date;
}

function resolveAnalyticsRange(query = {}, now = new Date()) {
    const allowed = new Set(['30d', '90d', '365d', 'all', 'custom']);
    const period = allowed.has(query.period) ? query.period : '90d';
    if (period === 'all') return { period, from: null, to: null, label: 'Toàn bộ dữ liệu' };
    if (period === 'custom') {
        const from = vietnamBoundary(query.from);
        const to = vietnamBoundary(query.to, true);
        if (from && to && from <= to) return { period, from, to, label: `${query.from} – ${query.to}`, fromInput: query.from, toInput: query.to };
    }
    const days = period === '30d' ? 30 : period === '365d' ? 365 : 90;
    const to = new Date(now);
    const from = new Date(to.getTime() - (days - 1) * 86400000);
    return { period: `${days}d`, from, to, label: `${days} ngày gần nhất` };
}

function dateParts(date) {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(date));
    return Object.fromEntries(parts.map(part => [part.type, part.value]));
}

function bucketKey(date, granularity) {
    const parts = dateParts(date);
    return granularity === 'day' ? `${parts.year}-${parts.month}-${parts.day}` : `${parts.year}-${parts.month}`;
}

function bucketLabel(key, granularity) {
    if (granularity === 'day') { const [, month, day] = key.split('-'); return `${day}/${month}`; }
    const [year, month] = key.split('-'); return `${month}/${year}`;
}

function buildBucketKeys(from, to, granularity) {
    const keys = [];
    if (granularity === 'day') {
        const cursor = new Date(from); cursor.setUTCHours(12, 0, 0, 0);
        const end = new Date(to); end.setUTCHours(12, 0, 0, 0);
        while (cursor <= end && keys.length < 120) { keys.push(bucketKey(cursor, 'day')); cursor.setUTCDate(cursor.getUTCDate() + 1); }
    } else {
        const first = dateParts(from); const last = dateParts(to);
        let year = Number(first.year); let month = Number(first.month);
        const lastValue = Number(last.year) * 12 + Number(last.month);
        while (year * 12 + month <= lastValue && keys.length < 60) {
            keys.push(`${year}-${String(month).padStart(2, '0')}`);
            month++; if (month > 12) { month = 1; year++; }
        }
    }
    return keys;
}

function driverFromBooking(booking) {
    return booking.assignedDriver || booking.vehicle?.driver || null;
}

async function getAdminAnalytics(query = {}) {
    const range = resolveAnalyticsRange(query);
    const bookingMatch = {};
    if (range.from || range.to) bookingMatch.bookingDate = { ...(range.from ? { $gte: range.from } : {}), ...(range.to ? { $lte: range.to } : {}) };
    const bookings = await Booking.find(bookingMatch)
        .populate('assignedDriver', 'username phone driverProfile')
        .populate({ path: 'vehicle', select: 'name type driver', populate: { path: 'driver', select: 'username phone driverProfile' } })
        .sort({ bookingDate: 1 }).lean();
    const bookingIds = bookings.map(item => item._id);
    const [reviews, drivers] = await Promise.all([
        bookingIds.length ? Review.find({ booking: { $in: bookingIds } }).sort({ createdAt: 1 }).lean() : [],
        User.find({ role: 'driver' }).select('username phone driverProfile isActive').sort({ username: 1 }).lean()
    ]);
    const reviewByBooking = new Map(reviews.map(review => [String(review.booking), review]));
    const bookingById = new Map(bookings.map(booking => [String(booking._id), booking]));
    const driverStats = new Map(drivers.map(driver => [String(driver._id), {
        id: String(driver._id), name: driver.username, phone: driver.phone || '', licensePlate: driver.driverProfile?.licensePlate || '',
        isActive: driver.isActive !== false, assignedTrips: 0, completedTrips: 0, servingTrips: 0, cancelledTrips: 0,
        totalRating: 0, driverRating: 0, tripRating: 0, reviewCount: 0
    }]));
    const unassigned = { id: '', name: 'Chưa gán tài xế', phone: '', licensePlate: '', isActive: false, assignedTrips: 0, completedTrips: 0, servingTrips: 0, cancelledTrips: 0, totalRating: 0, driverRating: 0, tripRating: 0, reviewCount: 0 };
    const records = bookings.map(booking => {
        const assigned = driverFromBooking(booking);
        const driverId = assigned?._id ? String(assigned._id) : assigned ? String(assigned) : '';
        const bucket = driverStats.get(driverId) || unassigned;
        if (['confirmed', 'completed', 'cancelled'].includes(booking.status)) bucket.assignedTrips++;
        if (booking.status === 'completed') bucket.completedTrips++;
        if (booking.status === 'confirmed') bucket.servingTrips++;
        if (booking.status === 'cancelled') bucket.cancelledTrips++;
        const review = reviewByBooking.get(String(booking._id));
        if (review) {
            const reviewDriverId = review.driver ? String(review.driver) : driverId;
            const ratingBucket = driverStats.get(reviewDriverId) || bucket;
            ratingBucket.reviewCount++;
            ratingBucket.driverRating += review.driverRating;
            ratingBucket.tripRating += review.tripRating;
            ratingBucket.totalRating += (review.driverRating + review.tripRating) / 2;
        }
        return {
            id: String(booking._id), code: booking._id.toString().slice(-8).toUpperCase(), createdAt: booking.createdAt,
            bookingDate: booking.bookingDate, customerName: booking.customerInfo?.name || '', phone: booking.customerInfo?.phone || '',
            tripType: booking.tripType, airport: booking.airport, pickup: booking.customerInfo?.pickupLocation || '', dropoff: booking.customerInfo?.dropoffLocation || '',
            vehicle: booking.vehicle?.name || booking.vehicleSnapshot?.name || 'Xe đã xóa', driverId, driver: assigned?.username || booking.driverSnapshot?.name || 'Chưa gán tài xế',
            status: booking.status, statusLabel: statusLabels[booking.status] || booking.status, totalPrice: booking.totalPrice || 0,
            paidAmount: booking.payment?.paidAmount || 0, tripRating: review?.tripRating || null, driverRating: review?.driverRating || null,
            reviewComment: review?.comment || ''
        };
    });
    if (unassigned.assignedTrips || unassigned.reviewCount) driverStats.set('', unassigned);
    const driverPerformance = Array.from(driverStats.values()).map(driver => ({
        ...driver,
        averageDriverRating: driver.reviewCount ? Number((driver.driverRating / driver.reviewCount).toFixed(1)) : 0,
        averageTripRating: driver.reviewCount ? Number((driver.tripRating / driver.reviewCount).toFixed(1)) : 0,
        averageOverall: driver.reviewCount ? Number((driver.totalRating / driver.reviewCount).toFixed(1)) : 0,
        completionRate: driver.assignedTrips ? Math.round(driver.completedTrips / driver.assignedTrips * 100) : 0
    })).sort((a, b) => b.completedTrips - a.completedTrips || b.assignedTrips - a.assignedTrips || a.name.localeCompare(b.name, 'vi'));
    const totalBookings = bookings.length;
    const completedBookings = bookings.filter(item => item.status === 'completed').length;
    const averageTrip = reviews.length ? reviews.reduce((sum, item) => sum + item.tripRating, 0) / reviews.length : 0;
    const averageDriver = reviews.length ? reviews.reduce((sum, item) => sum + item.driverRating, 0) / reviews.length : 0;
    const averageOverall = (averageTrip + averageDriver) / 2;
    const metrics = {
        totalBookings, completedBookings, completionRate: totalBookings ? Math.round(completedBookings / totalBookings * 100) : 0,
        totalReviews: reviews.length, averageTrip: Number(averageTrip.toFixed(1)), averageDriver: Number(averageDriver.toFixed(1)),
        averageOverall: Number(averageOverall.toFixed(1)), satisfaction: reviews.length ? Math.round(averageOverall / 5 * 100) : 0,
        totalRevenue: bookings.reduce((sum, item) => sum + (item.totalPrice || 0), 0),
        receivedRevenue: bookings.reduce((sum, item) => sum + (item.payment?.paidAmount || 0), 0)
    };
    const status = Object.entries(statusLabels).map(([key, label]) => ({ key, label, count: bookings.filter(item => item.status === key).length }));
    const effectiveFrom = range.from || (bookings[0]?.bookingDate ? new Date(bookings[0].bookingDate) : new Date(Date.now() - 89 * 86400000));
    const effectiveTo = range.to || (bookings.at(-1)?.bookingDate ? new Date(bookings.at(-1).bookingDate) : new Date());
    const spanDays = Math.max(1, Math.ceil((effectiveTo - effectiveFrom) / 86400000));
    const granularity = spanDays <= 62 ? 'day' : 'month';
    let trendFrom = effectiveFrom;
    if (granularity === 'month' && spanDays > 31 * 36) trendFrom = new Date(effectiveTo.getTime() - 31 * 35 * 86400000);
    const trendMap = new Map(buildBucketKeys(trendFrom, effectiveTo, granularity).map(key => [key, { key, label: bucketLabel(key, granularity), booked: 0, completed: 0, reviews: 0, ratingTotal: 0 }]));
    bookings.forEach(booking => {
        const key = bucketKey(booking.bookingDate, granularity); const item = trendMap.get(key);
        if (item) { item.booked++; if (booking.status === 'completed') item.completed++; }
    });
    reviews.forEach(review => {
        const booking = bookingById.get(String(review.booking));
        if (!booking) return;
        const item = trendMap.get(bucketKey(booking.bookingDate, granularity));
        if (item) { item.reviews++; item.ratingTotal += (review.driverRating + review.tripRating) / 2; }
    });
    const trend = Array.from(trendMap.values()).map(item => ({ ...item, averageRating: item.reviews ? Number((item.ratingTotal / item.reviews).toFixed(1)) : 0 })).map(({ ratingTotal, ...item }) => item);
    return {
        generatedAt: new Date().toISOString(),
        range: { period: range.period, label: range.label, from: range.from?.toISOString() || null, to: range.to?.toISOString() || null, fromInput: range.fromInput || '', toInput: range.toInput || '' },
        metrics, status, trend, drivers: driverPerformance, records,
        reviews: reviews.map(review => ({ id: String(review._id), bookingId: String(review.booking), createdAt: review.createdAt, driverName: review.driverName, vehicleName: review.vehicleName, tripRating: review.tripRating, driverRating: review.driverRating, comment: review.comment, isPublished: review.isPublished }))
    };
}

module.exports = { getAdminAnalytics, resolveAnalyticsRange, statusLabels };
