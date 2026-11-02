import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import pkg from '../../package.json';
import { features } from '@/config/features';
import { ErrorBoundary } from './ErrorBoundary';
import { buildRoutes } from './routes';

function renderAt(path: string) {
  const router = createMemoryRouter(buildRoutes(), { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

describe('app shell', () => {
  it('shows Today at /', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument();
  });

  it('bottom bar shows only enabled primary items plus More', () => {
    renderAt('/');
    // Two "Main" navs exist: desktop sidebar and mobile bar. The mobile bar is the last one.
    const navs = screen.getAllByRole('navigation', { name: 'Main' });
    const bar = navs.at(-1);
    if (!bar) throw new Error('mobile nav missing');
    const labels = within(bar)
      .getAllByRole('link')
      .map((a) => a.textContent);
    expect(labels).toContain('Today');
    expect(labels).toContain('More');
    expect(labels.length).toBeLessThanOrEqual(5);
    if (!features.focus) expect(labels).not.toContain('Focus');
    if (!features.goals) expect(labels).not.toContain('Goals');
  });

  it('More lists Settings, and Settings shows the version', async () => {
    renderAt('/more');
    await userEvent.click(within(screen.getByRole('main')).getByRole('link', { name: /Settings/ }));
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByText(pkg.version)).toBeInTheDocument();
  });

  it('a hidden feature route redirects home', () => {
    if (features.jobs) return;
    const router = renderAt('/jobs');
    expect(router.state.location.pathname).toBe('/');
  });
});

describe('ErrorBoundary', () => {
  it('shows the friendly error screen instead of a blank page', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    function Broken(): never {
      throw new Error('kaboom');
    }
    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.getByText('kaboom')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reload/ })).toBeInTheDocument();
  });
});
