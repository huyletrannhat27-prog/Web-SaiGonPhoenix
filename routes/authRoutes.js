const express = require('express');
const router = express.Router();

router.get('/login', (req, res) => {
    res.send('Trang đăng nhập');
});

router.get('/register', (req, res) => {
    res.send('Trang đăng ký');
});

module.exports = router;