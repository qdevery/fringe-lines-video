export type Word = { text: string; startMs: number; endMs: number; speaker?: string };
export type Shot = { startMs: number; endMs: number; scale: number };
export type ShortProps = {
  src: string;               // file in the render's publicDir
  durationInFrames: number;
  words: Word[];
  shots: Shot[];
  accent?: string;
};
