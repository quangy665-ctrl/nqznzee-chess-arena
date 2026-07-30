# NqznZee Arena V9.10 + Caro 0.6.5 integration

## Thay đổi
- Giữ nguyên `play.html` Chess V9.10 (SHA-256 trùng baseline).
- Đưa nút **Chơi Caro Điểm** ngay dưới nút **Chơi ngay** trong hero Trận nhanh.
- Caro rating tách hoàn toàn khỏi Chess rating.
- Mỗi tài khoản/khách lần đầu vào Caro có **Caro Elo 1000**.
- Caro Elo thử nghiệm được lưu trong `localStorage` theo account key (`nqznzee-caro-ratings-v1`).
- Không đọc `ratings.bot_rating` của Chess làm Elo Caro.
- Bàn Caro có player strip giống Chess:
  - Đối thủ ở trên.
  - Người chơi X ở dưới.
  - Tên + Caro Elo + điểm.
  - Strip active theo lượt.
- Bot có Elo hiển thị theo cấp độ: Dễ 700, Thường 1000, Khó 1400, Cực khó 2200.
- Caro dùng tài khoản Supabase hiện tại chỉ để lấy username/display name.
- UI Caro được chuyển accent/control sang xanh NqznZee để hợp giao diện Chess V9.10.

## Kiểm tra
- `play.html` byte-for-byte giống baseline V9.10.
- `caro.js` qua `node --check`.
- Core point engine / dynamic rules / bonus turn tests PASS.
- Local links/assets kiểm tra: không thiếu file.
- HTTP smoke: `/`, `/play.html`, `/caro/`, `/account-v9-8.js`, `/caro/caro.js`, `/caro/styles.css` trả 200 trên local server.

## Ghi chú rating
Giai đoạn này Caro Elo là rating độc lập **local-first** để test tích hợp. Khi làm Online, tạo bảng Supabase `caro_ratings` với default 1000 và migrate giá trị này lên cloud.
