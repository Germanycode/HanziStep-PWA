export interface DataSource {
  name: string;
  usage: string;
  license: string;
  url: string;
  attribution: string;
}

/** Shown on Settings → Nguồn & Ghi công. Keep in sync with scripts/fetch-datasets.ts. */
export const DATA_SOURCES: readonly DataSource[] = [
  {
    name: 'Complete HSK Vocabulary',
    usage: 'Danh sách từ HSK 2.0 và 3.0, tần suất, từ loại, lượng từ',
    license: 'MIT',
    url: 'https://github.com/drkameleon/complete-hsk-vocabulary',
    attribution: '© 2026 Yanis Zafirópulos (Dr.Kameleon)',
  },
  {
    name: 'CC-CEDICT',
    usage: 'Từ điển Trung–Anh, lượng từ, dữ liệu tách từ',
    license: 'CC BY-SA 4.0',
    url: 'https://www.mdbg.net/chinese/dictionary?page=cc-cedict',
    attribution: 'MDBG; CEDICT © 1997, 1998 Paul Andrew Denisowski',
  },
  {
    name: 'CVDICT',
    usage: 'Nghĩa tiếng Việt, dịch từ CC-CEDICT',
    license: 'CC BY-SA 4.0',
    url: 'https://github.com/ph0ngp/CVDICT',
    attribution: 'Phong Phan',
  },
  {
    name: 'hanviet-pinyin-wordlist',
    usage: 'Âm Hán Việt theo từng chữ và pinyin',
    license: 'MIT',
    url: 'https://github.com/ph0ngp/hanviet-pinyin-wordlist',
    attribution: '© 2024 Phong Phan',
  },
  {
    name: 'Unihan (kVietnamese)',
    usage: 'Âm Hán Việt dự phòng',
    license: 'Unicode License v3',
    url: 'https://www.unicode.org/charts/unihan.html',
    attribution: '© Unicode, Inc.',
  },
  {
    name: 'audio-cmn',
    usage: 'Phát âm âm tiết có thanh điệu (giọng người thật)',
    license: 'CC BY-SA',
    url: 'https://github.com/hugolpz/audio-cmn',
    attribution: 'Âm tiết: Chen Wang; từ HSK: Yue Tan; tuyển chọn: hugolpz',
  },
  {
    name: 'Tatoeba (qua ManyThings.org)',
    usage: 'Câu ví dụ Trung–Anh',
    license: 'CC BY 2.0 FR',
    url: 'https://tatoeba.org',
    attribution: 'Cộng đồng Tatoeba; bộ cặp câu của manythings.org',
  },
  {
    name: 'Hanzi Writer + Hanzi Writer Data',
    usage: 'Animation, nhận dạng và chấm thứ tự nét cho 3.034 chữ HSK',
    license: 'MIT (thư viện) · Arphic Public License (dữ liệu)',
    url: 'https://hanziwriter.org/license.html',
    attribution: 'Hanzi Writer © David Chanin; dữ liệu từ Make Me A Hanzi / Arphic Technology',
  },
  {
    name: 'Nhạc nền và âm thanh đúng/sai',
    usage: 'Nhạc học tập, âm báo đúng/sai (mang sang từ English Extension)',
    license: 'Theo nguồn gốc trong English Extension (các track "the_mountain" từ Pixabay)',
    url: 'https://pixabay.com/music/',
    attribution: 'The Mountain (Pixabay) và các tệp đi kèm extension',
  },
];
