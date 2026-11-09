import type { CSSProperties } from 'react';
import type { EffectsLevel } from '@/core/db/types';

/** Organic shapes: uneven corners, so turning and stretching them reads as slow morphing. */
const BLOBS = [
  { colour: 'var(--fx-violet)', box: 'left-[-12%] top-[4%] h-[76%] w-[60%]', delay: 0 },
  { colour: 'var(--fx-blue)', box: 'right-[-10%] top-[16%] h-[72%] w-[55%]', delay: -3 },
  { colour: 'var(--fx-red)', box: 'left-[26%] top-[48%] h-[60%] w-[50%]', delay: -6 },
];
/** Rank-up is bigger and rarer: one more shape, in the theme's accent. */
const RANK_BLOB = {
  colour: 'var(--accent)',
  box: 'left-[52%] top-[-6%] h-[44%] w-[36%]',
  delay: -4.5,
};

interface Spark {
  left?: string;
  right?: string;
  top: string;
  size: number;
  delay: number;
}

const SPARKS: Spark[] = [
  { left: '12%', top: '14%', size: 26, delay: 0 },
  { right: '14%', top: '26%', size: 20, delay: 0.8 },
  { left: '44%', top: '80%', size: 18, delay: 1.4 },
];
const RANK_SPARKS: Spark[] = [
  { left: '70%', top: '70%', size: 22, delay: 0.4 },
  { left: '30%', top: '4%', size: 16, delay: 1.1 },
];

const STAR = 'M12 0l2.6 9.4L24 12l-9.4 2.6L12 24l-2.6-9.4L0 12l9.4-2.6z';

/**
 * The level-up / rank-up art (ELEVATE, Phase 12): slowly morphing violet / blue / red shapes, a
 * white swoosh that draws itself and twinkling sparkles. Full = all of it moving; Light = the
 * swoosh draws once and everything else holds still; Off = a still picture. Shapes move with
 * transform only. Decorative.
 */
export function MomentArt({ rank, level }: { rank: boolean; level: EffectsLevel }) {
  const blobs = rank ? [...BLOBS, RANK_BLOB] : BLOBS;
  const sparks = rank ? [...SPARKS, ...RANK_SPARKS] : SPARKS;
  const full = level === 'full';
  return (
    <div aria-hidden className={`relative w-full ${rank ? 'h-72' : 'h-60'}`}>
      {blobs.map((b, i) => (
        <span
          key={i}
          className={`absolute ${b.box} ${full ? 'vfx-blob' : ''}`}
          style={
            {
              background: b.colour,
              borderRadius:
                i % 2 ? '40% 60% 38% 62% / 60% 40% 60% 40%' : '58% 42% 63% 37% / 45% 58% 42% 55%',
              animationDelay: `${b.delay}s`,
            } as CSSProperties
          }
        />
      ))}
      <svg viewBox="0 0 346 250" className="absolute inset-0 size-full">
        <path
          className={level === 'off' ? '' : 'vfx-draw'}
          d="M10 200 C 80 60, 170 260, 230 120 S 330 40, 340 90"
          fill="none"
          stroke="var(--text)"
          strokeWidth={rank ? 16 : 14}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
        />
      </svg>
      {sparks.map((s, i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          width={s.size}
          height={s.size}
          className={`absolute ${full ? 'vfx-sparkle' : ''}`}
          style={{ left: s.left, right: s.right, top: s.top, animationDelay: `${s.delay}s` }}
        >
          <path d={STAR} fill="var(--text)" />
        </svg>
      ))}
    </div>
  );
}
