import { Timer } from 'lucide-react';
import { useState } from 'react';
import { SkillPicker } from '@/ui/SkillPicker';
import type { Stat } from '@/core/db/types';
import { STATS } from '@/core/db/types';
import { useAppState } from '@/core/state/app';
import { useFocus } from '@/core/state/focus';
import { useToday } from '@/core/state/today';
import { Button } from '@/ui/Button';
import { useAction } from '@/ui/hooks/useAction';
import { STAT_META } from '@/ui/statMeta';
import { FocusRing } from './FocusRing';
import { FocusRunner } from './FocusRunner';
import { SessionHistory } from './SessionHistory';

/** A choice row (quests) and a pill (stat, length): lime outline / lime fill when picked. */
const row = (on: boolean) =>
  `inset min-h-11 px-4 py-2 text-sm ${on ? 'outline-accent font-semibold outline-2' : ''}`;
const pill = (on: boolean) =>
  `pill min-h-11 px-4 text-sm font-semibold ${on ? 'bg-accent-fill text-on-accent' : 'bg-surface-2 text-text'}`;

/** Focus (SPEC 4.6, 7.5): pick what it's for, pick a length, start. */
export function FocusPage() {
  const running = useFocus((s) => s.running);
  const daily = useToday((s) => s.daily);
  const week = useToday((s) => s.week);
  const presets = useAppState((s) => s.settings?.focus_presets) ?? [{ work_min: 25, break_min: 5 }];
  const { run, busy, error } = useAction();

  // Quests that take minutes and aren't finished yet: today's daily quests, then this week's.
  const quests = [...daily, ...week].filter(
    (q) =>
      q.instance.measure_snapshot === 'minutes' &&
      (q.instance.status === 'pending' || q.instance.status === 'done_min'),
  );
  const [target, setTarget] = useState<string>(() => quests[0]?.instance.id ?? 'stat');
  const [stat, setStat] = useState<Stat>('INT');
  const [preset, setPreset] = useState(0);
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const chosen = presets[preset] ?? presets[0] ?? { work_min: 25, break_min: 5 };

  if (running) return <FocusRunner session={running} />;

  const linked = target !== 'stat' && quests.some((q) => q.instance.id === target);
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 lg:max-w-5xl">
      <h1 className="display text-2xl">Focus</h1>
      {/* Desktop: setup on the left, this week and history on the right. */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-10">
        <div className="flex flex-col gap-6">
          <div className="flex justify-center">
            <FocusRing ratio={1} size={220}>
              <span className="display text-5xl tabular-nums">
                {String(chosen.work_min).padStart(2, '0')}:00
              </span>
              <span className="text-muted text-sm">{chosen.break_min} min break after</span>
            </FocusRing>
          </div>

          <section aria-label="What is it for?" className="flex flex-col gap-2">
            <h2 className="display">What is it for?</h2>
            <div role="radiogroup" aria-label="What is it for?" className="flex flex-col gap-2">
              {quests.map((q) => (
                <button
                  key={q.instance.id}
                  type="button"
                  role="radio"
                  aria-checked={target === q.instance.id}
                  onClick={() => setTarget(q.instance.id)}
                  className={`${row(target === q.instance.id)} flex items-center justify-between text-left`}
                >
                  <span>{q.instance.title_snapshot}</span>
                  <span className="text-muted tabular-nums">
                    {q.progress} / {q.instance.target_snapshot} min
                  </span>
                </button>
              ))}
              <button
                type="button"
                role="radio"
                aria-checked={!linked}
                onClick={() => setTarget('stat')}
                className={`${row(!linked)} text-left`}
              >
                No quest — 1 XP per minute for a stat
              </button>
            </div>
            {!linked && (
              <div role="radiogroup" aria-label="Stat" className="flex gap-2">
                {STATS.map((s) => {
                  const { icon: Icon, text, label } = STAT_META[s];
                  return (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={stat === s}
                      aria-label={label}
                      onClick={() => setStat(s)}
                      className={`${pill(stat === s)} flex items-center gap-1 ${stat === s ? '' : text}`}
                    >
                      <Icon aria-hidden size={16} /> {s}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section aria-label="Length" className="flex flex-col gap-2">
            <h2 className="display">Length</h2>
            <div role="radiogroup" aria-label="Length" className="flex flex-wrap gap-2">
              {presets.map((p, i) => (
                <button
                  key={`${p.work_min}-${p.break_min}`}
                  type="button"
                  role="radio"
                  aria-checked={preset === i}
                  onClick={() => setPreset(i)}
                  className={pill(preset === i)}
                >
                  {p.work_min} min focus · {p.break_min} min break
                </button>
              ))}
            </div>
          </section>

          <SkillPicker
            value={skillIds}
            onChange={setSkillIds}
            label={linked ? 'Skills (instead of the quest’s)' : 'Skills'}
          />

          <Button
            className="min-h-14 text-lg"
            disabled={busy}
            onClick={() =>
              void run({
                type: 'focus.start',
                payload: {
                  quest_instance_id: linked ? target : null,
                  stat: linked ? null : stat,
                  planned_min: chosen.work_min,
                  break_min: chosen.break_min,
                  skill_ids: skillIds,
                },
              })
            }
          >
            <Timer aria-hidden size={18} /> Start {chosen.work_min}-minute focus
          </Button>
          {error && (
            <p role="alert" className="text-warning-text text-sm">
              {error}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-6">
          <SessionHistory />
        </div>
      </div>
    </div>
  );
}
