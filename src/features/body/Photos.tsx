import { Camera, Lock, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Photo } from '@/core/db/types';
import { logError } from '@/core/errorLog';
import { useBody } from '@/core/state/body';
import { formatDay } from '@/features/goals/format';
import { Button } from '@/ui/Button';
import { useAction } from '@/ui/hooks/useAction';
import { useDialog } from '@/ui/hooks/useDialog';
import { resizeImage } from '@/ui/image';

/** Object URLs for photo blobs, released when the list changes or the screen closes. */
function usePhotoUrls(photos: readonly Photo[]): Record<string, string> {
  const urls = useMemo(
    () => Object.fromEntries(photos.map((p) => [p.id, URL.createObjectURL(p.blob)])),
    [photos],
  );
  useEffect(() => () => Object.values(urls).forEach((u) => URL.revokeObjectURL(u)), [urls]);
  return urls;
}

/** Body photos (SPEC 7.6): private, on this device only. */
export function Photos({ day }: { day: string }) {
  const photos = useBody((s) => s.photos);
  const urls = usePhotoUrls(photos);
  const [open, setOpen] = useState<Photo | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const { run, busy, error } = useAction();
  const hasToday = photos.some((p) => p.day === day);

  async function add(file: File | undefined) {
    if (!file) return;
    setPreparing(true);
    try {
      const blob = await resizeImage(file).catch((e: unknown) => {
        logError(e, 'photo.resize');
        return file; // keep the original rather than lose the photo
      });
      await run({ type: 'photo.add', payload: { day, blob, mime: blob.type || 'image/jpeg' } });
    } finally {
      setPreparing(false);
    }
  }

  return (
    <section aria-label="Photos" className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold">Photos</h2>
      <p className="text-muted flex items-center gap-1 text-xs">
        <Lock aria-hidden size={12} /> Stored only on this device. Never synced, and only included
        in “Export with photos”.
      </p>
      <label className="border-border bg-surface hover:bg-surface-2 inline-flex min-h-11 cursor-pointer items-center gap-2 self-start rounded-md border px-4 font-medium focus-within:outline-2">
        <Camera aria-hidden size={18} />
        {preparing ? 'Saving…' : hasToday ? 'Replace today’s photo' : 'Add today’s photo'}
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={preparing || busy}
          onChange={(e) => {
            void add(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </label>
      {photos.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                aria-label={`Photo from ${formatDay(p.day)}`}
                onClick={() => {
                  setOpen(p);
                  setConfirmDelete(false);
                }}
                className="border-border bg-surface-2 block aspect-square w-full overflow-hidden rounded-md border"
              >
                <img src={urls[p.id]} alt="" className="h-full w-full object-cover" />
              </button>
              <p className="text-muted mt-1 text-center text-xs">{formatDay(p.day)}</p>
            </li>
          ))}
        </ul>
      )}
      {open && (
        <PhotoViewer
          photo={open}
          url={urls[open.id]}
          busy={busy}
          confirmDelete={confirmDelete}
          setConfirmDelete={setConfirmDelete}
          onDelete={() =>
            void run({ type: 'photo.delete', payload: { id: open.id } }).then(
              (ok) => ok && setOpen(null),
            )
          }
          onClose={() => setOpen(null)}
        />
      )}
      {error && (
        <p role="alert" className="text-warning-text text-sm">
          {error}
        </p>
      )}
    </section>
  );
}

/** One photo full screen (Escape or ✕ closes it; focus starts on ✕). */
function PhotoViewer({
  photo: open,
  url,
  busy,
  confirmDelete,
  setConfirmDelete,
  onDelete,
  onClose,
}: {
  photo: Photo;
  url: string | undefined;
  busy: boolean;
  confirmDelete: boolean;
  setConfirmDelete: (v: boolean) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const closeRef = useDialog(onClose);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Photo from ${formatDay(open.day)}`}
      className="bg-bg fixed inset-0 z-40 flex flex-col gap-3 overflow-y-auto p-4"
    >
      <div className="flex items-center justify-between">
        <p className="font-medium">{formatDay(open.day)}</p>
        <button
          type="button"
          ref={closeRef}
          aria-label="Close photo"
          onClick={onClose}
          className="text-muted flex size-11 items-center justify-center rounded-md"
        >
          <X aria-hidden size={20} />
        </button>
      </div>
      <img
        src={url}
        alt={`Body photo from ${formatDay(open.day)}`}
        className="mx-auto max-h-[75dvh] rounded-md object-contain"
      />
      {confirmDelete ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="text-sm">Delete this photo for good?</span>
          <Button disabled={busy} onClick={onDelete}>
            Delete
          </Button>
          <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
            Keep it
          </Button>
        </div>
      ) : (
        <Button variant="ghost" className="self-center" onClick={() => setConfirmDelete(true)}>
          Delete photo…
        </Button>
      )}
    </div>
  );
}
