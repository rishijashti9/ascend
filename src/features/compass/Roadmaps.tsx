import { ExternalLink } from 'lucide-react';
import { pack, sourceById } from '@/core/compass/pack';

const KIND: Record<string, string> = {
  skill: 'Skill roadmaps',
  exam: 'Exams',
  process: 'Studying abroad',
  study: 'How to study',
};

/** Learning roadmaps and guides (SPEC 6.7 B), with typical durations and official links. */
export function Roadmaps() {
  const roadmaps = pack().roadmaps;
  return (
    <section aria-label="Roadmaps and guides" className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Roadmaps and guides</h2>
      {Object.entries(KIND).map(([kind, label]) => {
        const list = roadmaps.filter((r) => r.kind === kind);
        if (list.length === 0) return null;
        return (
          <div key={kind} className="flex flex-col gap-2">
            <h3 className="text-muted text-sm font-medium">{label}</h3>
            {list.map((r) => {
              const weeks = r.steps.reduce((s, x) => s + x.weeks, 0);
              return (
                <details
                  key={r.id}
                  className="border-border bg-surface rounded-lg border px-4 py-2"
                >
                  <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2">
                    <span className="font-medium">{r.title}</span>
                    {weeks > 0 && <span className="text-muted text-sm">~{weeks} weeks</span>}
                  </summary>
                  <p className="text-muted pb-2 text-sm">{r.summary}</p>
                  <ol className="flex list-decimal flex-col gap-2 pb-2 pl-5 text-sm">
                    {r.steps.map((s) => (
                      <li key={s.title}>
                        <span className="font-medium">{s.title}</span>
                        {s.weeks > 0 && <span className="text-muted"> · ~{s.weeks} wk</span>}
                        <p className="text-muted">{s.detail}</p>
                        {s.checkOfficial && (
                          <a
                            href={s.checkOfficial}
                            target="_blank"
                            rel="noreferrer"
                            className="text-accent-text inline-flex min-h-11 items-center gap-1"
                          >
                            Check the official site <ExternalLink aria-hidden size={14} />
                          </a>
                        )}
                      </li>
                    ))}
                  </ol>
                  <p className="text-muted pb-2 text-xs">
                    Sources: {r.sources.map((id) => sourceById(id)?.title ?? id).join('; ')}
                  </p>
                </details>
              );
            })}
          </div>
        );
      })}
    </section>
  );
}
