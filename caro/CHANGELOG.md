# 0.6.4 — Full NqznZee Chess UI pass

- Đồng bộ toàn bộ modal và control Caro với phong cách UI trong `play.html` của NqznZee Chess.
- Chọn Bot: bỏ card gradient/dashboard, dùng preset card tối + viền mảnh + accent xanh.
- Thiết lập trận: field/input/nút theo đúng quick-card/control của Chess.
- Kết quả trận: popup compact, nút chính xanh và nút phụ xám như game cờ.
- Đồng bộ side menu, card, toast và các action button trong ván.
- Không thay đổi luật điểm, Bot engine hay cơ chế thưởng lượt.

# LAB 0.6.2

- Thiết kế lại toàn bộ sảnh theo ngôn ngữ CONTROL PANEL của NqznZee Chess.
- Thêm tab CHƠI / BOT / LUẬT / PHONG CÁCH / LAB.
- PHONG CÁCH dùng bố cục THEME WORKSHOP 2 cột giống game cờ vua.
- Giữ nguyên toàn bộ flow Bot, luật điểm động, save và thưởng lượt.


## 0.6.1 — Bonus turn khi ghi điểm

- Mỗi nước đi tạo được ít nhất 1 điểm mới sẽ giữ nguyên lượt, tức người ghi điểm được đi thêm 1 nước.
- Một nước tạo nhiều điểm cùng lúc vẫn chỉ thưởng 1 lượt thêm.
- Nếu điểm vừa ghi đạt mục tiêu thắng, trận kết thúc ngay và không cấp lượt thưởng.
- Bot cũng tuân theo luật thưởng lượt: Bot ghi điểm sẽ tự đánh thêm đúng 1 nước; nếu nước thưởng tiếp tục ghi điểm thì lại được thêm lượt.
- Toast và phần Luật điểm được cập nhật để hiển thị cơ chế mới.
# LAB 0.5.2 — Bot picker packaging fix + browser smoke test

- Sửa lỗi bản HTML đóng gói 0.5.1 bị thiếu hẳn `#botPicker`, khiến nút **Chơi với Bot** không thể hiện gì.
- Đóng gói lại từ đúng source LAB hiện tại; modal chọn Bot nằm trực tiếp trong HTML.
- Kiểm thử bằng Chromium thật: Sảnh → Chơi với Bot → Cực khó → vào trận → người đánh → Bot trả nước → Tạo ván mới → về sảnh → mở Bot lại.
- Không tích hợp Arena ở bản này; chỉ tập trung ổn định Caro LAB.

# Changelog

## LAB 0.1
- Tạo Caro Chu Kỳ độc lập khỏi chess game.
- Engine 4 hướng, score không kết thúc trận.
- Chống tính chồng lặp trên cùng chuỗi/hướng.
- Cho phép nhiều chu kỳ khác hướng trong cùng một nước.
- Canvas infinite board + chunk 16×16 + pan/zoom/touch.
- Giao diện theo bảng màu NqznZee V9.10.
- Autosave localStorage.
- Nhật ký và highlight các chu kỳ đã được tính.
## 0.1.1 - Seamless board
- Ẩn hoàn toàn đường gạch biểu thị ranh giới chunk.
- Chunk vẫn tải động ở nền, nhưng người chơi không còn thấy đường phân chia giữa các chunk.


## 0.1.2
- Bỏ hoàn toàn các đường grid mờ giữa từng ô.
- Giữ nền caro hai màu liền mạch; chunk vẫn hoạt động ngầm và không lộ ranh giới.

## LAB 0.2.0
- Thiết kế lại bố cục mobile theo sketch: header gọn, bàn cờ chiếm phần lớn màn hình, hàng 3 nút dưới bàn.
- 3 nút dưới bàn: Thu nhỏ / Về tâm / Phóng to.
- Nút Về tâm đưa camera về (0,0) nhưng giữ nguyên mức zoom.
- Menu/luật/nhật ký/ván mới chuyển vào drawer mở từ nút ☰.
- Ẩn tọa độ in trên các ô để mặt bàn sạch hơn.

## LAB 0.3.0 — Shared NqznZee Styles
- Thêm 5 phong cách từ NqznZee Chess: Mặc Định, Khủng Long, Tương Lai, Phục Hưng, Pha Lê.
- Dùng đúng màu light/dark/accent từ Theme Workshop của game cờ vua.
- Bàn vô hạn render texture riêng cho từng theme nhưng vẫn overdraw 1px để không lộ khe giữa ô.
- X/O có model canvas riêng theo từng theme (xương/rêu, neon, kim loại, pha lê...).
- Thêm Theme Gallery trong menu Caro và lưu lựa chọn bằng localStorage.
- Nếu cùng origin đã có store NqznZee Chess, Caro sẽ đọc theme hiện tại và đồng bộ lựa chọn theme trở lại store đó.

## LAB 0.4.0 — Sảnh trước trận + Bot Chu Kỳ
- Mỗi lần mở game đều hiển thị Sảnh trước khi vào bàn.
- Thêm `Chơi tiếp` dựa trên save local hiện có; nút tự khóa nếu chưa có ván lưu.
- Thêm `Ván mới · 2 người` cho chế độ local cùng thiết bị.
- Thêm `Chơi với Bot Chu Kỳ`: người chơi X, bot O, bot ưu tiên hoàn thành Chu Kỳ, chặn Chu Kỳ của X, sau đó mới phát triển chuỗi.
- Lưu thêm metadata chế độ để Chơi tiếp đúng ván Bot hoặc ván 2 người.
- Theme Workshop 5 model được đưa thẳng ra Sảnh; đổi model trước khi vào ván và đồng bộ với menu trong game.
- Menu trong ván có `Về sảnh chính`; `Tạo lại ván này` giữ nguyên chế độ đang chơi.
- Khóa thao tác đặt quân của người chơi trong lượt Bot.

## 0.4.1 — Cycle Line + Functional Lobby
- Chu Kỳ giờ chỉ dùng một đường thẳng mảnh chạy qua tâm 5 quân, không còn dải highlight dày.
- Đường Chu Kỳ đổi vật liệu/gradient theo 5 model: Mặc Định, Khủng Long, Tương Lai, Phục Hưng, Pha Lê.
- Giữ line đủ mảnh ở mọi zoom; quân X/O luôn nằm phía trên line.
- Bổ sung markup Sảnh thật: Chơi tiếp, Ván mới 2 người, Đấu Bot, chọn model trước khi vào bàn.
