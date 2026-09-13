import { describe, expect, it } from 'vitest';
import { isCognate } from './cognate';

describe('isCognate', () => {
  it('detects Hán-Việt readings inside Vietnamese meanings', () => {
    expect(isCognate('CHÚ Ý', ['chú ý đến; quan tâm đến'])).toBe(true);
    expect(isCognate('NGÂN HÀNG', ['ngân hàng'])).toBe(true);
    expect(isCognate('HỌC SINH', ['học sinh', 'trẻ đi học'])).toBe(true);
    expect(isCognate('ÂM NHẠC', ['âm nhạc'])).toBe(true);
  });

  it('requires whole words and a clear reading', () => {
    expect(isCognate('TẠ TẠ', ['cảm ơn'])).toBe(false);
    expect(isCognate('AN', ['anh ấy'])).toBe(false);
    expect(isCognate('NGÂN HÀNG/HẠNG', ['ngân hàng'])).toBe(false);
    expect(isCognate('HỌC ?', ['học sinh'])).toBe(false);
    expect(isCognate('', ['bất kỳ'])).toBe(false);
  });
});
