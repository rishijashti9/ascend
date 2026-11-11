import { ChevronRight } from 'lucide-react';
import { AskEntry } from '@/features/ask/AskButton';
import { Link, Navigate, useSearchParams } from 'react-router';
import { isEnabled } from '@/config/features';
import { DailyTab } from './DailyTab';
import { SideTab, WeeklyTab } from './QuestDefTabs';
import { Tabs } from '@/ui/Surface';
import { tabPanelProps } from '@/ui/tabs';

const TABS = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'side', label: 'Side' },
] as const;
type TabId = (typeof TABS)[number]['id'];

/**
 * Quests screen (SPEC 7.3): what you've committed to — Daily / Weekly / Side. Main quests live
 * in Growth → Goals (UX-5, docs/product/AUDIT-AND-PROPOSAL.md P7: the old Main tab was a second
 * list of them); a quiet link points there, and old `?tab=main` links go straight to Goals.
 */
export function QuestsPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab');
  if (raw === 'main' && isEnabled('goals')) return <Navigate to="/growth/goals" replace />;
  const tab: TabId = TABS.some((t) => t.id === raw) ? (raw as TabId) : 'daily';

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="display text-2xl">Quests</h1>
        <AskEntry />
      </div>
      <Tabs
        label="Quest types"
        tabs={TABS}
        active={tab}
        onChange={(id) => setParams(id === 'daily' ? {} : { tab: id }, { replace: true })}
      />
      {isEnabled('goals') && (
        <Link
          to="/growth/goals"
          className="text-muted hover:text-text -mt-2 inline-flex min-h-11 items-center gap-1 self-start text-sm"
        >
          Main quests live in Growth <ChevronRight aria-hidden size={14} />
        </Link>
      )}
      <div {...tabPanelProps(tab)}>
        {tab === 'daily' && <DailyTab />}
        {tab === 'weekly' && <WeeklyTab />}
        {tab === 'side' && <SideTab />}
      </div>
    </div>
  );
}
