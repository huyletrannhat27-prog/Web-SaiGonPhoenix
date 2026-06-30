const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ===== MIDDLEWARE =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// ===== SESSION =====
app.use(session({
    secret: process.env.SESSION_SECRET || 'secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

// ===== FLASH =====
app.use(flash());

// ===== VIEW ENGINE =====
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ===== PASS DATA TO VIEWS =====
app.use((req, res, next) => {
    res.locals.flash = req.flash();
    res.locals.session = req.session;
    res.locals.currentPage = '';
    res.locals.title = 'SaiGonPhoenix';
    next();
});

// ===== ROUTES =====

// Trang chủ
app.get('/', (req, res) => {
    res.render('index');
});

// Giới thiệu
app.get('/about', (req, res) => {
    res.render('about');
});

// Đăng ký
app.get('/register', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/dashboard');
    }
    res.render('register', { error: null, success: null });
});

app.post('/register', (req, res) => {
    const { username, email, password, confirmPassword, phone } = req.body;
    
    if (password !== confirmPassword) {
        return res.render('register', { 
            error: 'Mật khẩu xác nhận không khớp', 
            success: null 
        });
    }
    
    req.flash('success', 'Đăng ký thành công! Vui lòng đăng nhập.');
    res.redirect('/login');
});

// Đăng nhập
app.get('/login', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/dashboard');
    }
    res.render('login', { error: null, success: null });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    
    // Demo account
    if (email === 'admin@saigonphoenix.com' && password === 'admin123') {
        req.session.userId = 'admin';
        req.session.username = 'admin';
        req.session.email = email;
        req.flash('success', 'Đăng nhập thành công!');
        return res.redirect('/dashboard');
    }
    
    res.render('login', { 
        error: 'Email hoặc mật khẩu không đúng', 
        success: null 
    });
});

// Đăng xuất
app.get('/logout', (req, res) => {
    req.session.destroy();
    req.flash('success', 'Đã đăng xuất thành công');
    res.redirect('/');
});

// Dashboard
app.get('/dashboard', (req, res) => {
    if (!req.session.userId) {
        req.flash('error', 'Vui lòng đăng nhập');
        return res.redirect('/login');
    }
    res.render('dashboard');
});

// Đặt xe
app.get('/booking', (req, res) => {
    if (!req.session.userId) {
        req.flash('error', 'Vui lòng đăng nhập để đặt xe');
        return res.redirect('/login');
    }
    res.render('booking');
});

app.post('/booking', (req, res) => {
    req.flash('success', 'Đặt xe thành công! Chúng tôi sẽ liên hệ với bạn sớm.');
    res.redirect('/dashboard');
});

// ===== 404 HANDLER =====
app.use((req, res) => {
    res.status(404).render('404', { 
        title: '404 - Không tìm thấy' 
    });
});

// ===== START SERVER =====
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📧 Demo: admin@saigonphoenix.com / admin123`);
});