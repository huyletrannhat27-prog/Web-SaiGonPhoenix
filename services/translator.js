const SUPPORTED_LANGUAGES = new Set(['vi','en','zh-CN','ko','ja','th','fr','de','es','pt','ru','it','nl','ar','hi','id','ms','tl','km','lo']);

function normalizeLanguage(language) {
    const value = String(language || '').trim();
    const aliases = { zh: 'zh-CN', 'zh-cn': 'zh-CN', 'zh-hans': 'zh-CN', fil: 'tl' };
    return aliases[value.toLowerCase()] || value;
}

function detectLanguage(text) {
    const value = String(text || '');
    if (/[가-힯]/u.test(value)) return 'ko';
    if (/[぀-ヿ]/u.test(value)) return 'ja';
    if (/[一-鿿]/u.test(value)) return 'zh-CN';
    if (/[฀-๿]/u.test(value)) return 'th';
    if (/[ក-៿]/u.test(value)) return 'km';
    if (/[຀-໿]/u.test(value)) return 'lo';
    if (/[؀-ۿ]/u.test(value)) return 'ar';
    if (/[ऀ-ॿ]/u.test(value)) return 'hi';
    if (/[ăâđêôơưĂÂĐÊÔƠƯ]|[àáạảãèéẹẻẽìíịỉĩòóọỏõùúụủũỳýỵỷỹ]/iu.test(value)) return 'vi';
    return 'en';
}

function splitByUtf8Bytes(text, maximum = 450) {
    const chunks = [];
    let current = '';
    for (const character of String(text || '')) {
        if (Buffer.byteLength(current + character, 'utf8') > maximum) { chunks.push(current); current = character; }
        else current += character;
    }
    if (current) chunks.push(current);
    return chunks;
}

async function translateWithLibre(text, source, target) {
    const endpoint = process.env.LIBRETRANSLATE_URL?.trim();
    if (!endpoint) return null;
    const response = await fetch(`${endpoint.replace(/\/$/, '')}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text, source, target, format: 'text', ...(process.env.LIBRETRANSLATE_API_KEY ? { api_key: process.env.LIBRETRANSLATE_API_KEY } : {}) }),
        signal: AbortSignal.timeout(15000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.translatedText) throw new Error(data.error || 'Máy chủ LibreTranslate không phản hồi.');
    return { text: data.translatedText, provider: 'LibreTranslate' };
}

async function translateWithMyMemory(text, source, target) {
    const chunks = splitByUtf8Bytes(text);
    const translated = [];
    for (const chunk of chunks) {
        const params = new URLSearchParams({ q: chunk, langpair: `${source}|${target}`, mt: '1' });
        if (process.env.TRANSLATION_CONTACT_EMAIL) params.set('de', process.env.TRANSLATION_CONTACT_EMAIL);
        const response = await fetch(`https://api.mymemory.translated.net/get?${params}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || Number(data.responseStatus) !== 200 || !data.responseData?.translatedText) throw new Error(data.responseDetails || 'Dịch vụ dịch dự phòng không phản hồi.');
        translated.push(data.responseData.translatedText);
    }
    return { text: translated.join(''), provider: 'MyMemory' };
}

async function translateText(text, sourceLanguage, targetLanguage) {
    const target = normalizeLanguage(targetLanguage);
    const source = normalizeLanguage(sourceLanguage) || detectLanguage(text);
    if (!SUPPORTED_LANGUAGES.has(target)) throw Object.assign(new Error('Ngôn ngữ dịch chưa được hỗ trợ.'), { status: 400 });
    if (!String(text || '').trim()) throw Object.assign(new Error('Tin nhắn không có nội dung để dịch.'), { status: 400 });
    if (source === target) return { text, source, target, provider: 'Original' };
    try {
        const libreResult = await translateWithLibre(text, source, target);
        if (libreResult) return { ...libreResult, source, target };
    } catch (error) { console.warn('LibreTranslate:', error.message); }
    return { ...(await translateWithMyMemory(text, source, target)), source, target };
}

module.exports = { SUPPORTED_LANGUAGES, normalizeLanguage, detectLanguage, translateText };
