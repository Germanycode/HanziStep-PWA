<div align="center">

![HanziStep — Học tiếng Trung, từng bước vững chắc](docs/assets/hanzistep-readme-hero.png)

# HanziStep

**Ứng dụng PWA học tiếng Trung dành cho người Việt mới bắt đầu — riêng tư, cục bộ và dùng được ngoại tuyến.**

![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-offline--first-5A0FC8?logo=pwa&logoColor=white)

</div>

HanziStep kết hợp từ vựng, hệ thống ôn tập ngắt quãng, luyện Pinyin và thanh điệu, đọc, nghe, nói, viết chữ Hán trong một ứng dụng duy nhất. Dữ liệu học và tiến độ được lưu trong IndexedDB trên máy; ứng dụng không yêu cầu backend hoặc tài khoản.

## Điểm nổi bật

- **Lộ trình cho người mới:** làm quen Pinyin, thanh điệu và từ vựng theo cấp HSK.
- **Ôn tập thông minh:** hỗ trợ SM-2 và FSRS, nhiều dạng câu hỏi, vòng luyện lại lỗi sai và giới hạn câu hỏi trùng từ.
- **Bốn kỹ năng:** đọc truyện, nghe hội thoại, luyện phát âm, shadowing và viết chữ theo nét.
- **Ngữ cảnh Việt Nam:** giao diện tiếng Việt, nghĩa Việt và âm Hán–Việt.
- **Local-first:** tiến độ nằm trên thiết bị; có sao lưu và khôi phục bằng JSON.
- **Hoạt động ngoại tuyến:** PWA cache giao diện, dữ liệu, âm thanh và bộ nét chữ cần thiết.
- **Tùy chọn AI:** tạo truyện, hội thoại và luyện cùng AI Coach khi người dùng tự cung cấp Gemini API key.

## Bắt đầu nhanh

### Yêu cầu

- Node.js `>= 22.12.0`
- npm
- Microsoft Edge nếu chạy bộ kiểm thử E2E

### Dùng hằng ngày trên Windows

Nhấp đúp vào:

```text
Start HanziStep.bat
```

Script sẽ cài dependency khi cần, build ứng dụng, phục vụ tại `http://localhost:4173` và mở Edge.

> [!IMPORTANT]
> IndexedDB phụ thuộc origin. Hãy giữ nguyên cổng `4173` khi dùng hằng ngày; đổi cổng sẽ khiến trình duyệt hiển thị một kho tiến độ khác.

### Chạy môi trường phát triển

```bash
npm install
npm run dev
```

Mở `http://localhost:5173`. Đây là origin phát triển nên dữ liệu tách biệt với bản dùng hằng ngày ở cổng `4173`.

## Các lệnh chính

| Lệnh | Công dụng |
| --- | --- |
| `npm run dev` | Chạy Vite development server |
| `npm run build` | Kiểm tra TypeScript và tạo production build |
| `npm test` | Chạy unit test bằng Vitest |
| `npm run test:e2e` | Build và chạy Playwright trên Microsoft Edge |
| `npm run lint` | Kiểm tra ESLint |
| `npm run typecheck` | Kiểm tra TypeScript |
| `npm run data:validate` | Xác minh tính toàn vẹn của data pack |
| `npm run release:check` | Chạy toàn bộ cổng kiểm tra phát hành |

## Kiến trúc

```text
src/
├── app/          # Router, layout và vòng đời PWA
├── chinese/      # Pinyin, Hán–Việt, phân đoạn và xử lý tiếng Trung
├── data/         # Data pack, từ điển và kiểm tra toàn vẹn
├── db/           # IndexedDB/Dexie, schema và migration
├── features/     # Học, ôn tập, đọc, nghe, nói, viết, thống kê...
├── progress/     # XP, cấp độ, streak và huy hiệu
├── services/     # Âm thanh, giọng nói, hình ảnh và Gemini
├── srs/          # SM-2, FSRS và lịch ôn tập
└── ui/           # Các UI primitive dùng chung
```

Ứng dụng được xây dựng bằng React 19, TypeScript 6, Vite 8, Tailwind CSS 4, Dexie 4, Zustand 5, Vitest và Playwright. Xem thêm [ngữ cảnh miền](docs/CONTEXT.md), [kế hoạch sản phẩm](docs/PLAN.md) và [hướng dẫn triển khai](docs/DEPLOYMENT.md).

## Dữ liệu và quyền riêng tư

- Từ vựng, thẻ ôn tập, lịch sử học và cài đặt được lưu cục bộ trong IndexedDB.
- API key chỉ nằm trong cài đặt trên thiết bị và mặc định không được đưa vào bản sao lưu.
- `data-raw/`, data pack sinh tự động và các file `.env` không được commit.
- Dữ liệu ngôn ngữ và âm thanh đến từ nhiều bộ dữ liệu mở; giấy phép tương ứng được đóng gói cùng data pack.

## Trạng thái dự án

Các luồng cốt lõi đã được triển khai và có unit/E2E test. Tuy nhiên, dự án **chưa được tuyên bố sẵn sàng phát hành công khai** cho đến khi tất cả mục chặn trong [Bugs.md](Bugs.md) được xử lý, đặc biệt là kiểm tra production headers, giấy phép nhạc và Gemini Live với API key thật.

## Đóng góp

Đây hiện là ứng dụng cá nhân cho một người dùng trên một máy. Nếu phát triển tiếp, hãy đọc [AGENT.md](AGENT.md) trước khi thay đổi thuật toán, schema dữ liệu hoặc quy ước của dự án; mọi thay đổi hành vi cần đi kèm kiểm thử phù hợp.
