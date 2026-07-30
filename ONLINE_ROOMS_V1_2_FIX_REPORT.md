# NqznZee Online Rooms V1.2 — Caro auto-board fix

## Lỗi được sửa
- V1/V1.1 có thể để room chuyển sang `playing` nhưng Caro lại mở sảnh thay vì bàn.
- Ảnh lỗi cũ có câu “Room system đã hoạt động…” — đây là dấu hiệu file `online/index.html` V1 cũ vẫn đang được GitHub Pages/browser phục vụ.

## V1.2 thay đổi
1. Online room khi `playing` tự `location.replace()` thẳng sang bàn sau 180ms.
2. Trước khi chuyển trang, room id/code/game/side được lưu vào sessionStorage + localStorage.
3. Caro đọc context theo 3 tầng:
   - query string `online_room`,
   - launch context đã lưu,
   - fallback: tự tìm phòng Caro `playing` mà account hiện tại là host/guest.
4. Nếu query string bị mất hoặc redirect cũ, Caro vẫn có thể tự vào bàn.
5. Cache-bust asset: `online.js?v=1.2.0`, `caro.js?v=0.6.5-online-1.2`.
6. Trang phòng có marker `ONLINE V1.2`; footer sảnh Caro có `build ONLINE V1.2` để nhận biết đúng build.

## SQL
Không có migration mới. Giữ nguyên `05_shared_online_rooms.sql`.

## Test tĩnh
- JavaScript syntax: PASS
- Online deterministic sync simulation: PASS
- Auto redirect hook: PASS
- Launch context fallback: PASS
- Active-playing-room fallback: PASS
- Cache-busted asset URLs: PASS
- HTTP local paths `/`, `/online/`, `/caro/`, JS assets: 200

## Khi upload GitHub
Upload đè toàn bộ package. Sau deploy, mở `/online/?game=caro&v=1.2`. Nếu trang bắt đầu trận không ghi `ONLINE V1.2`, GitHub/browser vẫn đang hiển thị build cũ; hard refresh Ctrl+F5 hoặc chờ Pages deploy xong.
