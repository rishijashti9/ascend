import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChartCard } from './ChartCard';
import { DailyBars } from './DailyBars';
import { axisNumber, dailySeries, niceTicks } from './scale';

describe('chart scales', () => {
  it('nice ticks are round and always cover the data', () => {
    expect(niceTicks(78.1, 79.2)).toEqual([78, 78.5, 79, 79.5]);
    expect(niceTicks(0, 10_400)).toEqual([0, 5000, 10000, 15000]);
    expect(niceTicks(5, 5).length).toBeGreaterThan(1);
  });

  it('daily series fills every day; missing days stay empty, not zero', () => {
    expect(dailySeries('2026-11-01', '2026-11-03', new Map([['2026-11-02', 7]]))).toEqual([
      { day: '2026-11-01', value: null },
      { day: '2026-11-02', value: 7 },
      { day: '2026-11-03', value: null },
    ]);
  });

  it('axis numbers: full under 10,000, compact above', () => {
    expect(axisNumber(5000)).toBe('5,000');
    expect(axisNumber(12_500)).toBe('12.5K');
  });
});

describe('charts', () => {
  const bars = [
    { day: '2026-11-01', value: 4200 },
    { day: '2026-11-02', value: null },
    { day: '2026-11-03', value: 9100 },
  ];

  it('every bar has a keyboard-focusable readout', async () => {
    render(<DailyBars bars={bars} unit="steps" label="Steps" />);
    expect(screen.getByRole('img', { name: 'Steps: 2 days with data' })).toBeInTheDocument();
    await userEvent.tab();
    expect(screen.getByRole('status')).toHaveTextContent('4,200 steps');
  });

  it('a table view carries the same numbers (tooltips never gate)', async () => {
    render(
      <ChartCard title="Steps" rows={[{ label: '3 Nov 2026', value: '9,100 steps' }]}>
        <DailyBars bars={bars} unit="steps" label="Steps" />
      </ChartCard>,
    );
    const card = screen.getByRole('region', { name: 'Steps' });
    await userEvent.click(within(card).getByRole('button', { name: 'Table' }));
    expect(within(card).getByRole('table')).toHaveTextContent('9,100 steps');
  });
});
