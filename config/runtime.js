// Hosted services must use their own environment, never a developer's .env file.
if (process.env.NODE_ENV !== 'production' && !process.env.RENDER) require('dotenv').config();

function mongoUri() {
    const configured = process.env.MONGODB_URI?.trim();
    if (!configured && (process.env.NODE_ENV === 'production' || process.env.RENDER)) {
        throw Object.assign(new Error('Thiếu MONGODB_URI. Hãy cấu hình kết nối Atlas trong Render → Environment.'), { code: 'MONGODB_CONFIG' });
    }
    const value = configured || 'mongodb://127.0.0.1:27017/SaiGonPhoenix';
    if (!/^mongodb(?:\+srv)?:\/\//.test(value) || /[<>\s]/.test(value)) {
        throw Object.assign(new Error('MONGODB_URI chưa hợp lệ. Sao chép URI từ Atlas → Connect → Drivers và thay thông tin tài khoản database.'), { code: 'MONGODB_CONFIG' });
    }
    return value;
}

function databaseErrorMessage(error) {
    // Do not print raw driver errors: malformed URIs can contain passwords.
    const code = error?.code || error?.cause?.code;
    const message = String(error?.message || '');
    if (code === 'MONGODB_CONFIG') return message;
    if (code === 'ENOTFOUND' || code === 'ENODATA' || /querySrv.*(?:ENOTFOUND|ENODATA)/i.test(message)) {
        return 'Không tìm thấy bản ghi DNS SRV của MongoDB Atlas. Kiểm tra hostname trong MONGODB_URI và cluster có đang hoạt động; lấy lại URI từ Atlas → Connect → Drivers. Không thể sửa hostname này bằng cách đổi PORT.';
    }
    if (/querySrv|queryTxt/.test(message) || ['ECONNREFUSED', 'ETIMEOUT', 'EAI_AGAIN'].includes(code)) {
        return 'Không kết nối được MongoDB hoặc không phân giải được DNS Atlas. Kiểm tra URI, trạng thái cluster và DNS/mạng của môi trường triển khai.';
    }
    if (code === 18 || /authentication failed|bad auth/i.test(message)) {
        return 'MongoDB từ chối đăng nhập. Kiểm tra database user/password trong MONGODB_URI; ký tự đặc biệt của tài khoản phải được mã hóa URL.';
    }
    if (error?.name === 'MongoParseError') return 'MONGODB_URI sai định dạng. Hãy sao chép lại connection string từ Atlas; không ghi mật khẩu vào log hoặc Git.';
    return 'Không thể khởi tạo MongoDB. Kiểm tra URI, trạng thái Atlas, Database Access và Network Access (IP outbound của Render).';
}
module.exports = { mongoUri, databaseErrorMessage };
