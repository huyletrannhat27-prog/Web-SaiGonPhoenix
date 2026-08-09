const router = require('express').Router();
const crypto = require('crypto');
const UiTranslation = require('../models/UiTranslation');
const { SUPPORTED_LANGUAGES, normalizeLanguage, translateText } = require('../services/translator');

async function runLimited(items, worker, concurrency = 3) {
    const results = new Array(items.length);
    let cursor = 0;
    async function run() {
        while (cursor < items.length) {
            const index = cursor++;
            results[index] = await worker(items[index]);
        }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
    return results;
}

router.post('/api/localization/translate', async (req, res, next) => {
    try {
        const targetLanguage = normalizeLanguage(req.body.targetLanguage);
        const rawItems = Array.isArray(req.body.items) ? req.body.items.slice(0, 30) : [];
        if (!SUPPORTED_LANGUAGES.has(targetLanguage) || !rawItems.length) return res.status(400).json({ error: 'Yêu cầu dịch giao diện chưa hợp lệ.' });
        const items = rawItems.map(item => ({
            id: String(item.id || '').slice(0, 120),
            text: String(item.text || '').trim().slice(0, 2000),
            sourceLanguage: SUPPORTED_LANGUAGES.has(normalizeLanguage(item.sourceLanguage)) ? normalizeLanguage(item.sourceLanguage) : 'vi'
        })).filter(item => item.id && item.text);
        if (items.reduce((total, item) => total + item.text.length, 0) > 10000) return res.status(413).json({ error: 'Nội dung dịch vượt giới hạn.' });

        const now = Date.now();
        if (!req.session.localizationWindow || now - req.session.localizationWindow.startedAt > 60000) req.session.localizationWindow = { startedAt: now, count: 0 };
        req.session.localizationWindow.count += items.length;
        if (req.session.localizationWindow.count > 150) return res.status(429).json({ error: 'Đang dịch quá nhiều nội dung. Vui lòng thử lại sau một phút.' });

        const translations = await runLimited(items, async item => {
            const sourceHash = crypto.createHash('sha256').update(item.text).digest('hex');
            const cached = await UiTranslation.findOne({ sourceHash, sourceLanguage: item.sourceLanguage, targetLanguage }).lean();
            if (cached) return { id: item.id, text: cached.translatedText, provider: cached.provider, cached: true };
            try {
                const result = await translateText(item.text, item.sourceLanguage, targetLanguage);
                try {
                    await UiTranslation.findOneAndUpdate(
                        { sourceHash, sourceLanguage: item.sourceLanguage, targetLanguage },
                        { sourceText: item.text, translatedText: result.text, provider: result.provider },
                        { upsert: true, runValidators: true }
                    );
                } catch (error) { if (error.code !== 11000) throw error; }
                return { id: item.id, text: result.text, provider: result.provider, cached: false };
            } catch (error) { return { id: item.id, error: error.message }; }
        });
        res.json({ targetLanguage, translations });
    } catch (error) { next(error); }
});

module.exports = router;
