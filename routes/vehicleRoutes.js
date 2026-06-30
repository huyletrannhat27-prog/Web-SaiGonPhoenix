const express = require('express');
const router = express.Router();

router.get('/vehicles', (req, res) => {
    res.send('Danh sách xe');
});

module.exports = router;