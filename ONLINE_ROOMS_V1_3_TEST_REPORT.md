# Online Rooms V1.3 — Test report

## Fix lifecycle
- Caro khi đạt điều kiện thắng gọi RPC `finish_game_room`.
- Hai nút kết quả `Về sảnh` / `Tạo ván mới` đóng lifecycle Online trước khi về lobby.
- `Tạo ván mới / đổi đối thủ` khi đang Online gọi `leave_game_room` nếu trận chưa kết thúc.
- Snapshot V1/V1.2 đã finished nhưng room còn `playing` được tự dọn khi boot Caro V1.3.
- Sảnh Online có recovery `Tiếp tục trận / Rời trận cũ` khi account còn room `playing`.

## Tách phòng theo game
- Chess: `/online/chess/` — chỉ tạo/join `game_type=chess`.
- Caro: `/caro/online/` — chỉ tạo/join `game_type=caro`.
- Join dùng RPC `join_game_room_for_game(code, game_type)`, nên mã của game khác bị từ chối.
- Trang `/online/` cũ chỉ redirect, không còn bộ chọn Chess/Caro.
- Chess CONTROL có tab `ONLINE` riêng.
- Caro `Chơi Online` mở thẳng `/caro/online/`.

## Static checks
- `caro/caro.js`: Node syntax PASS.
- `online/online.js`: Node syntax PASS.
- Caro deterministic online sync simulation: PASS.
- HTTP local: `/`, `/play.html`, `/caro/`, `/caro/online/`, `/online/chess/`, migration SQL đều trả 200.
