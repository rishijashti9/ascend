import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';

/** Shared form controls: 44px tap targets, token colours, visible labels. */
const control = 'control min-h-11 w-full px-3 text-base';

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-muted text-xs">{hint}</p>}
    </div>
  );
}

export function TextInput({
  label,
  hint,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      {(id) => <input id={id} className={`${control} ${className}`} {...props} />}
    </Field>
  );
}

export function Select({
  label,
  options,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  /** `group`: consecutive options with the same group are shown under that heading. */
  options: readonly { value: string; label: string; group?: string }[];
}) {
  const runs: { group?: string; items: (typeof options)[number][] }[] = [];
  for (const o of options) {
    const last = runs.at(-1);
    if (last && last.group === o.group) last.items.push(o);
    else runs.push({ group: o.group, items: [o] });
  }
  const render = (items: (typeof options)[number][]) =>
    items.map((o) => (
      <option key={o.value} value={o.value}>
        {o.label}
      </option>
    ));
  return (
    <Field label={label}>
      {(id) => (
        <select id={id} className={control} {...props}>
          {runs.map((r, i) =>
            r.group ? (
              <optgroup key={`${r.group}-${i}`} label={r.group}>
                {render(r.items)}
              </optgroup>
            ) : (
              render(r.items)
            ),
          )}
        </select>
      )}
    </Field>
  );
}
