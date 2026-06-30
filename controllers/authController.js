const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Hiển thị trang đăng ký
exports.showRegister = (req, res) => {
    if (req.session.userId) {
        return res.redirect('/dashboard');
    }
    res.render('register', { error: null, success: null });
};

// Xử lý đăng ký
exports.register = async (req, res) => {
    try {
        const { username, email, password, confirmPassword, phone } = req.body;

        // Kiểm tra password
        if (password !== confirmPassword) {
            return res.render('register', { 
                error: 'Mật khẩu xác nhận không khớp', 
                success: null 
            });
        }

        // Kiểm tra user đã tồn tại
        const existingUser = await User.findOne({ 
            $or: [{ email }, { username }] 
        });
        
        if (existingUser) {
            return res.render('register', { 
                error: 'Tên đăng nhập hoặc email đã tồn tại', 
                success: null 
            });
        }

        // Tạo user mới
        const user = new User({ 
            username, 
            email, 
            password, 
            phone 
        });
        await user.save();

        res.render('login', { 
            error: null, 
            success: 'Đăng ký thành công! Vui lòng đăng nhập.' 
        });
    } catch (error) {
        console.error(error);
        res.render('register', { 
            error: 'Đăng ký thất bại: ' + error.message, 
            success: null 
        });
    }
};

// Hiển thị trang đăng nhập
exports.showLogin = (req, res) => {
    if (req.session.userId) {
        return res.redirect('/dashboard');
    }
    res.render('login', { error: null, success: null });
};

// Xử lý đăng nhập
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Tìm user
        const user = await User.findOne({ email });
        if (!user) {
            return res.render('login', { 
                error: 'Email hoặc mật khẩu không đúng', 
                success: null 
            });
        }

        // Kiểm tra password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.render('login', { 
                error: 'Email hoặc mật khẩu không đúng', 
                success: null 
            });
        }

        // Tạo token
        const token = jwt.sign(
            { userId: user._id, email: user.email }, 
            process.env.JWT_SECRET, 
            { expiresIn: '7d' }
        );

        // Lưu session
        req.session.token = token;
        req.session.userId = user._id;
        req.session.username = user.username;
        req.session.email = user.email;

        req.flash('success', 'Đăng nhập thành công!');
        res.redirect('/dashboard');
    } catch (error) {
        console.error(error);
        res.render('login', { 
            error: 'Đăng nhập thất bại: ' + error.message, 
            success: null 
        });
    }
};

// Xử lý đăng xuất
exports.logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error(err);
        }
        res.redirect('/');
    });
};

// Middleware kiểm tra đăng nhập
exports.isAuthenticated = (req, res, next) => {
    if (req.session && req.session.userId) {
        return next();
    }
    req.flash('error', 'Vui lòng đăng nhập để tiếp tục');
    res.redirect('/login');
};