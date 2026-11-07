# Travel Memory Map

Travel Memory Map là ứng dụng nhật ký hành trình đa phương tiện được xây dựng bằng React Native và Expo SDK 58. Ứng dụng tổ chức chuyến đi, kỷ niệm, ảnh, video, ghi âm, tài liệu và vị trí trong một dòng thời gian thống nhất.

## Chạy dự án

```powershell
npm ci
npm run check
npm test
npm start -- --port 8082 --clear
```

Quét QR bằng Expo Go. Nếu điện thoại không kết nối được qua LAN, dùng `npm start -- --tunnel`.

## Phạm vi 20 scene

Trang chủ, tất cả chuyến đi, tạo chuyến đi, chỉnh sửa chuyến đi, tổng quan, bản đồ, chi tiết địa điểm, timeline, tạo kỷ niệm, camera, xem lại nội dung, chọn media, ghi âm, nghe lại ghi âm, đính kèm tài liệu, chỉnh sửa kỷ niệm, chi tiết kỷ niệm, thư viện, story và cài đặt.

Các luồng chính đã nối dữ liệu cục bộ: CRUD chuyến đi và kỷ niệm, chụp ảnh, quay video trực tiếp tối đa 60 giây, nhập ảnh/video, ghi và phát âm thanh, đính kèm tài liệu, tùy chọn tự gắn GPS, bản đồ marker tự căn vùng, timeline, gallery và story dạng vuốt. Timeline và Gallery có tìm kiếm/bộ lọc và tải thêm theo trang; Story chỉ mount media quanh trang đang xem để tránh tạo đồng thời quá nhiều player. Màn Cài đặt hỗ trợ sao lưu/khôi phục từng chuyến bằng file `.travelmap`, kiểm tra SHA-256 của media, thống kê dung lượng, phát hiện file đã mất và dọn file mồ côi. Media được sao chép vào vùng document của ứng dụng thay vì giữ URI cache. Camera, micro, GPS, chia sẻ/nhập file backup, bản đồ và phát media vẫn cần được kiểm thử trên thiết bị thật trước khi phát hành.

## Kiểm tra

```powershell
npm run check
npx expo-doctor
npx expo export --platform android
npx expo export --platform ios
```
