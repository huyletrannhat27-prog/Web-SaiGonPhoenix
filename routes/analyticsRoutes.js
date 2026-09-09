const router = require('express').Router();
const auth = require('../controllers/authController');
const { getAdminAnalytics } = require('../services/analytics');
const { createAnalyticsCsv, createAnalyticsWorkbook } = require('../services/analyticsExport');

router.get('/admin/analytics/export/:format', auth.isAdmin, async (req, res, next) => {
    try {
        const format = String(req.params.format || '').toLowerCase();
        if (!['xlsx', 'csv', 'json'].includes(format)) return res.status(404).send('Định dạng xuất không được hỗ trợ.');
        const analytics = await getAdminAnalytics(req.query);
        const stamp = new Date().toISOString().slice(0, 10);
        res.set('Cache-Control', 'no-store');
        if (format === 'json') {
            res.attachment(`saigonphoenix-analytics-${stamp}.json`);
            return res.type('application/json').send(JSON.stringify(analytics, null, 2));
        }
        if (format === 'csv') {
            res.attachment(`saigonphoenix-trips-${stamp}.csv`);
            return res.type('text/csv; charset=utf-8').send(createAnalyticsCsv(analytics));
        }
        const workbook = await createAnalyticsWorkbook(analytics);
        res.attachment(`saigonphoenix-analytics-${stamp}.xlsx`);
        return res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(workbook);
    } catch (error) { next(error); }
});

module.exports = router;
