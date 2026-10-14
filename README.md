# LUMA Camera — Personal Edition (Android)

Ứng dụng **React Native / Expo SDK 57**, sử dụng `expo-camera` thực sự trên Android. Offline, không backend, không API key.

## Những gì đã có trong source

- Camera thật: xin quyền, preview, chụp JPEG, flash Off/Auto/On, đổi camera, zoom tương đối, hẹn giờ.
- Pro Assist: lưới 3×3, hẹn giờ, thay đổi kích thước ảnh theo thiết bị, chất lượng JPEG.
- Gallery nội bộ: liệt kê, xem, xóa ảnh có xác nhận.
- Xuất ảnh riêng ra thư viện Android (xin quyền ghi ảnh).
- Color Studio: preview 6 preset cảm hứng Leica / Hasselblad / ZEISS, chỉnh cường độ, so sánh ảnh gốc, **áp ma trận màu lên pixel và xuất JPEG mới** qua Skia.
- Lưu dữ liệu offline: `expo-file-system` vào app Documents, preferences trong AsyncStorage.

### Quan trọng

Preset **không phải** LUT/profile màu thương mại của các hãng. Pro Assist **không** điều khiển ISO, tốc độ màn trập, RAW hay Camera2 trực tiếp. Ảnh đã chỉnh màu giới hạn 2048px cạnh dài để tránh lỗi bộ nhớ trên Android; ảnh gốc không bị đổi hoặc hạ độ phân giải bởi công đoạn này. Zoom hiển thị bằng nội suy trên tham số `zoom` chứ không đo tiêu cự/quang học.

## Cách chạy thật trên Android, từ VS Code

1. Cài **Node.js 22.13+**, VS Code và ứng dụng **Expo Go** trên điện thoại Android.
2. Giải nén rồi mở thư mục `LUMA-Camera` trong VS Code.
3. Mở Terminal, chạy:

```powershell
npm install
npx expo install --fix
npm run check
npx expo start --clear
```

4. Điện thoại và máy tính kết nối cùng Wi-Fi; mở **Expo Go** quét QR từ Terminal.
5. Cấp quyền camera. Chụp ảnh → LUMA Photo Viewer → Color Studio → lưu ảnh mới → Xuất Android.
6. Khi máy và điện thoại không cùng Wi-Fi, có thể thử `npx expo start --tunnel` (cần mạng khi phát triển).

> **VS Code không phải môi trường chạy app**: VS Code chỉ để chỉnh sửa code; Metro bundler phục vụ JavaScript, còn app chạy trong **Expo Go Android**. Khi build APK, đây là ứng dụng Android độc lập.

## Xuất APK

```powershell
npm install -g eas-cli
npx eas login
npx eas build --platform android --profile preview
```

Sau khi build hoàn tất, Expo/EAS cung cấp link APK. APK vẫn chụp ảnh offline khi không có mạng. Lần build cloud và cài npm cần Internet.

## Lưu ý kiểm thử

- **Chưa chạy trên thiết bị Android thật trong môi trường tạo source này**. Cần kiểm tra quyền camera, vòng đời CameraView và khả năng xử lý Skia trên máy của bạn trước khi kết luận production-ready.
- Chụp 1 ảnh, thoát app hoàn toàn rồi mở lại: ảnh vẫn xuất hiện trong Gallery.
- Chọn Pro Assist, xem danh sách size; Android khác nhau có thể trả ra size khác nhau.
- Áp Leica Classic và Original, đối chiếu bằng mắt và dung lượng/độ phân giải file mới.
- Thử ảnh 12MP/50MP; Skia chỉ xử lý bản resize 2048px, tránh OOM.
- Thử xóa ảnh, xuất Android rồi xóa ảnh nội bộ: bản bên Android phải vẫn còn.
- Gỡ ứng dụng khi chưa xuất ảnh **có thể làm mất toàn bộ ảnh** trong Documents nội bộ.

## Những việc chưa có

- Chỉnh ISO, shutter, white balance phần cứng, RAW/DNG.
- Preset xem trực tiếp trên luồng video camera. Preset chỉ chạy hậu kỳ.
- Chọn trực tiếp ống kính tele/ultrawide và HDR hãng.
- Máy Android đòi hỏi native module tùy biến có thể cần **development build** thay vì Expo Go.

## Tài liệu chính thức

- https://docs.expo.dev/versions/v57.0.0/sdk/camera/
- https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/
- https://docs.expo.dev/versions/v57.0.0/sdk/media-library/
- https://shopify.github.io/react-native-skia/

## Cấu trúc

```text
app/
  _layout.tsx             Navigation + Providers
  index.tsx               Camera/Pro Assist
  gallery.tsx             Thư viện
  photo/[name].tsx        Ảnh chi tiết và xóa/xuất
  presets.tsx             Chỉnh màu ảnh thật
  settings.tsx            Cài đặt
src/
  components/Ui.tsx       UI tái sử dụng
  lib/gallery.ts          Quản lý file offline
  lib/presets.ts          Ma trận màu
  state/Prefs.tsx         Preferences + AsyncStorage
  theme/colors.ts         Design tokens
```
