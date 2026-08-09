const Booking = require('../models/Booking');

const graceMs = () => Number(process.env.BOOKING_ARCHIVE_HOURS || 2) * 60 * 60 * 1000;

exports.activeCutoff = () => new Date(Date.now() - graceMs());

exports.archiveOverdueBookings = async () => {
    const cutoff = exports.activeCutoff();
    const now = new Date();
    const [completed, expired] = await Promise.all([
        Booking.updateMany({ status: 'confirmed', bookingDate: { $lte: cutoff } }, { $set: { status: 'completed', autoCompletedAt: now } }),
        Booking.updateMany({ status: 'pending', bookingDate: { $lte: cutoff } }, { $set: { status: 'expired', autoCompletedAt: now } })
    ]);
    return { completed: completed.modifiedCount, expired: expired.modifiedCount };
};

exports.findGloballyBusyVehicleIds = async (excludeBookingId = null) => {
    const filter = { status: 'confirmed', bookingDate: { $gt: exports.activeCutoff() } };
    if (excludeBookingId) filter._id = { $ne: excludeBookingId };
    return Booking.distinct('vehicle', filter);
};
