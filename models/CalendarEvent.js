const mongoose = require('mongoose');

const schema = new mongoose.Schema({
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    notes: { type: String, trim: true, maxlength: 3000, default: '' },
    location: { type: String, trim: true, maxlength: 250, default: '' },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    allDay: { type: Boolean, default: false },
    category: { type: String, enum: ['personal', 'work', 'travel'], default: 'personal' }
}, { timestamps: true });
schema.index({ owner: 1, startsAt: 1, endsAt: 1 });
module.exports = mongoose.model('CalendarEvent', schema);
