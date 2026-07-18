const router = require('express').Router();
const auth = require('../controllers/authController');
const booking = require('../controllers/bookingController');
router.get('/booking', auth.isAuthenticated, booking.showBooking);
router.post('/booking', auth.isAuthenticated, booking.createBooking);
router.get('/bookings/:id', auth.isAuthenticated, booking.showDetail);
router.post('/bookings/:id/cancel', auth.isAuthenticated, booking.cancel);
router.post('/bookings/:id/payment-submitted', auth.isAuthenticated, booking.paymentSubmitted);
module.exports = router;
