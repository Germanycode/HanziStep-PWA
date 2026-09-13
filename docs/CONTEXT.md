# CONTEXT — HanziStep glossary

| Term | Meaning |
|---|---|
| **Word** | A vocabulary item; `simplified + pinyinNum` is unique. Holds Vietnamese/English meanings, Hán-Việt, HSK levels, classifiers, examples. |
| **Hán-Việt** | Sino-Vietnamese reading of each character (学生 = HỌC SINH). Derived from the traditional form + pinyin (`src/chinese/hanviet.ts`). |
| **Cognate** | A word whose Hán-Việt reading appears in its Vietnamese meaning (注意 = chú ý). |
| **Facet** | A skill practised for a subject: `read`, `listen`, `speak`, `write` (write is per character). |
| **Subject** | What a card is about: a word, or (Phase 6) a single character. |
| **Card** | Scheduling state for one subject × facet (SM-2: repetition, easeFactor, intervalDays, due, lapses). |
| **Mastery label** | From the `read` card's repetition: 0 Mới, 1 Đang học, 2 Quen, 3 Nhớ, 4+ Thành thạo. |
| **Quality** | 0–5 grade of one answer from correctness, time, hints and replays; input to the scheduler. |
| **Session** | One review run: due cards plus today's new words, in chunks; may end with a retry round. |
| **Retry round** | Practice on the session's mistakes. Never changes scheduling. |
| **Review log** | Immutable record of one answer with the card state before and after. |
| **Day key** | Local calendar day `YYYY-MM-DD`, shifted by `dayStartHour`. Basis for daily stats and streaks. |
| **Active day** | A day with `learningXp > 0`. |
| **Streak** | Consecutive active days ending today or yesterday; computed when read, never stored. |
| **XP / Level** | XP is stored; the level is always derived from XP. |
| **Track / Level** | HSK word-list family (`hsk2`, `hsk3`, `hsk3-newest`) and a level within it; level 7 means band 7–9. |
| **Data pack** | Generated files in `public/data/v1`, described by `manifest.json`. |
| **Text** | A reading text: AI story, AI dialogue, or pasted text. |
| **Token** | A segmented word inside a text sentence, with in-context pinyin and a status (known, learning, target, new, unknown). |
| **Coverage** | Share of a text's content tokens that the learner already knows. |
| **Drill** | Adaptive pinyin/tone practice item. Weighted by recent error rate, not scheduled with SM-2. |
