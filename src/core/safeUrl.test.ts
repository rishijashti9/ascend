import { safeExternalUrl } from './safeUrl';

describe('safe external links (hardening V-13)', () => {
  it('keeps plain http(s) links', () => {
    expect(safeExternalUrl('https://example.com/jobs/1')).toBe('https://example.com/jobs/1');
    expect(safeExternalUrl('  http://example.com ')).toBe('http://example.com/');
  });

  it('drops scripts, data, other schemes and junk', () => {
    for (const bad of [
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      ' javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox',
      'file:///etc/passwd',
      'intent://scan/#Intent;scheme=zxing;end',
      'app.ascend.rishi://open/settings',
      '//evil.example',
      'https://exa mple.com',
      'https://',
      'example.com',
      '',
      null,
      undefined,
    ]) {
      expect(safeExternalUrl(bad), String(bad)).toBeNull();
    }
  });
});
