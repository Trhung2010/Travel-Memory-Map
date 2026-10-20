# LUMA Camera

LUMA Camera là ứng dụng chụp và chỉnh ảnh chạy bằng Expo Go. Ảnh, bản chỉnh sửa, album và danh sách yêu thích nằm trên điện thoại. Ứng dụng không cần tài khoản, Supabase hay máy chủ.

## Chạy trên điện thoại

Cần Node.js và Expo Go. Trong thư mục dự án:

```powershell
npm ci
npm run check
npm start -- --port 8082 --clear
```

Quét QR bằng Expo Go. Nếu điện thoại không kết nối được qua LAN, chạy `npm start -- --tunnel` thay cho lệnh cuối. Không cần Android Studio, Android SDK hay Gradle.

## Sử dụng

App mở thẳng Camera. **Chụp thường** tập trung vào thao tác nhanh; **Chụp Pro** có thanh điều khiển mở ở cạnh phải cho zoom theo phần trăm phạm vi thiết bị, đèn flash, lấy nét, hẹn giờ, lưới và chất lượng JPEG. Đóng thanh để xem trọn khung ngắm; bấm chụp cũng tự đóng thanh. Pro không giả lập ISO, tốc độ màn trập hoặc RAW khi Expo Go không hỗ trợ.

Bộ lọc có sẵn trên thanh dưới camera. Ảnh sau khi chụp được lưu trong LUMA và có thể cắt, xoay, chỉnh màu, thêm chữ hoặc hình dán, so sánh trước/sau. Mọi thao tác tạo một file mới và giữ ảnh gốc. Từ Chi tiết ảnh, bạn có thể lưu bản sao vào thư viện điện thoại hoặc mở bảng chia sẻ để gửi bằng ứng dụng khác.

20 scene: Chụp thường, Chụp Pro, Bộ lọc, Xem thử bộ lọc, Ảnh vừa chụp, Chỉnh sửa ảnh, Cắt và xoay, Ánh sáng và màu, Chữ và hình dán, Trước và sau, Xuất ảnh, Chia sẻ ảnh, Thư viện LUMA, Chi tiết ảnh, Album, Chi tiết album, Ảnh yêu thích, Tìm ảnh, Kỷ niệm, Cài đặt và lưu trữ. Camera thường là route `/`; các scene còn lại dùng `/studio/[scene]`.

Ảnh trong vùng dữ liệu LUMA có thể mất khi gỡ ứng dụng hoặc xóa dữ liệu của app. Hãy dùng **Lưu vào máy** cho ảnh cần giữ bên ngoài LUMA. Ảnh và tài khoản từ bản Supabase cũ không tự chuyển sang phiên bản local này; bản local không xóa dữ liệu đang nằm trong project Supabase cũ.

## Kiểm tra

```powershell
npm run check
npx expo-doctor
npx expo export --platform android
npx expo export --platform ios
```

Hai lệnh export chỉ kiểm tra bundle Expo, không cần công cụ Android gốc.
