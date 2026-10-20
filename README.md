# LUMA Moments (Android)

LUMA Moments là ứng dụng React Native / Expo SDK 57 để chụp ảnh vuông, chia sẻ riêng với bạn bè và xem ảnh nhận được trên widget Android. Dự án có 20 trạng thái màn hình điều hướng bằng Expo Router. Camera, Color Studio và ảnh cá nhân chạy offline; tài khoản, kết bạn, gửi/nhận ảnh và thông báo trong app dùng Supabase.

## Chạy dự án

Cần Node.js 22.13+ và Expo Go trên điện thoại. Sau khi clone:

```powershell
npm ci
npm run check
npx expo start --go --clear
```

Quét mã QR bằng Expo Go để dùng camera và phần chia sẻ. Expo Go không chứa widget trên màn hình chính; widget và thông báo đẩy từ xa cần bản build riêng qua EAS khi bạn muốn dùng chúng. Dự án cần EAS `projectId` để đăng ký Expo Push Token. Chưa cấu hình Supabase, app vẫn chụp và chỉnh ảnh cá nhân nhưng không thể đăng nhập/gửi ảnh.

## Cấu hình Supabase

Xem [supabase/README.md](supabase/README.md) và tạo `.env` từ `.env.example`. Chỉ đặt URL và anon key công khai trong app. Không bao giờ đặt service role key trong `EXPO_PUBLIC_*`.

## Luồng sử dụng

1. Đăng ký, xác nhận email nếu dự án Supabase bật xác nhận, đăng nhập và tạo username.
2. Tìm bạn → gửi lời mời → người nhận chấp nhận.
3. Chụp ảnh vuông → viết lời nhắn hoặc mở Color Studio → chọn người nhận → gửi.
4. Nếu mạng mất, ảnh được sao chép vào SQLite/file riêng dưới trạng thái chờ hoặc thất bại. App thử gửi lại khi mở; màn Kỷ niệm có nút thử lại và hủy. Mỗi ảnh dùng cùng một mã giao dịch để tránh gửi trùng.
5. Người nhận xem trong Khoảnh khắc, thả cảm xúc và có thể đánh dấu đã xem. Màn Thông báo lưu sự kiện trong Supabase.
6. APK Android có widget LUMA Moments. Thêm widget từ trình chọn widget của màn hình chính; chọn bạn bè và đồng bộ ảnh trong app. Widget cập nhật khi app mở hoặc nhấn đồng bộ, hiện chưa tự tải ảnh khi app hoàn toàn đóng.

20 scene: Welcome, Login, Register, Profile Setup, Camera, Edit, Send, Inbox, Moment Detail, Memories, Memory Detail, Friends, Find Friends, Friend Requests, Friend Profile, Widget Setup, Notifications, My Profile, Settings, Privacy. Camera là route `/`; các màn khác là `/moments/[scene]` với giá trị `scene` tương ứng.

Ảnh nhận được cần Internet để lấy URL có hạn sử dụng. File widget nằm trong bộ nhớ riêng của app và được xóa khi đăng xuất. Ảnh cá nhân chưa xuất khỏi app có thể mất khi gỡ ứng dụng.

## Kiểm tra

```powershell
npm run check
npx expo install --check
npx expo export --platform android
npx expo-doctor
```

`npx expo export` kiểm tra bundle JS, chưa kiểm tra widget native. Các luồng đăng nhập, gửi/nhận và quyền ảnh phải kiểm tra với Supabase thật và hai tài khoản khác nhau. Chưa có URL/khóa Supabase trong repository nên không thể xác nhận các luồng cloud bằng test tại đây.
