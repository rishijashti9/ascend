import { Smartphone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { db } from '@/core/db/db';
import { compareWeeks, weekLine } from '@/core/screentime/review';
import { getRules, rulesState } from '@/core/screentime/store';
import { addDays } from '@/core/time';

/** The one weekly-review line (SPEC 6.8): entertainment this week vs last week. No guilt. */
export function ScreenWeekLine({ weekStart, today }: { weekStart: string; today: string }) {
  const [line, setLine] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const rules = await getRules(db);
      if (!rules?.enabled) return;
      const records = await db.screen_days
        .where('day')
        .between(addDays(weekStart, -7), today, true, true)
        .toArray();
      if (!records.some((r) => r.day >= weekStart && !r.deleted_at)) return;
      const text = weekLine(compareWeeks(records, rulesState(rules), weekStart, today));
      if (alive) setLine(text);
    })();
    return () => {
      alive = false;
    };
  }, [weekStart, today]);

  if (!line) return null;
  return (
    <p className="text-muted flex items-center gap-2 text-sm">
      <Smartphone aria-hidden size={16} className="shrink-0" />
      {line}
    </p>
  );
}
