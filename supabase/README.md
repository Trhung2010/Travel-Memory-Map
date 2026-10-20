# Thiết lập backend cho LUMA Moments

1. Tạo dự án Supabase. Trong SQL Editor, chạy toàn bộ `schema.sql`. Script có thể chạy lại để cập nhật trigger/chính sách. Không dùng service role key trong ứng dụng di động.
2. Tạo `.env` ở thư mục gốc từ `.env.example`, điền `EXPO_PUBLIC_SUPABASE_URL` và anon/publishable key từ Project Settings → API.
3. Đăng nhập Supabase CLI, liên kết project và deploy Edge Function:

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase functions deploy notify-moment
```

Function đọc `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` từ môi trường Supabase Edge; không đưa các khóa đó vào app/repo. Function xác thực người gọi, kiểm tra họ sở hữu moment, rồi chỉ gửi Expo Push Token của người nhận. Ứng dụng vẫn gửi/nhận ảnh nếu function chưa deploy; riêng thông báo đẩy cho ảnh mới sẽ không hoạt động.

4. Đăng ký EAS project để app có `projectId`, build APK/development client, rồi bật thông báo trong scene Notifications. Trên Android 13+, ứng dụng sẽ hỏi quyền thông báo.
5. Dùng hai tài khoản để kiểm tra lời mời, kết bạn, gửi ảnh, đọc ảnh, chặn, widget. Kiểm tra RLS bằng cách cố đọc ảnh của tài khoản thứ ba qua REST/Storage: phải bị từ chối.

Bucket `moments` là private, giới hạn 10 MB/JPEG. RPC `publish_moment` kiểm tra quyền sở hữu file và tình bạn trước khi tạo moment và người nhận. Ảnh chờ gửi được lưu riêng trong thiết bị, không coi là đã gửi cho tới khi RPC trả về thành công. Widget tải ảnh có quyền xem bằng signed URL ngắn hạn rồi lưu bản JPEG nội bộ, xóa khi đăng xuất.

Lưu ý: nếu đã chạy `schema.sql` cũ, chạy lại file mới để thêm `client_id`, `seen_at`, `push_tokens`, trigger kiểm tra danh tính lời mời và quyền RLS. Chạy trong môi trường test trước khi áp dụng vào dữ liệu thật.
