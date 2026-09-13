# Kế hoạch: HanziStep — web app học tiếng Trung (dựa trên "English Extension for you")

## 1. Bối cảnh

**Hiện trạng.** `English Extension for you` là Chrome Extension MV3 viết JS thuần, không có bước build (tên hiển thị "GermanyVocab"). Chức năng chính:
- Bôi đen từ trên web để tra và lưu từ.
- Ôn tập ngắt quãng SM-2 với 7 dạng câu hỏi tăng dần theo mức thuộc.
- XP, 10 level, 12 huy hiệu, streak, trang thống kê.
- Story Mode (Gemini), AI Speaking Coach (Gemini Live), nhạc nền.

**Mục tiêu.** Xây mới một web app học tiếng Trung. App dùng lại cấu trúc, thuật toán, cách tính điểm, streak và assets của app tiếng Anh, rồi mở rộng dần ra đủ 4 kỹ năng nghe, nói, đọc, viết.

**Quyết định đã chốt:**

| Hạng mục | Quyết định |
|---|---|
| Nền tảng | React + Vite + TypeScript, dạng PWA |
| Lưu trữ | IndexedDB (Dexie), không backend; sao lưu bằng JSON |
| Phạm vi dùng | Cá nhân, 1 máy tính |
| Người học | Mới bắt đầu, chưa biết pinyin và thanh điệu |
| MVP | Từ vựng + SRS · Đọc + tra từ · Nghe + Nói (Viết để Phase 6) |
| Giao diện | Tiếng Việt; nghĩa hiển thị VI trước, EN sau, kèm âm Hán Việt |
| AI | Gemini, API key nhập trong Settings |

**Tên và vị trí đề xuất:** `D:\WORKSPACE\Real project\HanziStep-PWA`.
- Dùng lại thương hiệu HanziStep (con dấu 汉, khẩu hiệu "中文，从这里开始").
- Tách hẳn khỏi `HanziStep-source-v1`, vì bản đó chỉ là UI mẫu gắn với OpenAI Sites/Cloudflare.
- Máy đã có Node v24.15.0 và npm 11.12.1.

**3 điểm khác biệt quan trọng so với app tiếng Anh:**
1. **Nghĩa tiếng Việt lấy offline từ CVDICT**, không dịch từng từ qua API.
2. **Mỗi từ có nhiều facet (kỹ năng):** `read`, `listen`, `speak`, `write`. Mỗi facet có lịch SM-2 riêng và được mở khoá dần, để người mới không bị ngợp.
3. **Phase Pinyin & Thanh điệu đi trước SRS.** Gõ pinyin, câu hỏi nghe và distractor theo thanh đều cần nền tảng này.

---

## 2. Kiểm kê: tái sử dụng gì từ app tiếng Anh

### 2.1 Bản đồ port
Đường dẫn gốc tính từ `D:\WORKSPACE\Real project\English Extension for you\`. Đường dẫn đích tính từ `HanziStep-PWA/src/`.

| Chức năng gốc | Vị trí gốc | Đích | Thay đổi / sửa |
|---|---|---|---|
| SM-2 `updateSM2` | `review/review.js:1930` | `srs/sm2.ts`, hàm thuần `(state, q, now) → state` | Giữ nguyên công thức; có golden test (5.2) |
| `calculateAnswerQuality` và quality của câu gõ | `review.js:1481`, `review.js:2575` | `features/review/engine/quality.ts` | Chuyển thành bảng theo từng dạng câu hỏi (5.3) |
| `renderNextQuestion`: chọn dạng câu hỏi theo rep | `review.js:1032` | `features/review/engine/selectQuestionType.ts` | Hàm thuần, truyền random vào từ ngoài, ma trận facet × rep (5.4) |
| Các hàm `renderMCQ`, `renderPicture`, `renderMatch`, `renderSynonym`, `renderCollocation`, `renderSentence`, `renderTypingQuestion` | `review.js:1103–1477`, `2463–2592` | `features/review/questions/*.tsx` | Dùng chung interface `QuestionProps → AnswerResult`; distractor mới (5.5) |
| Review Gate, `formatTimeLeft`, session bar, progress ring | `review.js:754–1030` | `features/review/{ReviewGate,SessionBar}.tsx`, `lib/time.ts` | Hiển thị thời gian bằng tiếng Việt; hiện backlog và số từ mới còn lại trong ngày |
| `startMistakeReview` | `review.js:985` | `features/review/engine/session.ts#buildRetryRound` | **Chỉ luyện tập, không cập nhật SM-2** (sửa lỗi phạt 2 lần) |
| Summary panel, `fetchMissingMedia` | `review.js:1519–1723` | `features/review/SummaryPanel.tsx`, `features/vocab/enrichWord.ts` | Thêm Hán Việt từng chữ, lượng từ, câu ví dụ, audio tốc độ chậm |
| `recordReviewResult` (streak, lịch sử) | `review.js:2286` | `progress/{recordActivity,streak}.ts` | Dùng ngày local; streak tính lúc đọc (6.4) |
| `LEVEL_DEFINITIONS`, `BADGES_DEFINITIONS`, `getLevelInfo`, `addGamificationXP` | `review.js:3766–3995`, `background/background.js:1242` | `progress/{xp,levels,badges}.ts` | Gom về một nguồn; có trần XP/ngày; đường cong level mới |
| `renderStatistics` | `review.js:2329–2459` | `features/stats/*` | Thêm heatmap 98 ngày (port từ `Reading app/frontend/components/tracker/HeatmapCalendar.tsx`), tiến độ HSK, ma trận độ chính xác theo cặp thanh |
| Bảng từ vựng: tìm kiếm, lọc, sắp xếp, tag, xoá hàng loạt | `review.js:397–660`, `3577–3762` | `features/vocab/*` | Lọc thêm theo mastery từng facet, cấp HSK, nguồn, từ gần âm Hán Việt |
| Import/Export JSON và CSV (merge/overwrite, preview, BOM) | `review.js:1990–2275` | `features/backup/*`, `lib/csv.ts` | Giữ các cột CSV cũ, thêm Pinyin, Traditional, Han Viet, HSK Level, Tags; backup JSON toàn DB |
| `updateStoredVocabList`, `persistVocabularyWord`, `syncVocabList`, `queueVocabWrite` | `review.js:1847–1892`, `background.js:1122` | Transaction Dexie trong `features/review/engine/answerCard.ts` + `useLiveQuery` | Không cần hàng đợi ghi tự viết |
| `saveVocabulary` | `background.js:1133` | `features/vocab/saveWord.ts` | Chống trùng theo `[simplified+pinyinNum]`; làm giàu dữ liệu local; ảnh bổ sung sau; tạo card; cộng XP qua progress service |
| `handleTranslation` (endpoint gtx) | `background.js:1044–1120` | `services/translate/gtx.ts` | zh-CN → vi, **chỉ dùng cho câu**; cache IndexedDB 7 ngày |
| `handleLemmatizeWord`, `inferPartOfSpeech` | `background.js:147–226` | `chinese/segment/*`, `data/dictLookup.ts` | Thay bằng tách từ + longest-match; từ loại lấy từ HSK/CEDICT |
| `lookupDictionaryWord` (Promise.any, cache, gộp request trùng) | `background.js:465–557` | `data/dictLookup.ts`, `lib/dedupe.ts` | Tra offline trong IndexedDB |
| `lookupPronunciation` (IPA) | `background.js:559–627` | `chinese/pinyin/*` + pinyin-pro | Pinyin chuẩn (CEDICT), pinyin theo ngữ cảnh, màu thanh điệu |
| `speakText`, `scoreVoice` | `background.js:629`, `options/options.js:100–148` | `services/speech/{tts,voices,geminiTts}.ts` | Lọc giọng zh-CN, đọc theo câu, dự phòng Gemini TTS (8.1) |
| Tìm ảnh: `fetchVocabularyImage`, `chooseBestPixabayImage`, `generateSmartImageQuery` | `background.js:232–426` | `services/images/*` | Tìm bằng **nghĩa tiếng Anh**; bỏ qua trợ từ, lượng từ, đại từ; key để trong Settings |
| `fetchWithTimeout`, `readCachedValue`, `cacheValue` | `background.js:433–463` | `lib/http.ts`, `lib/cache.ts` | Cache bền (TTL + LRU) |
| `explainCollocationWithGemini` | `background.js:809` | `services/ai/prompts/explain.ts` | Ghi chú cách dùng bằng tiếng Việt: 搭配, lượng từ, phân biệt từ gần nghĩa (会/能/可以) |
| `evaluateSentenceWithGemini` | `background.js:870` | `services/ai/prompts/grade.ts` | Schema `{correct, score, corrected, pinyin, feedbackVi}` |
| Story Mode: `handleGenerateStory` và phần hiển thị | `background.js:912–1042`, `review.js:3152–3528` | `features/reading/{generateStory,validateStory}.ts` + reader | Trả về mảng câu, độ dài theo cấp HSK, kiểm tra độ phủ từ (7.4) |
| `notifyDueWords` | `background.js:1269` | `navigator.setAppBadge()` + banner trong app | PWA không có backend thì không đẩy thông báo được khi đã đóng |
| Tách câu chứa từ được chọn | `content/content.js:299–325` | `lib/sentenceSplit.ts` | Tách theo `。！？；…`, xuống dòng, ngoặc kép đóng |
| Popup tra nhanh + thống kê | `popup/popup.js` | `features/today/TodayPage.tsx` + tra nhanh bằng Ctrl+K | — |
| AI Coach (WebSocket Live, worklet, voice gate, phát 24 kHz) | `review.js:22–43`, `2598–3150`, `review/audio-recorder-worklet.js` | `features/coach/{liveSocket,voiceGate,pcm,playback,useLiveCoach}.ts`, `public/worklets/` | Giữ các hằng số; model ID lấy từ Settings; prompt cho người mới (8.5) |
| Music player, `music-tracks.js`, âm thanh đúng/sai | `review.js:44–68`, `217–323`, `assets/musics/music-tracks.js` | `features/music/*`, `services/audio/sfx.ts` | Tự giảm âm lượng nhạc khi TTS, ghi âm hoặc coach đang chạy |
| Theme tokens | `review/review.css:8–43`, `assets/backgrounds/Light mode.md` | `styles/tokens.css` → Tailwind `@theme` | Thêm token màu thanh điệu |
| Hook TTS React | `Reading app/frontend/hooks/useSpeechSynthesis.ts` | Điểm khởi đầu cho `services/speech/tts.ts` | — |

### 2.2 Assets copy nguyên
- **Nhạc nền:** 11 track `assets/musics/*.mp3` (~42 MB) + registry → `public/music/`. Chỉ cache khi phát, không precache.
- **Âm thanh:** `Right_answer.mp3`, `Wrong answer.mp3` → `public/audio/sfx/`.
- **Theme:** dark indigo `#6366f1→#8b5cf6`; light teal `#2ba8a2` + coral `#ef6c4a` (Flip7). Tuỳ chọn thêm palette từ `Reading app/assets/backgrounds/*.md`.
- **Ý tưởng UI** từ `HanziStep-source-v1/app/learning-dashboard.tsx`: điều hướng Hôm nay / Lộ trình / Ôn tập / Tiến độ, vòng mục tiêu ngày, thẻ phát âm theo thanh, con dấu 汉.

### 2.3 Không mang sang
- **Chỉ dùng cho tiếng Anh:** wink-lemmatizer, dictionaryapi.dev, Datamuse, Wiktionary IPA, YouGlish.
- **PDF viewer của extension:** có thể làm lại ở Phase 6.
- **Pixabay key viết cứng ở `background/background.js:17`:** tuyệt đối không copy.

### 2.4 Lỗi và nợ kỹ thuật phải sửa khi port

| # | Vấn đề (vị trí) | Cách sửa |
|---|---|---|
| 1 | Ngày của streak, lịch sử và biểu đồ 7 ngày tính theo UTC (`review.js:2293`, `2408`), nên ở UTC+7 ngày mới bắt đầu lúc 07:00 | `toDayKey()` theo giờ local, có tuỳ chọn `dayStartHour` |
| 2 | Streak hiển thị không tự về 0 khi bỏ lỡ ngày | Tính streak lúc đọc, từ `dailyStats` |
| 3 | Vòng "Review missed words" gọi `updateSM2` lần thứ hai: từ bị phạt 2 lần, EF trôi (`review.js:985`) | Vòng ôn lại chỉ để luyện tập, không đổi lịch |
| 4 | +30 XP "hoàn thành phiên" được cộng chỉ sau 1 câu (`review.js:967`) | Cần ≥ 10 câu, hoặc hết hàng đợi với ≥ 5 câu |
| 5 | Logic XP/level lặp ở 2 nơi; background.js nâng level cứng `xp>=150 → level 2` (`background.js:1245`) | Chỉ lưu XP; level luôn tính bằng `getLevelInfo` |
| 6 | Lên level 10 (5.500 XP) chỉ cần khoảng 370 câu đúng | Đường cong level mới (6.2) |
| 7 | Xáo trộn lệch vì dùng `sort(() => Math.random() - 0.5)` | Fisher–Yates + `mulberry32(seed)` để test được |
| 8 | Distractor chọn ngẫu nhiên, trộn với danh sách từ giả | Distractor có chủ đích (5.5) |
| 9 | `AGENT.md` mô tả sai thang interval, và ghi tên model Live khác với code (`review.js:38`) | Tài liệu cập nhật cùng commit với thuật toán và test; model ID là setting |
| 10 | Gemini key nằm trong URL `?key=` | REST dùng header `x-goog-api-key`. WebSocket Live trên trình duyệt không đặt được header, nên vẫn phải dùng query (chấp nhận được khi dùng cá nhân) |
| 11 | Pixabay key đã nằm trong git history của repo tiếng Anh | Không copy; nên đổi (rotate) key đó |

---

## 3. Dữ liệu tiếng Trung

### 3.1 Nguồn và license (đã kiểm tra)

| Nguồn | Dùng cho | License | Cách tích hợp |
|---|---|---|---|
| [complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary) | Danh sách từ HSK 2.0 (cấp 1–6) và HSK 3.0 (cấp 1–6 + bậc 7–9), tần suất, từ loại, lượng từ | MIT (nghĩa tiếng Anh gốc từ CEDICT) | `complete.min.json` (~3 MB). Các field: `simplified`, `level[]` (`old-N`/`new-N`), `frequency`, `pos`, `forms[].{traditional, transcriptions.{pinyin,numeric}, meanings, classifiers}` |
| CC-CEDICT (MDBG) | Từ điển Trung–Anh khoảng 120k mục, lượng từ `CL:`, dữ liệu cho tách từ | CC BY-SA 4.0 | Parse lúc build |
| [CVDICT](https://github.com/ph0ngp/CVDICT) | Nghĩa tiếng Việt cho khoảng 122k mục, cùng định dạng CEDICT (`CVDICT.u8`, 10,8 MB) | CC BY-SA 4.0 | **Nguồn nghĩa VI chính (offline).** Dịch bằng GPT-4o, có người review nhưng vẫn còn lỗi, nên cho phép sửa nghĩa. Gemini chỉ dùng cho "nghĩa trong câu này". Không có âm Hán Việt |
| [hanviet-pinyin-words](https://github.com/ph0ngp/hanviet-pinyin-words) | Âm Hán Việt theo chữ + pinyin (giải quyết chữ có nhiều âm) | MIT (danh sách gốc `hanviet-pinyin-wordlist` chưa rõ license) | Nguồn Hán Việt chính. Nếu vẫn còn mơ hồ thì hiện cả hai (ví dụ "HÀNH/HÀNG") để người dùng chọn |
| Unihan `kVietnamese` | Âm Hán Việt dự phòng | Unicode License | Dùng khi nguồn chính không có |
| [audio-cmn](https://github.com/hugolpz/audio-cmn) | 1.707 âm tiết đủ thanh (`cmn-ma1.mp3`, giọng Chen Wang) và 5.596 từ HSK (`cmn-{hanzi}.mp3`, giọng Yue Tan). Giọng người thật | CC BY-SA | **Nguồn audio chính** cho âm tiết và từ HSK; dùng bản `24k-abr` |
| [Tone Perfect](https://www.diglib.org/tone-perfect-multimodal-database-mandarin-chinese/) (MSU) | 410 âm tiết × 4 thanh × 6 giọng | Phi thương mại, cần đăng ký | Tuỳ chọn: tăng độ đa dạng giọng cho bài luyện nghe thanh |
| [pinyin-pro](https://github.com/zh-lx/pinyin-pro) | Chuyển chữ Hán sang pinyin theo ngữ cảnh, có tuỳ chọn `toneSandhi` | MIT | Tải lười, chạy trong worker |
| `Intl.Segmenter` | Tách từ | Có sẵn trong trình duyệt | Kết hợp bước reconcile theo CEDICT |
| Tatoeba | Câu ví dụ | CC BY 2.0 FR | Lọc theo cấp |
| [hanzi-writer](https://hanziwriter.org) + [data](https://github.com/chanind/hanzi-writer-data) | Thứ tự nét (Phase 6) | Thư viện MIT; dữ liệu Arphic Public License | Mỗi chữ một file JSON, copy về local |
| Pixabay API | Ảnh minh hoạ | Pixabay Content License | Key riêng; tìm bằng nghĩa tiếng Anh |
| Gemini (text, TTS, [Live](https://ai.google.dev/gemini-api/docs/live-api/capabilities)) | Tạo truyện, chấm câu, TTS dự phòng, Coach | Trả phí theo lượng dùng | Live hỗ trợ tiếng Trung. Model native-audio tự chọn ngôn ngữ, nên phải ép qua system prompt |
| [mp3-chinese-pinyin-sound](https://github.com/davinfifield/mp3-chinese-pinyin-sound) | Dự phòng audio âm tiết | Unlicense | Chưa kiểm tra độ phủ |

> **Lưu ý license:** dùng cá nhân thì không có vấn đề. Nếu sau này chia sẻ công khai, dữ liệu CC BY-SA bắt buộc ghi công và giữ cùng license. Vì vậy từ Phase 0 đã có trang **Settings → Nguồn & Ghi công**.

### 3.2 Pipeline build dữ liệu (`scripts/`, chạy bằng `tsx`)
Các bước:
1. `fetch-datasets`: tải từ URL cố định, lưu sha256, copy LICENSE vào `data-raw/` (thư mục này nằm trong gitignore).
2. Chạy lần lượt `build-hsk`, `build-dict`, `build-hanviet`, `build-sentences`, `build-syllables`, `build-syllable-audio`.
3. `validate-data`: kiểm tra bằng Zod và soát mẫu. Ví dụ: 银行 = `yin2 hang2`; 学 → HỌC; 个 là lượng từ của 人; 你好 có 2 âm tiết.
4. Sinh `public/data/v1/manifest.json`.

| Output | Nguồn | Nội dung | Kích thước |
|---|---|---|---|
| `hsk/{hsk2-1..6, hsk3-1..6, hsk3-7_9}.json` | complete-hsk-vocabulary | Giản thể, phồn thể, pinyin dạng số, từ loại, tần suất, bộ thủ, lượng từ; sắp theo tần suất | 30–700 KB/cấp |
| `dict/dict.json.gz` | CC-CEDICT ghép CVDICT (khoá: phồn thể + giản thể + pinyin) | `{s, t, p, en[], vi[], cl[]}`; đổi `u:` thành `ü`; gloss dạng "variant of"/"surname" không dùng để tìm ảnh | 5–7 MB gzip (25–40 MB trong IndexedDB) |
| `hanviet.json` | hanviet-pinyin-words, dự phòng Unihan | chữ → {pinyin → [các âm Hán Việt]} | 0,2–0,5 MB |
| `sentences/{1..6}.json` | Tatoeba | Câu ≤ 20 chữ, ≥ 90% token thuộc HSK ≤ cấp L; mỗi từ giữ 5 câu ngắn nhất | Tổng 1–3 MB |
| `syllables.json` | Tự sinh | 410 âm tiết → thanh mẫu/vận mẫu, vị trí đặt dấu, tập âm tiết hợp lệ | ~30 KB |
| `audio/syllables/{syl}{tone}.webm` | audio-cmn | Mã hoá Opus ~24 kbps | 10–15 MB, tải lười |
| `audio/words/{hanzi}.webm` (tuỳ chọn) | audio-cmn HSK | Phát âm từ HSK bằng giọng người thật | Tải lười, cache khi dùng |
| `hanzi/*.json` (Phase 6) | hanzi-writer-data | Chỉ các chữ trong HSK | 8–10 MB |

**Chiến lược tải:**
- **Precache:** app shell, `hanviet.json`, `syllables.json`, chunk HSK đang học, âm thanh sfx.
- **Runtime cache-first (Workbox, 30 ngày):** các cấp HSK khác, câu ví dụ, audio, nhạc (chỉ khi phát), ảnh Pixabay (tối đa 500).
- **Lần chạy đầu:**
  - `dictImport.worker.ts` tải `dict.json.gz`, giải nén bằng `DecompressionStream('gzip')`, rồi `bulkPut` từng lô 5k, có thanh tiến độ.
  - Khi `dataVersion` thay đổi thì import lại.
  - Trong lúc import chưa xong, tra từ bằng dữ liệu HSK + gtx.

---

## 4. Kiến trúc

### 4.1 Stack

| Mảng | Lựa chọn | Lý do |
|---|---|---|
| Build | Vite (bản ổn định mới nhất) + React 19 + TypeScript strict | Máy đã có Node 24 |
| PWA | `vite-plugin-pwa` (Workbox), `registerType: 'prompt'` | Chạy offline, có nút cập nhật. Cần kiểm tra plugin hỗ trợ đúng bản Vite |
| Routing | React Router 7 | Đơn giản |
| Lưu trữ | Dexie 4 + `dexie-react-hooks` | IndexedDB có index, migration, query phản ứng |
| State tạm | Zustand | Phiên ôn, player, hàng đợi TTS, coach |
| Validate | Zod 4 | Schema JSON của Gemini, import backup, kiểm tra dữ liệu |
| AI | Client `fetch`/WebSocket tự viết, không dùng SDK | Giống extension, bundle nhỏ |
| UI | Tailwind v4 + tokens từ `review.css`; shadcn/ui copy từng component cần dùng (Dialog, Popover, Tabs, Dropdown, Slider, Switch); `sonner`; `lucide-react` | Nhẹ, dùng lại theme cũ |
| Tiếng Trung | `pinyin-pro` (tải lười trong worker), `Intl.Segmenter`, `hanzi-writer` (Phase 6) | Xử lý chữ đa âm theo ngữ cảnh, biến điệu 一/不 |
| Phân tích audio | `pitchy` (Phase 4) | Vẽ đường cao độ khi shadowing |
| Scheduler sau này | `ts-fsrs` (Phase 5) | FSRS dùng chung interface |
| Biểu đồ | Tự vẽ bằng SVG/div | Tránh Recharts nặng |
| Font | Font CJK có sẵn trên hệ thống (Microsoft YaHei…) | Không nhúng Noto Sans SC (> 10 MB) |
| Test | Vitest + happy-dom + Testing Library + `fake-indexeddb`; Playwright (Chromium, mic giả) | Unit test cho engine thuần, e2e cho các luồng |
| Lint | ESLint 9 flat config + typescript-eslint + Prettier | — |

### 4.2 Cấu trúc thư mục
```
HanziStep-PWA/
  AGENT.md  docs/CONTEXT.md  docs/adr/          # tài liệu phải khớp code
  Start HanziStep.bat                           # build rồi vite preview --port 4173 --strictPort (origin cố định!)
  data-raw/ (gitignore)   scripts/{lib, fetch-datasets, build-*, validate-data}.ts
  public/  data/v1/  audio/{sfx,syllables,words}/  music/  worklets/  icons/
  src/
    app/        App, router, layout (Sidebar, MobileNav, TopBar)
    db/         db.ts, schema.ts, migrations.ts, repos/*
    domain/     types.ts
    lib/        random, dayKey, time, http, cache, dedupe, csv, sentenceSplit
    chinese/    pinyin/{syllables,parse,marks,compare,sandhi}  segment/{segmenter.worker,reconcile,longestMatch}  hanviet  toneColors  cognate
    data/       manifest, hskLoader, dictImport.worker, dictLookup, sentences
    srs/        scheduler, sm2, ratings, cardFactory, fsrs (P5)
    services/   ai/{gemini,schemas,prompts/*}  translate/gtx  images/*  speech/{tts,voices,geminiTts,recognition,pitch,recorder}  audio/{sfx,audioCache}
    progress/   xp, levels, badges, streak, dailyGoal, recordActivity
    features/   today  learn  pinyin  vocab  review/{engine,questions}  reading  listening  speaking  coach  stats  settings  backup  music  writing (P6)
    ui/         primitives, HanziText, PinyinText, ToneColored, AudioButton
    styles/     i18n/vi.ts
  tests/  e2e/*.spec.ts  fixtures/{gemini,asr,audio}
```
Sidebar: Hôm nay · Học mới · Ôn tập · Đọc · Nghe & Nói · Phát âm · Từ vựng · Thống kê · Cài đặt.

### 4.3 Mô hình dữ liệu (rút gọn)
```ts
type Facet = 'read' | 'listen' | 'speak' | 'write';
type Quality = 0 | 1 | 2 | 3 | 4 | 5;

interface Word {
  id; simplified; traditional?;
  pinyinNum;                 // "yin2 hang2"
  pinyinVariants[];
  hanViet;                   // "NGÂN HÀNG"
  meaningVi[]; meaningEn[]; pos[]; classifiers[];
  hsk: { hsk2?, hsk3? }; freqRank?; cognate: boolean;
  source: 'hsk-list' | 'reader' | 'manual' | 'import' | 'coach';
  context?: { sentence, sentenceVi?, textId? };
  examples[]; imageUrl?; imageStatus; tags[]; knownWithoutSrs?;
  ai?: { usageNoteVi?, collocations? };
  createdAt; updatedAt;
}

interface Card {
  id; subjectType: 'word' | 'char'; subjectId; facet: Facet;
  state: 'new' | 'learning' | 'review' | 'relearning' | 'suspended';
  repetition; easeFactor; intervalDays; due; lapses; lastReviewedAt?; fsrs?;
}

interface ReviewLog {        // log đầy đủ để sau này fit FSRS
  cardId; facet; questionType;
  mode: 'learn' | 'review' | 'retry' | 'match-bonus';
  correct; quality; elapsedMs; hints; replays; reviewedAt; dayKey; before; after;
}

interface DailyStats {
  dayKey; xp; learningXp; xpByKind; answers; correct; newIntroduced;
  textsRead; dictations; speakingAttempts; drillItems; coachSeconds; goalMetAt?;
}

interface TextDoc {
  id; kind: 'ai-story' | 'ai-dialogue' | 'pasted'; title; level?;
  sentences: { zh, vi?, speaker? }[];
  targetWordIds[]; questions[]; segOverrides; tokenCache?; progress; coverage?; createdAt;
}

interface Settings {
  geminiApiKey?; pixabayApiKey?; geminiTextModel; geminiLiveModel; geminiTtsModel;
  hskTrack: 'hsk2' | 'hsk3'; currentLevel; newWordsPerDay; maxReviewsPerDay; sessionSize;
  dailyGoalXp: 50 | 150 | 300; dayStartHour; enabledFacets[];
  pinyinDisplay: 'all' | 'unknown' | 'none'; toneColors; tonelessEasyMode;
  ttsVoiceURI?; ttsRate; theme; musicTrack; musicVolume; fontScale;
  scheduler: 'sm2' | 'fsrs'; dataVersion;
}
```
```ts
db.version(1).stores({
  words:         'id, &[simplified+pinyinNum], simplified, source, createdAt, *tags, hsk.hsk2, hsk.hsk3',
  cards:         'id, [subjectType+subjectId+facet], subjectId, facet, state, due, [facet+due]',
  reviewLogs:    '++id, cardId, subjectId, dayKey, reviewedAt, [facet+dayKey]',
  dailyStats:    'dayKey',
  texts:         'id, kind, level, createdAt',
  dict:          '++id, s, t, pt',          // giản thể, phồn thể, pinyin không dấu
  caches:        'key, kind, expiresAt',    // gtx, gemini, ảnh (TTL + LRU)
  audioCache:    'key, createdAt, bytes',   // clip Gemini TTS (trần ~100 MB)
  coachSessions: 'id, startedAt',
  kv:            'key',                     // settings, gamification {xp, badges[]}, drillStats
});
```
**Quy tắc:**
- Không sửa block `version()` cũ; mỗi version mới kèm `.upgrade()`.
- Backup JSON có dạng `{format:'hanzistep-backup', schemaVersion, exportedAt, includesSecrets:false, data}`, đọc vào qua `migrateBackup()`.
- Không đưa `dict`, cache và audio vào backup.
- Gọi `navigator.storage.persist()` ở lần chạy đầu.

---

## 5. SRS và bộ câu hỏi

### 5.1 Facet và mở khoá

| Facet | Hỏi gì | Tạo / mở khoá |
|---|---|---|
| `read` | Chữ Hán → nghĩa/âm | Tạo khi học từ mới |
| `listen` | Audio → từ | Tạo cùng lúc với `read`, tạm khoá cho tới khi `read` rep ≥ 1 |
| `speak` | Nói ra từ/câu | Bật trong Settings và trình duyệt có SpeechRecognition; mở khi `read` rep ≥ 2 |
| `write` (Phase 6) | Viết theo nét | Tính **theo từng chữ**; mở khi một từ chứa chữ đó đạt `read` rep ≥ 3 |

- **Không dồn facet:** mỗi phiên hỏi tối đa 1 facet cho mỗi từ; các facet anh em bị hoãn (bury siblings).
- **Nhãn mức thuộc:** lấy theo card `read`: Mới / Đang học / Quen / Nhớ / Thành thạo (rep 0 / 1 / 2 / 3 / 4+). Các facet khác hiện bằng chấm nhỏ.
- **Luyện pinyin/thanh điệu không dùng SM-2:** chọn câu thích ứng theo tỉ lệ sai (8.2).

### 5.2 Interface scheduler và port SM-2
```ts
interface SchedState { repetition; easeFactor; intervalDays; due; lapses }
interface Scheduler { id: 'sm2' | 'fsrs'; initial(now): SchedState; next(s, q: Quality, now): SchedState }
const toRating = (q) => q <= 2 ? 1 : q === 3 ? 2 : q === 4 ? 3 : 4;   // dùng cho FSRS sau này
```
SM-2 giữ **đúng** logic cũ:
- **Trả lời đúng (q ≥ 3):** rep0 → 20 phút; rep1 → 1 ngày; rep ≥ 2 → `max(1, round(interval × EF_cũ))`; rep++.
- **Trả lời sai:** rep = 0, interval 20 phút.
- **EF:** `EF += 0.1 − (5−q)(0.08 + (5−q)·0.02)`, sàn 1.3.
- **Giới hạn:** interval tối đa 365 ngày; từ mới đến hạn ngay.

**Golden test** (bắt đầu rep 0, EF 2.5). Đã tính tay, khớp với code gốc:

| Bước | q | Interval | Rep | EF |
|---|---|---|---|---|
| 1 | 4 | 20 phút | 1 | 2.50 |
| 2 | 4 | 1 ngày | 2 | 2.50 |
| 3 | 4 | 3 ngày | 3 | 2.50 |
| 4 | 5 | 8 ngày | 4 | 2.60 |
| 5 | 3 | 21 ngày | 5 | 2.46 |
| 6 | 0 | 20 phút | 0 | 1.66 |
| 7 | 1 | 20 phút | 0 | 1.30 (chạm sàn) |

### 5.3 Quality theo dạng câu hỏi
Đồng hồ bắt đầu khi đề hiển thị xong. Với đề dạng audio, bắt đầu khi audio phát xong.

| Dạng | Sai | 5 | 4 | 3 | Ghi chú |
|---|---|---|---|---|---|
| MCQ (Hán ↔ Việt), tranh, Hán → pinyin | 0 | < 3s | < 8s | Chậm hơn | Mở xem pinyin → tối đa 4 |
| Nghe → chọn chữ Hán / nghĩa / kiểu thanh | 0 | < 4s, nghe lại ≤ 1 lần | < 10s | Chậm hơn | Nghe lại > 2 lần → tối đa 3 |
| Nối cặp (4 cặp) | 0 | — | 4 | — | Như bản cũ |
| Gõ pinyin / chính tả pinyin | 0 (chỉ sai thanh → 2) | < 6s, không gợi ý | < 15s | Có gợi ý hoặc chậm | Chế độ bỏ qua thanh → tối đa 3 |
| Gõ chữ Hán bằng IME (điền chỗ trống) | 0 | < 8s | < 20s | Có gợi ý hoặc chậm | — |
| Điền lượng từ | 0 | < 4s | < 10s | Chậm hơn | — |
| Sắp xếp câu (连词成句) | 0 sau 2 lần | Đúng lần 1, < 10s | Đúng lần 1 | Đúng lần 2 | — |
| Chính tả câu (độ chính xác ký tự, LCS) | < 90% → 1 | 100%, nghe ≤ 2 lần | 100% | ≥ 90% | — |
| Nói (SpeechRecognition) | 2 lần không khớp → 1 | **Không bao giờ** | Đúng chữ ngay lần 1 | Khớp âm tiết (bỏ qua thanh) hoặc đúng lần 2 | Tối đa 4 |
| Viết câu (Gemini chấm) | score < 0.6 → 0 | — | ≥ 0.9 | 0.6–0.9 | — |
| Quiz nét (Phase 6) | Bỏ cuộc → 0 | 0 lỗi, không gợi ý | ≤ 2 lỗi | Có gợi ý | — |

### 5.4 Ma trận dạng câu hỏi (facet × rep)
Thiếu tài nguyên (ảnh, lượng từ, câu ví dụ…) thì lùi xuống lựa chọn kế tiếp; cuối cùng là MCQ, giống bản cũ.

| Rep | `read` | `listen` | `speak` (opt-in) |
|---|---|---|---|
| 0 | MCQ có pinyin, tự phát audio: 50% Hán → Việt, 50% Việt → Hán | Nghe → chọn chữ Hán + pinyin | Nghe mẫu → nhắc lại → tự nghe lại để so |
| 1 | Tranh → chữ Hán (danh từ/động từ cụ thể có ảnh thật); không có ảnh thì MCQ không kèm pinyin | Nghe → chọn nghĩa tiếng Việt | Nghĩa + ảnh → nói ra từ |
| 2 | 50% nối cặp (cần ≥ 4 từ đã học), 50% chữ Hán → chọn pinyin đúng thanh | Nghe → chọn kiểu thanh ("3–4") hoặc pinyin | Chỉ nhìn chữ Hán → nói |
| 3 | 60% gõ pinyin (có nghĩa + câu ngữ cảnh khuyết từ; gợi ý = thanh mẫu). Còn lại lần lượt: điền lượng từ (danh từ có lượng từ) → sắp xếp câu → MCQ | Nghe → gõ pinyin | Câu tiếng Việt → nói câu ví dụ |
| 4+ | 40% gõ chữ Hán bằng IME; 30% sắp xếp câu hoặc điền lượng từ; 30% viết câu có Gemini chấm (không có key thì chuyển sang gõ pinyin) | Audio câu → 50% xếp thẻ, 50% gõ chữ Hán | Như rep 3, chấm theo khác biệt ký tự |

**Facet `write` (Phase 6):**
- rep 0: xem animation, tô theo nét
- rep 1: quiz có viền chữ
- rep 2: quiz không viền
- rep 3+: nhìn nghĩa/pinyin, viết từ trí nhớ

**Phím tắt:** 1–4 chọn đáp án; Space nghe lại; Shift+Space nghe chậm; Enter nộp bài (bỏ qua khi IME đang gõ, dựa trên `compositionstart/end`); H gợi ý; P hiện pinyin.

### 5.5 Distractor (`engine/distractors.ts`)
Ứng viên lấy từ các từ đã học và từ cùng cấp HSK; không bao giờ trùng đáp án đúng.
- **Đáp án là nghĩa tiếng Việt:**
  - Ưu tiên cùng từ loại và cùng cấp.
  - Loại ứng viên có nghĩa trùng (chung từ chính, hoặc Jaccard > 0,4), để không có 2 đáp án cùng đúng (ví dụ 高兴 và 快乐 đều là "vui").
- **Đáp án là chữ Hán:**
  - Cùng số chữ.
  - Ưu tiên chữ chung thành phần hoặc bộ thủ (大/太/天, 买/卖).
- **Đáp án là pinyin:**
  - Cùng âm khác thanh (mǎi/mài).
  - Cặp thanh mẫu dễ nhầm: zh/z, ch/c, sh/s, j-q-x với zh-ch-sh, n/l.
  - Cặp vận mẫu dễ nhầm: an/ang, en/eng, in/ing, ü/u.
  - Từ nhiều âm tiết: đổi thanh của 1 âm tiết.
  - Chuỗi sinh ra phải là âm tiết hợp lệ.
- **Đáp án là audio:** chỉ dùng từ có thật, chọn trong nhóm âm gần.
- **Dự phòng:** từ lõi HSK1, không dùng danh sách từ giả như bản tiếng Anh.

### 5.6 Xây phiên ôn (`engine/session.ts#buildSession`)
1. **Card đến hạn:**
   - Card đang ở bước 20 phút được xếp trước.
   - Còn lại xếp theo độ quá hạn `(now − due) / max(interval, 1/72)`, từ cao xuống thấp.
   - Trần `maxReviewsPerDay` (mặc định 120). Phần vượt trần là backlog, hiện ở Gate.
2. **Từ mới:**
   - Số lượng = `newWordsPerDay − introducedToday`. Mặc định **5 từ/ngày trong tuần 1–2, sau đó 8 từ/ngày**.
   - Thứ tự: từ lưu từ bài đọc trước, sau đó danh sách HSK theo tần suất. Có tuỳ chọn ưu tiên từ gần âm Hán Việt.
3. **Từ mới đi qua màn `learn/`:**
   - Thẻ giới thiệu: chữ, pinyin tô màu thanh, audio, Hán Việt từng chữ, nghĩa VI/EN, ảnh, câu ví dụ có audio.
   - Sau đó 1 câu MCQ nhanh; card vào SM-2 với kết quả của câu đó.
   - Nút "Tôi đã biết": đặt `knownWithoutSrs`, không tạo card.
4. **Trộn:** 1 từ mới xen 4 lượt ôn; hoãn facet anh em; chia khối `sessionSize` (25 câu), có nút "Tiếp tục".
5. **Kết thúc:** nếu có card 20 phút sẽ đến hạn trong 5 phút tới, màn All Done hiện đếm ngược.

### 5.7 Ôn lại câu sai và nối cặp
- **Ôn lại câu sai (Retry):** dạng MCQ hoặc nghe-chọn, mode `retry`. Không đổi lịch; +3 XP mỗi câu đúng; chỉ ghi log.
- **Thưởng khi nối cặp** (giữ quy tắc cũ, chỉ áp dụng trong cùng facet):
  - Nối đúng một card `read` đang đến hạn và nằm sau trong hàng đợi → q = 4, rút card đó khỏi hàng đợi.
  - Nối sai có liên quan tới card đó → q = 0.

### 5.8 Transaction trả lời (thay hàng đợi ghi)
`answerCard(input) → {quality, next, xp, newBadges}` chạy trong **một** `db.transaction('rw', [cards, reviewLogs, dailyStats, kv])`:
1. Đọc card, tính quality.
2. Gọi `scheduler.next`, ghi card.
3. Thêm log.
4. Cập nhật dailyStats và XP (có trần).

Kiểm tra huy hiệu sau khi transaction xong.

---

## 6. Điểm, level, huy hiệu, streak

### 6.1 XP (chỉ lưu XP; level luôn được tính ra)

| Sự kiện | XP | Trần/ngày | Tính cho streak |
|---|---|---|---|
| Lưu từ (từ bài đọc hoặc thủ công) | +10 | 20 từ | Không |
| Học từ mới (màn Learn) | +5 | — | Có |
| Trả lời ôn đúng / sai | +15 / +5 | — | Có |
| Ôn lại câu sai, đúng | +3 | — | Có |
| Hoàn thành phiên (≥ 10 câu, hoặc hết hàng đợi với ≥ 5 câu) | +30 | 3 | Có |
| Gắn tag lần đầu cho 1 từ | +10 | 1 lần/từ | Không |
| Hoàn thành bài học pinyin (lần đầu) | +25 | — | Có |
| Vòng luyện thanh/pinyin (10 câu) | +15, thêm +10 nếu ≥ 90% | 10 vòng | Có |
| Đọc hết 1 bài (tới câu cuối, ≥ 60s) | +20 | 5 | Có |
| Câu hỏi đọc hiểu | +5 | 3/bài | Có |
| Chính tả câu ≥ 90% / thấp hơn | +10 / +4 | — | Có |
| Lượt nói / lượt nhận dạng khớp | +3 / +8 | 30 lượt | Có |
| Shadowing (ghi âm + nghe lại) | +5 | 20 | Có |
| Gọi AI Coach ≥ 3 phút | +30 | 2 | Có |
| Đạt mục tiêu ngày | +20 | 1 | — |

### 6.2 Level: `minXp(L) = 250 × (L − 1)²`

| Level | XP tối thiểu | Danh hiệu |
|---|---|---|
| 1 | 0 | Học trò 学童 |
| 2 | 250 | Thư sinh 书生 |
| 3 | 1.000 | Tú tài 秀才 |
| 4 | 2.250 | Cử nhân 举人 |
| 5 | 4.000 | Cống sĩ 贡士 |
| 6 | 6.250 | Tiến sĩ 进士 |
| 7 | 9.000 | Thám hoa 探花 |
| 8 | 12.250 | Bảng nhãn 榜眼 |
| 9 | 16.000 | Trạng nguyên 状元 |
| 10 | 20.250 | Hàn lâm 翰林 |

- `getLevelInfo` trả về cùng dạng dữ liệu như bản cũ.
- Năng lực thật hiển thị riêng qua **tiến độ HSK**: số từ có `read` rep ≥ 2 ở từng cấp.

### 6.3 Huy hiệu
Kiểm tra sau mỗi hoạt động (không đợi mở trang Thống kê). Khi mở khoá hiện toast + confetti kiểu Flip7. Huy hiệu nào tương ứng bản tiếng Anh thì giữ ID cũ.
- **Từ vựng:** `first_word`, `vocab_50`, `vocab_150`, `vocab_500`
- **Streak:** `streak_3`, `streak_7`, `streak_30`
- **Thành thạo:** `master_20`, `master_100` (tính theo `read` rep ≥ 4)
- **Ôn tập:** `review_100`, `review_1000`
- **Khác:** `tagger`, `level_5`, `pinyin_graduate`, `tone_ear` (200 câu thanh đúng và ≥ 85% trong 100 câu gần nhất), `first_story`, `reader_20`, `first_voice` (20 lượt nói), `coach_first`, `hsk1_done`

### 6.4 Streak (đã sửa 2 lỗi)
```ts
toDayKey(d: Date, dayStartHour = 0): string   // ngày local của (d − dayStartHour giờ)
dayDiff(a: string, b: string): number         // tính qua Date.UTC(y, m−1, d), an toàn với DST
computeStreak(activeDays: string[], today: string): { current; longest; atRisk }
```
- Một ngày là **active** khi `dailyStats.learningXp > 0`. Mọi hoạt động học đều tính (bản cũ chỉ tính câu ôn).
- Streak hiện tại = số ngày active liên tiếp kết thúc ở hôm nay, hoặc ở hôm qua (khi đó `atRisk = true`); ngoài hai trường hợp đó thì bằng 0.
- Vì tính lúc đọc nên streak tự về 0 khi bỏ lỡ ngày, không bị lệch dữ liệu.

### 6.5 Mục tiêu ngày
- Ba mức 50 / 150 / 300 XP, mặc định 150.
- Hiển thị bằng vòng tròn ở trang Hôm nay (lấy từ mock HanziStep).
- Lưu `goalMetAt`; thưởng +20 XP một lần mỗi ngày.

---

## 7. Module Đọc

### 7.1 Nguồn bài
- Truyện AI theo cấp · hội thoại AI (dùng chung với phần Nghe) · văn bản dán vào (Ctrl+V hoặc file `.txt`).
- Mở khoá sau khoảng 30 từ đã học. Trước đó dùng "micro-text": 2–4 câu, pinyin đầy đủ, nghĩa tiếng Việt dưới từng câu.

### 7.2 Pipeline xử lý văn bản
1. `sentenceSplit`: tách câu.
2. `segmenter.worker`: tách từ bằng `Intl.Segmenter('zh', {granularity:'word'})`, rồi `reconcile`:
   - (a) gộp các đoạn liền kề nếu ghép lại thành từ đã lưu hoặc từ HSK;
   - (b) tách đoạn không có trong từ điển thành các từ khớp dài nhất;
   - (c) áp override riêng của bài.
3. Gọi `pinyin(cả câu, {toneSandhi})` rồi cắt theo vị trí token. Nếu gọi riêng từng token sẽ mất ngữ cảnh (银行 vs 行走).
4. Gán trạng thái token:
   - `known`: `read` rep ≥ 3 hoặc `knownWithoutSrs`
   - `learning`: rep 0–2
   - `target`
   - `new`: có trong từ điển
   - `unknown`
   - `punct` / `num` / `latin`
5. Cache token trên bài, kèm `segVersion`.

### 7.3 Giao diện đọc
- **Hiển thị:**
  - Pinyin dạng ruby với 3 chế độ: tất cả / chỉ từ chưa biết / ẩn.
  - Màu thanh điệu (hover hiện số thanh, hỗ trợ người mù màu); gạch chân màu theo trạng thái token; A−/A+.
- **Theo câu:** bật/tắt nghĩa tiếng Việt từng câu; tiến độ "đã khám phá x/y từ mục tiêu".
- **Trình phát câu:**
  - Đọc từng câu và highlight câu đang đọc.
  - Tốc độ 0.6 / 0.8 / 1.0; nút lặp câu để shadowing (Phase 4).
- **Popover khi chạm vào từ:**
  - **Các lựa chọn:** `longestMatchAt(câu, vị trí)` đưa ra các độ dài tới 8 chữ (ví dụ 中国人 / 中国 / 中).
  - **Mỗi lựa chọn hiển thị:**
    - chữ, kèm phồn thể nếu khác
    - pinyin theo ngữ cảnh, kèm pinyin CEDICT nếu khác
    - Hán Việt từng chữ + nhãn "≈ Hán Việt"
    - nghĩa VI (CVDICT) và EN (CEDICT)
    - lượng từ, cấp HSK, audio thường/chậm
  - **Hành động:**
    - **Lưu:** kèm câu, nghĩa câu, `textId`; từ được đưa lên đầu hàng Học mới.
    - **Đã biết.**
    - **Tách/Gộp:** ghi override.
    - **Giải thích (AI):** có cache.
- **Chọn nhiều token:** kéo chọn → "Dịch câu" (gtx hoặc Gemini).

### 7.4 Truyện AI (`generateStory.ts`)

| Cấp | Số chữ | Số câu | Câu dài tối đa | Từ mục tiêu |
|---|---|---|---|---|
| HSK1 | 40–90 | 4–8 | 12 chữ | ≤ 3 |
| HSK2 | 90–180 | 6–12 | 16 chữ | ≤ 5 |
| HSK3 | 180–350 | 10–18 | 22 chữ | ≤ 6 |
| HSK4 | 350–600 | — | 28 chữ | ≤ 7 |

- **Prompt:**
  - Gồm: quy tắc theo cấp, thể loại, từ mục tiêu, danh sách từ được phép dùng (từ đã học + HSK cấp thấp hơn, tối đa 400 từ theo tần suất).
  - Yêu cầu: chỉ viết bằng từ được phép, tên riêng lấy từ danh sách cho sẵn, không kèm pinyin.
- **Schema trả về:**
  ```
  {titleZh, titleVi, sentences[{zh, vi}], targetWords[{hanzi, vi}], names[],
   questions[{type: 'mcq'|'short', qZh, qVi, options?, answerZh, answerVi}],
   imageSearchKeywordsEn}
  ```
- **Gọi API:** `responseMimeType: 'application/json'` + JSON schema, nhiệt độ thấp. Parse bằng Zod; lỗi thì thử sửa 1 lần.
- **Kiểm tra độ phủ:**
  - coverage = 1 − (token lạ / token nội dung).
  - Token "lạ" là token không thuộc: từ đã biết ∪ từ mục tiêu ∪ HSK ≤ cấp ∪ hư từ ∪ số ∪ tên riêng.
  - Ngưỡng: 95% cho HSK1–2, 92% cho HSK3 trở lên.
  - Dưới ngưỡng: tạo lại 1 lần với chỉ thị "thay thế: [...]". Vẫn dưới ngưỡng thì lưu bài và tô các từ "ngoài danh sách".
- **Pinyin luôn tính local** bằng pinyin-pro và đối chiếu CEDICT/HSK; không tin pinyin do Gemini sinh ra.
- **Ảnh:** tìm trên Pixabay bằng `imageSearchKeywordsEn`.
- **Đọc hiểu:**
  - HSK1: 2 câu MCQ với đáp án tiếng Việt.
  - HSK2 trở lên: đáp án tiếng Trung.
  - Thêm 1 câu trả lời ngắn: tự gõ rồi mới hiện đáp án mẫu; Gemini chấm là tuỳ chọn.
- **Thư viện bài:** hiện cấp, % độ phủ (tính lại mỗi lần mở bài nên tăng dần khi học thêm), trạng thái hoàn thành, ngày.

---

## 8. Module Nghe và Nói

### 8.1 TTS (`services/speech/tts.ts`)
- **Chọn giọng:**
  - Đợi sự kiện `voiceschanged`, rồi lọc giọng `zh-CN`; chỉ dùng zh-TW/HK khi không có zh-CN.
  - Thứ hạng: giọng Natural/Online của Edge (Xiaoxiao, Yunxi) > Google 普通话 > giọng desktop Microsoft (Huihui, Kangkang, Yaoyao).
- **Đọc theo từng câu**, tránh việc giọng mạng của Chrome bị cắt khi đoạn dài.
- **Chuỗi dự phòng:** giọng trình duyệt → Gemini TTS (model cấu hình trong Settings), cache vào `audioCache` → màn hướng dẫn cài gói giọng tiếng Trung cho Windows.
- **Âm tiết đơn và chữ đa âm (行, 长, 了) không đọc bằng TTS:** dùng file audio (audio-cmn) hoặc clip Gemini TTS.
- **Chế độ chậm:** `rate` 0.7 cho giọng trình duyệt, `playbackRate` 0.75 cho clip.
- **Nhạc nền** tự giảm âm lượng khi đang đọc.
- **Trang chẩn đoán "Kiểm tra giọng đọc":** liệt kê các giọng, phát thử 妈麻马骂 và 银行.

### 8.2 Module Pinyin & Thanh điệu (Phase 1)
**Bài học (nội dung tĩnh, tiếng Việt):**
1. 4 thanh + thanh nhẹ, có hình đường cao độ
2. Vận mẫu đơn
3. Thanh mẫu theo nhóm
4. Vận mẫu kép
5. Quy tắc y/w và ü; cách viết tắt iu/ui/un
6. Vị trí đặt dấu thanh
7. Biến điệu: 3-3 → 2-3, 不 → bú, 一 → yí/yì, thanh nhẹ
8. Âm cuốn lưỡi (儿化)

**Các dạng luyện:**
- Nhận diện thanh: nghe 1 âm tiết → bấm phím 1–4 hoặc 5.
- 20 cặp thanh: 4 × (4 thanh + thanh nhẹ).
- Cặp tối thiểu.
- Nghe → gõ pinyin.
- Bảng pinyin tương tác: bấm vào ô để nghe cả 4 thanh.

**Chọn câu thích ứng:** trọng số theo tỉ lệ sai trung bình trượt (EMA, α = 0.3) của từng mục, lưu trong `kv.drillStats`.

**API pinyin lõi** (`chinese/pinyin/*`, test kỹ):
```ts
parsePinyin(input, { allowToneless? }): { syllables: Syllable[]; errors: string[] }
// nhận: "ni3hao3", "ni3 hao3", "nǐhǎo", "lv3"/"lu:3"/"lü3"/"lǚ", "xi'an", "er2", thanh nhẹ "5"/"0"/không số
toMarks(s): string;  toNumbered(s): string
comparePinyin(accepted: Syllable[][], actual): { ok; toneErrors: number[]; segmentErrors: number[] }
applySandhi(s, hanzi): Syllable[]   // khi chấm, chấp nhận cả dạng gốc lẫn dạng biến điệu
```

### 8.3 Phòng Nghe
- **Hội thoại AI 2 người:** 2 giọng đọc xen kẽ, giới hạn từ vựng theo cấp HSK như truyện.
- **Luồng:** nghe "mù" (không chữ) → trả lời câu hỏi → hiện transcript (ruby + chạm để tra từ) → nghe lại từng câu.
- **Chính tả (听写), 3 chế độ:**
  - gõ pinyin (cho người mới)
  - xếp thẻ
  - gõ chữ Hán bằng IME, so khác biệt ký tự bằng LCS
- **Settings** có hướng dẫn thêm bộ gõ Microsoft Pinyin trên Windows.

### 8.4 Nhận dạng giọng nói và shadowing
- **Cấu hình nhận dạng:**
  - `webkitSpeechRecognition` với `lang: 'zh-CN'`, `maxAlternatives: 5`, nhận 1 câu, timeout 6s.
  - Trước tiên kiểm tra API có tồn tại không. Nếu có `SpeechRecognition.available({langs:['zh-CN'], processLocally:true})` thì dùng nó để biết có nhận dạng on-device hay không.
  - Chrome (Google) và Edge (Microsoft) nhận dạng qua server; Firefox không hỗ trợ.
- **Chấm điểm** `scoreUtterance(target, alts)` trả về `{best, charMatch, tonelessSyllableMatch, perSyllable: ('match'|'homophone'|'wrong'|'missing')[], quality: 0|1|3|4}`:
  1. Chuẩn hoá transcript: bỏ dấu câu, đổi số thành chữ Hán, đổi phồn thể sang giản thể.
  2. Chọn phương án khớp đúng chữ Hán; nếu không có thì chọn theo khoảng cách Levenshtein trên âm tiết.
  3. `homophone` nghĩa là âm tiết khớp nhưng chữ khác.
- **Giới hạn phải ghi rõ trên UI:**
  - Bộ nhận dạng không nghe được thanh điệu; mô hình ngôn ngữ của nó tự điền từ nghe có vẻ hợp lý.
  - Kết quả với 1 âm tiết đơn lẻ không đáng tin.
  - Vì vậy quality tối đa là 4, và kỹ năng thanh điệu được luyện bằng các bài nghe ở 8.2.
- **Shadowing (ghi âm và so sánh):**
  - `MediaRecorder` ghi âm → phát giọng mẫu, rồi phát giọng bạn.
  - Vẽ **đường cao độ** bằng `pitchy`, chuẩn hoá theo semitone quanh cao độ trung vị. Chỉ so với *file audio* (audio-cmn hoặc clip Gemini TTS), vì không thu được âm thanh TTS của trình duyệt.
  - Bộ phân loại thanh cho 1 âm tiết (bằng / lên / xuống-lên / xuống) được gắn nhãn "thử nghiệm".
- **Tuỳ chọn "AI nhận xét phát âm":**
  - Gửi clip ghi âm + pinyin mục tiêu cho Gemini, schema `{syllables[{expected, ok, noteVi}], feedbackVi}`.
  - Ghi rõ đây là nhận xét của AI; **không** ảnh hưởng tới SRS.
- **Phase 5:** thử Azure Pronunciation Assessment cho zh-CN (trả phí, key trong Settings) nếu cần chấm thanh điệu thật.

### 8.5 AI Coach (port + chế độ người mới)
- **Module:**
  - `liveSocket.ts`: setup, message, reconnect.
  - `voiceGate.ts`: hàm thuần, giữ hằng số `MIN_RMS .012`, `STRONG_RMS .075`, `SILENCE_HOLD 6`, đuôi 0,8s, duck 0,28s.
  - `pcm.ts`: resample → Int16 16 kHz → base64.
  - `playback.ts`: lập lịch phát 24 kHz, dừng khi bị ngắt lời.
  - Worklet đặt ở `public/worklets/`.
- **Model:**
  - Lấy từ `settings.geminiLiveModel` (mặc định là model Live mới nhất); dự phòng `gemini-2.5-flash-native-audio-preview-12-2025` đang chạy trong extension.
  - Model native-audio tự chọn ngôn ngữ, nên phải ép qua system prompt.
  - Đầu Phase 4 cần kiểm chứng lại định dạng setup message.
- **Kịch bản:** "Luyện từ hôm nay" · "Chào hỏi / Gọi món / Mua sắm / Hỏi đường" · "Hỏi thầy bằng tiếng Việt".
- **Sau cuộc gọi:** lưu transcript vào `coachSessions`; chạm vào từ trong transcript để tra.
- **System prompt (khung):**
  > You are 小林老师, a patient Mandarin tutor for a Vietnamese native speaker who is a complete beginner (HSK{level}). Give instructions and explanations in Vietnamese. Speak Chinese only in short model phrases (≤ 8 characters), slowly and clearly, and give the Vietnamese meaning right after each one. Use only these words: {learnedWords}; today's focus words: {targets}. Loop: model a phrase → ask the learner to repeat → brief feedback (name the tone number, e.g. "买 mǎi là thanh 3") → continue. When useful, mention the Hán-Việt reading (学 xué – HỌC). Max 2 short sentences per turn; correct at most one error per turn; don't interrupt short pauses; if the learner speaks Vietnamese, reply in Vietnamese and gently return to practice. Your tone judgement may be imperfect: encourage, don't grade.

---

## 9. Lộ trình theo phase

**Lộ trình học gợi ý cho bạn:**
- Tuần 1–2: Pinyin 10–15 phút/ngày + 5 từ HSK1/ngày (`read`, `listen`).
- Từ tuần 3: 8 từ/ngày + micro-text.
- Khoảng tuần 5: truyện với pinyin chỉ hiện trên từ chưa biết + shadowing.
- Sau khoảng 100 từ: bắt đầu dùng AI Coach.

### Phase 0: Nền móng
- **Mục tiêu:** app shell chạy offline, dữ liệu, lưu trữ, cài đặt.
- **Phạm vi:**
  - Scaffold Vite/React/TS; Tailwind tokens dark/light; sidebar.
  - PWA manifest + service worker; Dexie v1 + `persist()`.
  - Settings (ẩn/hiện key, model ID) + trang "Nguồn & Ghi công".
  - Khung backup/restore JSON; music player + sfx; `random`, `dayKey`.
  - Toàn bộ `scripts/build-*` (trừ hanzi-writer) + `validate-data`.
  - `Start HanziStep.bat`.
- **File chính:** `vite.config.ts`, `src/db/schema.ts`, `scripts/build-dict.ts`, `src/lib/dayKey.ts`, `src/features/settings/*`.
- **Hoàn thành khi:**
  - Edge/Chrome hiện nút cài đặt app (DevTools → Application → Manifest không báo lỗi).
  - Reload khi offline vẫn chạy.
  - Manifest dữ liệu và thư mục LICENSES được sinh ra.
  - Settings giữ nguyên sau reload.
  - Backup rồi restore cho dữ liệu giống hệt.

### Phase 1: Lõi tiếng Trung + Pinyin & Thanh điệu
- **Mục tiêu:** người mới học được phát âm.
- **Phạm vi:**
  - `chinese/pinyin/*`, `toneColors`, `hanviet.ts`, `cognate.ts`.
  - TTS + trang chẩn đoán giọng; build audio âm tiết.
  - Bảng pinyin, 8 bài học, 4 dạng luyện.
  - `dailyStats`, XP, streak, trang Hôm nay + vòng mục tiêu ngày.
- **File chính:** `src/chinese/pinyin/parse.ts`, `src/progress/streak.ts`, `src/features/pinyin/*`, `src/services/speech/tts.ts`.
- **Hoàn thành khi:**
  - Mọi bài luyện phát đúng audio.
  - Các biến thể nhập liệu ở 8.2 parse đúng.
  - Trọng số chọn câu bám theo tỉ lệ sai.
  - Streak tăng theo ngày local và về 0 sau ngày bỏ lỡ.

### Phase 2: Từ vựng + SRS (lõi MVP)
- **Mục tiêu:** tái hiện đầy đủ vòng ôn của app tiếng Anh.
- **Phạm vi:**
  - Worker import từ điển + tra nhanh bằng Ctrl+K.
  - Onboarding: chọn HSK track/cấp, số từ mới mỗi ngày.
  - Màn Học mới; card `read` + `listen`.
  - Gate, session bar, progress ring, Summary panel, All Done + Ôn lại câu sai.
  - Các dạng câu hỏi ở 5.4 (trừ `speak`).
  - Từ vựng của tôi: bảng, lọc, tag, import/export.
  - Bổ sung ảnh Pixabay.
  - Thống kê v1: level/XP, streak, heatmap, mastery theo facet, tiến độ HSK, huy hiệu.
- **File chính:** `src/srs/sm2.ts`, `src/features/review/engine/{session,selectQuestionType,quality,distractors,answerCard}.ts`, `src/progress/recordActivity.ts`, `src/features/vocab/saveWord.ts`, `src/features/backup/*`.
- **Hoàn thành khi:**
  - Golden table SM-2 pass.
  - Không câu MCQ nào có 2 đáp án đúng.
  - Hạn mức từ mới đúng khi qua nửa đêm và theo `dayStartHour`.
  - Bước 20 phút hoạt động đúng.
  - Ôn lại câu sai không làm đổi lịch.
  - Facet anh em không xuất hiện cùng một phiên.
  - File CSV mở bằng Excel giữ đúng dấu tiếng Việt và chữ Hán.
  - Restore cho ra đúng số card đến hạn như trước.

### Phase 3: Đọc + tra từ
- **Mục tiêu:** đọc bài có hỗ trợ tra từ.
- **Phạm vi:**
  - Segmenter worker + reconcile; cắt pinyin theo token.
  - Reader: ruby, màu thanh và trạng thái, trình phát câu, nghĩa VI.
  - Popover có tách/gộp; dán văn bản.
  - Tạo truyện có kiểm tra độ phủ + ảnh; câu hỏi đọc hiểu; thư viện bài; XP đọc.
- **File chính:** `src/chinese/segment/*`, `src/features/reading/*`, `src/services/ai/prompts/story.ts`.
- **Hoàn thành khi:**
  - 银行 và 行走 ra đúng pinyin theo ngữ cảnh.
  - Chạm vào 中国人 cho ra 3 độ dài.
  - Văn bản 500 chữ render dưới 300 ms khi từ điển đã nạp.
  - Truyện HSK1 đạt ≥ 95% độ phủ, hoặc được đánh dấu sau 1 lần tạo lại.
  - Từ lưu từ bài đọc có kèm câu ngữ cảnh và nhảy lên đầu hàng Học mới.

### Phase 4: Nghe + Nói + Coach
- **Mục tiêu:** hoàn tất MVP của cả 3 nhóm kỹ năng.
- **Phạm vi:**
  - Phòng Nghe: hội thoại, nghe mù, câu hỏi, transcript.
  - Chính tả với 3 chế độ; các dạng `listen` còn lại.
  - Facet `speak` + `scoreUtterance`.
  - Shadowing: ghi âm, đường cao độ, phân loại thanh thử nghiệm; AI nhận xét phát âm (tuỳ chọn).
  - Port Coach + kịch bản + lưu transcript; giảm âm lượng nhạc ở mọi nơi.
- **File chính:** `src/features/{listening,speaking,coach}/*`, `src/services/speech/{recognition,pitch,recorder}.ts`.
- **Hoàn thành khi:**
  - Phản hồi từ nhận dạng giọng nói không bao giờ khẳng định đúng thanh.
  - Coach chạy 5 phút bằng VI + ZH, câu ngắn, ngắt lời được, lưu được transcript.
  - Khác biệt giữa Chrome và Edge được ghi trên trang chẩn đoán.

### Phase 5: Củng cố
- **Mục tiêu:** app bền và giữ được thói quen học.
- **Phạm vi:**
  - FSRS tuỳ chọn (`ts-fsrs`, replay từ log, so sánh thống kê); công cụ giãn backlog.
  - App badge; bảng dung lượng (`storage.estimate()`, LRU cho audio).
  - Tự backup vào thư mục chọn sẵn (File System Access API) + nhắc hàng tuần.
  - Xếp cấp nhanh ("Tôi đã biết" cả một cấp HSK).
  - CSP; ngân sách hiệu năng; thử Azure Pronunciation Assessment.
- **File chính:** `src/srs/fsrs.ts`, `src/features/backup/autoBackup.ts`.
- **Hoàn thành khi:**
  - Đổi scheduler không làm hỏng lịch ôn.
  - Auto-backup ghi được file.
  - JS ban đầu ≤ 250 KB gzip (tách riêng pinyin-pro và Coach).

### Phase 6: Viết + mở rộng
- **Trạng thái 2026-09-13:** lõi Viết đã triển khai; DB v4 tự sửa metadata vị trí do migration v3 cũ tạo ra, 3.034 file nét HSK local, animation trong popover, facet/card theo từng chữ và quiz giảm gợi ý theo repetition. Unit/build/data và Edge E2E đã qua cả đường bỏ cuộc lẫn hoàn thành đúng nét/persist quality. Ba mục dưới nhãn **Tuỳ chọn** chưa triển khai.
- **Mục tiêu:** kỹ năng Viết.
- **Phạm vi:**
  - Hanzi Writer: animation trong popover/summary; facet `write` theo từng chữ.
  - Dexie v2 thêm bảng `chars`; khám phá bộ thủ/thành phần (kiểm tra license trước).
  - **Tuỳ chọn:**
    - Extension Chrome đi kèm để bôi đen chữ Hán trên web rồi đẩy từ chờ lưu vào PWA (`externally_connectable`).
    - Nhận dạng giọng nói offline: Whisper trong trình duyệt, hoặc cầu nối tới `Whisperopen/engines/whispercpp/bin/whisper-cli.exe`. Whisper cũng không nghe được thanh, nên ưu tiên thấp.
    - Nhập PDF vào reader.
- **File chính:** `src/features/writing/*`, `src/db/migrations.ts`.
- **Hoàn thành khi:**
  - Migration v1 → v2 giữ nguyên dữ liệu.
  - Quiz nét chấm đúng theo bảng 5.3.

---

## 10. Kiểm thử và xác minh

**Lệnh chuẩn** (khai báo trong `package.json` ở Phase 0):
- `npm run data:build` và `npm run data:validate`
- `npm test` (Vitest)
- `npm run test:e2e` (Playwright)
- `npm run build && npm run preview`, hoặc chạy `Start HanziStep.bat` (cổng cố định 4173)

| Phase | Unit (Vitest) | E2E / thủ công |
|---|---|---|
| 0 | `toDayKey` lúc 06:59 và 07:01 giờ UTC+7 ra cùng một ngày; biên tháng/năm; `dayStartHour`; kiểm định χ² cho shuffle; backup round-trip với `fake-indexeddb` | Playwright: vào lần đầu → `context.setOffline(true)` → reload vẫn chạy |
| 1 | ≥ 60 ca pinyin (quy tắc ü, `xi'an`, `er2`/`r5`, vị trí dấu liù/guǐ, biến điệu 你好/不是/一个/一天); `computeStreak` (có khoảng trống, nhiều lần trong ngày, `atRisk`); trần XP/ngày; `getLevelInfo` | Playwright: 1 vòng luyện thanh với `SpeechAdapter` giả |
| 2 | Golden table `sm2`; bảng `quality`; phân phối `selectQuestionType` qua 10k lượt có seed, lệch trong ±2%; tính chất distractor (không trùng, cùng độ dài, âm tiết hợp lệ, không trùng nghĩa); `buildSession` (thứ tự, trần, hoãn facet); luật thưởng nối cặp; `answerCard` nguyên tử (tiêm lỗi → không ghi gì) | Playwright: học 4 từ → ôn → trả lời sai → ôn lại câu sai → All Done → export → import vào profile mới → số card đến hạn không đổi |
| 3 | 20 fixture tách từ (chấp nhận nhiều cách tách hợp lệ); công thức coverage; parse truyện bằng fixture ghi sẵn (hợp lệ / JSON hỏng → sửa / độ phủ thấp → tạo lại); `longestMatchAt` | Playwright: dán bài → chạm từ → lưu → từ xuất hiện trong Từ vựng kèm câu |
| 4 | `scoreUtterance` (đồng âm, chữ số, dấu câu, trả lời thiếu); chuỗi RMS của `voiceGate` → quyết định gửi/giữ; resample/encode của `pcm`; bộ phân loại thanh trên sóng tổng hợp (bằng / lên / xuống-lên / xuống) | Playwright với `--use-fake-device-for-media-stream --use-file-for-fake-audio-capture=fixtures/ni3hao3.wav`; checklist Coach thủ công: độ trễ, ngắt lời, tiếng vọng khi dùng loa và tai nghe |
| 5 | Replay `fsrsAdapter` từ log | Script đo kích thước bundle |
| 6 | Migration Dexie v1 → v2 với `fake-indexeddb`; mapping chất lượng nét | Playwright: quiz nét với đường vẽ giả lập |

**Kiểm tra end-to-end sau MVP (thủ công, khoảng 1 buổi):**
1. Mở `Start HanziStep.bat` trên Edge → cài PWA.
2. Học bài pinyin 1 + luyện 20 cặp thanh.
3. Học 5 từ HSK1 → ôn tới màn All Done.
4. Đọc 1 micro-text, chạm vào 1 từ và lưu.
5. Nghe 1 hội thoại + làm chính tả; nói 3 từ; gọi Coach 3 phút.
6. Mở Thống kê: XP, streak = 1, heatmap có dữ liệu.
7. Export backup → xoá dữ liệu site → import → mọi thứ khôi phục đầy đủ.

---

## 11. Rủi ro và cách giảm

| Rủi ro | Giảm thiểu |
|---|---|
| Giọng zh-CN không đồng đều: Chrome có giọng mạng Google (cần online, bị cắt khi đoạn dài), giọng Windows chỉ có khi đã cài gói tiếng Trung; Edge có giọng Natural | Trang chẩn đoán; khuyên dùng Edge cho PWA; đọc theo câu; dự phòng Gemini TTS có cache; audio âm tiết dựng sẵn; không chặn app khi danh sách giọng rỗng |
| TTS đọc sai chữ đa âm khi đứng riêng (行, 长, 了) | Đọc cả từ; âm tiết đơn dùng file audio hoặc Gemini TTS |
| **SpeechRecognition không nghe được thanh điệu** và tự điền từ; chạy qua server ở Chrome/Edge, Firefox không có | Không chấm thanh bằng nó; quality tối đa 4; luyện nghe thanh riêng; shadowing có đường cao độ; `speak` là opt-in; kiểm tra on-device qua `available()` |
| **Đổi origin là mất dữ liệu** (IndexedDB gắn với origin: cổng 5173 khác 4173, host khác cũng vậy) | Dùng hằng ngày qua cổng cố định `--strictPort`; coi dev và prod là 2 DB riêng; nhắc backup; auto-backup ở Phase 5 |
| Trình duyệt dọn dữ liệu site, không có sync | `storage.persist()`; nhắc backup hàng tuần; từ điển luôn build lại được |
| Dung lượng IndexedDB (từ điển 25–40 MB, cache audio) | Import 1 lần trong worker; trần LRU; bảng dung lượng; không precache nhạc/audio |
| **License:** CC-CEDICT, CVDICT, audio-cmn là CC BY-SA; danh sách gốc của hanviet-pinyin-words chưa rõ license; Tone Perfect chỉ phi thương mại; dữ liệu nét dùng Arphic | Dùng cá nhân thì ổn; có trang "Nguồn & Ghi công"; `data-raw/` nằm ngoài git; không phát hành dữ liệu sinh ra khi chưa ghi công đúng |
| Gemini trả JSON lỗi hoặc đổi tên model | JSON mime type + schema; Zod + 1 lần sửa; nhiệt độ thấp khi chấm; timeout; model ID trong Settings; fixture trong test. **Mọi tính năng lõi (từ điển, SRS, đọc bài dán vào, TTS) chạy được không cần key** |
| Lộ API key (lưu dạng plain text trong IndexedDB) | Không dùng `dangerouslySetInnerHTML`; CSP chặt `connect-src` (googleapis, pixabay, translate); không nhúng script bên thứ ba; backup không kèm key; giới hạn key Gemini chỉ cho Generative Language API |
| Endpoint gtx không chính thức bị chặn | Nghĩa VI lấy offline từ CVDICT; Gemini dự phòng; cache |
| Tách từ hoặc pinyin lệch (thanh nhẹ 东西, 儿化, biến điệu) | Pinyin chuẩn lấy từ CEDICT/HSK; chấp nhận `pinyinVariants` khi chấm; người dùng tự tách/gộp |
| Quá tải ôn tập, EF kẹt ở 1.3 với người mới | Giới hạn từ mới, mở khoá facet dần, hoãn facet anh em, trần số lượt ôn/ngày, ôn lại câu sai không đổi lịch, FSRS ở Phase 5 |
| Phạm vi 4 kỹ năng dễ lan man | Mỗi phase có tiêu chí hoàn thành rõ; engine là hàm thuần có test, UI mỏng |
| Phím Enter của IME nộp bài khi đang gõ | Xử lý `compositionstart/end`; test Playwright bằng `insertText` |

---

**Nguồn tham khảo:**
- [complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary) · [CVDICT](https://github.com/ph0ngp/CVDICT) · [hanviet-pinyin-words](https://github.com/ph0ngp/hanviet-pinyin-words) · [audio-cmn](https://github.com/hugolpz/audio-cmn) · [mp3-chinese-pinyin-sound](https://github.com/davinfifield/mp3-chinese-pinyin-sound)
- [pinyin-pro](https://github.com/zh-lx/pinyin-pro) · [hanzi-writer-data](https://github.com/chanind/hanzi-writer-data) · [Hanzi Writer license](https://hanziwriter.org/license.html) · [Tone Perfect](https://www.diglib.org/tone-perfect-multimodal-database-mandarin-chinese/)
- [vite-plugin-pwa](https://www.npmjs.com/package/vite-plugin-pwa) · [Gemini models](https://ai.google.dev/gemini-api/docs/models) · [Live API capabilities](https://ai.google.dev/gemini-api/docs/live-api/capabilities) · [Gemini structured output](https://ai.google.dev/gemini-api/docs/generate-content/structured-output) · [MDN SpeechRecognition.processLocally](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/processLocally)
