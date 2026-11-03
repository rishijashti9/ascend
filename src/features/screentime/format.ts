/** "18 Nov" — the date a lock ends or a waiting change applies. */
export function shortDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
