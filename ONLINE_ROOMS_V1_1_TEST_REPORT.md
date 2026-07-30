# NqznZee Online Rooms V1.1 — Test report

## Fix chính
- Sửa lỗi `Start` phòng Caro xong lại rơi về lobby Caro.
- Online page tự chuyển cả hai client vào game khi `game_rooms.status = playing`.
- Caro đọc room context và vào thẳng board.
- Player strip map theo X/O thực tế và dùng tên/Elo từ room.
- Chặn click khi chưa tới lượt của mình.
- Realtime Broadcast truyền `caro_move`; client đối diện chạy cùng `CycleGame`.
- Broadcast sync request/state hỗ trợ khôi phục desync/reconnect khi còn peer online.

## Automated checks
- `node --check online/online.js`: PASS
- `node --check caro/caro.js`: PASS
- `node caro/test-online-caro-sync.js`: PASS
- Static integration assertions: PASS

## Lưu ý
- Broadcast gameplay là bản test realtime; Elo Online chưa được cập nhật bởi client.
- Chess hiện đã dùng chung room/start routing nhưng move sync Chess chưa nằm trong V1.1.
