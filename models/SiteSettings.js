const mongoose = require('mongoose');

const defaultAutoReplyTemplates = [
    'SaiGonPhoenix đã nhận được tin nhắn của bạn. Admin sẽ phản hồi ngay khi có thể nhé!',
    'Cảm ơn bạn đã liên hệ. Admin đang kiểm tra và sẽ trả lời bạn trong ít phút.',
    'Xin chào {ten}! Tin nhắn của bạn đã được ghi nhận, bạn vui lòng chờ admin một chút nhé.',
    'Admin có thể đang hỗ trợ một chuyến khác. Chúng tôi sẽ quay lại cuộc trò chuyện này sớm nhất có thể.',
    'SaiGonPhoenix đã nhận thông tin. Nếu cần gấp, bạn có thể để lại mã đơn và nội dung cần hỗ trợ.',
    'Cảm ơn bạn đã nhắn tin! Bạn cứ để lại đầy đủ thông tin, admin sẽ kiểm tra ngay khi online.',
    'Tin nhắn đã được lưu thành công. Admin sẽ phản hồi trực tiếp trong khung chat này.',
    'Chào bạn! Chúng tôi đã nhận được yêu cầu và đang sắp xếp người hỗ trợ.',
    'Bạn vui lòng chờ trong giây lát nhé, admin sẽ kiểm tra chuyến và phản hồi sớm.',
    'Cảm ơn bạn đã lựa chọn SaiGonPhoenix. Yêu cầu của bạn đang được tiếp nhận.',
    'Hệ thống đã chuyển tin nhắn đến admin. Bạn không cần gửi lại, chúng tôi sẽ trả lời sớm nhất.',
    'Admin chưa thể phản hồi ngay lúc này nhưng tin nhắn của bạn đã được lưu đầy đủ.'
];

const siteSettingsSchema = new mongoose.Schema({
    key: { type: String, unique: true, default: 'support-contact' },
    hotline: { type: String, trim: true, default: '' },
    zaloPhone: { type: String, trim: true, default: '' },
    zaloUrl: { type: String, trim: true, default: '' },
    supportHours: { type: String, trim: true, default: 'Hỗ trợ 24/7' },
    wechat: { type: String, trim: true, default: '' },
    whatsapp: { type: String, trim: true, default: '' },
    facebook: { type: String, trim: true, default: '' },
    tiktok: { type: String, trim: true, default: '' },
    line: { type: String, trim: true, default: '' },
    viber: { type: String, trim: true, default: '' },
    x: { type: String, trim: true, default: '' },
    instagram: { type: String, trim: true, default: '' },
    telegram: { type: String, trim: true, default: '' }
    ,autoReplyEnabled: { type: Boolean, default: true }
    ,autoReplyTemplates: { type: [String], default: defaultAutoReplyTemplates }
}, { timestamps: true });

siteSettingsSchema.statics.defaultAutoReplyTemplates = defaultAutoReplyTemplates;

module.exports = mongoose.model('SiteSettings', siteSettingsSchema);
