/**
 * Hardening V-13: links people type (job postings, project links) are checked when saved, but a
 * record can also arrive by backup import or sync without passing that check. Anything shown as
 * a clickable link goes through this: only plain http(s) URLs, otherwise no link at all.
 */
export function safeExternalUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value.trim();
  if (!/^https?:\/\/\S+$/i.test(text)) return null;
  try {
    const url = new URL(text);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}
