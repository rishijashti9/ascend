import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { isEnabled } from '@/config/features';
import { useSkills } from '@/core/state/skills';

/**
 * Pick the skills a quest or focus session counts for (task 9.2b). Collapsed to one line
 * ("Skills: ROS 2, C++ · Change") so forms stay short; open, it shows the active skills as
 * toggle chips grouped by branch. Hidden while the Skills feature is off or the tree is empty.
 */
export function SkillPicker({
  value,
  onChange,
  label = 'Skills',
}: {
  value: readonly string[];
  onChange: (ids: string[]) => void;
  label?: string;
}) {
  const branches = useSkills((s) => s.branches);
  const skills = useSkills((s) => s.skills);
  const [open, setOpen] = useState(false);
  if (!isEnabled('skills') || skills.length === 0) return null;

  const names = value
    .map((id) => skills.find((s) => s.id === id)?.name)
    .filter((n): n is string => Boolean(n));
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <fieldset className="flex flex-col gap-2 sm:col-span-2">
      <legend className="sr-only">{label}</legend>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 items-center justify-between gap-2 text-left text-sm"
      >
        <span>
          <span className="font-medium">{label}:</span>{' '}
          <span className={names.length ? '' : 'text-muted'}>
            {names.length ? names.join(', ') : 'none'}
          </span>
        </span>
        <span className="text-accent-text flex items-center gap-1">
          {open ? 'Done' : 'Change'}
          {open ? <ChevronUp aria-hidden size={16} /> : <ChevronDown aria-hidden size={16} />}
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-3">
          {branches.map((b) => {
            const active = b.skills.filter((s) => s.status === 'active' || value.includes(s.id));
            if (active.length === 0) return null;
            return (
              <div key={b.name} className="flex flex-col gap-1">
                <span className="text-muted text-xs">{b.name}</span>
                <div className="flex flex-wrap gap-2">
                  {active.map((s) => {
                    const on = value.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggle(s.id)}
                        className={`pill min-h-11 px-4 text-sm font-semibold ${
                          on ? 'bg-accent-fill text-on-accent' : 'bg-surface-2 text-text'
                        }`}
                      >
                        {s.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <p className="text-muted text-xs">Time is shared evenly between the skills you pick.</p>
        </div>
      )}
    </fieldset>
  );
}
