const router = require('express').Router();
const auth = require('../controllers/authController');
const profile = require('../controllers/profileController');

router.get('/profile', auth.isAuthenticated, profile.showProfile);
router.post('/profile', auth.isAuthenticated, profile.updateProfile);

module.exports = router;
