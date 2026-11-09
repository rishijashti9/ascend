import { useState } from 'react';
import { AuthError, sendMagicLink, signInWithGoogle, signOut } from '@/app/auth';
import { isNativeApp } from '@/app/platform';
import { logError } from '@/core/errorLog';
import { useAccount } from '@/core/state/account';
import { useSync } from '@/core/state/sync';
import { Button } from '@/ui/Button';
import { Field } from '@/ui/Field';
import { Card } from './sections';
import { SyncChoice } from './SyncChoice';
import { SyncStatusLine } from './SyncStatusLine';

/**
 * Account (SPEC 7.11, DECISIONS: magic link + Google, no passwords). Optional: ASCEND works
 * fully without one; an account only adds sync between devices.
 */
export function AccountSection() {
  const status = useAccount((s) => s.status);
  const email = useAccount((s) => s.email);
  const notice = useAccount((s) => s.notice);
  const syncStatus = useSync((s) => s.status);
  const [address, setAddress] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === 'unavailable' || status === 'loading') return null;

  const attempt = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      if (e instanceof AuthError) setError(e.message);
      else {
        logError(e, 'auth');
        setError('Something went wrong. Please try again.');
      }
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Account" id="account">
      {status === 'signed_in' ? (
        <>
          <p>
            Signed in as <span className="font-medium">{email ?? 'your account'}</span>
          </p>
          {syncStatus === 'needs_choice' ? <SyncChoice /> : <SyncStatusLine />}
          <p className="text-muted text-sm">
            Signing out keeps everything on this device; it only stops syncing.
          </p>
          <Button
            variant="secondary"
            className="self-start"
            disabled={busy}
            onClick={() => void attempt(signOut)}
          >
            Sign out
          </Button>
        </>
      ) : (
        <>
          <p className="text-muted text-sm">
            Optional. Sign in to keep your phone and laptop in sync. ASCEND works fully without an
            account, and your data stays on this device either way.
          </p>
          <Button
            variant="secondary"
            className="self-start"
            disabled={busy}
            onClick={() => void attempt(signInWithGoogle)}
          >
            Continue with Google
          </Button>
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void attempt(() => sendMagicLink(address)).then(setSent);
            }}
          >
            <Field label="Or get a sign-in link by email">
              {(id) => (
                <input
                  id={id}
                  type="email"
                  required
                  autoComplete="email"
                  value={address}
                  onChange={(e) => {
                    setSent(false);
                    setAddress(e.target.value);
                  }}
                  className="control min-h-11 px-3 text-base"
                />
              )}
            </Field>
            <Button type="submit" className="self-start" disabled={busy || !address.includes('@')}>
              Email me a link
            </Button>
          </form>
          {sent && (
            <p role="status" className="text-sm">
              Check your email and open the link{' '}
              {isNativeApp() ? 'on this phone' : 'in this browser'} — it signs you in here. No
              password needed.
            </p>
          )}
        </>
      )}
      {(error ?? notice) && (
        <p role="alert" className="text-warning-text text-sm">
          {error ?? notice}
        </p>
      )}
    </Card>
  );
}
