import { ArrowLeft } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { syllableToMarks } from '@/chinese/pinyin/marks';
import { SYLLABLE_SET } from '@/chinese/pinyin/syllables';
import type { PinyinTone } from '@/chinese/pinyin/types';
import { TONE_TEXT_CLASS } from '@/chinese/toneColors';
import { loadSyllableTable } from '@/data/syllables';
import type { SyllableInfo } from '@/data/types';
import { playSyllable } from '@/services/audio/clips';
import { AudioButton } from '@/ui/AudioButton';
import { Card } from '@/ui/Card';
import { PageHeader } from '@/ui/PageHeader';

const INITIAL_ORDER = ['', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'zh', 'ch', 'sh', 'r', 'z', 'c', 's', 'y', 'w'];
const FINAL_ORDER = [
  'a', 'o', 'e', 'i', 'u', 'ü', 'er', 'ai', 'ei', 'ao', 'ou', 'an', 'en', 'ang', 'eng', 'ong',
  'ia', 'ie', 'iao', 'iu', 'ian', 'in', 'iang', 'ing', 'iong', 'ua', 'uo', 'uai', 'ui', 'uan', 'un', 'uang', 'ue', 'üe',
];

function orderIndex(order: readonly string[], value: string): number {
  const index = order.indexOf(value);
  return index === -1 ? order.length : index;
}

export function PinyinChartPage() {
  const [syllables, setSyllables] = useState<SyllableInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SyllableInfo | null>(null);

  useEffect(() => {
    loadSyllableTable()
      .then((table) => setSyllables([...table.values()].filter((info) => SYLLABLE_SET.has(info.display))))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)));
  }, []);

  const chart = useMemo(() => {
    if (!syllables) return null;
    const initials = [...new Set(syllables.map((info) => info.initial))].sort(
      (a, b) => orderIndex(INITIAL_ORDER, a) - orderIndex(INITIAL_ORDER, b),
    );
    const finals = [...new Set(syllables.map((info) => info.final))].sort(
      (a, b) => orderIndex(FINAL_ORDER, a) - orderIndex(FINAL_ORDER, b) || a.localeCompare(b),
    );
    const cells = new Map(syllables.map((info) => [`${info.initial}|${info.final}`, info]));
    return { initials, finals, cells };
  }, [syllables]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link to="/pinyin" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Phát âm
      </Link>
      <PageHeader title="Bảng pinyin" subtitle="Chọn một ô để nghe âm tiết với từng thanh điệu (giọng người thật)." />

      {selected && (
        <Card
          title={<span className="font-mono text-2xl">{selected.display}</span>}
          description={`Thanh mẫu: ${selected.initial || '(không có)'} · Vận mẫu: ${selected.final}`}
        >
          <div className="flex flex-wrap gap-3">
            {selected.tones.map((tone) => (
              <AudioButton
                key={tone}
                label={`Nghe ${syllableToMarks({ base: selected.display, tone: tone as PinyinTone })}`}
                onPlay={() => playSyllable(selected.key, tone)}
                className="border border-line px-4 py-2 text-lg"
              >
                <span className={TONE_TEXT_CLASS[tone as PinyinTone]}>
                  {syllableToMarks({ base: selected.display, tone: tone as PinyinTone })}
                </span>
              </AudioButton>
            ))}
          </div>
        </Card>
      )}

      <Card>
        {error && <p className="text-sm text-danger">{error}</p>}
        {!chart && !error && <p className="text-sm text-sub">Đang tải bảng âm tiết…</p>}
        {chart && (
          <div className="max-h-[70vh] overflow-auto">
            <table className="border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="sticky top-0 left-0 z-20 bg-surface p-2" />
                  {chart.finals.map((final) => (
                    <th key={final} className="sticky top-0 z-10 bg-surface px-2 py-1 font-mono text-xs text-muted">
                      {final}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chart.initials.map((initial) => (
                  <tr key={initial || 'none'}>
                    <th className="sticky left-0 z-10 bg-surface px-2 py-1 text-left font-mono text-xs text-muted">
                      {initial || '∅'}
                    </th>
                    {chart.finals.map((final) => {
                      const info = chart.cells.get(`${initial}|${final}`);
                      return (
                        <td key={final} className="p-0.5">
                          {info && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelected(info);
                                void playSyllable(info.key, info.tones.includes(1) ? 1 : (info.tones[0] ?? 1)).catch(() => {});
                              }}
                              className={`w-full min-w-12 rounded-md px-1.5 py-1 font-mono transition hover:bg-primary/15 ${
                                selected?.key === info.key ? 'bg-primary/20 text-fg' : 'bg-surface-2 text-sub'
                              }`}
                            >
                              {info.display}
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
