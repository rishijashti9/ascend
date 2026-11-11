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

  it('bottom bar: Today · Quests · Focus · Growth · Me (Phase 12, no More)', () => {
    renderAt('/');
    // Two "Main" navs exist: desktop sidebar and mobile bar. The mobile bar is the last one.
    const navs = screen.getAllByRole('navigation', { name: 'Main' });
    const bar = navs.at(-1);
    if (!bar) throw new Error('mobile nav missing');
    const labels = within(bar)
      .getAllByRole('link')
      .map((a) => a.textContent);
    expect(labels).toEqual(['Today', 'Quests', 'Focus', 'Growth', 'Me']);
    expect(labels).not.toContain('More');
  });

  it('Me has the Settings gear, and Settings shows the version', async () => {
    renderAt('/me');
    await userEvent.click(within(screen.getByRole('main')).getByRole('link', { name: 'Settings' }));
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByText(pkg.version)).toBeInTheDocument();
  });

  it('old addresses go to their new places, keeping the query', async () => {
    const router = renderAt('/review?tab=weekly');
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/me/reviews'));
    expect(router.state.location.search).toBe('?tab=weekly');
    const goal = renderAt('/goals/abc');
    await vi.waitFor(() => expect(goal.state.location.pathname).toBe('/growth/goals/abc'));
  });

  it('UX-5: Roadmap is now Compass, and Quests→Main went to Growth — old links still land', async () => {
    const roadmap = renderAt('/growth/roadmap?tab=health');
    await vi.waitFor(() => expect(roadmap.state.location.pathname).toBe('/growth/compass'));
    expect(roadmap.state.location.search).toBe('?tab=health');
    const compass = renderAt('/compass');
    await vi.waitFor(() => expect(compass.state.location.pathname).toBe('/growth/compass'));
    const main = renderAt('/quests?tab=main');
    await vi.waitFor(() => expect(main.state.location.pathname).toBe('/growth/goals'));
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
