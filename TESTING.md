# Kiểm thử LUMA Moments

## Kiểm tra được bằng Expo

```powershell
npm ci
npm run check
npx expo install --check
npx expo-doctor
npx expo export --platform android
npx expo start --go --clear
```

Trên Expo Go, kiểm tra cấp/từ chối quyền camera, chụp ảnh vuông, timer, flash, đổi camera, lưu ảnh, xem lại sau khi khởi động lại, preset màu, và chọn ảnh để gửi. Expo export chỉ xác nhận mã JavaScript đóng gói được; không thay thế kiểm thử trên điện thoại.

## Kiểm tra với Supabase thật

Dùng hai tài khoản A và B, thêm một tài khoản C chưa kết bạn để kiểm tra quyền xem:

1. A/B đăng ký, xác nhận email nếu bật, đăng nhập và tạo username.
2. A gửi lời mời cho B; B chấp nhận; cả hai thấy nhau trong danh sách bạn bè.
3. A chụp ảnh, thêm lời nhắn, chọn B và gửi. B thấy ảnh trong Khoảnh khắc và thông báo trong app; A thấy ảnh ở Kỷ niệm.
4. B thả cảm xúc; A thấy thông báo phản hồi. B mở ảnh để trạng thái “Mới” biến mất.
5. Ngắt mạng trước khi gửi. Ảnh nằm trong hàng đợi, không báo là đã gửi. Mở mạng, bấm thử lại; ảnh chỉ xuất hiện một lần ở tài khoản B.
6. A chặn B; B không thể đọc ảnh mới từ A. C không thể đọc ảnh hoặc URL Storage của A/B qua API dù đoán được ID.
7. Đăng xuất rồi đăng nhập tài khoản khác; không hiện ảnh widget hoặc hàng đợi của tài khoản cũ.

Widget trên màn hình chính và thông báo đẩy từ xa không chạy trong Expo Go. Chỉ kiểm tra hai phần đó khi đã tạo bản build có native module và cấu hình EAS project ID, Edge Function.

**Trạng thái hiện tại:** chưa có thông số Supabase hay thiết bị đăng nhập trong repo, nên các bước nhiều tài khoản và widget chưa được xác nhận thực tế.
