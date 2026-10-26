# SaiGonPhoenix

Website đặt xe đưa đón sân bay bằng Node.js, Express, EJS và MongoDB.

## Chạy dự án

1. Cài Node.js 18+ và MongoDB Community Server.
2. Sao chép `.env.example` thành `.env`, đổi các secret và tài khoản admin.
3. Chạy `npm install` rồi `npm run dev`.
4. Mở `http://localhost:3000`.

Lần chạy đầu hệ thống tự tạo tài khoản admin và bốn xe mẫu. Muốn xem dữ liệu bằng MongoDB Compass, kết nối tới URI trong `MONGODB_URI` (mặc định `mongodb://127.0.0.1:27017/SaiGonPhoenix`). Các collection chính: `users`, `vehicles`, `bookings`, `sessions`.

## Chức năng

### Lịch cá nhân và giao diện mới

- Mở `/calendar` từ mục **Lịch của tôi**. Đăng nhập để thêm, sửa, xóa lịch hẹn; dữ liệu được lưu trong collection `calendarevents` theo tài khoản.
- Chế độ tháng và danh sách, tìm kiếm trong tháng, bộ lọc Cá nhân / Công việc / Chuyến đi, lịch cả ngày và nhiều ngày, địa điểm và ghi chú riêng.
- Mọi thời gian trên trang lịch được nhập và hiển thị theo **Asia/Ho_Chi_Minh (GMT+7)**, kể cả khi thiết bị ở múi giờ khác. Ngày kết thúc của lịch cả ngày trên form được tính bao gồm ngày đó.
- Mở một lịch hẹn đã lưu rồi chọn **Thêm vào Google Calendar** để tạo bản sao trên Google. Đây **không phải đồng bộ tự động**; lịch tạo trên Google chưa tự hiện trên web.
- Nhãn giao diện Việt/Anh và thuật ngữ đặt xe được biên tập trong `public/js/locale-refinements.js`. Một số ngôn ngữ khác dùng bản dịch tự động cho nhãn được đánh dấu `data-i18n`; khi dịch vụ không phản hồi, dùng nội dung dự phòng. Không tự gửi ghi chú, tên khách hay nội dung chat để dịch giao diện; dịch tin nhắn vẫn là thao tác riêng của người dùng.
- Giao diện có chữ dễ đọc hơn, điều hướng lịch, chế độ sáng/tối, hỗ trợ màn hình nhỏ và giảm chuyển động theo cài đặt thiết bị.

Kiểm thử phần mới bằng `npm run test:calendar` (Node.js 24, MongoDB local cổng 27017). Bộ kiểm thử tự tạo cơ sở dữ liệu `sgp_calendar_test_*`, kiểm tra API, phân quyền, biểu mẫu, DOM và ngôn ngữ rồi xóa đúng cơ sở dữ liệu thử nghiệm đó. Không dùng dữ liệu ứng dụng đang chạy. Kiểm thử DOM không thay thế việc kiểm tra bố cục trực tiếp trên trình duyệt.

Các route EJS tiếp tục dùng đăng nhập session trong `controllers/authController.js`. Bản controller JWT có sẵn khi bắt đầu nâng cấp được giữ riêng tại `controllers/authApiController.js` để tiếp tục phần frontend API sau này; chưa gắn vào các route EJS.

### Đặt xe và quản trị

### Ảnh xe, nội thất và chế độ xoay

- Bấm hình xe ở trang chủ hoặc form đặt xe để mở thư viện ảnh. Có các mục **Ngoại thất**, **Nội thất**, **Xoay 360°**, chuyển bằng mũi tên, bàn phím hoặc vuốt. Bấm ảnh trong form đặt xe không tự đổi xe đang chọn.
- Vào **Quản trị → Quản lý đội xe → Chỉnh sửa xe → Ảnh để khách xem xe**. Có thể tải nhiều ảnh, chọn lại ảnh từ thư viện hoặc nhập liên kết HTTPS (mỗi dòng một ảnh). Bấm **Lưu thay đổi** để áp dụng. Tạo xe mới cũng có các trường này.
- Mỗi xe hỗ trợ tối đa 12 ảnh ngoại thất, 12 ảnh nội thất; mỗi tệp JPG/PNG/WEBP/GIF tối đa 5 MB, tổng cộng tối đa 36 tệp trong một lần lưu. Ảnh đầu tiên trong nhóm ngoại thất là ảnh bìa. Ảnh tải lên được giữ trong thư viện để tái sử dụng.
- Hiệu ứng trên ảnh thường là chuyển động của ảnh tĩnh, không mô phỏng góc nhìn chưa được chụp. Muốn xoay 360° thực sự bằng chuỗi ảnh, thêm 8–36 ảnh cùng xe chụp quanh xe, đặt tên `01`, `02`… trước khi tải lên. Khách có thể kéo để xoay hoặc bật/tắt tự xoay. Tôn trọng tùy chọn giảm chuyển động của thiết bị.
- Xe chưa có ảnh nội thất hoặc bộ ảnh 360° sẽ hiển thị thông báo tương ứng; hệ thống không tự gán ảnh xe khác. Bỏ ảnh khỏi xe giữ nguyên tệp trong thư viện; thư viện không cho xóa ảnh đang được xe sử dụng ở bất kỳ nhóm nào.
- `npm run test:gallery`: kiểm thử bằng cơ sở dữ liệu local tách riêng `sgp_gallery_test_*`; tự dọn đúng dữ liệu và ảnh thử nghiệm sau khi chạy. Bao gồm tải ảnh, giới hạn dung lượng, quyền quản trị, lưu/chỉnh ảnh, mở thư viện, xoay, bàn phím, lỗi tải ảnh và giảm chuyển động. DOM test không phải kiểm tra hình ảnh trực tiếp trên trình duyệt.

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
