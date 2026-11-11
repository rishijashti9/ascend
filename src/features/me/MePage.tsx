import { Brain, ChevronRight, Database, Settings as Gear, Smartphone } from 'lucide-react';
import { AskEntry } from '@/features/ask/AskButton';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { isEnabled } from '@/config/features';
import { titleName } from '@/core/achievements/titles';
import { formatMinutes } from '@/core/screentime/observe';
import { useAppState } from '@/core/state/app';
import { useProgress } from '@/core/state/progress';
import { useScreen } from '@/core/state/screen';
import { Tabs } from '@/ui/Surface';
import { tabPanelProps } from '@/ui/tabs';
import { meTabs, type MeTab } from './tabs';

/**
 * Me (Phase 12): who you are and how you're doing — Stats & achievements · Body · Reviews, with
 * Screen time, "What the System knows about you" and My data one tap away (compact rows), and
 * Settings behind the gear.
 */
export function MePage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const tabs = meTabs();
  const segment = pathname.split('/')[2] as MeTab | undefined;
  const active = tabs.find((t) => t.id === segment)?.id ?? 'stats';

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <MeHeader />
      <MeTiles />
      <Tabs
        label="Me"
        idPrefix="me"
        tabs={tabs}
        active={active}
        onChange={(id) => navigate(`/me/${id}`)}
      />
      <div {...tabPanelProps(active, 'me')}>
        <Outlet />
      </div>
    </div>
  );
}

function MeHeader() {
  const profile = useAppState((s) => s.profile);
  const settings = useAppState((s) => s.settings);
  const progress = useProgress((s) => s.progress);
  const name = profile?.name ?? 'Player';
  const title = titleName(profile?.display_title, settings);
  return (
    <header className="flex items-center gap-3">
      <span
        aria-hidden
        className="bg-tile-lime text-on-tile-lime display grid size-14 shrink-0 place-items-center rounded-full text-xl"
      >
        {name.slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <h1 className="display truncate text-xl">{name}</h1>
        <p className="text-muted truncate text-sm">
          {progress ? `Lv ${progress.level.level} · Rank ${progress.rank}` : ''}
          {title ? ` · ${title}` : ''}
        </p>
      </div>
      <AskEntry />
      <Link
        to="/settings"
        aria-label="Settings"
        className="bg-surface-2 text-text grid size-12 shrink-0 place-items-center rounded-full"
      >
        <Gear aria-hidden size={22} />
      </Link>
    </header>
  );
}

/**
 * Screen time, what the System knows and My data — one tap away from every Me tab, as compact
 * rows (UX-6, docs/product/AUDIT-AND-PROPOSAL.md P12: they were the two largest tiles on Me,
 * bigger than their importance). Settings stays behind the gear in the header.
 */
function MeTiles() {
  const screen = useScreen((s) => s);
  const showScreen = isEnabled('screenTime');
  const showKnows = isEnabled('adaptive');
  const limit = screen.rules?.limit_min ?? null;
  const screenLine = !screen.rules?.enabled
    ? 'Off — set it up on your phone'
    : limit === null
      ? 'Observing quietly'
      : `${formatMinutes(Math.round(screen.todaySec / 60))} of ${formatMinutes(limit)} today`;
  const rows = [
    showScreen && {
      to: '/me/screen-time',
      icon: Smartphone,
      title: 'Screen time',
      line: screenLine,
    },
    showKnows && {
      to: '/me/knows',
      icon: Brain,
      title: 'What the System knows',
      line: 'Everything it has learned, each clearable',
    },
    isEnabled('settings') && {
      to: '/my-data',
      icon: Database,
      title: 'My data',
      line: 'What is stored, where, and what leaves the device',
    },
  ].filter((r): r is { to: string; icon: typeof Brain; title: string; line: string } => !!r);
  if (rows.length === 0) return null;
  return (
    <nav aria-label="More about you" className="panel flex flex-col">
      {rows.map(({ to, icon: Icon, title, line }, i) => (
        <Link
          key={to}
          to={to}
          className={`flex min-h-14 items-center gap-3 px-4 py-2 ${i > 0 ? 'border-border border-t' : ''}`}
        >
          <Icon aria-hidden size={20} className="text-muted shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{title}</span>
            <span className="text-muted block truncate text-sm">{line}</span>
          </span>
          <ChevronRight aria-hidden size={16} className="text-muted shrink-0" />
        </Link>
      ))}
    </nav>
  );
}
