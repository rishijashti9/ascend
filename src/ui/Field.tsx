import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';

/** Shared form controls: 44px tap targets, token colours, visible labels. */
const control =
  'border-border bg-surface text-text min-h-11 w-full rounded-md border px-3 text-base outline-none focus-visible:border-accent';

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
  options: readonly { value: string; label: string }[];
}) {
  return (
    <Field label={label}>
      {(id) => (
        <select id={id} className={control} {...props}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}
