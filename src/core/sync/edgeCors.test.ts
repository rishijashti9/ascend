import { ALLOWED_ORIGINS, corsHeaders } from '../../../supabase/functions/_shared/cors';
import { SUPABASE_URL } from '@/config/cloud';

/** Hardening V-12: the Edge Functions answer CORS only for ASCEND's own origins. */
describe('Edge Function CORS allow-list', () => {
  it('the web app, the Android app and local dev are allowed, each echoed back exactly', () => {
    for (const origin of [
      'https://ascend-vert-mu.vercel.app',
      'https://localhost',
      'http://localhost:5173',
      'http://localhost:4173',
    ]) {
      const h = corsHeaders(origin);
      expect(h['Access-Control-Allow-Origin']).toBe(origin);
      expect(h['Access-Control-Allow-Headers']).toContain('authorization');
      expect(h.Vary).toBe('Origin');
    }
  });

  it('other sites, look-alikes and missing origins get no CORS permission', () => {
    for (const origin of [
      'https://evil.example',
      'https://ascend-vert-mu.vercel.app.evil.example',
      'https://evil-ascend-vert-mu.vercel.app',
      'http://ascend-vert-mu.vercel.app', // not https
      'https://localhost:8443',
      'null',
      '',
      null,
    ]) {
      const h = corsHeaders(origin);
      expect(h['Access-Control-Allow-Origin'], String(origin)).toBeUndefined();
      expect(h.Vary).toBe('Origin');
    }
  });

  it('never allows a wildcard', () => {
    expect(ALLOWED_ORIGINS).not.toContain('*');
    expect(SUPABASE_URL.startsWith('https://')).toBe(true);
  });
});
