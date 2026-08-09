const User = require('../models/User');
const crypto = require('crypto');
const { sendPasswordResetEmail } = require('../config/mailer');

exports.showRegister = (req, res) => req.session.userId ? res.redirect('/dashboard') : res.render('register', { title: 'Đăng ký', error: null, form: {} });

exports.register = async (req, res, next) => {
    try {
        const { username, email, phone, password, confirmPassword } = req.body;
        const form = { username: username?.trim(), email: email?.trim(), phone: phone?.trim() };
        if (!username || !email || !phone || !password) return res.status(400).render('register', { title: 'Đăng ký', error: 'Vui lòng nhập đầy đủ thông tin.', form });
        if (password.length < 6) return res.status(400).render('register', { title: 'Đăng ký', error: 'Mật khẩu phải có ít nhất 6 ký tự.', form });
        if (password !== confirmPassword) return res.status(400).render('register', { title: 'Đăng ký', error: 'Mật khẩu xác nhận không khớp.', form });
        if (await User.findOne({ email: email.toLowerCase() })) return res.status(409).render('register', { title: 'Đăng ký', error: 'Email đã được sử dụng.', form });
        await User.create({ username: username.trim(), email: email.toLowerCase().trim(), phone: phone.trim(), password });
        req.flash('success', 'Đăng ký thành công. Bạn có thể đăng nhập ngay.');
        res.redirect('/login');
    } catch (error) { next(error); }
};

exports.showLogin = (req, res) => req.session.userId ? res.redirect('/dashboard') : res.render('login', { title: 'Đăng nhập', error: null, form: {} });

exports.login = async (req, res, next) => {
    try {
        const user = await User.findOne({ email: req.body.email?.toLowerCase().trim() });
        const form = { email: req.body.email?.trim() || '' };
        if (!user || !user.isActive || !await user.comparePassword(req.body.password || '')) return res.status(401).render('login', { title: 'Đăng nhập', error: 'Email hoặc mật khẩu không đúng.', form });
        req.session.userId = user._id.toString();
        req.session.username = user.username;
        req.session.email = user.email;
        req.session.role = user.role;
        req.flash('success', `Xin chào ${user.username}!`);
        res.redirect(user.role === 'admin' ? '/admin' : user.role === 'driver' ? '/driver' : '/dashboard');
    } catch (error) { next(error); }
};

exports.logout = (req, res, next) => req.session.destroy(error => error ? next(error) : res.redirect('/'));
exports.showForgotPassword = (req, res) => req.session.userId ? res.redirect('/dashboard') : res.render('forgot-password', { title: 'Quên mật khẩu', error: null, sent: false, developmentResetUrl: null, form: {} });

exports.forgotPassword = async (req, res, next) => {
    try {
        const email = req.body.email?.toLowerCase().trim();
        if (!email) return res.status(400).render('forgot-password', { title: 'Quên mật khẩu', error: 'Vui lòng nhập email đã đăng ký.', sent: false, developmentResetUrl: null, form: { email: '' } });
        const user = await User.findOne({ email, isActive: true }).select('+resetPasswordToken +resetPasswordExpires');
        let developmentResetUrl = null;
        if (user) {
            const token = crypto.randomBytes(32).toString('hex');
            user.resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex');
            user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
            await user.save({ validateBeforeSave: false });
            const baseUrl = (process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
            const resetUrl = `${baseUrl}/reset-password/${token}`;
            try {
                const result = await sendPasswordResetEmail({ to: user.email, username: user.username, resetUrl });
                if (result.development) developmentResetUrl = resetUrl;
            } catch (mailError) {
                user.resetPasswordToken = undefined;
                user.resetPasswordExpires = undefined;
                await user.save({ validateBeforeSave: false });
                console.error('Không gửi được email đặt lại mật khẩu:', mailError.message);
            }
        }
        res.render('forgot-password', { title: 'Kiểm tra email', error: null, sent: true, developmentResetUrl, form: { email } });
    } catch (error) { next(error); }
};

exports.showResetPassword = async (req, res, next) => {
    try {
        const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
        const user = await User.findOne({ resetPasswordToken: hashedToken, resetPasswordExpires: { $gt: new Date() } }).select('+resetPasswordToken +resetPasswordExpires');
        if (!user) return res.status(400).render('reset-password', { title: 'Liên kết không hợp lệ', error: 'Liên kết đã hết hạn hoặc đã được sử dụng.', token: null });
        res.render('reset-password', { title: 'Đặt lại mật khẩu', error: null, token: req.params.token });
    } catch (error) { next(error); }
};

exports.resetPassword = async (req, res, next) => {
    try {
        const { password, confirmPassword } = req.body;
        if (!password || password.length < 6 || password !== confirmPassword) {
            return res.status(400).render('reset-password', { title: 'Đặt lại mật khẩu', error: password !== confirmPassword ? 'Mật khẩu xác nhận không khớp.' : 'Mật khẩu phải có ít nhất 6 ký tự.', token: req.params.token });
        }
        const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
        const user = await User.findOne({ resetPasswordToken: hashedToken, resetPasswordExpires: { $gt: new Date() } }).select('+resetPasswordToken +resetPasswordExpires');
        if (!user) return res.status(400).render('reset-password', { title: 'Liên kết không hợp lệ', error: 'Liên kết đã hết hạn hoặc đã được sử dụng.', token: null });
        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();
        req.flash('success', 'Mật khẩu đã được thay đổi. Bạn có thể đăng nhập ngay.');
        res.redirect('/login');
    } catch (error) { next(error); }
};
exports.isAuthenticated = (req, res, next) => req.session.userId ? next() : (req.flash('error', 'Vui lòng đăng nhập để tiếp tục.'), res.redirect('/login'));
exports.isAdmin = (req, res, next) => req.session.userId && req.session.role === 'admin' ? next() : res.status(403).render('error', { title: 'Không có quyền truy cập', error: { message: 'Trang này chỉ dành cho quản trị viên.' } });
exports.isDriver = (req, res, next) => req.session.userId && req.session.role === 'driver' ? next() : res.status(403).render('error', { title: 'Không có quyền truy cập', error: { message: 'Trang này chỉ dành cho tài xế.' } });
