import { NavLink, Outlet } from 'react-router';
import { AchievementToast } from '@/features/achievements/AchievementToast';
import { isEnabled } from '@/config/features';
import { NotificationBridge } from '@/features/notifications/NotificationBridge';
import { DeepLinks } from './DeepLinks';
import { LevelUpMoment } from '@/features/moments/LevelUpMoment';
import { AskButton } from '@/features/ask/AskButton';
import { primaryNav, SETTINGS_ITEM, type NavItem } from './navigation';

function SidebarLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      className={({ isActive }) =>
        `pill flex min-h-11 items-center gap-3 px-4 text-base font-semibold transition-colors duration-(--dur-fast) ${
          isActive ? 'bg-tile-white text-on-tile-white' : 'text-muted hover:text-text'
        }`
      }
    >
      <Icon aria-hidden size={20} />
      {item.label}
    </NavLink>
  );
}

/** A bottom-bar item: icon + label; the active one sits in a white circle. */
function TabLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  if (item.centre) {
    return (
      <NavLink
        to={item.path}
        className="flex flex-1 flex-col items-center justify-end gap-0.5 text-[11px] font-semibold"
      >
        {({ isActive }) => (
          <>
            <span
              className={`bg-accent-fill text-on-accent shadow-float -mt-7 grid size-16 place-items-center rounded-full transition-transform duration-(--dur) ${
                isActive ? 'scale-105' : ''
              }`}
            >
              <Icon aria-hidden size={28} strokeWidth={2.25} />
            </span>
            <span className={isActive ? 'text-text' : 'text-muted'}>{item.label}</span>
          </>
        )}
      </NavLink>
    );
  }
  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold"
    >
      {({ isActive }) => (
        <>
          <span
            className={`grid size-9 place-items-center rounded-full transition-colors duration-(--dur-fast) ${
              isActive ? 'bg-tile-white text-on-tile-white' : 'text-muted'
            }`}
          >
            <Icon aria-hidden size={20} />
          </span>
          <span className={isActive ? 'text-text' : 'text-muted'}>{item.label}</span>
        </>
      )}
    </NavLink>
  );
}

/**
 * Mobile: content + a floating pill bottom bar (Focus as the big centre button).
 * Desktop (≥1024px): a left sidebar with the same five + Settings.
 */
export function Layout() {
  const primary = primaryNav();

  return (
    <div className="min-h-dvh lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-8 p-5 lg:flex">
        <div className="display px-4 pt-2 text-xl">ASCEND</div>
        <nav aria-label="Main" className="flex flex-col gap-1">
          {[...primary, SETTINGS_ITEM].map((item) => (
            <SidebarLink key={item.path} item={item} />
          ))}
        </nav>
      </aside>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-32 sm:px-6 lg:px-10 lg:pb-10">
        {isEnabled('notifications') && <NotificationBridge />}
        {isEnabled('widgets') && <DeepLinks />}
        <Outlet />
      </main>
      {isEnabled('ask') && <AskButton />}
      <AchievementToast />
      <LevelUpMoment />

      <nav
        aria-label="Main"
        className="pill bg-surface shadow-float fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] flex items-end px-2 lg:hidden"
      >
        {primary.map((item) => (
          <TabLink key={item.path} item={item} />
        ))}
      </nav>
    </div>
  );
}
