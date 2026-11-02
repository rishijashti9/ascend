import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

const variants: Record<Variant, string> = {
  primary: 'bg-accent-fill text-on-accent hover:opacity-90',
  secondary: 'bg-surface text-text border border-border hover:bg-surface-2',
  ghost: 'text-accent-text hover:bg-surface-2',
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
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-base font-medium transition-[background-color,opacity] duration-(--dur-fast) disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
