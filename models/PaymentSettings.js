const mongoose = require('mongoose');

const paymentSettingsSchema = new mongoose.Schema({
    key: { type: String, unique: true, default: 'bank-transfer' },
    bankId: { type: String, trim: true, default: '' },
    bankName: { type: String, trim: true, default: '' },
    accountNo: { type: String, trim: true, default: '' },
    accountName: { type: String, trim: true, uppercase: true, default: '' },
    qrTemplate: { type: String, trim: true, default: 'compact2' }
}, { timestamps: true });

module.exports = mongoose.model('PaymentSettings', paymentSettingsSchema);
