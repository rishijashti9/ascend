import { ChevronRight } from 'lucide-react';
import { AskEntry } from '@/features/ask/AskButton';
import { Link, useSearchParams } from 'react-router';
import { isEnabled } from '@/config/features';
import { useGoals } from '@/core/state/goals';
import { ProgressLine } from '@/features/goals/parts';
import { StatChip } from '@/ui/stats';
import { DailyTab } from './DailyTab';
import { SideTab, WeeklyTab } from './QuestDefTabs';
import { Tabs } from '@/ui/Surface';
import { tabPanelProps } from '@/ui/tabs';

const TABS = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'main', label: 'Main' },
  { id: 'side', label: 'Side' },
] as const;
type TabId = (typeof TABS)[number]['id'];

/** Main quests at a glance; details live on the Goals screen. */
function MainTab() {
  const quests = useGoals((s) => s.mainQuests);
  const progress = useGoals((s) => s.mainQuestProgress);
  const active = quests.filter((q) => q.status === 'active');
  if (active.length === 0) {
    return (
      <p className="panel p-4">
        No active main quests.{' '}
        <Link to="/growth/goals" className="text-accent-text">
          Add one in Goals
        </Link>
        .
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {active.map((q) => (
        <li key={q.id} className="panel">
          <Link to={`/growth/goals/${q.id}`} className="flex min-h-11 flex-col gap-1 p-3">
            <span className="flex items-center gap-2">
              <span className="font-medium">{q.title}</span>
              <StatChip stat={q.stat} />
              <ChevronRight aria-hidden size={16} className="text-muted ml-auto" />
            </span>
            <ProgressLine value={progress[q.id] ?? 0} label={`${q.title} progress`} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Quests screen (SPEC 7.3): Daily / Weekly / Main / Side. */
export function QuestsPage() {
  const [params, setParams] = useSearchParams();
  const tabs = TABS.filter((t) => t.id !== 'main' || isEnabled('goals'));
  const raw = params.get('tab');
  const tab: TabId = tabs.some((t) => t.id === raw) ? (raw as TabId) : 'daily';

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="display text-2xl">Quests</h1>
        <AskEntry />
      </div>
      <Tabs
        label="Quest types"
        tabs={tabs}
        active={tab}
        onChange={(id) => setParams(id === 'daily' ? {} : { tab: id }, { replace: true })}
      />
      <div {...tabPanelProps(tab)}>
        {tab === 'daily' && <DailyTab />}
        {tab === 'weekly' && <WeeklyTab />}
        {tab === 'main' && <MainTab />}
        {tab === 'side' && <SideTab />}
      </div>
    </div>
  );
}
