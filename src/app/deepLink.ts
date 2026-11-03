/** Links that open a screen: `app.ascend.rishi://open/focus` (the widget's "Start focus"). */
export const OPEN_PREFIX = 'app.ascend.rishi://open/';

export function pathFromLink(url: string): string | null {
  if (!url.startsWith(OPEN_PREFIX)) return null;
  const path = url.slice(OPEN_PREFIX.length).replace(/[^a-z0-9/-]/gi, '');
  return `/${path}`;
}
