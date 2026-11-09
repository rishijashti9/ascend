import { useSearchParams } from 'react-router';
import { useAppState } from '@/core/state/app';
import { ONET_ATTRIBUTION } from '@/data/compass';
import { CareerBrowser } from './CareerBrowser';
import { CareerGap } from './CareerGap';
import { Discovery } from './Discovery';
import { HealthCheck } from './HealthCheck';
import { Roadmaps } from './Roadmaps';

const TABS = [
  { id: 'career', label: 'Career' },
  { id: 'health', label: 'Health' },
] as const;

/**
 * Growth Compass (SPEC 6.7 B): career and health guidance from trusted, sourced data —
 * deterministic, offline and free. Career and Health only.
 */
export function CompassPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'health' ? 'health' : 'career';
  const target = useAppState((s) => s.profile?.compass?.target_career ?? null);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="display text-2xl">Growth Compass</h1>
        <p className="text-muted text-sm">
          Career and health guidance from trusted sources, worked out on this device. Every
          suggestion shows why and where it comes from.
        </p>
      </header>
      <div role="tablist" aria-label="Compass" className="border-border flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setParams(t.id === 'career' ? {} : { tab: t.id }, { replace: true })}
            className={`min-h-11 px-4 text-sm font-medium ${
              tab === t.id ? 'border-accent text-accent-text border-b-2' : 'text-muted'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'career' ? (
        <div role="tabpanel" aria-label="Career" className="flex flex-col gap-6">
          {target ? (
            <>
              <CareerGap />
              <details className="panel p-4">
                <summary className="min-h-11 cursor-pointer font-medium">
                  Find careers that fit you
                </summary>
                <div className="pt-3">
                  <Discovery />
                </div>
              </details>
            </>
          ) : (
            <section className="flex flex-col gap-3">
              <h2 className="display text-lg">Find careers that fit you</h2>
              <Discovery />
            </section>
          )}
          <Roadmaps />
          <CareerBrowser />
          <p className="text-muted text-xs">{ONET_ATTRIBUTION}</p>
        </div>
      ) : (
        <div role="tabpanel" aria-label="Health" className="flex flex-col gap-6">
          <HealthCheck />
        </div>
      )}
    </div>
  );
}
