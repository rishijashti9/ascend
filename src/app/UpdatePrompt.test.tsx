import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UpdatePrompt } from './UpdatePrompt';

const state = {
  needRefresh: false,
  setNeedRefresh: vi.fn(),
  updateServiceWorker: vi.fn().mockResolvedValue(undefined),
};

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [state.needRefresh, state.setNeedRefresh],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: state.updateServiceWorker,
  }),
}));

describe('UpdatePrompt', () => {
  beforeEach(() => {
    state.needRefresh = false;
    vi.clearAllMocks();
  });

  it('shows nothing when no update is waiting', () => {
    render(<UpdatePrompt />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('offers Reload when an update is ready, and only reloads on tap', async () => {
    state.needRefresh = true;
    render(<UpdatePrompt />);
    expect(screen.getByRole('status')).toHaveTextContent('Update ready.');
    expect(state.updateServiceWorker).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /Reload/ }));
    expect(state.updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('can be dismissed for later', async () => {
    state.needRefresh = true;
    render(<UpdatePrompt />);
    await userEvent.click(screen.getByRole('button', { name: 'Later' }));
    expect(state.setNeedRefresh).toHaveBeenCalledWith(false);
  });
});
