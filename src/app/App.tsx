import { APP_VERSION } from './version';

export function App() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-2 p-6">
      <h1 className="font-display text-2xl font-semibold tracking-tight">ASCEND</h1>
      <p className="text-muted tabular-nums">Version {APP_VERSION}</p>
    </main>
  );
}
