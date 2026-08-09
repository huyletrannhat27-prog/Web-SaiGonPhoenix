const Booking = require('../models/Booking');

const API_BASE = 'https://fr24api.flightradar24.com/api';
const normalizeFlight = value => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const toDate = value => {
    if (!value) return null;
    if (typeof value === 'number') return new Date(value > 1e12 ? value : value * 1000);
    return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`);
};

async function fr24Request(pathname, params) {
    if (!process.env.FR24_API_TOKEN) throw new Error('FR24_API_TOKEN chưa được cấu hình');
    const url = new URL(`${API_BASE}${pathname}`);
    Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== '') url.searchParams.set(key, value); });
    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${process.env.FR24_API_TOKEN}`, Accept: 'application/json', 'Accept-Version': 'v1' },
        signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) throw new Error(`Flightradar24 phản hồi ${response.status}`);
    return response.json();
}

function chooseFlight(items, booking) {
    const flightNumber = normalizeFlight(booking.customerInfo.flightNumber);
    const airportCode = booking.airport.match(/\(([A-Z]{3})\)/)?.[1];
    return items.find(item => normalizeFlight(item.flight) === flightNumber && (!airportCode || [item.dest_iata, item.destination_iata, item.dest_icao, item.destination_icao].includes(airportCode)))
        || items.find(item => normalizeFlight(item.flight) === flightNumber)
        || items[0];
}

exports.syncBookingFlight = async bookingOrId => {
    const booking = typeof bookingOrId === 'string' ? await Booking.findById(bookingOrId) : bookingOrId;
    if (!booking || booking.tripType !== 'airport-pickup' || !booking.customerInfo.flightNumber) return null;
    const checkedAt = new Date();
    const expiresAt = new Date(checkedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
    if (!process.env.FR24_API_TOKEN) {
        booking.flightTracking.status = 'waiting';
        booking.flightTracking.lastCheckedAt = checkedAt;
        booking.flightTracking.message = 'Chờ cấu hình API Flightradar24.';
        await booking.save();
        return booking.flightTracking;
    }
    try {
        const flightNumber = normalizeFlight(booking.customerInfo.flightNumber);
        let result = await fr24Request('/live/flight-positions/full', { flights: flightNumber, limit: 10 });
        let item = chooseFlight(result.data || [], booking);
        if (item) {
            booking.flightTracking = {
                provider: 'Flightradar24', fr24Id: item.fr24_id || '', status: item.on_ground ? 'landed' : 'en_route',
                origin: item.orig_iata || item.orig_icao || '', destination: item.dest_iata || item.dest_icao || '',
                estimatedArrival: toDate(item.eta), actualTakeoff: null, actualLanding: item.on_ground ? checkedAt : null,
                lastCheckedAt: checkedAt, dataExpiresAt: expiresAt,
                message: item.on_ground ? 'Máy bay đã hạ cánh.' : 'Máy bay đang được theo dõi trực tiếp.'
            };
        } else {
            const from = new Date(booking.bookingDate.getTime() - 20 * 60 * 60 * 1000).toISOString().slice(0, 19);
            const to = new Date(booking.bookingDate.getTime() + 20 * 60 * 60 * 1000).toISOString().slice(0, 19);
            result = await fr24Request('/flight-summary/light', { flight_datetime_from: from, flight_datetime_to: to, flights: flightNumber, limit: 10 });
            item = chooseFlight(result.data || [], booking);
            booking.flightTracking = item ? {
                provider: 'Flightradar24', fr24Id: item.fr24_id || '', status: item.datetime_landed ? 'landed' : (item.flight_ended === false ? 'en_route' : 'waiting'),
                origin: item.origin_icao || '', destination: item.destination_icao_actual || item.destination_icao || '',
                estimatedArrival: null, actualTakeoff: toDate(item.datetime_takeoff), actualLanding: toDate(item.datetime_landed),
                lastCheckedAt: checkedAt, dataExpiresAt: expiresAt,
                message: item.datetime_landed ? 'Đã ghi nhận giờ hạ cánh thực tế.' : 'Đã tìm thấy chuyến bay, đang chờ dữ liệu hạ cánh.'
            } : { provider: 'Flightradar24', status: 'not_found', lastCheckedAt: checkedAt, dataExpiresAt: expiresAt, message: 'Chưa tìm thấy chuyến bay trong dữ liệu hiện tại.' };
        }
        await booking.save();
        return booking.flightTracking;
    } catch (error) {
        booking.flightTracking.status = 'error';
        booking.flightTracking.lastCheckedAt = checkedAt;
        booking.flightTracking.message = error.message;
        await booking.save();
        return booking.flightTracking;
    }
};

exports.syncActiveFlights = async () => {
    const from = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const to = new Date(Date.now() + 30 * 60 * 60 * 1000);
    const bookings = await Booking.find({ tripType: 'airport-pickup', status: { $in: ['pending', 'confirmed'] }, 'customerInfo.flightNumber': { $nin: ['', null] }, bookingDate: { $gte: from, $lte: to } }).limit(50);
    for (const booking of bookings) await exports.syncBookingFlight(booking);
    await Booking.updateMany({ 'flightTracking.dataExpiresAt': { $lt: new Date() } }, { $unset: { flightTracking: 1 } });
    return bookings.length;
};
