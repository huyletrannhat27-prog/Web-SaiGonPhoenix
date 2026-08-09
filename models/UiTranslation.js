const mongoose = require('mongoose');

const uiTranslationSchema = new mongoose.Schema({
    sourceHash: { type: String, required: true },
    sourceLanguage: { type: String, required: true },
    targetLanguage: { type: String, required: true },
    sourceText: { type: String, required: true, maxlength: 2000 },
    translatedText: { type: String, required: true, maxlength: 5000 },
    provider: { type: String, default: '' }
}, { timestamps: true });

uiTranslationSchema.index({ sourceHash: 1, sourceLanguage: 1, targetLanguage: 1 }, { unique: true });

module.exports = mongoose.model('UiTranslation', uiTranslationSchema);
