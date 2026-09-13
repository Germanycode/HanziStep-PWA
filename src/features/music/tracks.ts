/** Port of English Extension assets/musics/music-tracks.js. Files live in public/music/. */
export interface MusicTrack {
  id: string;
  title: string;
  src: string;
}

export const MUSIC_TRACKS: readonly MusicTrack[] = [
  { id: 'default', title: 'Background Music', src: '/music/music.mp3' },
  { id: 'reading', title: 'Reading Music', src: '/music/reading-music.mp3' },
  { id: 'cosmic-study', title: 'Cosmic Study', src: '/music/the_mountain-cosmic-study-143288.mp3' },
  { id: 'geography-study', title: 'Geography Study', src: '/music/the_mountain-geography-study-141463.mp3' },
  { id: 'government-study', title: 'Government Study', src: '/music/the_mountain-government-study-142302.mp3' },
  { id: 'natural-study', title: 'Natural Study', src: '/music/the_mountain-natural-study-141476.mp3' },
  { id: 'space-study', title: 'Space Study', src: '/music/the_mountain-space-study-146969.mp3' },
  { id: 'study', title: 'Study', src: '/music/the_mountain-study-513400.mp3' },
  { id: 'study-rock', title: 'Study Rock', src: '/music/the_mountain-study-rock-136978.mp3' },
  { id: 'study-vibe', title: 'Study Vibe', src: '/music/the_mountain-study-vibe-136087.mp3' },
  { id: 'universe-study', title: 'Universe Study', src: '/music/the_mountain-universe-study-141461.mp3' },
];

export const DEFAULT_TRACK: MusicTrack = MUSIC_TRACKS[0] as MusicTrack;

export function findTrack(trackId: string): MusicTrack {
  return MUSIC_TRACKS.find((track) => track.id === trackId) ?? DEFAULT_TRACK;
}
