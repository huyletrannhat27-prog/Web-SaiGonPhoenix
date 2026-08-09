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
- Trang chủ có banner tự chuyển, form tìm chuyến nhanh và giao diện responsive theo phong cách ứng dụng đặt xe hiện đại.
- Form đặt xe cập nhật xe trống, giá cọc/tổng tiền và tóm tắt hành trình theo thời gian thực.
- Admin cấu hình hotline và liên kết Zalo; khách dùng khung hỗ trợ nổi để mở chat trực tiếp với admin.
- Khách có thể yêu cầu email đặt lại mật khẩu bằng token một lần, hết hạn sau 15 phút.
- Admin xem đơn theo ba nhóm: chờ xác nhận, chờ phục vụ và hoàn thành/lưu trữ. Đơn xác nhận quá giờ đón 2 tiếng tự hoàn thành; đơn chờ quá hạn tự chuyển sang quá hạn.
- Xe đã nằm trong một đơn được xác nhận sẽ tự ẩn khỏi trang chủ, form đặt xe và API xe đến khi chuyến hoàn thành/hủy.
- Quản lý tài xế, gán tài xế vào xe; tài xế có tài khoản riêng để xem chuyến và chat với khách.
- Chat nội bộ lưu trong MongoDB, hỗ trợ ảnh/video tối đa 25 MB, kéo thả cửa sổ và chế độ toàn màn hình.
- Chat admin có trả lời tự động ngẫu nhiên khi admin chưa kịp phản hồi; có thể bật/tắt và chỉnh tối đa 30 câu mẫu trong trang quản trị.
- Đơn đón sân bay có mã chuyến bay hỗ trợ đồng bộ ETA, giờ cất cánh/hạ cánh thực tế từ Flightradar24.

## Cấu hình email và Zalo

- Điền `APP_BASE_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` và `MAIL_FROM` để gửi email khôi phục mật khẩu. Với Gmail, dùng App Password thay cho mật khẩu đăng nhập.
- Điền `HOTLINE`, `ZALO_PHONE` hoặc `ZALO_OA_URL`; sau khi chạy, admin cũng có thể cập nhật các thông tin này tại mục **Hotline và khung chat Zalo**.
- Khi chạy ở môi trường development mà chưa có SMTP, liên kết đặt lại mật khẩu được in ở terminal và hiển thị trên trang kết quả để tiện kiểm thử. Production không hiển thị liên kết này.
- Điền `FR24_API_TOKEN` của gói API Flightradar24 đang hoạt động để bật dữ liệu chuyến bay thật. API công khai không cung cấp giờ scheduled trước khi máy bay được theo dõi; hệ thống giữ giờ khách nhập và hiển thị ETA/thời gian thực tế riêng khi có dữ liệu.
- `BOOKING_ARCHIVE_HOURS=2` điều chỉnh số giờ sau lịch đón để tự lưu trữ. `MAINTENANCE_INTERVAL_MINUTES=10` điều chỉnh chu kỳ đồng bộ nền.
