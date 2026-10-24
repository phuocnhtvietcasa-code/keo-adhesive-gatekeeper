# Đăng nhập + Quản lý tài khoản cho Kho Vietcasa

## Mục tiêu
- Giữ nguyên toàn bộ file index.html (giao diện, chức năng kho) — không sửa nội dung.
- Bắt buộc đăng nhập trước khi vào trang kho.
- Có 1 tài khoản admin mặc định; chỉ admin được tạo / khóa / đổi mật khẩu / xóa tài khoản.
- Trang "Quản lý tài khoản" dành riêng cho admin.

## Trang đăng nhập (theo mẫu ảnh gửi)
- Nền trắng với các dải chéo màu đen, cam, vàng, xanh lá như ảnh mẫu, thêm vòng tròn mờ chuyển động nhẹ.
- Bên trái: khu trưng bày sản phẩm động — bao keo xanh (ảnh gửi), thêm bao vàng, bao đỏ và tuýp keo (tạo ảnh mới cùng phong cách Webond), xoay vòng / nổi lơ lửng.
- Bên phải: thẻ đăng nhập với logo WEBOND, "Bền vững theo thời gian", tiêu đề "Quản Lý Kho - Doanh Số", ô Tên đăng nhập, Mật khẩu (nút hiện/ẩn), "Ghi nhớ tài khoản", nút Đăng nhập xanh, dòng © Công ty TNHH Gạch Nhà Việt VIETCASA.
- Báo lỗi rõ ràng khi sai tài khoản hoặc tài khoản bị khóa.
- Hiển thị tốt trên điện thoại.

## Sau khi đăng nhập
- Trang kho hiển thị nguyên vẹn file gốc trong khung toàn màn hình.
- Thanh nhỏ phía trên: tên người dùng, nút "Quản lý tài khoản" (chỉ admin), nút Đăng xuất.

## Quản lý tài khoản (admin)
- Danh sách: tên đăng nhập, họ tên, vai trò, trạng thái, ngày tạo.
- Tạo tài khoản mới (tên đăng nhập, họ tên, mật khẩu, vai trò Admin/Nhân viên).
- Đặt lại mật khẩu, khóa/mở khóa, xóa (không cho xóa chính mình).
- Mọi người dùng tự đổi mật khẩu của mình.

## Tài khoản mặc định
- Tên đăng nhập: `admin`, mật khẩu tạm `Admin@123` — nên đổi ngay sau lần đăng nhập đầu.

## Chi tiết kỹ thuật
- Bật Lovable Cloud cho đăng nhập; tên đăng nhập quy đổi thành email nội bộ `username@vietcasa.local`, tự xác nhận, tắt đăng ký công khai (chỉ admin tạo qua server function dùng quyền quản trị, kiểm tra vai trò trước).
- Bảng `profiles` (username, họ tên, trạng thái khóa) và bảng `user_roles` riêng + hàm `has_role`, RLS đầy đủ.
- Tạo admin mặc định qua server function khởi tạo một lần (chỉ chạy khi chưa có admin).
- File gốc đặt nguyên vẹn trong thư mục public và hiển thị bằng iframe trong route được bảo vệ `/kho`; `/` là trang đăng nhập, `/tai-khoan` là quản lý tài khoản.
- Ảnh bao keo gửi lên đưa lên CDN; tạo thêm ảnh bao vàng, bao đỏ, tuýp keo bằng AI.
- Lưu ý: file tĩnh trong public về kỹ thuật vẫn truy cập được nếu biết đường dẫn trực tiếp; nếu cần chặn tuyệt đối sẽ phục vụ file qua route server có kiểm tra phiên.
