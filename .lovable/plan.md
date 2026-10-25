# Quên mật khẩu & lấy lại bằng email

## Vấn đề hiện tại
Tài khoản đang dùng email nội bộ giả (`ten@vietcasa.local`) nên không thể nhận thư. Muốn lấy lại mật khẩu, mỗi tài khoản cần có **email thật**.

## Sẽ làm
1. **Email thật cho tài khoản**
   - Trang Quản lý tài khoản: thêm ô "Email" khi tạo/sửa tài khoản (admin nhập).
   - Mỗi người tự thêm/đổi email của mình trong menu tài khoản (cạnh "Đổi mật khẩu").
   - Vẫn đăng nhập bằng **tên đăng nhập** như cũ; email chỉ dùng để lấy lại mật khẩu.
2. **Link "Quên mật khẩu?"** dưới ô mật khẩu ở trang đăng nhập → hộp thoại nhập email → gửi thư chứa link đặt lại mật khẩu. Luôn báo "Nếu email có trong hệ thống, thư đã được gửi" (không tiết lộ email nào tồn tại).
3. **Trang "Đặt mật khẩu mới"** (mở từ link trong thư): nhập mật khẩu mới 2 lần → lưu → vào thẳng kho. Cùng giao diện thương hiệu Webond.
4. Tài khoản chưa có email: hiện gợi ý "Liên hệ admin để đặt lại mật khẩu".

## Lưu ý
- Thư gửi từ địa chỉ mặc định của hệ thống; có thể gắn tên miền riêng sau để thư mang thương hiệu Webond.
- Admin mặc định nên được gắn email thật ngay sau khi làm xong.

## Chi tiết kỹ thuật
- Thêm cột `email` (unique, nullable) vào `profiles`. Khi đặt email thật: `admin.updateUserById` đổi email đăng nhập của user sang email thật (email_confirm: true); nếu xoá email thì trả về `username@vietcasa.local`.
- Đăng nhập chuyển sang server function `signInWithUsername`: tra email từ `profiles` bằng admin client phía server, gọi `signInWithPassword`, trả session → client `setSession`. Email không bao giờ lộ ra trình duyệt.
- Quên mật khẩu: `supabase.auth.resetPasswordForEmail(email, { redirectTo: origin + '/reset-password' })`.
- Route công khai `src/routes/reset-password.tsx`: chờ sự kiện `PASSWORD_RECOVERY`, gọi `updateUser({ password })` (không gửi current_password).
- Cập nhật AGENTS.md và ghi nhớ dự án về quy tắc username/email mới.
