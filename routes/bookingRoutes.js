const express = require('express');
const router = express.Router();

router.get('/booking', (req, res) => {
    res.send('Trang đặt xe');
});

module.exports = router;