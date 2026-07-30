# NqznZee Online Rooms V1.3

## Nếu Supabase đã chạy V1/V1.2
Chạy thêm file:

`supabase/database/06_online_rooms_v1_3_lifecycle.sql`

File này thêm:
- `finish_game_room(...)` để giải phóng tài khoản ngay khi trận kết thúc.
- `join_game_room_for_game(...)` để Caro chỉ vào phòng Caro, Chess chỉ vào phòng Chess.
- dọn phòng `playing` đã hết hạn khi tạo phòng mới.

## Đường dẫn mới
- Cờ vua Online: `/online/chess/`
- Caro Online: `/caro/online/`

`/online/?game=...` chỉ còn là redirect tương thích link cũ.

## Khôi phục tài khoản bị kẹt từ V1/V1.2
Mở đúng sảnh Online mới. Nếu Supabase vẫn thấy một room `playing`, trang sẽ hiện:
- **Tiếp tục trận**
- **Rời trận cũ**

Bấm **Rời trận cũ** để gọi `leave_game_room` và giải phóng account.

Nếu ván Caro cũ đã kết thúc và snapshot local có `finished=true`, Caro V1.3 cũng tự gọi `finish_game_room` khi mở game.
