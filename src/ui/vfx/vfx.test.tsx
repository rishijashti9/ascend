import { render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Settings } from '@/core/db/types';
import { appStore } from '@/core/state/app';
import { Burst } from './Burst';
import {
  dailyClearReached,
  particleCount,
  STREAK_MILESTONES,
  streakMilestoneReached,
} from './celebrations';

describe('celebration rules', () => {
  it('celebrates a streak only when it grows onto a milestone', () => {
    expect(streakMilestoneReached(6, 7)).toBe(7);
    expect(streakMilestoneReached(29, 30)).toBe(30);
    expect(streakMilestoneReached(7, 8)).toBeNull();
    expect(streakMilestoneReached(8, 7)).toBeNull(); // shrinking (an untick) never celebrates
    expect(streakMilestoneReached(7, 7)).toBeNull();
    expect(streakMilestoneReached(null, 7)).toBeNull(); // first value seen (startup) isn't new
    expect(STREAK_MILESTONES).toContain(100);
  });

  it('celebrates Daily Clear only for a change seen while open', () => {
    expect(dailyClearReached(false, true)).toBe(true);
    expect(dailyClearReached(null, true)).toBe(false);
    expect(dailyClearReached(true, true)).toBe(false);
    expect(dailyClearReached(true, false)).toBe(false);
  });

  it('uses fewer particles on Light and none on Off', () => {
    expect(particleCount('full', false)).toBeGreaterThan(particleCount('light', false));
    expect(particleCount('full', true)).toBeGreaterThan(particleCount('full', false));
    expect(particleCount('off', true)).toBe(0);
  });
});

function withEffects(effects: Settings['effects']) {
  appStore.setState({ settings: { effects } as Settings });
}

describe('Burst', () => {
  afterEach(() => appStore.setState({ settings: null }));

  it('plays particles and a ring on Full effects', () => {
    withEffects('full');
    const { container } = render(<Burst fireKey={1} />);
    expect(container.querySelectorAll('.vfx-particle')).toHaveLength(particleCount('full', false));
    expect(container.querySelectorAll('.vfx-ring')).toHaveLength(1);
  });

  it('adds a second ring for a min→full upgrade', () => {
    withEffects('full');
    const { container } = render(<Burst fireKey={1} tone="upgrade" />);
    expect(container.querySelectorAll('.vfx-ring')).toHaveLength(2);
  });

  it('is smaller on Light and absent on Off', () => {
    withEffects('light');
    const light = render(<Burst fireKey={1} />);
    expect(light.container.querySelectorAll('.vfx-particle')).toHaveLength(5);
    expect(light.container.querySelectorAll('.vfx-ring')).toHaveLength(0);
    light.unmount();
    withEffects('off');
    const off = render(<Burst fireKey={1} />);
    expect(off.container).toBeEmptyDOMElement();
  });

  it('shows nothing until fired', () => {
    const { container } = render(<Burst fireKey={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
