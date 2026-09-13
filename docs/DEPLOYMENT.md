# Triển khai HanziStep

## Hợp đồng phát hành

- Chỉ triển khai ứng dụng tại gốc của một origin riêng (ví dụ `https://hanzi.example.com/`). Bản hiện tại không hỗ trợ subpath như `/HanziStep/` vì URL dữ liệu, audio, music, worklet và PWA scope đều tuyệt đối từ `/`.
- Artifact duy nhất được phép phát hành là thư mục `dist/` sinh bởi CI hoặc `npm run release:check` sau khi gói dữ liệu đã được tạo bằng `npm run data:fetch && npm run data:build`.
- Host phải trả `404` thật cho asset thiếu trong `/data/`, `/audio/`, `/music/` và `/worklets/`; không rewrite các URL đó thành `index.html`.
- Chỉ route điều hướng của SPA mới fallback về `index.html`.

## Header bắt buộc

Meta CSP trong `index.html` không thể bảo vệ `frame-ancestors`. Host production phải gửi tối thiểu:

```text
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://pixabay.com https://cdn.pixabay.com https://images.unsplash.com https://plus.unsplash.com; media-src 'self' blob:; font-src 'self'; worker-src 'self' blob:; connect-src 'self' https://generativelanguage.googleapis.com wss://generativelanguage.googleapis.com https://pixabay.com https://api.unsplash.com https://images.unsplash.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

Không phát hành công khai các file nhạc cho tới khi ledger giấy phép theo từng track được hoàn tất.
