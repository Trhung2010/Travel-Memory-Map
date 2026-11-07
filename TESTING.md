# Kiểm tra Travel Memory Map trên thiết bị

1. Mở app và xác nhận Trang chủ Travel Memory Map xuất hiện đầu tiên.
2. Tạo chuyến đi với tên, điểm đến và khoảng ngày hợp lệ.
3. Đóng rồi mở lại app; chuyến đi phải còn trong danh sách.
4. Thử ngày kết thúc trước ngày bắt đầu; app phải từ chối lưu.
5. Mở Tổng quan và kiểm tra các lối vào Bản đồ, Timeline, Story và Tạo kỷ niệm.
6. Mở Camera, cấp quyền, chụp ảnh; thêm tiêu đề và tọa độ rồi kiểm tra marker trên bản đồ.
7. Nhập một ảnh và một video; đóng/mở lại app rồi kiểm tra Gallery và Story vẫn phát được.
8. Trong camera hành trình, chuyển sang Video, quay rồi dừng trước 60 giây; xác nhận video mở được sau khi khởi động lại app.
9. Sửa một kỷ niệm, chọn “Lấy vị trí hiện tại”, kiểm tra marker xuất hiện đúng trên bản đồ; thử cả trường hợp từ chối quyền và tắt GPS.
10. Ghi âm ít nhất 3 giây, dừng và phát lại ở màn Nghe lại.
11. Đính kèm PDF, mở bảng chia sẻ tài liệu, sau đó xóa kỷ niệm.
12. Xóa một chuyến đi và xác nhận timeline, marker cùng media của chuyến đó không còn trong ứng dụng.
13. Trong Cài đặt, bật tự gắn GPS; chụp ảnh và quay video mới rồi xác nhận tọa độ xuất hiện mà không cần nhập thủ công. Thu hồi quyền vị trí và kiểm tra ứng dụng tự tắt tùy chọn nhưng vẫn lưu media.
14. Nhập từ khóa và đổi bộ lọc ở Timeline/Gallery; xác nhận danh sách gốc không bị xóa hoặc đổi thứ tự sau khi bỏ lọc.
15. Sao lưu chuyến có đủ ảnh, video, ghi âm và tài liệu thành `.travelmap`; nhập lại file đó và xác nhận ứng dụng tạo chuyến “(khôi phục)” riêng, media vẫn mở được sau khi khởi động lại.
16. Thử nhập file không phải `.travelmap`, file bị cắt và file backup thiếu dung lượng; ứng dụng phải từ chối mà không thêm dữ liệu dở dang.
17. Quét dung lượng, kiểm tra cảnh báo file đã mất và chỉ dọn các file được đánh dấu không còn sử dụng.
18. Sửa một byte trong phần media của file `.travelmap` nhưng giữ nguyên kích thước; import phải báo media không nguyên vẹn và không thêm chuyến đi.
19. Tạo trên 40 ảnh/video và trên 30 mục timeline; kiểm tra nút “Xem thêm”, thay đổi bộ lọc phải đặt lại giới hạn hiển thị.
20. Tạo nhiều video/ghi âm trong Story, vuốt liên tục và xác nhận chỉ media ở trang hiện tại được khởi tạo/phát, trang vừa rời phải ngừng âm thanh.
21. Gắn nhiều tọa độ xa nhau, mở bản đồ và xác nhận tất cả marker nằm trong khung; nút “Căn theo địa điểm” phải đưa bản đồ trở lại vùng chứa marker.

Kiểm thử bundle không thay thế các bước quyền camera, micro, GPS và phát media trên thiết bị thật.

## Sáu tính năng bổ sung: kiểm tra trên thiết bị

- Chọn ảnh bìa trong Tổng quan; khởi động lại và khôi phục backup, kiểm tra ảnh vẫn hiện.
- Đánh dấu yêu thích, lưu nhãn; lọc Timeline/Gallery rồi đóng mở app để kiểm tra lưu trữ.
- Xóa kỷ niệm, hoàn tác, khôi phục từ Cài đặt; xóa vĩnh viễn phải có xác nhận. Ảnh đang làm bìa phải được đổi trước khi xóa vĩnh viễn.
- Thêm điểm lịch trình đúng/sai ngày giờ, đánh dấu đã ghé và tạo ghi chú tại điểm đó; kiểm tra backup giữ lịch trình.
- Đặt lời nhắc trong ngày tương lai, từ chối/cấp quyền, mở thông báo và tắt lời nhắc. Đổi ngày hoặc xóa chuyến phải hủy lịch cũ. Giới hạn tổng 60 thông báo đang chờ.
- Bật khóa với sinh trắc học đã đăng ký; thử hủy, xác thực sai, khởi động lại, chuyển nền và quay lại. Face ID cần development build iOS; khóa giao diện không mã hóa file backup.
- Dọn dung lượng phải giữ media đang tham chiếu, thùng rác, ảnh bìa và file mới hơn một giờ.

Các tình huống thiết bị ở mục này chưa được xác nhận bằng kiểm thử native. Kiểm thử tự động bao phủ định dạng dữ liệu mới và tương thích dữ liệu cũ.
