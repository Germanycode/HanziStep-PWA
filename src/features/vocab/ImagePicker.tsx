import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { useSettings } from '@/db/settings';
import type { Word } from '@/domain/types';
import { availableSources, SOURCE_LABELS, type ImageCandidate } from '@/services/images/providers';
import { Button } from '@/ui/Button';
import { TextInput } from '@/ui/form';
import { imageQueryFor, saveWordImage, searchImages } from './images';

/** Picks a picture from Pixabay or Unsplash; the file is downloaded and kept on this machine. */
export function ImagePicker({ word, onDone }: { word: Word; onDone: () => void }) {
  const settings = useSettings();
  const sources = availableSources(settings);
  const [query, setQuery] = useState(() => imageQueryFor(word));
  const [hits, setHits] = useState<ImageCandidate[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = (text: string) => {
    setBusy(true);
    setError(null);
    searchImages(settings, text).then(
      (found) => {
        setHits(found);
        setBusy(false);
      },
      (failure: unknown) => {
        setError(failure instanceof Error ? failure.message : 'Không tìm được ảnh.');
        setBusy(false);
      },
    );
  };

  useEffect(() => {
    if (sources.length === 0) return;
    const timer = setTimeout(() => search(imageQueryFor(word)), 0);
    return () => clearTimeout(timer);
    // Only when the word changes; later searches come from the button.
  }, [word.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = async (candidate: ImageCandidate) => {
    setBusy(true);
    try {
      await saveWordImage(word, candidate, settings);
      toast.success('Đã tải ảnh về máy cho từ này.');
      onDone();
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : 'Không lưu được ảnh.');
    } finally {
      setBusy(false);
    }
  };

  if (sources.length === 0) {
    return (
      <p className="text-sm text-sub">
        Nhập API key Pixabay hoặc Unsplash trong{' '}
        <Link to="/settings" className="text-primary hover:underline">
          Cài đặt
        </Link>{' '}
        để tìm ảnh minh hoạ.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <TextInput
          aria-label="Từ khoá tìm ảnh (tiếng Anh)"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            event.stopPropagation();
            search(query);
          }}
        />
        <Button onClick={() => search(query)} disabled={busy || !query.trim()}>
          Tìm
        </Button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      {busy && <p className="text-sm text-sub">Đang tải…</p>}
      {hits && hits.length === 0 && !busy && <p className="text-sm text-muted">Không có ảnh phù hợp.</p>}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {(hits ?? []).map((hit) => (
          <button
            key={hit.id}
            type="button"
            disabled={busy}
            onClick={() => void choose(hit)}
            className="overflow-hidden rounded-xl border border-line transition hover:border-primary"
            title={`${hit.author} · ${SOURCE_LABELS[hit.source]}`}
          >
            <img src={hit.previewUrl} alt={hit.tags} className="h-20 w-full object-cover" loading="lazy" />
            <span className="block truncate px-1 py-0.5 text-[10px] text-muted">{hit.author}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-muted">
        Nguồn: {sources.map((source) => SOURCE_LABELS[source]).join(' · ')}. Ảnh được tải về máy nên không hỏng khi link hết hạn.
      </p>
    </div>
  );
}
