const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Import routes
const authRoutes = require('./authRoutes');
const bookingRoutes = require('./bookingRoutes');
const vehicleRoutes = require('./vehicleRoutes');

// Sử dụng routes
router.use('/', authRoutes);
router.use('/', bookingRoutes);
router.use('/', vehicleRoutes);

// Trang chủ
router.get('/', (req, res) => {
    res.render('index', { 
        session: req.session,
        title: 'SaiGonPhoenix - Dịch vụ đón tiễn sân bay'
    });
});

// Dashboard
router.get('/dashboard', authController.isAuthenticated, async (req, res) => {
    try {
        const Booking = require('../models/Booking');
        const bookings = await Booking.find({ user: req.session.userId })
            .populate('vehicle')
            .sort({ createdAt: -1 })
            .limit(5);

        res.render('dashboard', { 
            session: req.session,
            bookings: bookings,
            title: 'Dashboard - SaiGonPhoenix'
        });
    } catch (error) {
        console.error(error);
        res.render('dashboard', { 
            session: req.session,
            bookings: [],
            title: 'Dashboard - SaiGonPhoenix'
        });
    }
});

// About page
router.get('/about', (req, res) => {
    res.render('about', { 
        session: req.session,
        title: 'Giới thiệu - SaiGonPhoenix'
    });
});

// Contact page
router.get('/contact', (req, res) => {
    res.render('contact', { 
        session: req.session,
        title: 'Liên hệ - SaiGonPhoenix'
    });
});

module.exports = router;