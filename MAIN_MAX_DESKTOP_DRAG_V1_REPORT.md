# NqznZee Arena — Main integration: NGUYENENGINE MAX + Desktop Drag V1.0

## Tích hợp

- Giữ nguyên hệ thống Chess V9.10 và luồng click-to-move hiện tại.
- Tích hợp Caro `NGUYENENGINE MAX` như bot thứ 5, nhãn `Deep Threat Search`, không hiển thị Elo.
- Thêm kéo-thả quân cờ bằng chuột cho Chess trên máy tính.
- Mobile vẫn dùng cơ chế Tap First / touch drag V7.9 hiện tại; desktop drag chỉ kích hoạt với `pointerType === "mouse"` và thiết bị `(hover: hover) and (pointer: fine)`.

## Desktop drag

- Nhấn và giữ chuột trái trên quân hợp lệ, rê > 6px để bắt đầu kéo.
- Ghost piece bám con trỏ, quân nguồn mờ đi.
- Hiện các ô đi hợp lệ / bắt quân trong lúc kéo.
- Ô thả hợp lệ viền xanh; ô không hợp lệ viền đỏ.
- Thả hợp lệ gọi đúng `NQZ_API.selectSquare()` của core game, nên vẫn đi qua logic game gốc, promotion, log, sound, Coach và bot scheduling.
- Thả sai: quân snap-back và giữ quân nguồn ở trạng thái selected.
- Click-to-move trên desktop vẫn hoạt động nếu người dùng chỉ click mà không kéo.
- Không áp dụng drag chuột khi engine đang bận, AI đang nghĩ, hết ván, hoặc không phải lượt người chơi.

## Kiểm tra đã chạy

- `node --check` cho script Desktop Drag: PASS.
- `node --check caro/caro.js`: PASS.
- `node --check caro/caro-max-engine.js`: PASS.
- `node caro/test-nguyenengine-max.js`: PASS.
- `node caro/test-online-caro-sync.js`: PASS.
- Local HTTP: `/play.html`, `/caro/`, `/caro/caro-max-engine.js` đều trả HTTP 200.
- Static assertions xác nhận Desktop Drag chỉ dành cho mouse/fine pointer, sử dụng legal moves từ chess.js và gọi core `selectSquare()` thay vì tự sửa board state.

## Lưu ý môi trường test

Headless Chromium trong môi trường build bị chặn truy cập cả localhost/file URL bởi chính sách administrator (`ERR_BLOCKED_BY_ADMINISTRATOR`), vì vậy không ghi nhận là đã hoàn tất browser E2E drag test tại đây. Cần test thao tác chuột thật sau khi deploy GitHub Pages.

## Database

Không có thay đổi Supabase/SQL trong bản này.
