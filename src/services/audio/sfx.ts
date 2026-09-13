/** Answer sounds copied from English Extension (Right_answer.mp3 / Wrong answer.mp3). */
type SfxName = 'right' | 'wrong';

const SOURCES: Record<SfxName, string> = {
  right: '/audio/sfx/right.mp3',
  wrong: '/audio/sfx/wrong.mp3',
};

const elements = new Map<SfxName, HTMLAudioElement>();

function getElement(name: SfxName): HTMLAudioElement {
  let audio = elements.get(name);
  if (!audio) {
    audio = new Audio(SOURCES[name]);
    audio.preload = 'auto';
    audio.volume = 0.75;
    elements.set(name, audio);
  }
  return audio;
}

export function playSfx(name: SfxName): void {
  const audio = getElement(name);
  audio.pause();
  audio.currentTime = 0;
  audio.play().catch(() => {
    // Autoplay may be blocked before the first user gesture; sounds are optional.
  });
}

export function playAnswerSound(isCorrect: boolean): void {
  playSfx(isCorrect ? 'right' : 'wrong');
}
