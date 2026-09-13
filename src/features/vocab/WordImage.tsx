import { SOURCE_LABELS } from '@/services/images/providers';
import type { Word } from '@/domain/types';
import { useWordImage } from './images';

interface WordImageProps {
  word: Word;
  className?: string;
  /** Without a picture, show the first character instead of nothing. */
  placeholder?: boolean;
}

/** The word's stored picture (downloaded from Pixabay or Unsplash), or a character tile. */
export function WordImage({ word, className = '', placeholder = true }: WordImageProps) {
  const image = useWordImage(word);

  if (image) {
    return (
      <img
        src={image.url}
        alt={`Ảnh minh hoạ cho ${word.simplified}`}
        title={`${image.author} · ${SOURCE_LABELS[image.source]}`}
        className={`rounded-2xl object-cover ${className}`}
      />
    );
  }
  if (!placeholder) return null;
  return (
    <div
      aria-hidden
      className={`font-hanzi hidden place-items-center rounded-2xl bg-linear-to-br from-primary/15 to-accent/10 text-5xl text-primary/60 sm:grid ${className}`}
    >
      {[...word.simplified][0]}
    </div>
  );
}
