# NqznZee Online Rooms v1 — Chess + Caro

Bản này tạo một hệ phòng dùng chung cho **Cờ vua** và **Caro**:

- Mã phòng đúng 4 chữ số (`0000`–`9999`).
- Tạo phòng / nhập mã.
- Tên + Elo snapshot của hai người.
- Random bên: Chess = Trắng/Đen, Caro = X/O.
- Ready / bỏ Ready.
- Chủ phòng bắt đầu khi cả hai Ready.
- Realtime cập nhật sảnh chờ giữa hai trình duyệt.
- Refresh trang có thể quay lại phòng bằng `?room=1234` nếu tài khoản vẫn là thành viên.
- Chess và Caro cùng dùng bảng `game_rooms`.

## Bước 1 — Supabase

Mở **SQL Editor** trong project Supabase hiện tại và chạy toàn bộ:

`supabase/database/05_shared_online_rooms.sql`

File SQL tạo bảng + RLS + RPC + bật `game_rooms` trong publication `supabase_realtime`.

> Không cần service_role ở frontend. Website tiếp tục dùng Publishable key hiện tại.

## Bước 2 — GitHub Pages

Upload toàn bộ package lên repo test. Các đường dẫn:

- `/online/` — sảnh Online chung.
- `/online/?game=chess` — chọn Cờ vua.
- `/online/?game=caro` — chọn Caro.
- Chess `play.html` có tab **ONLINE**.
- Lobby Caro có nút **Chơi Online**.

## Bước 3 — Test hai thiết bị

1. Đăng nhập tài khoản A trên máy A.
2. Mở `/online/?game=chess` hoặc `/online/?game=caro` → **Tạo phòng**.
3. Gửi mã 4 số cho tài khoản B.
4. B đăng nhập trên thiết bị/trình duyệt khác → nhập mã → **Vào phòng**.
5. Hai bên bấm **Sẵn sàng**.
6. Chủ phòng bấm **Bắt đầu trận**.

Giai đoạn v1 dừng ở đây: room chuyển sang `playing` và có nút mở bàn game. **Nước đi vẫn chưa đồng bộ realtime.** Phần tiếp theo sẽ nối Chess move và Caro move vào chính `room.id` này.

## Rating

- Chess Elo snapshot lấy từ `public.ratings.bot_rating`.
- Caro Elo: SQL tự dùng `public.caro_ratings` nếu bảng đó tồn tại và có cột `elo`, `caro_elo` hoặc `rating`; nếu chưa có thì mặc định 1000.
- `rated` đã có trong room schema, nhưng v1 **không tự cộng/trừ Elo**. Chỉ cập nhật Elo sau khi backend xác minh kết quả gameplay Online.
