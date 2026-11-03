import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SupabaseClient } from '@supabase/supabase-js';
import { completeAuthRedirect } from '@/app/auth';
import { accountStore, startAccount } from '@/core/state/account';
import { setSupabase } from '@/core/sync/client';
import { AccountSection } from './AccountSection';

const native = vi.hoisted(() => ({ on: false }));
vi.mock('@/app/platform', () => ({ isNativeApp: () => native.on }));
const browser = vi.hoisted(() => ({
  open: vi.fn(async () => undefined),
  close: vi.fn(async () => undefined),
}));
vi.mock('@capacitor/browser', () => ({ Browser: browser }));

type Listener = (event: string, session: { user: { id: string; email: string } } | null) => void;
function fakeClient() {
  let listener: Listener | null = null;
  const auth = {
    signInWithOtp: vi.fn(async () => ({ error: null })),
    signInWithOAuth: vi.fn(async () => ({
      data: { url: 'https://accounts.google.com/x' },
      error: null,
    })),
    signOut: vi.fn(async () => {
      listener?.('SIGNED_OUT', null);
      return { error: null };
    }),
    exchangeCodeForSession: vi.fn(async (code: string) => ({
      error: code === 'good' ? null : { message: 'bad' },
    })),
    getSession: vi.fn(async () => ({ data: { session: null } })),
    onAuthStateChange: vi.fn((fn: Listener) => {
      listener = fn;
      return { data: { subscription: { unsubscribe: () => undefined } } };
    }),
  };
  return {
    client: { auth } as unknown as SupabaseClient,
    auth,
    signIn: (email: string) => listener?.('SIGNED_IN', { user: { id: 'u1', email } }),
  };
}

afterEach(() => {
  setSupabase(undefined);
  native.on = false;
  vi.clearAllMocks();
});

describe('Account', () => {
  it('hidden when this build has no Supabase project', async () => {
    setSupabase(null);
    await startAccount();
    const { container } = render(<AccountSection />);
    expect(container).toBeEmptyDOMElement();
  });

  it('web: email link back to /settings, Google, then signed in; sign out keeps local data', async () => {
    const f = fakeClient();
    setSupabase(f.client);
    await startAccount();
    render(<AccountSection />);
    expect(screen.getByText(/ASCEND works fully without an account/)).toBeInTheDocument();

    await userEvent.type(
      screen.getByLabelText('Or get a sign-in link by email'),
      'rishi@example.com',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Email me a link' }));
    expect(f.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'rishi@example.com',
      options: { emailRedirectTo: `${window.location.origin}/settings`, shouldCreateUser: true },
    });
    expect(await screen.findByRole('status')).toHaveTextContent('open the link in this browser');

    await userEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
    expect(f.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/settings` },
    });

    act(() => f.signIn('rishi@example.com'));
    expect(await screen.findByText('rishi@example.com')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(accountStore.getState().status).toBe('signed_out'));
  });

  it('a failed email says why', async () => {
    const f = fakeClient();
    f.auth.signInWithOtp.mockResolvedValueOnce({ error: { status: 429 } } as never);
    setSupabase(f.client);
    await startAccount();
    render(<AccountSection />);
    await userEvent.type(screen.getByLabelText('Or get a sign-in link by email'), 'a@b.co');
    await userEvent.click(screen.getByRole('button', { name: 'Email me a link' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many sign-in emails');
  });

  it('android: Google opens in the system browser and comes back through the app link', async () => {
    native.on = true;
    const f = fakeClient();
    setSupabase(f.client);
    await startAccount();
    render(<AccountSection />);
    await userEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
    expect(f.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'app.ascend.rishi://auth', skipBrowserRedirect: true },
    });
    expect(browser.open).toHaveBeenCalledWith({
      url: 'https://accounts.google.com/x',
      presentationStyle: 'popover',
    });

    expect(await completeAuthRedirect('app.ascend.rishi://auth?code=good')).toBeNull();
    expect(f.auth.exchangeCodeForSession).toHaveBeenCalledWith('good');
    expect(browser.close).toHaveBeenCalled();
    expect(await completeAuthRedirect('app.ascend.rishi://auth?code=old')).toMatch(
      /expired or was opened on another device/,
    );
    expect(
      await completeAuthRedirect('app.ascend.rishi://auth?error_description=Access+denied'),
    ).toBe('Access denied');
    expect(await completeAuthRedirect('https://example.com/other')).toBeNull();
  });
});
