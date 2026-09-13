# AGENT.md — HanziStep PWA

Read this before changing code. Keep it accurate: when an algorithm, data format or convention changes, update this file **and** the matching tests in the same change.

## Project

HanziStep is a personal, local-first PWA for learning Mandarin Chinese with a Vietnamese UI. It ports the structure, algorithms and assets of `../English Extension for you` (the GermanyVocab Chrome extension) and extends them to listening, speaking, reading and writing.

- Approved roadmap and design: `docs/PLAN.md`. Glossary: `docs/CONTEXT.md`.
- One user, one computer, no backend, no sync. Progress lives in IndexedDB; backups are JSON files.
- The learner is a complete beginner.

## Run

| Command                                               | Purpose                                                                                                                          |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `Start HanziStep.bat`                                 | Daily use: installs/builds when needed, serves `dist` on http://localhost:4173 and opens Edge. `-Rebuild` forces an app rebuild. |
| `npm run dev`                                         | Dev server on http://localhost:5173 (a different origin, so a separate IndexedDB).                                               |
| `npm run build` / `npm run preview`                   | Typecheck + production build / serve the build on port 4173.                                                                     |
| `npm test`                                            | Vitest (runs with `TZ=Asia/Ho_Chi_Minh`).                                                                                        |
| `npm run test:e2e`                                    | Build, then Playwright against the installed Microsoft Edge.                                                                     |
| `npm run lint` / `npm run typecheck`                  | ESLint / `tsc -b`.                                                                                                               |
| `npm run data:fetch` → `data:build` → `data:validate` | Data pack pipeline (below).                                                                                                      |
| `npm run icons`                                       | Regenerate PWA icons from `public/favicon.svg`.                                                                                  |
| `npm run size`                                        | Initial JS against the 250 KB gzip budget (run after a build).                                                                   |

IndexedDB is per origin. Ports are fixed (`strictPort`); never change 4173 for daily use or saved progress will look lost.

## Stack

Vite 8 · React 19 · TypeScript 6 strict (typescript-eslint does not support TS 7 yet) · React Router 8 (library mode; `RouterProvider` from `react-router/dom`) · Dexie 4 + dexie-react-hooks · Zustand 5 · Zod 4 · Tailwind CSS 4 · vite-plugin-pwa 1.3 (Workbox, `registerType: 'prompt'`) · sonner · lucide-react 1.x (renamed icons: `House`, `ChartColumn`) · Vitest 5 + happy-dom + fake-indexeddb · Playwright 1.63 (`channel: 'msedge'`) · tsx + fflate for scripts.

UI primitives are hand-written in `src/ui` (no shadcn/Radix yet).

## Layout

```
src/app        router, layout (Sidebar), ThemeSync, PwaUpdater, error/404 pages
src/db         Dexie database, schema, settings (Zod-validated), storage helpers,
               storageReport (what is taking up room), lru (eviction for cached pictures)
src/domain     domain types (Word, Card, ReviewLog, DailyStats, TextDoc, Settings…)
src/data       data-pack types + manifest loader        (shared with scripts: relative imports only)
src/chinese    Chinese language logic                  (shared with scripts: relative imports only)
               hanviet.ts, cognate.ts, toneColors.ts, text.ts,
               pinyin/ (syllables, parse, marks, compare, sandhi),
               segment/ (sentence splitting, longest-match reconcile, overrides)
src/lib        pure helpers: dayKey, random, time, http, cache, dedupe
src/progress   xp (rules + daily caps), levels, badges, streak, state (kv keys),
               recordActivity (one transaction per activity), snapshot/useProgress, announce (toasts)
src/srs        scheduler interface, SM-2 port, optional FSRS adapter, cards (ids, state, labels),
               replay/history (compare schedulers on the real log), backlog (spreading overdue cards)
src/services   audio: sfx, mixer (music ducking), clips (syllable recordings), sequence
               speech: voices (zh-CN ranking), tts, useSpeaker, wordSpeaker,
                       recognition (Web Speech), recorder (MediaRecorder), pitch (autocorrelation)
               ai: gemini (JSON, audio input, sentence grading), prompts/ (story, dialogue, coach)
               images: providers (Pixabay, Unsplash), store (blobs in `caches`)
src/features   today, learn (onboarding + word introduction), review (gate, session, questions, engine),
               reading (library, reader, tap-to-look-up popover, AI stories),
               listening (dialogue, blind listen, transcript, dictation),
               speaking (scoreUtterance, shadowing), coach (voice gate, PCM, live socket),
               vocab (list, detail, CSV, pictures, Ctrl+K lookup), stats, pinyin (lessons, chart, drills),
               writing (local Hanzi Writer animation + character SRS quiz),
               settings (+ voice, diagnostics, sources), backup, music, placeholder
public/worklets mic-capture.js (audio-thread microphone frames for the coach)
src/i18n/vi.ts user-facing strings
src/ui         Button, Card, PageHeader, form controls
src/styles     globals.css (theme tokens)
scripts        data pipeline (fetch-datasets, build-all, validate-data, lib/*), start-local.ps1
tests          setup.ts, e2e/*.spec.ts
```

## Conventions

- **Language:** UI text is Vietnamese, centralised in `src/i18n/vi.ts` once reused. Code, comments and script logs are English.
- **Pure logic first:** put it in `src/lib`, `src/chinese`, `src/srs` with a colocated `*.test.ts`; keep components thin.
- **Randomness:** always use `src/lib/random.ts` (`shuffle` is Fisher–Yates; `mulberry32(seed)` in tests). Never `sort(() => Math.random() - 0.5)`.
- **Dates:** store day keys from `toDayKey()` (local time + `dayStartHour`). Never `toISOString().slice(0, 10)` (UTC bug from the English app).
- **Shared files:** anything imported by scripts (`src/chinese/hanviet.ts`, `src/data/*`) uses relative imports, no `@/`.
- **Styling:** use theme tokens from `src/styles/globals.css` (`bg-surface`, `bg-surface-2`, `text-fg`, `text-sub`, `text-muted`, `border-line`, `text-tone-1..5`, `bg-seal`). Tailwind cannot see dynamic class names, so map values to full class strings.
- **Settings:** read with `useSettings()` / `useLoadedSettings()`, write with `updateSettings(patch)`. Invalid values are dropped by the Zod shape in `src/db/settings.ts`.
- **Secrets:** API keys live only in the `kv.settings` row. Backups exclude them unless the user opts in.

## Progress rules (docs/PLAN.md §6)

- **Recording activity:** call `recordActivity({ kind, amount?, counters? })` for every learning activity, then `announceActivity(result, label)`. Never write XP directly.
- **XP:** the table and daily caps live in `src/progress/xp.ts`. Caps count events, not XP.
- **Levels:** `minXp(L) = 250 × (L − 1)²`, 10 levels with titles from 学童 to 翰林. Only XP is stored; the level is always derived from it.
- **Active day:** a day counts when `dailyStats.learningXp > 0`. Saving words gives XP but does not make a learning day.
- **Streak:** computed when read (`computeStreak`), so a missed day shows 0 immediately.
- **Daily goal:** measured in learning XP. The +20 bonus is added once per day, inside the same transaction.
- **Badges:** evaluated after each activity (`evaluateBadges`). Keep ids stable because they are stored in `kv.gamification.badges`.

## Pinyin & tones (Phase 1)

- **Parsing:** `parsePinyin` accepts numbers, marks (also decomposed), ü written as v or u:, apostrophes and hyphens. An untoned syllable is neutral (5).
- **Checking answers:** use `comparePinyin` with every reading in `acceptedReadings` (citation and sandhi forms).
- **Syllable set:** 414 syllables (audio-cmn keys minus jv/fe/yai/cei, plus r and yo). Audio keys write ü as `v` (`syllableAudioKey`).
- **Drills:** adaptive practice, not SM-2. Each item keeps an EMA error rate (α = 0.3, unseen = 0.5, minimum weight 0.15) in `kv.drillStats`. Tone answers also feed `toneRecent` (last 100) for the `tone_ear` badge.
- **Playback:** `useSpeaker().say({ pinyin, hanzi })` plays real recordings when every syllable has one, otherwise zh-CN TTS on the characters. Never TTS isolated syllables or bare pinyin.

## Data model

- Dexie database `hanzistep`, version 4. Tables and indexes are in `src/db/schema.ts`; v2 marks already-tagged words so first-tag XP cannot be earned again; v3 adds `chars` and character-owned write cards; v4 repairs positional pinyin/Hán-Việt and compound meanings created by the original v3 migration.
- **Never edit a released version.** Add `version(n + 1)` with `.upgrade()` and a migration test.
- **Backup file** (`src/features/backup/backup.ts`): schema v3 validates every domain row/reference and includes stored image blobs; v1 and v2 are migrated explicitly before restore.
  - `data` holds the tables `words`, `chars`, `cards`, `reviewLogs`, `dailyStats`, `texts`, `coachSessions`, `kv`.
  - `dict`, `caches` and `audioCache` are excluded because they can be rebuilt.
- **Restore:** replaces all backed-up tables in one transaction. If the file has no API keys, it keeps the keys already on this device.

## Data pack (`public/data/v1`, gitignored)

Built from `data-raw/` (gitignored) by `scripts/build-all.ts`:

| Output                                                     | Source (licence)                                | Notes                                                                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hsk/{hsk2\|hsk3\|hsk3-newest}-{level}.json`               | complete-hsk-vocabulary (MIT)                   | `HskLevelFile`. Level 7 = band 7–9. Each form has `py`, `pn` (numbered, ü not u:), `en`, `vi` (CVDICT, classifier glosses removed), `cl`, `hv` (best Hán-Việt: the reading found in the Vietnamese meaning, else the usual tone for neutral tones, else the first) and `hva` (every candidate, only when ambiguous) |
| `dict/dict.json.gz`                                        | CC-CEDICT + CVDICT (CC BY-SA 4.0)               | `DictRow[]` = `[simp, trad, pinyin, en[], vi[], classifiers[]]`                                                                                                                                                                                                                                                     |
| `hanviet.json`                                             | hanviet-pinyin-words (MIT) + Unihan kVietnamese | Keys are **traditional** characters → numbered pinyin with `u:`, or `*`                                                                                                                                                                                                                                             |
| `syllables.json`, `public/audio/syllables/{key}{tone}.mp3` | audio-cmn (CC BY-SA)                            | ü is `v` in keys                                                                                                                                                                                                                                                                                                    |
| `words-audio.json`, `public/audio/words/{hanzi}.mp3`       | audio-cmn (CC BY-SA)                            | Whole-word recordings for HSK words; the index is a plain array of headwords                                                                                                                                                                                                                                        |
| `sentences/{1..6}.json`                                    | Tatoeba via manythings.org (CC BY 2.0 FR)       | Simplified only, ≤ 20 Han characters, ≥ 90% of tokens at or below the level                                                                                                                                                                                                                                         |
| `LICENSES/`, `manifest.json`                               | —                                               | The manifest has counts and sha256 per file                                                                                                                                                                                                                                                                         |

Source level-tag prefixes: `o` = HSK 2.0, `n` = HSK 3.0, `t` = "newest" track. Syllable audio is copied as mp3 because ffmpeg is not installed.

Build rules worth knowing:

- HSK forms whose meanings are only "variant of …" (e.g. 㝡 for 最) are dropped.
- Hán-Việt tries the form's spelling, then CC-CEDICT's standard traditional spelling, then the simplified word.
- Unihan kVietnamese fills in characters that have no readings in the wordlist.
- `npm run data:validate` must pass (77 checks) before shipping a rebuilt pack. Current pack: 125,050 dictionary entries (95% with Vietnamese), 11,470 HSK words (no unknown Hán-Việt), 416 syllables / 1,679 recordings, 8,569 word recordings, 9,198 sentences.
- Word recordings come from the `24k-abr/hsk` folder of audio-cmn, which `npm run data:fetch` adds to the sparse checkout.

## SRS & review (docs/PLAN.md §5)

- **Facets:** the `read` card is created with the word; `listen` is created suspended and unlocks once the read card reaches repetition ≥ 1. A session asks at most one facet per word (siblings are buried).
- **Scheduler:** `src/srs/sm2.ts` is the exact port (20 min → 1 day → `interval × EF`, EF floor 1.3, cap 365 days) behind the `Scheduler` interface, so FSRS can be added later without touching the UI.
- **One transaction per answer:** `answerCard` writes the card, the review log, daily stats and XP together, then evaluates badges. Never write those tables separately.
- **Question types:** `engine/selectQuestionType.ts` picks the type from facet × repetition, `engine/questions.ts` builds it and falls back when a resource is missing (no picture, fewer than 4 learned words, no example sentence, no Chinese voice, no Gemini key). A new type needs all three of: builder, `qualityFor` case, and a view in `features/review/questions/`.
- **Distractors** (`engine/distractors.ts`) must never produce two right answers: `glossesOverlap` drops synonyms, and every accepted reading (including sandhi) is excluded from pinyin and tone options.
- **Mistakes:** wrong answers come back in a retry round with mode `retry` — practice only, +3 XP, no schedule change. Matching a due word inside a matching question also answers its card (mode `match-bonus`) and removes it from the queue.
- **Keyboard:** 1–4 choose, Space replays (Shift = slow), H hint, P shows pinyin, Enter continues. Text inputs call `stopPropagation` so their Enter never reaches the page handler.
- **CSV** (`features/vocab/csv.ts`): UTF-8 BOM + CRLF so Excel keeps Vietnamese and Chinese. Only the `Hanzi` column is required on import; a file exported by HanziStep also restores the schedule.
- **Pictures:** Pixabay URLs expire, so the image blob is stored in `caches` under `image:{wordId}` and `word.imageStatus === 'ok'` marks that one exists.

## Reading (docs/PLAN.md §7)

- **Segmentation** (`src/chinese/segment/`): dictionary longest match first (so 银行 stays one word and 行走 is never cut), `Intl.Segmenter` only as a fallback for runs with no dictionary word, which keeps names together. A text's own split/merge edits are stored as forced spans in `TextDoc.segOverrides` — one mechanism for both, because a forced span always becomes exactly one token.
- **Readings are per token, never per character:** `tokenPinyin` looks the whole token up, then sandhi is applied across each run of adjacent words (punctuation ends a run). The dictionary reading is kept as `citation` so the popover can show both.
- **Token status** decides the colour: `known` (read repetition ≥ 3 or marked known) → `learning` → `target` → `new` (in the dictionary) → `unknown` (dashed underline).
- **The lexicon is the whole dictionary:** ~125k headwords loaded once per session by `loadDictionaryHeadwords`. It is never cached while empty, and the reader re-prepares the text when the dictionary import finishes — otherwise the first read of the day silently mis-segments.
- **Budget:** segmenting and reading a 500-character text stays well under 300 ms once the dictionary is in memory (`pipeline.test.ts` guards it).
- **AI stories** (`services/ai/prompts/story.ts` + `features/reading/story.ts`): a closed allowed-word list (max 400, learned words + HSK up to the level + function words + a fixed name list), per-level length rules, Zod-validated JSON, then coverage is measured **locally**. Below 95% (HSK 1–2) or 92% (above) the story is rewritten once; whatever is kept, the words outside the list stay marked in the reader. Never trust pinyin from the model — it is always computed locally.
- **Saving from a text** stores the sentence in `word.context`, and pending words are introduced before HSK words in Học mới.

## Listening, speaking and the coach (docs/PLAN.md §8)

- **Speech recognition never judges tones.** `scoreUtterance` matches characters first, reports a syllable-only match as a *homophone*, and caps quality at 4; the UI repeats that the recogniser cannot hear tones. Tone work stays in the pinyin drills.
- **Speak cards** are created suspended with the word and unlock at reading repetition ≥ 2 (listening at ≥ 1). Both facets are switched on in Settings → Học tập.
- **Listening room:** listen blind, answer the questions, and only then read the transcript. Dialogues use the same closed word list and coverage check as the reading stories (`buildAllowedVocabulary`), and two voices when the machine has two.
- **Dictation** has three modes — pinyin, tiles, characters — graded by the existing `gradePinyin` / `gradeOrder` / `gradeDictation`: 10 XP for a perfect sentence, 4 when at least 90% of the characters match.
- **Shadowing compares pitch only against real recordings** (audio-cmn), never against browser TTS, which cannot be captured. `services/speech/pitch.ts` is normalised autocorrelation with a subharmonic guard (a voice also correlates at two or three times its period); the single-syllable tone classifier is labelled experimental wherever it appears.
- **AI Coach:** `voiceGate.ts` keeps the ported constants (MIN_RMS .012, STRONG_RMS .075, SILENCE_HOLD 6, 800 ms tail, 280 ms duck) and stays pure, so it is tested frame by frame. Microphone audio goes out as 16 kHz PCM16 and comes back at 24 kHz (`pcm.ts`), captured by `public/worklets/mic-capture.js`. The Live API message shapes exist **only** in `liveSocket.ts`: if the coach ever stops answering, check that file against the current documentation first.
- **AI pronunciation notes are an opinion**, shown as such, and never feed the SRS.
- **Pictures** come from Pixabay or Unsplash (whichever key is present) and the file itself is always downloaded into `caches` under `image:{ownerId}` — those URLs expire, so a stored link would eventually break.

## Durability (docs/PLAN.md §9, Phase 5)

- **Two schedulers, one interface.** `settings.scheduler` picks SM-2 or FSRS through `schedulerFor()`. Each keeps its own numbers — FSRS writes `card.fsrs`, SM-2 writes `easeFactor` — so switching never destroys the other's schedule. FSRS needs its own bookkeeping (`learningSteps`, `state`) stored with it: without them a card never leaves its 10-minute step.
- **Replay never writes.** `replayCard` / `compareSchedulers` recompute from `reviewLogs` so the Settings comparison can answer "what would change?" without touching a card.
- **Backlog spreading** keeps today's share where it is and pushes the rest over the coming days, never further than 14.
- **What actually fills the disk:** `dict` (125k rows) and stored pictures in `caches`. The `audioCache` table exists in the schema but nothing writes to it yet, so the LRU (`db/lru.ts`) runs over the image cache; both the dictionary and the pictures can be rebuilt or refetched.
- **Auto-backup** keeps the folder handle in `kv` (File System Access API), writes a dated file and reminds weekly; browsers without the API still get the download button.
- **Quick placement** marks a whole HSK level as known in one action and records the ids, so one undo removes exactly those words.
- **CSP is injected at build time only** (`vite.config.ts`): a meta tag would also apply to the dev server and break HMR. `connect-src` allows just Gemini (https and wss), Pixabay and Unsplash. The theme script lives in `public/theme.js` so `script-src` stays `'self'` with no `unsafe-inline`. The directive list is written once: the meta tag drops `frame-ancestors` (a browser ignores it there and says so in the console) and the preview server sends the full policy as a real header.
- **Bundle budget:** every route except Today is loaded on demand, and `npm run size` fails when the initial JavaScript goes over 250 KB gzip.
- **The app badge uses `loadDueCount`, never the full snapshot.** That query lives in the layout and runs on every database change, so it reads only the cards that are due (indexed) and looks up exactly those words; `loadReviewSnapshot` scans both tables and belongs on a page.
- **A picture records its own `bytes` when saved.** The storage report and the LRU read that number instead of measuring the blob, which keeps the report cheap and works even where a stored blob does not come back as a `Blob` instance.
- **Every route has a smoke test** (`tests/e2e/smoke.spec.ts`): it opens all of them and fails on any uncaught error or console error. Most screens have no other end-to-end coverage.

## Writing (docs/PLAN.md §5.4, Phase 6)

- A write card belongs to a single character (`subjectType: 'char'`), never to a word. `chars.wordIds` records every learned word that contributed it.
- Writing is opt-in. A character opens once any containing word's read card reaches repetition 3; entering the Writing page backfills words mastered before the facet was enabled.
- Hanzi Writer is dynamically loaded only on the writing/popover paths. Its 3,034 simplified HSK character files are local under `data/v1/hanzi`, precached for offline use, and validated with the Arphic licence present.
- Support decreases by repetition: animation + tracing at 0, outline at 1, no outline at 2, character meaning or an explicitly labelled source-word cue at 3+. Restarting never clears elapsed time, mistakes or hint use; requesting a hint reveals the outline immediately. `qualityFor('stroke-quiz')` maps give-up/hints/mistakes exactly as §5.3.
- General word-review planning must filter `subjectType === 'word'`; character cards are scheduled only by the Writing page.

## Porting from the English app

- **Already ported:** theme tokens, music player and track list, answer sounds, `formatTimeLeft`, the in-memory cache and dedupe helpers, and the backup/restore idea.
- **Still to port:** see `docs/PLAN.md` §2.1. The bugs that must not be carried over are in §2.4.
- **Never copy** the Pixabay key hard-coded in the extension's `background/background.js`.

## Safety

- Never commit API keys, `.env` files, `data-raw/` or generated data.
- No `dangerouslySetInnerHTML`.
- Do not run `git push` or publish anything unless the user asks in the current turn.

## Progress

Verification snapshot 2026-09-13: 538 unit tests/56 files, 10 Edge E2E including mobile navigation plus failed and successful real stroke paths with persisted quality, TypeScript, lint, production build, data validation (77 aggregate checks including 3,034 stroke files), initial JS 198.7 KB gzip against the 250 KB budget.

| Phase | Implementation | Automated verification | Remaining manual/release gate |
|---|---|---|---|
| 0 — Foundations | Feature-complete | Passed | None in application code |
| 1 — Chinese core + Pinyin & Tones | Feature-complete; lessons are ordered and require a checkpoint before completion | Passed, including all 1,679 syllable and 8,569 word audio files | Real-device voice quality varies |
| 2 — Vocabulary + SRS | Feature-complete | Passed, including time rollover and SM-2/FSRS switching regressions | Multi-day user trial recommended |
| 3 — Reading + tap-to-lookup | Feature-complete | Passed unit + dictionary-import E2E | None in core flow |
| 4 — Listening + Speaking + AI Coach | Implemented | Non-network logic passed | Gemini Live 5-minute test with a real key; Gemini TTS fallback/cache remains roadmap work |
| 5 — Hardening | Automated gates implemented | Passed build/data/audit/E2E; CI workflow added | Git baseline commit, production-host headers, music license ledger, folder picker and app badge gestures |
| 6 — Writing + extras | Core writing implemented; positional metadata repair is DB v4; optional extension/Whisper/PDF not implemented | Unit, typecheck, lint, build, data, bundle and Edge failed/successful-stroke gates passed | Real touch-device trial; optional extras remain roadmap |

`Bugs.md` is the release ledger. Do not call the app deployment-ready while any item there is marked as a public-release blocker.
