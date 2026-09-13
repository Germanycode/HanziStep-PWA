# HanziStep PWA — lỗi còn mở, hạn chế và hướng phát triển

**Snapshot:** 2026-09-13, sau Phase 6 và critic vòng 3  
**Nguyên tắc của file:** chỉ giữ những việc **chưa hoàn tất**. Lỗi đã khắc phục được bảo vệ bằng test và không còn liệt kê ở đây.

## Trạng thái hiện tại

Critic độc lập chấm **8,4/10**: đủ thuyết phục để dùng cá nhân, nhưng **chưa sẵn sàng phát hành công khai** cho tới khi đóng các release gate P1 bên dưới.

| Cổng đã xác minh | Kết quả gần nhất |
|---|---:|
| Unit test | **538/538**, 56 file |
| Edge E2E | **10/10** |
| Data validator | **77/77** |
| TypeScript / ESLint / production build | Đạt |
| `npm audit` | **0 vulnerabilities** |
| JavaScript ban đầu | **198,7 KB gzip / 250 KB** |
| Tài nguyên cục bộ | 3.034 file nét, 1.679 audio âm tiết, 8.569 audio từ |

## Lỗi và release gate còn mở

| ID | Mức độ | Khu vực | Hiện trạng / hậu quả | Điều kiện đóng |
|---|---|---|---|---|
| BUG-28 | **P1 — chặn public release** | Bản quyền | Khoảng 42 MB nhạc chưa có ledger theo từng track gồm nguồn, tác giả, URL giấy phép và quyền tái phân phối. | Bổ sung provenance đầy đủ hoặc thay toàn bộ file chưa chứng minh được quyền sử dụng. |
| BUG-26 | **P1 — chặn public release** | Hosting/PWA | Artifact yêu cầu deploy ở root origin; CSP `frame-ancestors` chỉ có tác dụng khi host gửi HTTP header thật. Chưa xác minh host production. | Kiểm tra root scope, route reload, CSP và security headers trên URL production thực. |
| BUG-23 | **P1 — cần manual** | Gemini Live/micro | Cleanup, timeout và lưu transcript đã có trong code, nhưng chưa chạy phiên nói liên tục 5 phút bằng key thật và network thực. | Test đủ 5 phút, ngắt/kết nối lại mạng, kết thúc bất thường và xác nhận micro/context luôn được giải phóng. |
| BUG-29 | **P2 — quy trình** | Git/release | Workspace có CI config nhưng chưa có `.git`/baseline commit, nên chưa thể tag, bisect hoặc rollback một release đã xác định. | Khởi tạo repository và baseline chỉ khi chủ dự án cho phép; CI phải chạy trên clean checkout. |
| BUG-38 | **P2 — sư phạm** | Luyện viết | Cue từ ghép còn lộ chữ đích: khi hỏi `学`, UI có thể hiện `学生 — học sinh`, làm bài nhớ chữ dễ hơn chủ đích. | Che chữ đích thành `＿生`, hoặc chỉ hiện nghĩa/ngữ cảnh không chứa đáp án. |
| BUG-39 | **P3 — UX** | Luyện viết | Khi server trả HTML thay cho JSON nét, alert có thể lộ thông báo parser như `Unexpected token '<'`. | Kiểm tra status/content-type và luôn ánh xạ lỗi sang thông báo tiếng Việt ổn định. |
| BUG-40 | **P3 — mobile** | Layout | Music player cố định có thể cạnh tranh không gian với nút checkpoint trên màn hình thấp. | Đo geometry ở các viewport nhỏ; tự thu gọn/di chuyển player và giữ CTA luôn thao tác được. |
| BUG-43 | **P3 — dữ liệu** | Hán-Việt | Chuỗi có nhiều cách đọc ngăn bằng `/` đôi lúc không thể căn chắc chắn với từng chữ. Hệ thống hiện bỏ ánh xạ mơ hồ thay vì đoán sai. | Chuẩn hóa nguồn thành danh sách reading theo vị trí hoặc bổ sung metadata cấp ký tự. |

## Hạn chế hiện tại của sản phẩm

### 1. Chương trình học

- Tám bài hiện tại bao phủ Pinyin và thanh điệu khá tốt, nhưng chưa phải một giáo trình tiếng Trung sơ cấp hoàn chỉnh: chưa có lộ trình ngữ pháp, mẫu câu và giao tiếp theo chủ đề.
- Mỗi bài chỉ cần vượt một câu nhận biết xác định. Checkpoint chứng minh người học đã chú ý, chưa chứng minh phát âm chủ động hoặc ghi nhớ bền.
- Drill thích nghi theo lỗi đã làm, nhưng chưa có bài kiểm tra đầu vào hoặc cơ chế điều chỉnh toàn bộ lộ trình theo năng lực.

### 2. Phát âm và nghe nói

- Audio cục bộ có độ phủ lớn, nhưng chưa được native speaker nghe kiểm toàn bộ về âm lượng, nhịp, độ nhất quán và chất giọng.
- Nhận dạng giọng, microphone và pitch feedback phụ thuộc trình duyệt/thiết bị; chưa có chuẩn điểm phát âm có thể so sánh ổn định giữa các máy.
- AI Coach và sinh hội thoại phụ thuộc Gemini/API key, quota và mạng. Khi không có key, kho hội thoại offline ban đầu còn nghèo.

### 3. Hán tự và luyện viết

- 3.034 chữ HSK có hình học/thứ tự nét cục bộ và SRS theo từng chữ, nhưng chưa có trình khám phá bộ thủ, thành phần, từ nguyên, tên nét, chữ phồn thể và các từ thường gặp quanh mỗi chữ.
- Chấm nét đã có đường E2E thành công và bỏ cuộc, nhưng chưa thử thực tế bằng ngón tay/bút cảm ứng, palm rejection, scroll conflict và nhiều kích thước màn hình.
- Dữ liệu ưu tiên an toàn: nếu không căn chắc pinyin/Hán-Việt theo vị trí, app để trống thay vì suy đoán. Điều này tránh học sai nhưng làm một số cue kém đầy đủ.

### 4. Offline, dữ liệu và đồng bộ

- HanziStep là local-first: UI lưu trực tiếp vào Dexie/IndexedDB, không có backend tài khoản. Vì vậy chưa có đồng bộ đa thiết bị, chia sẻ tiến độ hoặc khôi phục cloud tự động.
- App shell và dữ liệu nét được precache; từ điển, phần lớn audio và nhạc chủ yếu được cache sau khi dùng. Chưa có nút tải trọn “offline pack” kèm dung lượng/trạng thái.
- Backup JSON đang là cơ chế di chuyển dữ liệu chính. Chưa có auto-backup tới thư mục người dùng chọn và chưa thử restore một profile lâu năm trên thiết bị thật.
- IndexedDB gắn với origin: đổi domain, port hoặc deploy dưới subpath có thể làm người dùng tưởng tiến độ đã mất nếu không có quy trình migration/import rõ ràng.

### 5. UI và khả năng tiếp cận

- Menu mobile đã hiển thị đầy đủ route, nhưng player cố định và các panel dài vẫn cần kiểm tra thêm trên màn hình thấp, zoom lớn và bàn phím ảo.
- Chưa có audit toàn diện bằng screen reader, high-contrast mode, reduced motion và chỉ-bàn-phím cho mọi bài luyện.
- PWA upgrade trên profile cũ cần một bài test riêng để chắc route mới, service worker mới và DB migration chuyển cùng nhau mà không để lại màn 404 cũ.

## Tính năng và cải thiện đề xuất

### Ưu tiên P0 — trước khi phát hành công khai

1. Hoàn thành ledger giấy phép nhạc hoặc thay asset không rõ provenance.
2. Tạo Git baseline/tag release và chạy CI từ clean checkout.
3. Deploy thử ở root origin, xác minh CSP/security headers, offline reload và nâng cấp service worker trên profile DB v3/v4 có dữ liệu.
4. Chạy Gemini Live 5 phút bằng key thật với các kịch bản mất mạng, đóng tab và từ chối quyền micro.

### Ưu tiên P1 — tăng chất lượng học

1. **Writing recall 2.0:** che chữ đích trong từ gợi ý, chuẩn hóa lỗi tải nét, lưu thống kê từng nét hay sai và cho luyện lại nét yếu.
2. **Character Explorer:** bộ thủ, thành phần âm/nghĩa, tên nét, từ nguyên ngắn, giản thể–phồn thể, pinyin đa âm và mạng lưới từ chứa chữ.
3. **Checkpoint nhiều tầng:** nhận biết → nghe phân biệt → gõ pinyin → thu âm/tự đánh giá; thêm bài ôn checkpoint sau 1–3 ngày.
4. **Giáo trình sơ cấp có cấu trúc:** mẫu câu, ngữ pháp, hội thoại theo chủ đề và điều kiện tiên quyết liên kết với vốn từ/SRS.
5. **Offline Content Manager:** chọn tải HSK level, từ điển, audio, hội thoại và nhạc; hiển thị dung lượng, checksum, phiên bản và nút dọn cache.
6. **Pronunciation Lab:** hiệu chỉnh microphone, so sánh contour thanh điệu, playback A/B với giọng mẫu và rubric dễ hiểu cho người Việt.

### Ưu tiên P2 — mở rộng nền tảng

1. Đồng bộ tùy chọn có mã hóa đầu cuối hoặc backup tự động vào thư mục do người dùng chọn; local-first vẫn là mặc định.
2. Gói hội thoại/listening offline dựng sẵn để người mới dùng được ngay khi không có Gemini key.
3. Nâng model Gemini Live sau khi regression test chất lượng/chi phí; thêm TTS fallback và cache audio sinh ra.
4. Extension Chrome để gửi chữ/từ đang bôi đen vào hàng chờ HanziStep.
5. Nhập PDF vào Reader với OCR tùy chọn và giữ nguồn/trang cho từng câu.
6. Nhận dạng giọng offline bằng Whisper/on-device model, có cảnh báo rõ rằng speech-to-text không tự chứng minh thanh điệu đúng.
7. Dashboard chẩn đoán dữ liệu: phiên bản manifest, dung lượng từng cache, lỗi asset, trạng thái backup và nút xuất gói hỗ trợ đã loại secret.
8. Audit accessibility đầy đủ và chế độ giảm chuyển động/độ tương phản cao.

## Tiêu chí triển khai

- **Dùng cá nhân:** chấp nhận được ở snapshot hiện tại; nên backup JSON trước khi nâng cấp.
- **Beta giới hạn:** đóng BUG-38/39/40, hoàn thành thử nghiệm touch/micro/PWA upgrade và cung cấp offline dialogue tối thiểu.
- **Public release:** phải đóng toàn bộ P1, có Git/tag/CI tái lập được, xác minh host production và không phân phối asset thiếu bằng chứng bản quyền.

Khi một mục được khắc phục và có bằng chứng phù hợp, hãy **xóa mục đó khỏi file này** thay vì tiếp tục tích lũy lịch sử “đã sửa”.
