# NqznZee Caro LAB 0.6.1 — Điểm + lượt thưởng

## Luật lượt thưởng

- Một nước đi không ghi điểm: đổi lượt như bình thường.
- Một nước đi ghi được ít nhất 1 điểm: người vừa ghi điểm giữ lượt và được đánh thêm 1 nước.
- Một nước tạo nhiều điểm ở nhiều hướng vẫn chỉ thưởng 1 lượt thêm.
- Nếu đã đạt điểm mục tiêu và thắng trận, trận kết thúc ngay; không có lượt thưởng sau khi kết thúc.
- Bot áp dụng đúng cùng luật: nếu Bot ghi điểm, Bot tự đánh lượt thưởng tiếp theo.

# NqznZee Caro Lab — Chu Kỳ 0.1

LAB độc lập để phát triển Caro trước khi tích hợp vào NqznZee Chess Arena.

## Luật đang được hiện thực

- X hoặc O tạo 5 quân liên tiếp theo ngang, dọc, chéo ↘, chéo ↗: +1 chu kỳ.
- Có điểm nhưng trận không kết thúc.
- Chu kỳ đã ghi nhận được lưu bằng đúng 5 tọa độ + hướng + line key.
- Không cho một chu kỳ mới dùng lại ô đã được tính trên cùng line/hướng. Vì vậy `XXXXXX` vẫn chỉ 1 điểm.
- Một nhóm 5 mới không chồng lặp có thể cho điểm mới; ví dụ 10 quân liên tiếp có thể trở thành 2 nhóm 5 rời nhau khi nhóm thứ hai được hoàn thành.
- Chu kỳ ở các hướng khác nhau được phép cắt nhau tại một ô. Một nước có thể ghi nhiều chu kỳ ở nhiều hướng.

## Bàn vô hạn

- Không tạo DOM cho cả bàn.
- Mỗi chunk logic là 16×16 ô.
- Chỉ chunk nằm trong viewport được đánh dấu/nạp khi camera đi tới.
- Canvas chỉ vẽ vùng đang nhìn thấy nên không có kích thước bàn cố định.
- Kéo/drag để đi camera; click/tap để đặt quân; cuộn hoặc nút +/- để zoom.

## Giao diện

Màu và vật liệu lấy cảm hứng trực tiếp từ NqznZee Arena V9.10:
- nền #17161b
- accent tím #7c5cff
- bàn cream/green #ebecd0 / #779556
- X dùng tím NqznZee; O dùng cyan để phân biệt rõ trên cả 2 màu ô.

## Lưu trạng thái

LAB 0.1 lưu localStorage để refresh không mất ván và không thể tính lại chu kỳ cũ do reload.
Supabase chưa được nối ở LAB này — sẽ tích hợp sau khi gameplay được chốt.

## Chạy local

```bash
python3 -m http.server 8080
```

Mở `http://localhost:8080`.

## Test luật

```bash
node test-cycle-engine.js
```

### LAB 0.4 — Sảnh và Bot
Khi tải trang, game luôn mở Sảnh trước trận. Tại đây có Chơi tiếp, Ván mới 2 người, Chơi với Bot, và 5 model hình ảnh. Chế độ Bot hiện dùng người chơi X và Bot O; AI ưu tiên nước ghi Chu Kỳ, nước chặn Chu Kỳ đối phương và các chuỗi mạnh quanh vùng quân đã đánh.

## LAB 0.5.2
- Sảnh Bot có 4 cấp: **Dễ / Thường / Khó / Cực khó**.
- **Cực khó – NguyenEngine Caro** dùng tìm kiếm chiến thuật sâu hơn trong vùng ứng viên gần ván đang chơi; đây là engine Caro chuyên cho luật Chu Kỳ, không phải Stockfish.
- Nút **Ván mới** và **Tạo ván mới** không còn dựa vào hộp confirm của trình duyệt nên hoạt động ổn định hơn trên mobile/embedded webview.
- Đường Chu Kỳ đổi vật liệu theo model; Khủng Long dùng silhouette đuôi thon có gai nhỏ, Tương Lai dùng beam neon, Phục Hưng dùng kim loại, Pha Lê dùng băng sáng.
