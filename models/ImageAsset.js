const mongoose = require('mongoose');

const imageAssetSchema = new mongoose.Schema({
    filename: { type: String, required: true, unique: true },
    originalName: { type: String, required: true },
    url: { type: String, required: true, unique: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true, min: 1 },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

module.exports = mongoose.model('ImageAsset', imageAssetSchema);
