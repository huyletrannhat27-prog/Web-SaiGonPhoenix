const router = require('express').Router();
const path = require('path');
const fs = require('fs/promises');
const mongoose = require('mongoose');
const auth = require('../controllers/authController');
const upload = require('../config/chatUpload');
const ChatMessage = require('../models/ChatMessage');
const Booking = require('../models/Booking');
const User = require('../models/User');
const SiteSettings = require('../models/SiteSettings');
const { getUnansweredChatCounts } = require('../services/chatStatus');
const { SUPPORTED_LANGUAGES, normalizeLanguage, detectLanguage, translateText } = require('../services/translator');

function scheduleAutoReply({ userId, adminId, triggerCreatedAt }) {
    const delay = Math.max(Number(process.env.AUTO_REPLY_DELAY_MS || 3500), 500);
    const timer = setTimeout(async () => {
        try {
            const settings = await SiteSettings.findOne({ key: 'support-contact' }).lean();
            if (settings?.autoReplyEnabled === false) return;
            const manualReply = await ChatMessage.exists({ sender: adminId, recipient: userId, booking: null, isAutomated: { $ne: true }, createdAt: { $gt: triggerCreatedAt } });
            if (manualReply) return;
            const recentAutoReply = await ChatMessage.exists({ sender: adminId, recipient: userId, booking: null, isAutomated: true, createdAt: { $gt: new Date(Date.now() - 10 * 60 * 1000) } });
            if (recentAutoReply) return;
            const templates = settings?.autoReplyTemplates?.filter(Boolean)?.length ? settings.autoReplyTemplates.filter(Boolean) : SiteSettings.defaultAutoReplyTemplates;
            const user = await User.findById(userId).select('username');
            const selected = templates[Math.floor(Math.random() * templates.length)].replace(/\{ten\}/gi, user?.username || 'bạn');
            await ChatMessage.create({ sender: adminId, recipient: userId, booking: null, text: selected, language: detectLanguage(selected), isAutomated: true });
        } catch (error) { console.error('Auto reply:', error.message); }
    }, delay);
    timer.unref?.();
}

async function resolveConversation(req) {
    const currentId = String(req.session.userId);
    const role = req.session.role;
    const bookingId = req.body.bookingId || req.query.bookingId || null;
    let partner;
    let booking = null;

    if (role === 'admin') {
        const userId = req.body.userId || req.query.userId;
        if (!mongoose.isValidObjectId(userId)) throw Object.assign(new Error('Vui lòng chọn khách hàng cần chat.'), { status: 400 });
        partner = await User.findOne({ _id: userId, role: 'user', isActive: true });
    } else if (role === 'driver') {
        booking = await Booking.findOne({ _id: bookingId, status: 'confirmed' }).populate('vehicle');
        if (!booking || String(booking.vehicle?.driver) !== currentId) throw Object.assign(new Error('Bạn không được phân công chuyến này.'), { status: 403 });
        partner = await User.findById(booking.user);
    } else if ((req.body.target || req.query.target) === 'driver') {
        booking = await Booking.findOne({ _id: bookingId, user: currentId, status: 'confirmed' }).populate('vehicle');
        if (!booking?.vehicle?.driver) throw Object.assign(new Error('Chuyến chưa có tài xế để chat.'), { status: 400 });
        partner = await User.findOne({ _id: booking.vehicle.driver, role: 'driver', isActive: true });
    } else {
        partner = await User.findOne({ role: 'admin', isActive: true }).sort({ createdAt: 1 });
    }

    if (!partner) throw Object.assign(new Error('Chưa tìm thấy người nhận tin nhắn.'), { status: 404 });
    return { partner, booking, bookingId: booking?._id || null };
}

function serialize(message, currentId) {
    return {
        id: message._id,
        text: message.text,
        mine: String(message.sender?._id || message.sender) === String(currentId),
        senderName: message.sender?.username || 'Người dùng',
        senderRole: message.sender?.role || '',
        automated: Boolean(message.isAutomated),
        language: message.language || detectLanguage(message.text),
        createdAt: message.createdAt,
        mediaType: message.media?.mimeType || '',
        mediaUrl: message.media?.filename ? `/chat-media/${message._id}` : ''
    };
}

router.get('/api/chat/unanswered', auth.isAdmin, async (req, res, next) => {
    try { res.json(await getUnansweredChatCounts()); }
    catch (error) { next(error); }
});

router.get('/api/chat/messages', auth.isAuthenticated, async (req, res, next) => {
    try {
        const { partner, bookingId } = await resolveConversation(req);
        const currentId = req.session.userId;
        const pair = { $or: [{ sender: currentId, recipient: partner._id }, { sender: partner._id, recipient: currentId }] };
        if (bookingId) pair.booking = bookingId;
        else pair.booking = null;
        const messages = await ChatMessage.find(pair).populate('sender', 'username role').sort({ createdAt: 1 }).limit(150);
        await ChatMessage.updateMany({ recipient: currentId, sender: partner._id, readAt: null, ...(bookingId ? { booking: bookingId } : { booking: null }) }, { $set: { readAt: new Date() } });
        res.json({ partner: { id: partner._id, name: partner.username, role: partner.role }, messages: messages.map(item => serialize(item, currentId)) });
    } catch (error) { next(error); }
});

router.post('/api/chat/messages', auth.isAuthenticated, upload.single('media'), async (req, res, next) => {
    try {
        const text = req.body.text?.trim() || '';
        if (!text && !req.file) return res.status(400).json({ error: 'Vui lòng nhập tin nhắn hoặc chọn ảnh/video.' });
        const { partner, bookingId } = await resolveConversation(req);
        const message = await ChatMessage.create({
            sender: req.session.userId,
            recipient: partner._id,
            booking: bookingId,
            text,
            language: SUPPORTED_LANGUAGES.has(normalizeLanguage(req.body.language)) ? normalizeLanguage(req.body.language) : detectLanguage(text),
            media: req.file ? { filename: req.file.filename, originalName: req.file.originalname, mimeType: req.file.mimetype, size: req.file.size } : undefined
        });
        await message.populate('sender', 'username role');
        if (req.session.role === 'user' && (req.body.target || 'admin') !== 'driver') scheduleAutoReply({ userId: req.session.userId, adminId: partner._id, triggerCreatedAt: message.createdAt });
        res.status(201).json(serialize(message, req.session.userId));
    } catch (error) {
        if (req.file) await fs.unlink(req.file.path).catch(() => {});
        next(error);
    }
});

router.post('/api/chat/messages/:id/translate', auth.isAuthenticated, async (req, res, next) => {
    try {
        const target = normalizeLanguage(req.body.targetLanguage);
        if (!SUPPORTED_LANGUAGES.has(target)) return res.status(400).json({ error: 'Ngôn ngữ dịch chưa hợp lệ.' });
        const message = await ChatMessage.findById(req.params.id);
        if (!message || ![String(message.sender), String(message.recipient)].includes(String(req.session.userId))) return res.sendStatus(404);
        if (!message.text?.trim()) return res.status(400).json({ error: 'Tin nhắn này chỉ có ảnh/video nên không có nội dung để dịch.' });
        const cached = message.translations?.find(item => item.language === target);
        if (cached) return res.json({ text: cached.text, source: message.language || detectLanguage(message.text), target, provider: cached.provider, cached: true });
        const result = await translateText(message.text, message.language || detectLanguage(message.text), target);
        if (result.provider !== 'Original') {
            message.translations.push({ language: target, text: result.text, provider: result.provider });
            await message.save();
        }
        res.json({ ...result, cached: false });
    } catch (error) { next(error); }
});

router.get('/chat-media/:id', auth.isAuthenticated, async (req, res, next) => {
    try {
        const message = await ChatMessage.findById(req.params.id);
        if (!message?.media?.filename || ![String(message.sender), String(message.recipient)].includes(String(req.session.userId))) return res.sendStatus(404);
        const root = path.resolve(__dirname, '..', 'uploads', 'chat');
        const filePath = path.resolve(root, message.media.filename);
        if (!filePath.startsWith(`${root}${path.sep}`)) return res.sendStatus(400);
        res.type(message.media.mimeType).sendFile(filePath);
    } catch (error) { next(error); }
});

module.exports = router;
