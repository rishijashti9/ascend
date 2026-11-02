import { APP_VERSION } from '@/app/version';

export function SettingsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Settings</h1>
      <section className="border-border bg-surface shadow-card rounded-lg border p-4">
        <h2 className="text-muted mb-2 text-sm font-medium">About</h2>
        <div className="flex items-center justify-between">
          <span>Version</span>
          <span className="text-muted tabular-nums">{APP_VERSION}</span>
        </div>
      </section>
    </div>
  );
}
