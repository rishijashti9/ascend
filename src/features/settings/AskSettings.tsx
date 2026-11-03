import { Link } from 'react-router';
import { DEFAULT_DAILY_LIMIT } from '@/core/ask/ask';
import type { Settings } from '@/core/db/types';
import { useAction } from '@/ui/hooks/useAction';
import { Switch } from '@/ui/Switch';
import { Card } from './sections';

/** Ask the System on/off (SPEC 6.7 C). Off by default; everything else works without it. */
export function AskSettings({ settings }: { settings: Settings }) {
  const { run, busy, error } = useAction();
  return (
    <Card title="Ask the System">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium" id="ask-label">
            Ask career and health questions
          </p>
          <p className="text-muted text-sm">
            Uses a free AI model through OpenRouter, via your sync account. Only your question and
            progress numbers are sent — never health data, journal text, mood or photos. Free
            models’ providers may use questions to improve their services. Up to{' '}
            {DEFAULT_DAILY_LIMIT} questions a day; when it’s off or unavailable, the Growth Compass
            answers instead.
          </p>
        </div>
        <Switch
          on={settings.ai_enabled}
          labelledBy="ask-label"
          disabled={busy}
          onChange={(v) => void run({ type: 'settings.update', payload: { ai_enabled: v } })}
        />
      </div>
      <Link to="/ask" className="text-accent-text inline-flex min-h-11 items-center text-sm">
        Open Ask the System →
      </Link>
      {error && (
        <p role="alert" className="text-warning-text text-sm">
          {error}
        </p>
      )}
    </Card>
  );
}
