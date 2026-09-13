/** Pinyin & tones course for complete beginners (Vietnamese). */

export interface LessonExample {
  /** Written (citation) pinyin, numbered. */
  pinyin: string;
  hanzi?: string;
  meaning?: string;
  /** Spoken form when it differs (tone sandhi); this is what gets played. */
  spoken?: string;
}

export interface LessonSection {
  heading: string;
  paragraphs: string[];
  table?: { head: string[]; rows: string[][] };
  examples?: LessonExample[];
}

export interface Lesson {
  id: string;
  title: string;
  summary: string;
  sections: LessonSection[];
}

export const LESSONS: readonly Lesson[] = [
  {
    id: 'tones',
    title: 'Bốn thanh điệu và thanh nhẹ',
    summary: 'Thanh điệu làm đổi nghĩa của từ. Nghe và tập đọc 4 thanh cùng thanh nhẹ.',
    sections: [
      {
        heading: 'Vì sao thanh điệu quan trọng?',
        paragraphs: [
          'Tiếng Trung phổ thông có 4 thanh điệu và 1 thanh nhẹ. Cùng một âm tiết, đổi thanh là thành một từ khác.',
          'Người Việt có lợi thế vì tiếng Việt cũng có thanh điệu, nhưng cao độ từng thanh khác nhau, nên cần luyện lại tai từ đầu.',
        ],
        examples: [
          { pinyin: 'ma1', hanzi: '妈', meaning: 'mẹ' },
          { pinyin: 'ma2', hanzi: '麻', meaning: 'tê; cây gai' },
          { pinyin: 'ma3', hanzi: '马', meaning: 'con ngựa' },
          { pinyin: 'ma4', hanzi: '骂', meaning: 'mắng' },
          { pinyin: 'ma5', hanzi: '吗', meaning: 'trợ từ để hỏi' },
        ],
      },
      {
        heading: 'Cách đọc từng thanh',
        paragraphs: ['Các con số mô tả cao độ từ 1 (thấp nhất) đến 5 (cao nhất).'],
        table: {
          head: ['Thanh', 'Dấu', 'Cao độ', 'Gợi ý cho người Việt'],
          rows: [
            ['Thanh 1', 'ā', '5 → 5, cao và đều', 'Như thanh ngang nhưng giữ giọng cao hơn.'],
            ['Thanh 2', 'á', '3 → 5, đi lên', 'Giống dấu sắc, như khi hỏi lại “hả?”.'],
            ['Thanh 3', 'ǎ', '2 → 1 → 4, xuống rồi lên', 'Gần giống dấu hỏi: hạ thật thấp rồi nâng lên.'],
            ['Thanh 4', 'à', '5 → 1, rơi mạnh', 'Như dấu huyền nhưng bắt đầu cao, rơi nhanh và dứt khoát.'],
            ['Thanh nhẹ', 'a', 'ngắn, nhẹ', 'Đọc ngắn, nhẹ; cao độ phụ thuộc âm tiết đứng trước.'],
          ],
        },
      },
      {
        heading: 'Nghe thêm và đọc theo',
        paragraphs: ['Bấm để nghe, rồi đọc to theo. Lúc mới học hãy phóng đại cao độ.'],
        examples: [
          { pinyin: 'ba1', hanzi: '八', meaning: 'số tám' },
          { pinyin: 'ba2', hanzi: '拔', meaning: 'nhổ' },
          { pinyin: 'ba3', hanzi: '把', meaning: 'cầm, nắm' },
          { pinyin: 'ba4', hanzi: '爸', meaning: 'bố' },
          { pinyin: 'yi1', hanzi: '一', meaning: 'số một' },
          { pinyin: 'yi2', hanzi: '移', meaning: 'dời đi' },
          { pinyin: 'yi3', hanzi: '椅', meaning: 'cái ghế' },
          { pinyin: 'yi4', hanzi: '意', meaning: 'ý' },
        ],
      },
    ],
  },
  {
    id: 'finals-simple',
    title: 'Vận mẫu đơn: a o e i u ü',
    summary: 'Sáu nguyên âm nền tảng của pinyin và cách đọc gần đúng với tiếng Việt.',
    sections: [
      {
        heading: 'Sáu nguyên âm cơ bản',
        paragraphs: ['Vận mẫu là phần vần của âm tiết. Sáu vận mẫu đơn là nền cho mọi vần khác.'],
        table: {
          head: ['Vận mẫu', 'Cách đọc gần đúng', 'Ví dụ'],
          rows: [
            ['a', 'như “a”, mở miệng rộng', '啊 ā'],
            ['o', 'như “ô” nhưng tròn môi hơn, hơi có “ua”', '哦 ó'],
            ['e', 'giữa “ơ” và “ưa”, lưỡi lùi về sau', '饿 è (đói)'],
            ['i', 'như “i”', '一 yī'],
            ['u', 'như “u”, chu tròn môi', '五 wǔ (năm)'],
            ['ü', 'đọc “i” rồi chu tròn môi, giữ nguyên lưỡi', '鱼 yú (cá)'],
          ],
        },
        examples: [
          { pinyin: 'a1', hanzi: '啊', meaning: 'a (thán từ)' },
          { pinyin: 'o2', hanzi: '哦', meaning: 'ồ' },
          { pinyin: 'e4', hanzi: '饿', meaning: 'đói' },
          { pinyin: 'yi1', hanzi: '一', meaning: 'một' },
          { pinyin: 'wu3', hanzi: '五', meaning: 'năm' },
          { pinyin: 'yu2', hanzi: '鱼', meaning: 'cá' },
        ],
      },
      {
        heading: 'Lưu ý',
        paragraphs: [
          'Đứng một mình, i viết là yi, u viết là wu, ü viết là yu (chi tiết ở bài 5).',
          'Chữ e trong pinyin không đọc như “e” tiếng Việt: 饿 è đọc gần “ưa” và đi xuống.',
        ],
        examples: [
          { pinyin: 'he1', hanzi: '喝', meaning: 'uống' },
          { pinyin: 'ge4', hanzi: '个', meaning: 'cái (lượng từ)' },
          { pinyin: 'de5', hanzi: '的', meaning: 'trợ từ “của”' },
        ],
      },
    ],
  },
  {
    id: 'initials',
    title: 'Thanh mẫu (phụ âm đầu)',
    summary: 'Sáu nhóm phụ âm đầu, cặp bật hơi và không bật hơi, chữ i đặc biệt.',
    sections: [
      {
        heading: 'Bật hơi và không bật hơi',
        paragraphs: [
          'Nhiều cặp phụ âm chỉ khác nhau ở luồng hơi: b/p, d/t, g/k, j/q, z/c, zh/ch. Âm thứ hai bật một luồng hơi mạnh — đặt tờ giấy trước miệng sẽ thấy giấy rung.',
          'b, d, g không bật hơi, nên nghe gần “p, t, c” của tiếng Việt hơn là “b, đ, g”.',
        ],
        examples: [
          { pinyin: 'ba1', hanzi: '八', meaning: 'tám' },
          { pinyin: 'pa1', hanzi: '趴', meaning: 'nằm sấp' },
          { pinyin: 'da4', hanzi: '大', meaning: 'to, lớn' },
          { pinyin: 'ta1', hanzi: '他', meaning: 'anh ấy' },
          { pinyin: 'ge1', hanzi: '哥', meaning: 'anh trai' },
          { pinyin: 'ke1', hanzi: '科', meaning: 'khoa, môn' },
        ],
      },
      {
        heading: 'Sáu nhóm thanh mẫu',
        paragraphs: ['Học theo nhóm vị trí phát âm sẽ dễ nhớ hơn học lẻ từng chữ.'],
        table: {
          head: ['Nhóm', 'Thanh mẫu', 'Gợi ý'],
          rows: [
            ['Môi', 'b p m f', 'f đọc như “ph”.'],
            ['Đầu lưỡi', 'd t n l', 't bật hơi, gần “th”.'],
            ['Cuống lưỡi', 'g k h', 'h đọc gần “kh” nhẹ.'],
            ['Mặt lưỡi', 'j q x', 'j gần “ch” với lưỡi phẳng; q là j bật hơi; x gần “x”.'],
            ['Đầu lưỡi – răng', 'z c s', 'z gần “ch” sát răng; c là z bật hơi; s gần “x”.'],
            ['Uốn lưỡi', 'zh ch sh r', 'Cong đầu lưỡi lên: zh gần “tr”; ch là zh bật hơi; sh là “s” uốn lưỡi; r là “r” mềm.'],
          ],
        },
        examples: [
          { pinyin: 'ji1', hanzi: '鸡', meaning: 'con gà' },
          { pinyin: 'qi1', hanzi: '七', meaning: 'bảy' },
          { pinyin: 'xi1', hanzi: '西', meaning: 'phía tây' },
          { pinyin: 'zi4', hanzi: '字', meaning: 'chữ' },
          { pinyin: 'ci4', hanzi: '次', meaning: 'lần' },
          { pinyin: 'si4', hanzi: '四', meaning: 'bốn' },
          { pinyin: 'zhi1', hanzi: '知', meaning: 'biết' },
          { pinyin: 'chi1', hanzi: '吃', meaning: 'ăn' },
          { pinyin: 'shi2', hanzi: '十', meaning: 'mười' },
          { pinyin: 'ri4', hanzi: '日', meaning: 'ngày, mặt trời' },
        ],
      },
      {
        heading: 'Chữ i đặc biệt',
        paragraphs: [
          'Sau z c s zh ch sh r, chữ i không đọc là “i” mà là một âm gần “ư” kéo dài, lưỡi giữ nguyên vị trí của phụ âm: 四 sì, 十 shí, 日 rì.',
        ],
        examples: [
          { pinyin: 'si4', hanzi: '四', meaning: 'bốn' },
          { pinyin: 'shi2', hanzi: '十', meaning: 'mười' },
          { pinyin: 'ri4', hanzi: '日', meaning: 'ngày' },
        ],
      },
    ],
  },
  {
    id: 'finals-compound',
    title: 'Vận mẫu kép và âm mũi',
    summary: 'ai, ei, ao, ou… và cặp dễ nhầm an/ang, en/eng, in/ing.',
    sections: [
      {
        heading: 'Vận mẫu kép',
        paragraphs: ['Đọc lướt từ nguyên âm đầu sang nguyên âm sau, không tách thành hai tiếng.'],
        table: {
          head: ['Vận mẫu', 'Gần giống', 'Ví dụ'],
          rows: [
            ['ai', 'ai', '爱 ài (yêu)'],
            ['ei', 'ây', '没 méi (không có)'],
            ['ao', 'ao', '好 hǎo (tốt)'],
            ['ou', 'âu', '口 kǒu (miệng)'],
            ['ia', 'ia', '家 jiā (nhà)'],
            ['ie', 'iê', '谢 xiè (cảm ơn)'],
            ['iao', 'ieo', '小 xiǎo (nhỏ)'],
            ['iu', 'iêu', '六 liù (sáu)'],
            ['ua', 'oa', '花 huā (hoa)'],
            ['uo', 'uô', '我 wǒ (tôi)'],
            ['uai', 'oai', '快 kuài (nhanh)'],
            ['ui', 'uây', '对 duì (đúng)'],
            ['üe', 'uê, tròn môi', '学 xué (học)'],
          ],
        },
        examples: [
          { pinyin: 'ai4', hanzi: '爱', meaning: 'yêu' },
          { pinyin: 'mei2', hanzi: '没', meaning: 'không có' },
          { pinyin: 'hao3', hanzi: '好', meaning: 'tốt' },
          { pinyin: 'kou3', hanzi: '口', meaning: 'miệng' },
          { pinyin: 'jia1', hanzi: '家', meaning: 'nhà' },
          { pinyin: 'xie4', hanzi: '谢', meaning: 'cảm ơn' },
          { pinyin: 'xiao3', hanzi: '小', meaning: 'nhỏ' },
          { pinyin: 'liu4', hanzi: '六', meaning: 'sáu' },
          { pinyin: 'hua1', hanzi: '花', meaning: 'hoa' },
          { pinyin: 'wo3', hanzi: '我', meaning: 'tôi' },
          { pinyin: 'kuai4', hanzi: '快', meaning: 'nhanh' },
          { pinyin: 'dui4', hanzi: '对', meaning: 'đúng' },
          { pinyin: 'xue2', hanzi: '学', meaning: 'học' },
        ],
      },
      {
        heading: 'Âm mũi -n và -ng',
        paragraphs: [
          '-n kết thúc bằng đầu lưỡi chạm lợi trên, như “n” tiếng Việt. -ng kết thúc ở cuống lưỡi, như “ng”. Người Việt hay nhầm en/eng và in/ing.',
        ],
        table: {
          head: ['Vận mẫu', 'Gần giống', 'Ví dụ'],
          rows: [
            ['an', 'an', '三 sān (ba)'],
            ['en', 'ân', '人 rén (người)'],
            ['in', 'in', '您 nín (ngài)'],
            ['ian', 'iên', '天 tiān (trời)'],
            ['uan', 'oan', '晚 wǎn (muộn)'],
            ['un', 'uân', '春 chūn (mùa xuân)'],
            ['ün', 'uyn', '云 yún (mây)'],
            ['üan', 'uyên', '远 yuǎn (xa)'],
            ['ang', 'ang', '忙 máng (bận)'],
            ['eng', 'âng', '冷 lěng (lạnh)'],
            ['ing', 'inh', '听 tīng (nghe)'],
            ['ong', 'ung', '中 zhōng (giữa)'],
            ['iang', 'i + ang', '想 xiǎng (nghĩ)'],
            ['iong', 'i + ung', '熊 xióng (gấu)'],
            ['uang', 'oang', '黄 huáng (vàng)'],
          ],
        },
        examples: [
          { pinyin: 'san1', hanzi: '三', meaning: 'ba' },
          { pinyin: 'ren2', hanzi: '人', meaning: 'người' },
          { pinyin: 'tian1', hanzi: '天', meaning: 'trời, ngày' },
          { pinyin: 'mang2', hanzi: '忙', meaning: 'bận' },
          { pinyin: 'leng3', hanzi: '冷', meaning: 'lạnh' },
          { pinyin: 'ting1', hanzi: '听', meaning: 'nghe' },
          { pinyin: 'zhong1', hanzi: '中', meaning: 'giữa' },
          { pinyin: 'xiang3', hanzi: '想', meaning: 'nghĩ, muốn' },
        ],
      },
      {
        heading: 'Cặp dễ nhầm',
        paragraphs: ['Nghe từng cặp và để ý phần cuối âm tiết.'],
        examples: [
          { pinyin: 'ren2', hanzi: '人', meaning: 'người' },
          { pinyin: 'reng2', hanzi: '仍', meaning: 'vẫn' },
          { pinyin: 'xin1', hanzi: '心', meaning: 'tim' },
          { pinyin: 'xing1', hanzi: '星', meaning: 'sao' },
          { pinyin: 'shan1', hanzi: '山', meaning: 'núi' },
          { pinyin: 'shang1', hanzi: '伤', meaning: 'vết thương' },
        ],
      },
    ],
  },
  {
    id: 'spelling-rules',
    title: 'Quy tắc viết: y, w, ü và dạng rút gọn',
    summary: 'Vì sao i viết là yi, ü lúc có hai chấm lúc không, và iu/ui/un là viết gọn.',
    sections: [
      {
        heading: 'Khi không có phụ âm đầu',
        paragraphs: ['Vận mẫu bắt đầu bằng i, u, ü mà không có thanh mẫu phải viết lại như sau:'],
        table: {
          head: ['Viết gốc', 'Viết thực tế', 'Ví dụ'],
          rows: [
            ['i, in, ing', 'yi, yin, ying', '一 yī, 音 yīn, 英 yīng'],
            ['ia, ie, iao, iou', 'ya, ye, yao, you', '牙 yá, 也 yě, 要 yào, 有 yǒu'],
            ['ian, iang, iong', 'yan, yang, yong', '烟 yān, 羊 yáng, 用 yòng'],
            ['u', 'wu', '五 wǔ'],
            ['ua, uo, uai, uei', 'wa, wo, wai, wei', '娃 wá, 我 wǒ, 外 wài, 为 wèi'],
            ['uan, uen, uang, ueng', 'wan, wen, wang, weng', '晚 wǎn, 问 wèn, 忘 wàng, 翁 wēng'],
            ['ü, üe, üan, ün', 'yu, yue, yuan, yun', '鱼 yú, 月 yuè, 远 yuǎn, 云 yún'],
          ],
        },
        examples: [
          { pinyin: 'you3', hanzi: '有', meaning: 'có' },
          { pinyin: 'yao4', hanzi: '要', meaning: 'muốn' },
          { pinyin: 'wei4', hanzi: '为', meaning: 'vì' },
          { pinyin: 'wen4', hanzi: '问', meaning: 'hỏi' },
          { pinyin: 'yue4', hanzi: '月', meaning: 'tháng, mặt trăng' },
        ],
      },
      {
        heading: 'Hai dấu chấm trên ü',
        paragraphs: [
          'Sau j, q, x và y, ü viết thành u nhưng vẫn đọc là ü: 去 qù, 学 xué, 句 jù.',
          'Sau n và l phải giữ dấu ü để phân biệt: 女 nǚ (nữ) khác 努 nǔ; 绿 lǜ (xanh lá) khác 路 lù (đường). Khi gõ phím, dùng v: nv3, lv4.',
        ],
        examples: [
          { pinyin: 'qu4', hanzi: '去', meaning: 'đi' },
          { pinyin: 'nü3', hanzi: '女', meaning: 'nữ' },
          { pinyin: 'nu3', hanzi: '努', meaning: 'cố gắng' },
          { pinyin: 'lü4', hanzi: '绿', meaning: 'xanh lá' },
          { pinyin: 'lu4', hanzi: '路', meaning: 'đường' },
        ],
      },
      {
        heading: 'Dạng rút gọn',
        paragraphs: ['Khi có thanh mẫu, iou, uei, uen viết gọn là iu, ui, un: l + iou → liù (六), g + uei → guì (贵), l + uen → lùn (论).'],
        examples: [
          { pinyin: 'liu4', hanzi: '六', meaning: 'sáu' },
          { pinyin: 'gui4', hanzi: '贵', meaning: 'đắt' },
          { pinyin: 'lun4', hanzi: '论', meaning: 'bàn luận' },
        ],
      },
    ],
  },
  {
    id: 'tone-marks',
    title: 'Đặt dấu thanh điệu',
    summary: 'Ba bước để luôn đặt dấu đúng chỗ, và cách gõ pinyin bằng số.',
    sections: [
      {
        heading: 'Quy tắc ba bước',
        paragraphs: [
          '1. Có a hoặc e: dấu đặt trên a hoặc e (hǎo, xiè, méi).',
          '2. Có ou: dấu đặt trên o (dōu, kǒu).',
          '3. Còn lại: dấu đặt trên nguyên âm cuối cùng (liù, guì, duō).',
          'Thanh nhẹ không có dấu. Khi gõ phím có thể dùng số: hao3, xie4, ma5.',
        ],
        examples: [
          { pinyin: 'hao3', hanzi: '好', meaning: 'tốt' },
          { pinyin: 'xie4', hanzi: '谢', meaning: 'cảm ơn' },
          { pinyin: 'dou1', hanzi: '都', meaning: 'đều' },
          { pinyin: 'liu4', hanzi: '六', meaning: 'sáu' },
          { pinyin: 'gui4', hanzi: '贵', meaning: 'đắt' },
          { pinyin: 'duo1', hanzi: '多', meaning: 'nhiều' },
          { pinyin: 'lü4', hanzi: '绿', meaning: 'xanh lá' },
        ],
      },
      {
        heading: 'Luyện tiếp',
        paragraphs: ['Mở bài luyện “Nghe và gõ pinyin” để tập gõ đúng thanh, hoặc bảng pinyin để nghe mọi âm tiết.'],
      },
    ],
  },
  {
    id: 'sandhi',
    title: 'Biến điệu: 3-3, 不 và 一',
    summary: 'Những chỗ đọc khác với cách viết: hai thanh 3 liền nhau, 不 bù và 一 yī.',
    sections: [
      {
        heading: 'Hai thanh 3 đứng liền nhau',
        paragraphs: [
          'Khi hai âm tiết thanh 3 đi liền, âm đầu đọc thành thanh 2 nhưng vẫn viết dấu thanh 3: 你好 viết nǐ hǎo, đọc ní hǎo.',
          'Chuỗi nhiều thanh 3 thường chỉ giữ thanh 3 ở âm cuối: 我很好 đọc wó hén hǎo.',
        ],
        examples: [
          { pinyin: 'ni3 hao3', spoken: 'ni2 hao3', hanzi: '你好', meaning: 'xin chào' },
          { pinyin: 'hen3 hao3', spoken: 'hen2 hao3', hanzi: '很好', meaning: 'rất tốt' },
          { pinyin: 'wo3 hen3 hao3', spoken: 'wo2 hen2 hao3', hanzi: '我很好', meaning: 'tôi rất khoẻ' },
          { pinyin: 'shui3 guo3', spoken: 'shui2 guo3', hanzi: '水果', meaning: 'hoa quả' },
        ],
      },
      {
        heading: 'Nửa thanh 3',
        paragraphs: ['Thanh 3 đứng trước thanh 1, 2, 4 hoặc thanh nhẹ chỉ đọc nửa đầu (xuống thấp, không lên lại): 很多 hěn duō, 老师 lǎoshī.'],
        examples: [
          { pinyin: 'hen3 duo1', hanzi: '很多', meaning: 'rất nhiều' },
          { pinyin: 'lao3 shi1', hanzi: '老师', meaning: 'thầy cô giáo' },
        ],
      },
      {
        heading: '不 bù',
        paragraphs: ['不 đọc bú trước thanh 4, còn lại đọc bù: 不是 bú shì, 不要 bú yào; nhưng 不好 bù hǎo, 不来 bù lái.'],
        examples: [
          { pinyin: 'bu4 shi4', spoken: 'bu2 shi4', hanzi: '不是', meaning: 'không phải' },
          { pinyin: 'bu4 yao4', spoken: 'bu2 yao4', hanzi: '不要', meaning: 'đừng; không cần' },
          { pinyin: 'bu4 hao3', hanzi: '不好', meaning: 'không tốt' },
          { pinyin: 'bu4 lai2', hanzi: '不来', meaning: 'không đến' },
        ],
      },
      {
        heading: '一 yī',
        paragraphs: [
          '一 đọc yí trước thanh 4 (一个 yí gè); đọc yì trước thanh 1, 2, 3 (一天 yì tiān, 一年 yì nián, 一起 yìqǐ); giữ yī khi đếm số hoặc đứng cuối (第一 dì yī).',
        ],
        examples: [
          { pinyin: 'yi1 ge4', spoken: 'yi2 ge4', hanzi: '一个', meaning: 'một cái' },
          { pinyin: 'yi1 tian1', spoken: 'yi4 tian1', hanzi: '一天', meaning: 'một ngày' },
          { pinyin: 'yi1 nian2', spoken: 'yi4 nian2', hanzi: '一年', meaning: 'một năm' },
          { pinyin: 'yi1 qi3', spoken: 'yi4 qi3', hanzi: '一起', meaning: 'cùng nhau' },
          { pinyin: 'di4 yi1', hanzi: '第一', meaning: 'thứ nhất' },
        ],
      },
    ],
  },
  {
    id: 'neutral-erhua',
    title: 'Thanh nhẹ và âm cuốn lưỡi 儿',
    summary: 'Thanh nhẹ trong trợ từ và từ lặp; âm r cuốn lưỡi của giọng Bắc Kinh.',
    sections: [
      {
        heading: 'Thanh nhẹ',
        paragraphs: [
          'Thanh nhẹ ngắn và nhẹ, không có dấu. Hay gặp ở trợ từ (吗 ma, 的 de, 了 le), từ lặp (妈妈 māma, 谢谢 xièxie) và hậu tố (桌子 zhuōzi, 我们 wǒmen).',
        ],
        examples: [
          { pinyin: 'ma1 ma5', hanzi: '妈妈', meaning: 'mẹ' },
          { pinyin: 'xie4 xie5', hanzi: '谢谢', meaning: 'cảm ơn' },
          { pinyin: 'zhuo1 zi5', hanzi: '桌子', meaning: 'cái bàn' },
          { pinyin: 'wo3 men5', hanzi: '我们', meaning: 'chúng tôi' },
          { pinyin: 'hao3 ma5', hanzi: '好吗', meaning: 'được không?' },
        ],
      },
      {
        heading: 'Âm cuốn lưỡi 儿 (儿化)',
        paragraphs: [
          'Người Bắc Kinh hay thêm âm r cuốn lưỡi vào cuối âm tiết: 一点儿 yìdiǎnr (một chút), 哪儿 nǎr (ở đâu), 这儿 zhèr (ở đây). Khi viết chỉ thêm r vào sau âm tiết.',
          'Khi 儿 là một từ riêng (儿子 érzi, con trai) thì đọc là ér.',
        ],
        examples: [
          { pinyin: 'yi1 dian3 r5', spoken: 'yi4 dian3 r5', hanzi: '一点儿', meaning: 'một chút' },
          { pinyin: 'na3 r5', hanzi: '哪儿', meaning: 'ở đâu' },
          { pinyin: 'zhe4 r5', hanzi: '这儿', meaning: 'ở đây' },
          { pinyin: 'er2 zi5', hanzi: '儿子', meaning: 'con trai' },
        ],
      },
    ],
  },
];

export function findLesson(id: string): Lesson | undefined {
  return LESSONS.find((lesson) => lesson.id === id);
}
