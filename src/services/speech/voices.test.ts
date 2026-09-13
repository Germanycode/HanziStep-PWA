import { describe, expect, it } from 'vitest';
import { pickVoice, rankChineseVoices, scoreVoice, splitIntoSpeechChunks, type VoiceInfo } from './voices';

const voice = (name: string, lang: string, voiceURI = name): VoiceInfo => ({
  name,
  lang,
  voiceURI,
  localService: true,
  default: false,
});

const edgeNatural = voice('Microsoft Xiaoxiao Online (Natural) - Chinese (Mainland)', 'zh-CN');
const google = voice('Google 普通话（中国大陆）', 'zh-CN');
const huihui = voice('Microsoft Huihui - Chinese (Simplified, PRC)', 'zh-CN');
const taiwan = voice('Microsoft Hanhan - Chinese (Traditional, Taiwan)', 'zh-TW');
const hongKong = voice('Microsoft Tracy - Chinese (Traditional, Hong Kong S.A.R.)', 'zh-HK');
const english = voice('Microsoft Zira - English (United States)', 'en-US');

describe('scoreVoice', () => {
  it('prefers natural mainland voices and rejects Cantonese and non-Chinese voices', () => {
    expect(scoreVoice(edgeNatural)).toBeGreaterThan(scoreVoice(google));
    expect(scoreVoice(google)).toBeGreaterThan(scoreVoice(huihui));
    expect(scoreVoice(huihui)).toBeGreaterThan(scoreVoice(taiwan));
    expect(scoreVoice(hongKong)).toBeLessThan(0);
    expect(scoreVoice(english)).toBeLessThan(0);
    expect(scoreVoice(voice('Some voice', 'zh_CN'))).toBe(100);
  });
});

describe('rankChineseVoices and pickVoice', () => {
  const voices = [english, huihui, hongKong, taiwan, google, edgeNatural];

  it('ranks usable voices best first', () => {
    expect(rankChineseVoices(voices)).toEqual([edgeNatural, google, huihui, taiwan]);
  });

  it('keeps the saved voice when installed, else falls back to the best', () => {
    expect(pickVoice(voices, huihui.voiceURI)).toBe(huihui);
    expect(pickVoice(voices, 'uninstalled-voice')).toBe(edgeNatural);
    expect(pickVoice([english, hongKong])).toBeUndefined();
  });
});

describe('splitIntoSpeechChunks', () => {
  it('splits at sentence punctuation and merges short sentences', () => {
    expect(splitIntoSpeechChunks('你好。我叫小明！你呢？', 6)).toEqual(['你好。', '我叫小明！', '你呢？']);
    expect(splitIntoSpeechChunks('你好。我叫小明！你呢？', 80)).toEqual(['你好。我叫小明！你呢？']);
  });

  it('breaks very long sentences at commas or by length', () => {
    const long = '我今天早上起床以后，先喝了一杯水，然后去公园跑步。';
    expect(splitIntoSpeechChunks(long, 12)).toEqual(['我今天早上起床以后，', '先喝了一杯水，', '然后去公园跑步。']);
    expect(splitIntoSpeechChunks('一二三四五六七八九十', 4)).toEqual(['一二三四', '五六七八', '九十']);
  });

  it('ignores empty input', () => {
    expect(splitIntoSpeechChunks('  \n ')).toEqual([]);
  });
});
