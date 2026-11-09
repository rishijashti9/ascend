import { ChevronRight } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { isEnabled } from '@/config/features';
import { useGoals } from '@/core/state/goals';
import { ProgressLine } from '@/features/goals/parts';
import { StatChip } from '@/ui/stats';
import { DailyTab } from './DailyTab';
import { SideTab, WeeklyTab } from './QuestDefTabs';

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
      <h1 className="text-xl font-semibold">Quests</h1>
      <div
        role="tablist"
        aria-label="Quest types"
        className="bg-surface-2 flex gap-1 rounded-md p-1"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setParams(t.id === 'daily' ? {} : { tab: t.id }, { replace: true })}
            className={`min-h-11 flex-1 rounded-md text-sm font-medium ${
              tab === t.id ? 'bg-surface text-text shadow-card' : 'text-muted'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'daily' && <DailyTab />}
        {tab === 'weekly' && <WeeklyTab />}
        {tab === 'main' && <MainTab />}
        {tab === 'side' && <SideTab />}
      </div>
    </div>
  );
}
