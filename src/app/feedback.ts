import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { logError } from '@/core/errorLog';
import { appStore } from '@/core/state/app';
import { isNativeApp } from './platform';

/**
 * Optional sound + haptics (Phase 12, Settings → Appearance → "Sound and vibration", off by
 * default): a soft generated tone and a short buzz on quest complete and level-up. No audio
 * files — each sound is a few sine notes from Web Audio. Silent while the app is hidden.
 */
export type FeedbackKind = 'complete' | 'levelup' | 'rankup';

export interface Note {
  /** Frequency in Hz. */
  hz: number;
  /** Start, seconds after the sound begins. */
  at: number;
  /** Length in seconds. */
  len: number;
}

/** The notes of each sound: short, quiet and rising (never alarming). */
export function notesFor(kind: FeedbackKind): Note[] {
  switch (kind) {
    case 'complete':
      return [
        { hz: 659.25, at: 0, len: 0.09 }, // E5
        { hz: 880, at: 0.07, len: 0.14 }, // A5
      ];
    case 'levelup':
      return [523.25, 659.25, 783.99, 1046.5].map((hz, i) => ({ hz, at: i * 0.09, len: 0.18 }));
    case 'rankup':
      return [392, 523.25, 659.25, 783.99, 1046.5, 1318.5].map((hz, i) => ({
        hz,
        at: i * 0.1,
        len: i === 5 ? 0.5 : 0.2,
      }));
  }
}

/** Plays only when switched on and the app is in front. */
export function shouldPlay(on: boolean | undefined, hidden: boolean): boolean {
  return on === true && !hidden;
}

const VOLUME = 0.06;
let ctx: AudioContext | null = null;

function playNotes(notes: Note[]): void {
  const Ctor = typeof window !== 'undefined' ? window.AudioContext : undefined;
  if (!Ctor) return;
  ctx ??= new Ctor();
  if (ctx.state === 'suspended') void ctx.resume();
  const start = ctx.currentTime + 0.01;
  for (const n of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = n.hz;
    // Soft attack and a quick fade, so nothing clicks.
    gain.gain.setValueAtTime(0, start + n.at);
    gain.gain.linearRampToValueAtTime(VOLUME, start + n.at + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + n.at + n.len);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start + n.at);
    osc.stop(start + n.at + n.len + 0.02);
  }
}

async function buzz(kind: FeedbackKind): Promise<void> {
  if (isNativeApp()) {
    if (kind === 'complete') await Haptics.impact({ style: ImpactStyle.Light });
    else await Haptics.notification({ type: NotificationType.Success });
    return;
  }
  navigator.vibrate?.(kind === 'complete' ? 12 : [20, 40, 30]);
}

/** A sound and a buzz for this moment, if Rishi switched them on. Never throws. */
export function playFeedback(kind: FeedbackKind): void {
  const on = appStore.getState().settings?.sound_haptics;
  if (!shouldPlay(on, document.visibilityState === 'hidden')) return;
  try {
    playNotes(notesFor(kind));
  } catch (error) {
    logError(error, 'feedback.sound');
  }
  buzz(kind).catch((error: unknown) => logError(error, 'feedback.haptics'));
}
