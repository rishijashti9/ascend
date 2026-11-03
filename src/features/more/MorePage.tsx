import { Link } from 'react-router';
import { ChevronRight } from 'lucide-react';
import { secondaryNav } from '@/app/navigation';
import { useAppState } from '@/core/state/app';

export function MorePage() {
  const settings = useAppState((s) => s.settings);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">More</h1>
      <ul className="border-border bg-surface shadow-card divide-border divide-y overflow-hidden rounded-lg border">
        {secondaryNav(settings).map(({ path, label, icon: Icon }) => (
          <li key={path}>
            <Link
              to={path}
              className="hover:bg-surface-2 flex min-h-14 items-center gap-3 px-4 transition-colors duration-(--dur-fast)"
            >
              <Icon aria-hidden size={20} className="text-muted" />
              <span className="flex-1">{label}</span>
              <ChevronRight aria-hidden size={18} className="text-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
