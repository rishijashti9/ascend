import type { SleepSampleLike, WorkoutLike } from './readings';

/** Where health data comes from: Health Connect on Android (app/health.ts), fakes in tests. */
export type HealthAvailability = 'available' | 'not_installed' | 'unsupported';

export interface HealthSource {
  availability(): Promise<HealthAvailability>;
  /** True when all three read permissions are granted. */
  granted(): Promise<boolean>;
  /** Opens Health Connect's permission sheet; true when everything was allowed. */
  requestAccess(): Promise<boolean>;
  openSettings(): Promise<void>;
  /** Steps between two instants (Health Connect removes double counting phone + watch). */
  steps(fromMs: number, toMs: number): Promise<number | null>;
  sleep(fromMs: number, toMs: number): Promise<SleepSampleLike[]>;
  workouts(fromMs: number, toMs: number): Promise<WorkoutLike[]>;
}
