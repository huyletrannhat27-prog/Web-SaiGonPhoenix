# SaiGonPhoenix

Website đặt xe đưa đón sân bay bằng Node.js, Express, EJS và MongoDB.

## Chạy dự án

1. Cài Node.js 18+ và MongoDB Community Server.
2. Sao chép `.env.example` thành `.env`, đổi các secret và tài khoản admin.
3. Chạy `npm install` rồi `npm run dev`.
4. Mở `http://localhost:3000`.

Lần chạy đầu hệ thống tự tạo tài khoản admin và bốn xe mẫu. Muốn xem dữ liệu bằng MongoDB Compass, kết nối tới URI trong `MONGODB_URI` (mặc định `mongodb://127.0.0.1:27017/SaiGonPhoenix`). Các collection chính: `users`, `vehicles`, `bookings`, `sessions`.

## Chức năng

- Khách đăng ký, đăng nhập, chọn đúng mẫu xe, đặt/hủy chuyến và xem lịch sử.
- Admin xem thống kê, duyệt trạng thái đơn, thêm và ẩn/hiện xe.
- Admin xóa vĩnh viễn xe mà vẫn giữ thông tin xe trong lịch sử đơn cũ.
- Admin có thư viện ảnh xe: tải ảnh từ máy lên một lần, xem/xóa ảnh và chọn lại khi tạo xe mới.
- Khách chọn đặt cọc 30% hoặc thanh toán 100%, nhận VietQR có sẵn số tiền và mã đơn; admin đối soát và xác nhận số tiền đã nhận.
- Xe đã có đơn chờ/xác nhận sẽ tự ẩn khỏi lựa chọn trong khung giờ bận (mặc định trước/sau 120 phút) và server kiểm tra trùng lần cuối khi khách gửi đơn.
- Mật khẩu mã hóa bcrypt, phân quyền phía server, session lưu trong MongoDB.
