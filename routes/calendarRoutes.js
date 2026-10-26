const router = require('express').Router();
const crypto = require('crypto');
const CalendarEvent = require('../models/CalendarEvent');

const invalid = message => Object.assign(new Error(message), { status: 400 });
function parseEvent(body) {
    const text = (key, max, required = false) => {
        if (body[key] !== undefined && typeof body[key] !== 'string') throw invalid('Nội dung không hợp lệ.');
        const value = (body[key] || '').trim();
        if ((required && !value) || value.length > max) throw invalid('Vui lòng kiểm tra tiêu đề và độ dài nội dung.');
        return value;
    };
    const startsAt = parseDate(body.startsAt), endsAt = parseDate(body.endsAt);
    if (endsAt <= startsAt || endsAt - startsAt > 366 * 86400000) throw invalid('Giờ kết thúc phải sau giờ bắt đầu; lịch hẹn không được dài quá một năm.');
    if (!['personal', 'work', 'travel'].includes(body.category)) throw invalid('Nhóm lịch không hợp lệ.');
    if (typeof body.allDay !== 'boolean') throw invalid('Trạng thái cả ngày không hợp lệ.');
    if (body.allDay && [startsAt, endsAt].some(date => (date.getTime() + 7 * 3600000) % 86400000 !== 0)) throw invalid('Lịch cả ngày phải bắt đầu và kết thúc lúc 00:00 theo giờ Việt Nam.');
    return { title: text('title', 120, true), notes: text('notes', 3000), location: text('location', 250), startsAt, endsAt, allDay: body.allDay, category: body.category };
}
function parseDate(value, minimumYear = 2000, maximumYear = 2100) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) throw invalid('Ngày giờ không hợp lệ.');
    const date = new Date(value);
    const day = value.slice(0, 10);
    const dayDate = new Date(`${day}T00:00:00Z`);
    if (!Number.isFinite(dayDate.getTime()) || dayDate.toISOString().slice(0, 10) !== day) throw invalid('Ngày không tồn tại.');
    const vietnamYear = new Date(date.getTime() + 7 * 3600000).getUTCFullYear();
    if (!Number.isFinite(date.getTime()) || Number(value.slice(11, 13)) > 23 || Number(value.slice(14, 16)) > 59 || vietnamYear < minimumYear || vietnamYear > maximumYear) throw invalid('Ngày giờ phải nằm trong khoảng năm 2000–2100.');
    return date;
}
router.get('/calendar', (req, res) => {
    if (req.session.userId && !req.session.calendarToken) req.session.calendarToken = crypto.randomBytes(32).toString('hex');
    res.render('calendar', { title: 'Lịch của tôi', calendarToken: req.session.calendarToken || '' });
});
router.use('/api/calendar', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!req.session.userId) return res.status(401).json({ error: 'Vui lòng đăng nhập để quản lý lịch của bạn.' });
    if (req.method !== 'GET' && (!req.session.calendarToken || req.get('X-Calendar-Token') !== req.session.calendarToken)) return res.status(403).json({ error: 'Phiên làm việc đã thay đổi. Vui lòng tải lại trang.' });
    next();
});
router.get('/api/calendar/events', async (req, res, next) => {
    try {
        const start = parseDate(req.query.start, 1999, 2101), end = parseDate(req.query.end, 1999, 2101);
        if (end <= start || end - start > 62 * 86400000) throw invalid('Khoảng xem lịch không được vượt quá 62 ngày.');
        const events = await CalendarEvent.find({ owner: req.session.userId, startsAt: { $lt: end }, endsAt: { $gt: start } }).sort({ startsAt: 1, _id: 1 }).lean();
        res.json({ events });
    } catch (error) { next(error); }
});
router.post('/api/calendar/events', async (req, res, next) => {
    try { res.status(201).json({ event: await CalendarEvent.create({ ...parseEvent(req.body), owner: req.session.userId }) }); }
    catch (error) { next(error); }
});
router.param('eventId', (req, res, next, value) => /^[a-f\d]{24}$/i.test(value) ? next() : res.status(400).json({ error: 'Mã lịch hẹn không hợp lệ.' }));
router.put('/api/calendar/events/:eventId', async (req, res, next) => {
    try {
        const event = await CalendarEvent.findOneAndUpdate({ _id: req.params.eventId, owner: req.session.userId }, { $set: parseEvent(req.body) }, { new: true, runValidators: true });
        if (!event) return res.status(404).json({ error: 'Lịch hẹn không còn tồn tại.' });
        res.json({ event });
    } catch (error) { next(error); }
});
router.delete('/api/calendar/events/:eventId', async (req, res, next) => {
    try {
        const event = await CalendarEvent.findOneAndDelete({ _id: req.params.eventId, owner: req.session.userId });
        if (!event) return res.status(404).json({ error: 'Lịch hẹn không còn tồn tại.' });
        res.json({ deleted: true });
    } catch (error) { next(error); }
});
router.use('/api/calendar', (error, req, res, next) => {
    if (error.status === 400) return res.status(400).json({ error: error.message });
    next(error);
});
module.exports = router;
