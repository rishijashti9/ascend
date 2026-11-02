import { NavLink, Outlet } from 'react-router';
import { AchievementToast } from '@/features/achievements/AchievementToast';
import { MORE_ITEM, primaryNav, secondaryNav, type NavItem } from './navigation';

function SidebarLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      className={({ isActive }) =>
        `flex min-h-11 items-center gap-3 rounded-md px-3 text-base transition-colors duration-(--dur-fast) ${
          isActive ? 'bg-surface-2 text-text font-medium' : 'text-muted hover:text-text'
        }`
      }
    >
      <Icon aria-hidden size={20} />
      {item.label}
    </NavLink>
  );
}

function TabLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      className={({ isActive }) =>
        `flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-xs ${
          isActive ? 'text-accent-text font-medium' : 'text-muted'
        }`
      }
    >
      <Icon aria-hidden size={22} />
      {item.label}
    </NavLink>
  );
}

/** Mobile: content + bottom tab bar. Desktop (≥1024px): left sidebar with every item. */
export function Layout() {
  const primary = primaryNav();
  const secondary = secondaryNav();

  return (
    <div className="bg-bg min-h-dvh lg:flex">
      <aside className="border-border bg-surface sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-r p-4 lg:flex">
        <div className="font-display px-3 pt-2 text-lg font-semibold tracking-tight">ASCEND</div>
        <nav aria-label="Main" className="flex flex-col gap-1">
          {[...primary, ...secondary].map((item) => (
            <SidebarLink key={item.path} item={item} />
          ))}
        </nav>
      </aside>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-24 sm:px-6 lg:px-10 lg:pb-10">
        <Outlet />
      </main>
      <AchievementToast />

      <nav
        aria-label="Main"
        className="border-border bg-surface fixed inset-x-0 bottom-0 flex border-t pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {[...primary, MORE_ITEM].map((item) => (
          <TabLink key={item.path} item={item} />
        ))}
      </nav>
    </div>
  );
}
