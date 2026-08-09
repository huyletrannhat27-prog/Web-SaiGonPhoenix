const nodemailer = require('nodemailer');

const escapeHtml = value => String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);

function createTransport() {
    if (!process.env.SMTP_HOST) return null;
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
        auth: process.env.SMTP_USER ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        } : undefined
    });
}

exports.sendPasswordResetEmail = async ({ to, username, resetUrl }) => {
    const transport = createTransport();
    if (!transport) {
        if (process.env.NODE_ENV === 'production') throw new Error('SMTP chưa được cấu hình.');
        console.log(`[DEV] Liên kết đặt lại mật khẩu cho ${to}: ${resetUrl}`);
        return { development: true };
    }

    const safeUsername = escapeHtml(username);
    const safeResetUrl = escapeHtml(resetUrl);
    await transport.sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER || 'SaiGonPhoenix <no-reply@saigonphoenix.vn>',
        to,
        subject: 'Đặt lại mật khẩu SaiGonPhoenix',
        text: `Xin chào ${username},\n\nBạn vừa yêu cầu đặt lại mật khẩu. Mở liên kết sau trong vòng 15 phút:\n${resetUrl}\n\nNếu không phải bạn yêu cầu, hãy bỏ qua email này.`,
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#172033"><h2 style="color:#e43d56">SaiGonPhoenix</h2><p>Xin chào <strong>${safeUsername}</strong>,</p><p>Bạn vừa yêu cầu đặt lại mật khẩu. Liên kết chỉ có hiệu lực trong 15 phút.</p><p><a href="${safeResetUrl}" style="display:inline-block;padding:13px 22px;background:#e43d56;color:#fff;text-decoration:none;border-radius:10px;font-weight:700">Đặt lại mật khẩu</a></p><p style="color:#667085;font-size:13px">Nếu không phải bạn yêu cầu, hãy bỏ qua email này.</p></div>`
    });
    return { development: false };
};
