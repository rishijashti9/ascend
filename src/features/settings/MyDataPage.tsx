import { ArrowLeft, Download, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { exportBackup, exportWithPhotos } from '@/app/files';
import { isEnabled } from '@/config/features';
import { readOutbound, type OutboundEntry } from '@/core/data/outbound';
import { deviceEstimate, formatBytes, localUsage, type GroupUsage } from '@/core/data/usage';
import { db } from '@/core/db/db';
import { logError } from '@/core/errorLog';
import { useAccount } from '@/core/state/account';
import { getSupabase } from '@/core/sync/client';
import { supabaseBackend } from '@/core/sync/backend';
import { Button } from '@/ui/Button';
import { Compaction } from './Compaction';
import { DeleteEverything } from './DeleteEverything';
import { Card } from './sections';

type Cloud = { records: number; bytes: number } | 'unknown' | 'signed_out' | 'loading';

/**
 * Settings → My data (SPEC 6.7 D): what is stored and where, how much space it takes, what has
 * ever been sent outside (and when), and the controls: export, compaction, delete everything.
 */
export function MyDataPage() {
  const signedIn = useAccount((s) => s.status === 'signed_in');
  const [groups, setGroups] = useState<GroupUsage[] | null>(null);
  const [device, setDevice] = useState<{ usage: number; quota: number } | null>(null);
  const [cloud, setCloud] = useState<Cloud>('loading');
  const [outbound, setOutbound] = useState<OutboundEntry[]>([]);

  useEffect(() => {
    void localUsage(db)
      .then(setGroups)
      .catch((e: unknown) => logError(e, 'mydata.usage'));
    void deviceEstimate().then(setDevice);
    void readOutbound(db).then(setOutbound);
  }, []);
  useEffect(() => {
    const client = getSupabase();
    if (!signedIn || !client) return;
    let live = true;
    supabaseBackend(client)
      .cloudUsage()
      .then((u) => live && setCloud(u ?? 'unknown'))
      .catch(() => live && setCloud('unknown'));
    return () => {
      live = false;
    };
  }, [signedIn]);
  const cloudView: Cloud = signedIn && getSupabase() ? cloud : 'signed_out';

  const total = groups?.reduce((s, g) => s + g.bytes, 0) ?? 0;
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Link to="/settings" className="text-accent-text inline-flex min-h-11 items-center gap-1">
        <ArrowLeft aria-hidden size={18} /> Settings
      </Link>
      <h1 className="text-xl font-semibold">My data</h1>
      <p className="flex items-start gap-2 text-sm">
        <ShieldCheck aria-hidden size={18} className="text-success-text mt-0.5 shrink-0" />
        <span>
          Your data stays on this device and, if you sync, in your own private account. No
          analytics, no tracking, nothing sold or shared. The Adaptive System and Growth Compass
          learn only here, and nothing about you trains any outside model.
        </span>
      </p>

      <Card title="Stored on this device">
        {groups === null ? (
          <p className="text-muted text-sm">Counting…</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {groups.map((g) => (
                <tr key={g.label} className="border-border border-b last:border-0">
                  <td className="py-2">{g.label}</td>
                  <td className="text-muted py-2 text-right tabular-nums">
                    {g.records.toLocaleString()}
                  </td>
                  <td className="text-muted py-2 text-right tabular-nums">
                    {formatBytes(g.bytes)}
                  </td>
                </tr>
              ))}
              <tr>
                <td className="py-2 font-medium">Total</td>
                <td />
                <td className="py-2 text-right font-medium tabular-nums">{formatBytes(total)}</td>
              </tr>
            </tbody>
          </table>
        )}
        {device && (
          <p className="text-muted text-sm">
            The browser/phone reports {formatBytes(device.usage)} used by ASCEND in total (app files
            and caches included).
          </p>
        )}
      </Card>

      <Card title="In your cloud account">
        <p className="text-sm">
          {cloudView === 'loading'
            ? 'Checking…'
            : cloudView === 'signed_out'
              ? 'Not signed in — nothing is stored in the cloud.'
              : cloudView === 'unknown'
                ? 'Synced, but the size isn’t available right now.'
                : `${cloudView.records.toLocaleString()} records, about ${formatBytes(cloudView.bytes)}.`}
        </p>
        <p className="text-muted text-sm">
          Body photos never sync. Health data is never sent to any AI.
        </p>
      </Card>

      <Card title="Sent outside ASCEND">
        {outbound.length === 0 ? (
          <p className="text-sm">
            Nothing, ever. Only “Ask the System” questions would go to Google Gemini, and only when
            you ask one.
          </p>
        ) : (
          <>
            <p className="text-sm">
              {outbound.length} question{outbound.length === 1 ? '' : 's'} to Google Gemini (Ask the
              System). Never health data, journal text, mood or photos.
            </p>
            <ul className="text-muted text-sm">
              {outbound
                .slice(-10)
                .reverse()
                .map((o) => (
                  <li key={o.at}>
                    {new Date(o.at).toLocaleString()} · {o.chars} characters
                  </li>
                ))}
            </ul>
          </>
        )}
      </Card>

      {isEnabled('exportImport') && (
        <Card title="Take it with you">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void exportBackup()}>
              <Download aria-hidden size={16} /> Export everything (JSON)
            </Button>
            <Button variant="secondary" onClick={() => void exportWithPhotos()}>
              <Download aria-hidden size={16} /> Export with photos (.zip)
            </Button>
          </div>
        </Card>
      )}
      <Compaction totalBytes={groups ? total : null} />
      <DeleteEverything />
    </div>
  );
}
