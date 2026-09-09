const User = require('../models/User');

const PHONE_PATTERN = /^[0-9+().\s-]{8,25}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GENDERS = new Set(['', 'male', 'female', 'other']);

function text(value, maxLength) {
    return String(value || '').trim().slice(0, maxLength);
}

function profileForm(user) {
    const profile = user.profile || {};
    return {
        username: user.username || '', email: user.email || '', phone: user.phone || '',
        dateOfBirth: profile.dateOfBirth ? new Date(profile.dateOfBirth).toISOString().slice(0, 10) : '',
        gender: profile.gender || '', address: profile.address || '', city: profile.city || '', country: profile.country || '',
        emergencyContactName: profile.emergencyContactName || '', emergencyContactPhone: profile.emergencyContactPhone || ''
    };
}

function profileCompletion(form) {
    const fields = ['username', 'email', 'phone', 'dateOfBirth', 'gender', 'address', 'city', 'country', 'emergencyContactName', 'emergencyContactPhone'];
    return Math.round(fields.filter(key => String(form[key] || '').trim()).length / fields.length * 100);
}

function renderProfile(res, user, error = null) {
    const form = profileForm(user);
    return res.status(error ? 400 : 200).render('profile', { title: 'Tài khoản của tôi', user, form, completion: profileCompletion(form), error });
}

exports.showProfile = async (req, res, next) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user) return req.session.destroy(() => res.redirect('/login'));
        return renderProfile(res, user);
    } catch (error) { return next(error); }
};

exports.updateProfile = async (req, res, next) => {
    try {
        const user = await User.findById(req.session.userId).select('+password');
        if (!user) return req.session.destroy(() => res.redirect('/login'));

        const form = {
            username: text(req.body.username, 80), email: text(req.body.email, 120).toLowerCase(), phone: text(req.body.phone, 30),
            dateOfBirth: text(req.body.dateOfBirth, 10), gender: text(req.body.gender, 12), address: text(req.body.address, 250),
            city: text(req.body.city, 100), country: text(req.body.country, 100), emergencyContactName: text(req.body.emergencyContactName, 100),
            emergencyContactPhone: text(req.body.emergencyContactPhone, 30)
        };
        const renderError = message => res.status(400).render('profile', { title: 'Tài khoản của tôi', user: { ...user.toObject(), profile: form }, form, completion: profileCompletion(form), error: message });

        if (form.username.length < 2) return renderError('Họ tên cần có ít nhất 2 ký tự.');
        if (!EMAIL_PATTERN.test(form.email)) return renderError('Email chưa đúng định dạng.');
        if (!PHONE_PATTERN.test(form.phone)) return renderError('Số điện thoại chưa hợp lệ.');
        if (!GENDERS.has(form.gender)) return renderError('Giới tính không hợp lệ.');
        if (form.emergencyContactPhone && !PHONE_PATTERN.test(form.emergencyContactPhone)) return renderError('Số điện thoại liên hệ khẩn cấp chưa hợp lệ.');

        let dateOfBirth = null;
        if (form.dateOfBirth) {
            dateOfBirth = new Date(`${form.dateOfBirth}T00:00:00.000Z`);
            const earliest = new Date('1900-01-01T00:00:00.000Z');
            if (Number.isNaN(dateOfBirth.getTime()) || dateOfBirth < earliest || dateOfBirth > new Date()) return renderError('Ngày sinh chưa hợp lệ.');
        }

        const changingEmail = form.email !== user.email;
        if (changingEmail) {
            if (!req.body.currentPassword || !await user.comparePassword(req.body.currentPassword)) return renderError('Để đổi email, vui lòng nhập đúng mật khẩu hiện tại.');
            if (await User.exists({ _id: { $ne: user._id }, email: form.email })) return renderError('Email này đã được sử dụng bởi tài khoản khác.');
        }

        user.username = form.username;
        user.email = form.email;
        user.phone = form.phone;
        user.profile = {
            dateOfBirth, gender: form.gender, address: form.address, city: form.city, country: form.country,
            emergencyContactName: form.emergencyContactName, emergencyContactPhone: form.emergencyContactPhone
        };
        await user.save();
        req.session.username = user.username;
        req.session.email = user.email;
        req.flash('success', 'Thông tin tài khoản đã được cập nhật.');
        return res.redirect('/profile');
    } catch (error) { return next(error); }
};
