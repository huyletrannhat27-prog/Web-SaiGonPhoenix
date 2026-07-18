const User = require('../models/User');

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

exports.showLogin = (req, res) => req.session.userId ? res.redirect('/dashboard') : res.render('login', { title: 'Đăng nhập', error: null });

exports.login = async (req, res, next) => {
    try {
        const user = await User.findOne({ email: req.body.email?.toLowerCase().trim() });
        if (!user || !user.isActive || !await user.comparePassword(req.body.password || '')) return res.status(401).render('login', { title: 'Đăng nhập', error: 'Email hoặc mật khẩu không đúng.' });
        req.session.userId = user._id.toString();
        req.session.username = user.username;
        req.session.email = user.email;
        req.session.role = user.role;
        req.flash('success', `Xin chào ${user.username}!`);
        res.redirect(user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (error) { next(error); }
};

exports.logout = (req, res, next) => req.session.destroy(error => error ? next(error) : res.redirect('/'));
exports.isAuthenticated = (req, res, next) => req.session.userId ? next() : (req.flash('error', 'Vui lòng đăng nhập để tiếp tục.'), res.redirect('/login'));
exports.isAdmin = (req, res, next) => req.session.userId && req.session.role === 'admin' ? next() : res.status(403).render('error', { title: 'Không có quyền truy cập', error: { message: 'Trang này chỉ dành cho quản trị viên.' } });
