import { useState } from 'react';
import api from '../lib/api.js';
import { useToast, date } from './ui.jsx';

/**
 * Everything a nanny has sent showing herself at work — her videos and her
 * photos, in one place.
 *
 * These arrive over months rather than at signup, so this is a tab of its own
 * rather than a strip at the bottom of the profile: an admin comes here to
 * review a backlog, and needs to see what is live to families and what is
 * still waiting without scrolling past the rest of her record.
 *
 * Both kinds are held back until someone has looked at them, because they
 * show other people's children.
 */

/** One approve/hide/delete row, shared by both kinds. */
function Controls({ item, live, onToggle, onRemove }) {
  return (
    <>
      <div className="flex items-center justify-between mt-2 px-1 gap-2">
        <span className="text-xs text-slate-400 truncate">
          {item.title || item.caption || (item.uploadedAt ? date(item.uploadedAt) : '—')}
        </span>
        {live
          ? <span className="text-xs text-emerald-400 shrink-0">Live to families</span>
          : <span className="text-xs text-amber-400 shrink-0">Awaiting review</span>}
      </div>
      <div className="flex gap-2 mt-2 px-1">
        <button className="btn-ghost text-xs" onClick={onToggle}>
          {live ? 'Hide from families' : 'Approve'}
        </button>
        <button className="btn-ghost text-xs text-red-400" onClick={onRemove}>
          Delete
        </button>
      </div>
    </>
  );
}

/** Add a video or photo by URL, for media that reached us outside WhatsApp. */
function AddForm({ kind, onAdd }) {
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!url.trim() || busy) return;
    setBusy(true);
    try {
      await onAdd(url.trim(), label.trim());
      setUrl('');
      setLabel('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2 mb-3">
      <input
        className="input text-xs flex-1 min-w-[200px]"
        placeholder={`Link to a ${kind}`}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
      />
      <input
        className="input text-xs w-40"
        placeholder={kind === 'video' ? 'Title (optional)' : 'Caption (optional)'}
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />
      <button className="btn-ghost text-xs" onClick={submit} disabled={!url.trim() || busy}>
        {busy ? 'Adding…' : `+ Add ${kind}`}
      </button>
    </div>
  );
}

export default function MediaTab({ nanny, onChanged }) {
  const { toast, notify, error: toastError } = useToast();
  const videos = nanny?.videos || [];
  const photos = nanny?.photos || [];

  /** Every change refetches, so the tab always shows what the server holds. */
  const run = async (fn, message) => {
    try {
      await fn();
      notify(message);
      await onChanged?.();
    } catch (e) {
      toastError(e.message);
    }
  };

  const setApproved = (kind, item, approved) => run(
    () => api(`/nannies/${nanny._id}/${kind}s/${item._id}`, {
      method: 'PATCH', body: { approved },
    }),
    approved ? `${kind === 'video' ? 'Video' : 'Photo'} is now visible to families.`
      : `${kind === 'video' ? 'Video' : 'Photo'} hidden from families.`,
  );

  const remove = (kind, item) => run(
    () => api(`/nannies/${nanny._id}/${kind}s/${item._id}`, { method: 'DELETE' }),
    `${kind === 'video' ? 'Video' : 'Photo'} deleted.`,
  );

  const add = (kind, url, label) => run(
    () => api(`/nannies/${nanny._id}/${kind}s`, {
      method: 'POST',
      body: kind === 'video' ? { url, title: label } : { url, caption: label },
    }),
    `${kind === 'video' ? 'Video' : 'Photo'} added.`,
  );

  const waiting = [...videos, ...photos].filter((m) => !m.approved).length;

  return (
    <div className="space-y-6">
      {toast}

      {waiting > 0 && (
        <p className="text-xs text-amber-400">
          {waiting} {waiting === 1 ? 'item is' : 'items are'} waiting to be reviewed.
        </p>
      )}

      <section>
        <h4 className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-2">
          Videos
          <span className="ml-2 text-slate-600">{videos.length}</span>
        </h4>

        <AddForm kind="video" onAdd={(url, label) => add('video', url, label)} />

        {videos.length === 0 ? (
          <p className="text-xs text-slate-600 rounded-lg border border-dashed border-ink-800 px-3 py-4 text-center">
            She has not sent any videos yet.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {videos.map((v) => (
              <div key={v._id || v.url} className="rounded-lg border border-ink-800 bg-ink-950/60 p-2">
                <video
                  src={v.url}
                  poster={v.thumbnailUrl}
                  controls
                  preload="metadata"
                  className="w-full rounded bg-black max-h-52"
                />
                <Controls
                  item={v}
                  live={v.approved}
                  onToggle={() => setApproved('video', v, !v.approved)}
                  onRemove={() => remove('video', v)}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h4 className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-2">
          Photos
          <span className="ml-2 text-slate-600">{photos.length}</span>
        </h4>

        <AddForm kind="photo" onAdd={(url, label) => add('photo', url, label)} />

        {photos.length === 0 ? (
          <p className="text-xs text-slate-600 rounded-lg border border-dashed border-ink-800 px-3 py-4 text-center">
            She has not sent any photos yet.
          </p>
        ) : (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
            {photos.map((p) => (
              <div key={p._id || p.url} className="rounded-lg border border-ink-800 bg-ink-950/60 p-2">
                {/* Opens full size: a thumbnail is rarely enough to judge one. */}
                <a href={p.url} target="_blank" rel="noreferrer">
                  <img
                    src={p.url}
                    alt={p.caption || 'Nanny photo'}
                    loading="lazy"
                    className="w-full h-32 object-cover rounded bg-ink-900"
                  />
                </a>
                <Controls
                  item={p}
                  live={p.approved}
                  onToggle={() => setApproved('photo', p, !p.approved)}
                  onRemove={() => remove('photo', p)}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
