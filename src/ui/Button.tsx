import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const variants: Record<Variant, string> = {
  primary: 'bg-accent-fill text-on-accent hover:opacity-90',
  secondary: 'bg-surface-2 text-text hover:opacity-90',
  ghost: 'text-accent-text hover:bg-surface-2',
  /** The one button that deletes or resets for good (inside a confirmation). */
  danger: 'bg-error text-on-error hover:opacity-90',
};

export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type={type}
      className={`pill inline-flex min-h-11 items-center justify-center gap-2 px-5 text-base font-semibold transition-[background-color,opacity,transform] duration-(--dur-fast) active:scale-[0.97] disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
