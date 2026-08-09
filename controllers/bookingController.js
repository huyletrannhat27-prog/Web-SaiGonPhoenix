const Booking = require('../models/Booking');
const Vehicle = require('../models/Vehicle');
const User = require('../models/User');
const PaymentSettings = require('../models/PaymentSettings');
const Review = require('../models/Review');
const { findGloballyBusyVehicleIds } = require('../services/bookingLifecycle');
const { syncBookingFlight } = require('../services/flightTracker');
const { bookingSuccessMessage } = require('../services/bookingNotifications');

async function getAvailableVehicles() {
    const globallyBusy = await findGloballyBusyVehicleIds();
    return Vehicle.find({ isAvailable: true, _id: { $nin: globallyBusy } }).populate('driver', 'username phone driverProfile').sort({ price: 1 });
}

exports.showBooking = async (req, res, next) => {
    try {
        const vehicles = await getAvailableVehicles();
        const user = await User.findById(req.session.userId);
        const form = {
            airport: req.query.airport || '',
            tripType: req.query.tripType || 'airport-pickup',
            bookingDate: req.query.bookingDate || '',
            vehicleId: req.query.vehicleId || ''
        };
        res.render('booking', { title: 'Đặt xe sân bay', vehicles, user, error: null, form });
    } catch (error) { next(error); }
};

exports.createBooking = async (req, res, next) => {
    try {
        const { vehicleId, airport, tripType, customerName, phone, bookingDate, passengerCount, pickupLocation, dropoffLocation, flightNumber, luggageCount, note, paymentOption } = req.body;
        const globallyBusy = await findGloballyBusyVehicleIds();
        const selectedVehicleIsBusy = globallyBusy.some(id => String(id) === String(vehicleId));
        const vehicle = selectedVehicleIsBusy ? null : await Vehicle.findOne({ _id: vehicleId, isAvailable: true });
        const pickupTime = new Date(bookingDate);
        const form = req.body;
        if (!vehicle) return res.status(400).render('booking', { title: 'Đặt xe sân bay', vehicles: await getAvailableVehicles(), user: await User.findById(req.session.userId), error: 'Xe này đã được xác nhận cho một chuyến khác hoặc đang tạm ẩn. Vui lòng chọn xe khác.', form });
        if (!customerName || !phone || !airport || !pickupLocation || !dropoffLocation || !['deposit', 'full'].includes(paymentOption) || Number.isNaN(pickupTime.getTime()) || pickupTime <= new Date()) {
            return res.status(400).render('booking', { title: 'Đặt xe sân bay', vehicles: await getAvailableVehicles(), user: await User.findById(req.session.userId), error: 'Thông tin chưa hợp lệ hoặc thời gian đón đã qua.', form });
        }
        if (+passengerCount < 1 || +passengerCount > vehicle.capacity) return res.status(400).render('booking', { title: 'Đặt xe sân bay', vehicles: await getAvailableVehicles(), user: await User.findById(req.session.userId), error: `Xe ${vehicle.name} chỉ nhận tối đa ${vehicle.capacity} khách.`, form });
        const bufferMinutes = Number(process.env.BOOKING_BUFFER_MINUTES || 120);
        const busyBooking = await Booking.exists({ vehicle: vehicle._id, status: { $in: ['pending', 'confirmed'] }, bookingDate: { $gte: new Date(pickupTime.getTime() - bufferMinutes * 60 * 1000), $lte: new Date(pickupTime.getTime() + bufferMinutes * 60 * 1000) } });
        if (busyBooking) return res.status(409).render('booking', { title: 'Đặt xe sân bay', vehicles: await getAvailableVehicles(), user: await User.findById(req.session.userId), error: 'Xe này vừa được đặt trong khung giờ bạn chọn. Vui lòng chọn xe hoặc thời gian khác.', form });
        const requiredAmount = paymentOption === 'full' ? vehicle.price : Math.round(vehicle.price * 0.3);
        const booking = await Booking.create({
            user: req.session.userId, vehicle: vehicle._id, airport, tripType,
            vehicleSnapshot: { name: vehicle.name, type: vehicle.type, image: vehicle.images[0] || '', capacity: vehicle.capacity },
            customerInfo: { name: customerName.trim(), phone: phone.trim(), pickupLocation, dropoffLocation, luggageCount: +luggageCount || 0, passengerCount: +passengerCount, flightNumber },
            bookingDate: pickupTime, originalBookingDate: pickupTime, totalPrice: vehicle.price, note,
            flightTracking: tripType === 'airport-pickup' && flightNumber ? { status: 'waiting', message: 'Đang chờ đồng bộ dữ liệu chuyến bay.' } : { status: 'not_requested' },
            payment: { option: paymentOption, requiredAmount }
        });
        const bookingCode = booking._id.toString().slice(-8).toUpperCase();
        req.flash('success', `[BOOKING_SUCCESS]${bookingSuccessMessage(req.body.uiLanguage, bookingCode)}`);
        if (tripType === 'airport-pickup' && flightNumber) syncBookingFlight(booking).catch(error => console.error('Flight sync:', error.message));
        res.redirect(`/bookings/${booking._id}`);
    } catch (error) { next(error); }
};

exports.showDetail = async (req, res, next) => {
    try {
        const query = { _id: req.params.id };
        if (req.session.role === 'user') query.user = req.session.userId;
        if (req.session.role === 'driver') query.vehicle = { $in: await Vehicle.distinct('_id', { driver: req.session.userId }) };
        const booking = await Booking.findOne(query).populate({ path: 'vehicle', populate: { path: 'driver', select: 'username phone driverProfile' } }).populate('user', 'username email phone');
        if (!booking) return res.status(404).render('error', { title: 'Không tìm thấy', error: { message: 'Không tìm thấy đơn đặt xe.' } });
        const bank = await PaymentSettings.findOne({ key: 'bank-transfer' }).lean();
        const transferContent = `SGP${booking._id.toString().slice(-8).toUpperCase()}`;
        const amountDue = booking.payment.status === 'partial' ? Math.max(booking.totalPrice - booking.payment.paidAmount, 0) : booking.payment.requiredAmount;
        const qrUrl = bank?.bankId && bank?.accountNo
            ? `https://img.vietqr.io/image/${encodeURIComponent(bank.bankId)}-${encodeURIComponent(bank.accountNo)}-${encodeURIComponent(bank.qrTemplate || 'compact2')}.png?amount=${amountDue}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(bank.accountName || '')}`
            : null;
        const review = await Review.findOne({ booking: booking._id }).lean();
        res.render('booking-details', { title: 'Chi tiết đơn xe', booking, review, bank, qrUrl, transferContent, amountDue });
    } catch (error) { next(error); }
};

exports.paymentSubmitted = async (req, res, next) => {
    try {
        const booking = await Booking.findOne({ _id: req.params.id, user: req.session.userId, 'payment.status': { $in: ['awaiting_payment', 'partial'] } });
        if (!booking) req.flash('error', 'Đơn không ở trạng thái chờ thanh toán.');
        else { booking.payment.status = 'pending_review'; booking.payment.submittedAt = new Date(); await booking.save(); req.flash('success', 'Đã gửi thông báo chuyển khoản. Admin sẽ kiểm tra và xác nhận.'); }
        res.redirect(`/bookings/${req.params.id}`);
    } catch (error) { next(error); }
};

exports.cancel = async (req, res, next) => {
    try {
        const booking = await Booking.findOne({ _id: req.params.id, user: req.session.userId, status: 'pending' });
        if (!booking) req.flash('error', 'Chỉ có thể hủy đơn đang chờ xác nhận.');
        else { booking.status = 'cancelled'; await booking.save(); req.flash('success', 'Đã hủy đơn đặt xe.'); }
        res.redirect('/dashboard');
    } catch (error) { next(error); }
};
