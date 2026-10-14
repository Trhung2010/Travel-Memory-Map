# Checklist kiểm thử trên Android

| Kiểm thử | Kết quả mong đợi |
|---|---|
| Chưa cấp quyền camera | Thấy nút yêu cầu quyền, không crash |
| Từ chối quyền vĩnh viễn | Có hướng dẫn bật lại trong Settings |
| Chụp ảnh bình thường | Chuyển sang Photo Viewer sau khi file lưu xong |
| Thoát hẳn app, vào lại | Gallery vẫn có ảnh |
| Chế độ Pro, Timer 3 giây | Đếm 3/2/1 rồi mới chụp |
| Flash Off/Auto/On | Camera nhận chế độ, tùy khả năng thiết bị |
| Đổi camera trước/sau | Không bị camera đen/lỗi session |
| Chọn độ phân giải khác | Ảnh mới có kích thước phù hợp trên thiết bị |
| Leica / Hassel / Zeiss | Preview thay màu và file xuất chứa pixel đã xử lý |
| Original 100% | Không cố tình thay đổi màu |
| So sánh Gốc / Preset | Có khác biệt rõ khi preset khác Original |
| Xóa ảnh khỏi LUMA | Ảnh biến mất khỏi LUMA Gallery |
| Export rồi xóa trong LUMA | Ảnh bên Gallery Android vẫn còn |
| Ảnh rất lớn | Không crash / hiển thị lỗi rõ nếu thiết bị không hỗ trợ Skia |

**Môi trường thực tế:** chưa được chạy trong Android runtime của người tạo bản mã nguồn. Những ô kiểm thử trên phải được xác nhận bằng tay.
