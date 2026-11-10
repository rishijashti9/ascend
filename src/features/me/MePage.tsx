import { Brain, Settings as Gear, Smartphone } from 'lucide-react';
import { AskEntry } from '@/features/ask/AskButton';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { isEnabled } from '@/config/features';
import { titleName } from '@/core/achievements/titles';
import { formatMinutes } from '@/core/screentime/observe';
import { useAppState } from '@/core/state/app';
import { useProgress } from '@/core/state/progress';
import { useScreen } from '@/core/state/screen';
import { Tabs, Tile } from '@/ui/Surface';
import { tabPanelProps } from '@/ui/tabs';
import { meTabs, type MeTab } from './tabs';

/**
 * Me (Phase 12): who you are and how you're doing — Stats & achievements · Body · Reviews, with
 * Screen time and "What the System knows about you" one tap away, and Settings behind the gear.
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

/** Screen time and the knowledge page, one tap away from every Me tab. */
function MeTiles() {
  const screen = useScreen((s) => s);
  const showScreen = isEnabled('screenTime');
  const showKnows = isEnabled('adaptive');
  if (!showScreen && !showKnows) return null;
  const limit = screen.rules?.limit_min ?? null;
  const screenLine = !screen.rules?.enabled
    ? 'Off — set it up on your phone'
    : limit === null
      ? 'Observing quietly'
      : `${formatMinutes(Math.round(screen.todaySec / 60))} of ${formatMinutes(limit)} today`;
  return (
    <div className="grid grid-cols-2 gap-3">
      {showScreen && (
        <Tile tone="grey" to="/me/screen-time">
          <Smartphone aria-hidden size={22} />
          <span className="display mt-6 text-base">Screen time</span>
          <span className="text-sm opacity-80">{screenLine}</span>
        </Tile>
      )}
      {showKnows && (
        <Tile tone="violet" to="/me/knows" label="What the System knows about you">
          <Brain aria-hidden size={22} />
          <span className="display mt-6 text-base">What the System knows</span>
        </Tile>
      )}
    </div>
  );
}
