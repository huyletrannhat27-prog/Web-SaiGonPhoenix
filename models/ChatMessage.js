const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null, index: true },
    text: { type: String, trim: true, maxlength: 2000, default: '' },
    media: {
        filename: { type: String, default: '' },
        originalName: { type: String, default: '' },
        mimeType: { type: String, default: '' },
        size: { type: Number, default: 0 }
    },
    isAutomated: { type: Boolean, default: false },
    language: { type: String, trim: true, default: '' },
    translations: [{
        language: { type: String, required: true },
        text: { type: String, required: true, maxlength: 5000 },
        provider: { type: String, default: '' },
        createdAt: { type: Date, default: Date.now }
    }],
    readAt: Date
}, { timestamps: true });

chatMessageSchema.index({ sender: 1, recipient: 1, booking: 1, createdAt: 1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
