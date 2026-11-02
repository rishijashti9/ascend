import { useState } from 'react';
import { visibleAchievement } from '@/core/achievements/titles';
import { useAchievements } from '@/core/state/achievements';
import { ACHIEVEMENTS } from '@/data/achievements';
import { Select } from '@/ui/Field';
import { useAction } from '@/ui/hooks/useAction';

/** Choose one unlocked achievement as the title shown on the profile and Today (SPEC 4.7). */
export function TitlePicker({ current }: { current: string | null }) {
  const unlocked = useAchievements((s) => s.unlocked);
  const { run, busy, error } = useAction();
  const [saved, setSaved] = useState(false);
  const options = ACHIEVEMENTS.filter((a) => unlocked[a.key] && visibleAchievement(a.key));
  if (options.length === 0) {
    return (
      <p className="text-muted text-sm">Unlock an achievement to choose a title to display.</p>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <Select
        label="Title"
        value={current && visibleAchievement(current) ? current : ''}
        disabled={busy}
        options={[
          { value: '', label: 'No title' },
          ...options.map((a) => ({ value: a.key, label: a.name })),
        ]}
        onChange={(e) => {
          setSaved(false);
          void run({ type: 'profile.setTitle', payload: { key: e.target.value || null } }).then(
            setSaved,
          );
        }}
      />
      {saved && (
        <span role="status" className="text-success-text text-xs">
          Saved
        </span>
      )}
      {error && (
        <p role="alert" className="text-warning-text text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
