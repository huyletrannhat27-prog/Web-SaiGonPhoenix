const router = require('express').Router();
const Vehicle = require('../models/Vehicle');
const Booking = require('../models/Booking');
const { findGloballyBusyVehicleIds } = require('../services/bookingLifecycle');
router.get('/api/vehicles', async (req, res, next) => {
    try {
        const filter = { isAvailable: true };
        const globallyBusy = await findGloballyBusyVehicleIds();
        filter._id = { $nin: globallyBusy };
        if (req.query.bookingDate) {
            const requestedDate = new Date(req.query.bookingDate);
            if (!Number.isNaN(requestedDate.getTime())) {
                const bufferMinutes = Number(process.env.BOOKING_BUFFER_MINUTES || 120);
                const from = new Date(requestedDate.getTime() - bufferMinutes * 60 * 1000);
                const to = new Date(requestedDate.getTime() + bufferMinutes * 60 * 1000);
                const busy = await Booking.distinct('vehicle', { status: { $in: ['pending', 'confirmed'] }, bookingDate: { $gte: from, $lte: to } });
                filter._id = { $nin: [...globallyBusy.map(String), ...busy.map(String)] };
            }
        }
        res.json(await Vehicle.find(filter).sort({ price: 1 }));
    } catch (error) { next(error); }
});
module.exports = router;
