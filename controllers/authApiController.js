const User = require('../models/User');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key';

exports.register = async (req, res, next) => {
    try {
        const { username, email, phone, password, confirmPassword } = req.body;
        if (!username || !email || !phone || !password) {
            return res.status(400).json({ error: 'Vui lòng nhập đầy đủ thông tin.' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự.' });
        }
        if (password !== confirmPassword) {
            return res.status(400).json({ error: 'Mật khẩu xác nhận không khớp.' });
        }
        if (await User.findOne({ email: email.toLowerCase() })) {
            return res.status(409).json({ error: 'Email đã được sử dụng.' });
        }

        const user = await User.create({
            username: username.trim(),
            email: email.toLowerCase().trim(),
            phone: phone.trim(),
            password
        });

        res.status(201).json({
            message: 'Đăng ký thành công!',
            userId: user._id
        });
    } catch (error) { next(error); }
};

exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email: email?.toLowerCase().trim() });

        if (!user || !user.isActive || !(await user.comparePassword(password || ''))) {
            return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng.' });
        }

        const token = jwt.sign(
            { userId: user._id, role: user.role, username: user.username },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            message: `Xin chào ${user.username}!`,
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) { next(error); }
};

exports.logout = (req, res) => {
    res.json({ message: 'Đã đăng xuất thành công.' });
};

exports.getMe = async (req, res, next) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng.' });
        res.json(user);
    } catch (error) { next(error); }
};

exports.isAuthenticated = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Bạn cần đăng nhập để tiếp tục.' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        req.userRole = decoded.role;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Phiên làm việc hết hạn, vui lòng đăng nhập lại.' });
    }
};

exports.isAdmin = (req, res, next) => {
    if (req.userRole !== 'admin') {
        return res.status(403).json({ error: 'Quyền truy cập bị từ chối. Yêu cầu quyền Admin.' });
    }
    next();
};

exports.isDriver = (req, res, next) => {
    if (req.userRole !== 'driver' && req.userRole !== 'admin') {
        return res.status(403).json({ error: 'Quyền truy cập bị từ chối. Yêu cầu quyền Tài xế.' });
    }
    next();
};
