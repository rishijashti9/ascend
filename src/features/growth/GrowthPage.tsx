import { Outlet, useLocation, useNavigate } from 'react-router';
import { AskEntry } from '@/features/ask/AskButton';
import { useAppState } from '@/core/state/app';
import { PageTitle, Tabs } from '@/ui/Surface';
import { tabPanelProps } from '@/ui/tabs';
import { growthTabs, type GrowthTab } from './tabs';

/**
 * Growth (Phase 12): one screen with tabs — Goals · Compass (the Growth Compass) · Skills, and Jobs
 * when the job tracker is switched on. Each tab is its own address (/growth/goals, …), so deep
 * links, notifications and the back button keep working.
 */
export function GrowthPage() {
  const settings = useAppState((s) => s.settings);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const tabs = growthTabs(settings);
  const segment = pathname.split('/')[2] as GrowthTab | undefined;
  const active = tabs.find((t) => t.id === segment)?.id ?? tabs[0]?.id ?? 'goals';

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <PageTitle>Growth</PageTitle>
        <AskEntry />
      </div>
      <Tabs
        label="Growth"
        idPrefix="growth"
        tabs={tabs}
        active={active}
        onChange={(id) => navigate(`/growth/${id}`)}
      />
      <div {...tabPanelProps(active, 'growth')}>
        <Outlet />
      </div>
    </div>
  );
}
