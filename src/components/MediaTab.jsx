import { useState } from 'react';
import api, { mediaUrl } from '../lib/api.js';
import { useToast, date } from './ui.jsx';

/**
 * How many of each can appear on a public profile. The archive behind them is
 * unlimited; these cap only what a family sees. Mirrors the server, which
 * enforces them for real.
 */
const MAX_VIDEOS = 2;
const MAX_PHOTOS = 6;

/**
 * Short forms of the review reasons, for showing what a rejection was for.
 * The queue gets the full wording from the server; here they only have to be
 * recognisable at a glance beside a thumbnail.
 */
const REJECTION_LABEL = {
  unclear_video: 'Unclear video',
  unclear_audio: 'Unclear audio',
  instructions_not_followed: 'Instructions not followed',
  incomplete_information: 'Incomplete information',
  duration: 'Wrong duration',
  off_guidelines: 'Off guidelines',
  face_not_visible: 'Face not visible',
  children_visible: "Child's face visible",
  duplicate: 'Duplicate',
  vulgar: 'Vulgar content',
  spam: 'Spam',
  low_quality: 'Low quality',
  video_error: 'Error in video',
  other: 'Other reason',
  // Kept so anything rejected before the list was expanded still reads.
  bad_quality: 'Bad quality',
  misconduct: 'Misconduct',
};

/** Every reason a rejection carries, newest field first. */
const rejectionLabels = (item) => {
  const list = item.rejectionReasons?.length
    ? item.rejectionReasons
    : [item.rejectionReason].filter(Boolean);
  return list.map((r) => REJECTION_LABEL[r] || r);
};

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

/**
 * The two decisions on one item, kept visibly separate.
 *
 * Approving says the item is safe to show. Ticking the box says it should
 * actually appear on her profile. Collapsing them into one control was the
 * mistake worth avoiding: approving everything she sends is routine, choosing
 * what represents her is not.
 */
function Controls({ item, onApprove, onFeature, onRemove, full }) {
  const approved = !!item.approved;
  const featured = approved && !!item.featured;

  return (
    <>
      <div className="flex items-center justify-between mt-2 px-1 gap-2">
        <span className="text-xs text-slate-400 truncate">
          {item.title || item.caption || (item.uploadedAt ? date(item.uploadedAt) : '—')}
        </span>
        {/* A rejected item is kept, so its state has to be visible — otherwise
            it reads as merely unreviewed and gets judged twice. */}
        {item.rejectedAt
          ? (
            <span
              className="text-xs text-red-400 shrink-0"
              title={[...rejectionLabels(item), item.rejectionDetail].filter(Boolean).join(' · ')}
            >
              Not passed
            </span>
          )
          : approved
            ? <span className="text-xs text-slate-500 shrink-0">Approved</span>
            : <span className="text-xs text-amber-400 shrink-0">Awaiting review</span>}
      </div>

      {item.rejectedAt && (
        <p className="text-[10px] text-red-400/70 mt-1 px-1">
          {rejectionLabels(item).join(' · ') || 'Turned down'}
          {item.rejectionDetail ? ` — ${item.rejectionDetail}` : ''}
          {' (she was told)'}
        </p>
      )}

      {/* The box that actually puts it in front of families. Disabled rather
          than hidden when the profile is full, so the reason is visible. */}
      <label
        className={`flex items-center gap-2 mt-2 px-1 text-xs ${
          approved && (featured || !full) ? 'cursor-pointer text-slate-300' : 'text-slate-600 cursor-not-allowed'
        }`}
        title={!approved ? 'Approve it first'
          : (full && !featured) ? 'The profile is full — untick another first'
            : 'Show this on her public profile'}
      >
        <input
          type="checkbox"
          className="accent-brand-500"
          checked={featured}
          disabled={!approved || (full && !featured)}
          onChange={() => onFeature(!featured)}
        />
        Show on profile
      </label>
      {/* Says why the box is unavailable, rather than leaving a dead
          checkbox with no explanation. */}
      <p className="text-[10px] leading-tight text-slate-600 mt-1 px-1">
        {!approved
          ? 'Approve it first — only approved items can be shown.'
          : (full && !featured)
            ? 'Profile is full for this kind. Untick another to make room.'
            : featured
              ? 'Families can see this on her profile.'
              : 'Tick to put this on her public profile.'}
      </p>

      <div className="flex gap-2 mt-2 px-1">
        <button
          className="btn-ghost text-xs"
          title={approved
            ? 'Mark it unchecked. This also takes it off her profile.'
            : 'Mark it as checked and safe. It still will not show to families until ticked above.'}
          onClick={() => onApprove(!approved)}
        >
          {approved ? 'Un-approve' : 'Approve'}
        </button>
        <button
          className="btn-ghost text-xs text-red-400"
          title="Remove it from her records permanently."
          onClick={onRemove}
        >
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
  const pictures = nanny?.profilePictures || [];

  // Three kinds that get judged differently, so they get their own screens
  // rather than one long scroll. Face photos default last in the list but are
  // deliberately loud: they are the only ones where picking a new item
  // replaces an old one, and that rule is easy to miss in a uniform grid.
  const [section, setSection] = useState('videos');

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

  // Each kind has its own endpoint and its own word for itself, kept in one
  // place so a new section is a row here rather than string-building at every
  // call site.
  const KIND = {
    video: { path: 'videos', noun: 'Video' },
    photo: { path: 'photos', noun: 'Photo' },
    'profile-picture': { path: 'profile-pictures', noun: 'Profile picture' },
  };
  const noun = (kind) => KIND[kind].noun;
  const path = (kind) => KIND[kind].path;

  // "Show on profile" means something slightly different for a headshot: it is
  // the one picture beside her name, so choosing it replaces the previous one
  // rather than adding to a set.
  const shownVerb = (kind) => (kind === 'profile-picture'
    ? 'is now her profile picture.'
    : 'is now on her profile.');

  const setApproved = (kind, item, approved) => run(
    () => api(`/nannies/${nanny._id}/${path(kind)}/${item._id}`, {
      method: 'PATCH', body: { approved },
    }),
    approved ? `${noun(kind)} approved. Tick "Show on profile" to display it.`
      : `${noun(kind)} un-approved and removed from her profile.`,
  );

  const setFeatured = (kind, item, featured) => run(
    () => api(`/nannies/${nanny._id}/${path(kind)}/${item._id}`, {
      method: 'PATCH', body: { featured },
    }),
    featured ? `${noun(kind)} ${shownVerb(kind)}`
      : `${noun(kind)} removed from her profile.`,
  );

  const remove = (kind, item) => run(
    () => api(`/nannies/${nanny._id}/${path(kind)}/${item._id}`, { method: 'DELETE' }),
    `${noun(kind)} deleted.`,
  );

  const add = (kind, url, label) => run(
    () => api(`/nannies/${nanny._id}/${path(kind)}`, {
      method: 'POST',
      body: kind === 'video' ? { url, title: label } : { url, caption: label },
    }),
    `${noun(kind)} added.`,
  );

  const waiting = [...videos, ...photos, ...pictures].filter((m) => !m.approved).length;

  // What is actually on her profile, against what it can hold.
  const shownVideos = videos.filter((v) => v.approved && v.featured).length;
  const shownPhotos = photos.filter((p) => p.approved && p.featured).length;
  const shownPictures = pictures.filter((p) => p.approved && p.featured).length;

  return (
    <div className="space-y-6">
      {toast}

      {waiting > 0 && (
        <p className="text-xs text-amber-400">
          {waiting} {waiting === 1 ? 'item is' : 'items are'} waiting to be reviewed.
        </p>
      )}

      {/* Approving is a safety check; the tick box is what families see.
          Said once, plainly, because conflating the two is the easy mistake. */}
      <p className="text-xs text-slate-500 rounded-lg border border-ink-800 bg-ink-950/40 px-3 py-2">
        Approving means the item has been checked — it does <span className="text-slate-300">not</span> put it
        on her profile. Only items with <span className="text-slate-300">Show on profile</span> ticked are
        visible to families: up to {MAX_VIDEOS} videos, {MAX_PHOTOS} photos, and one face photo.
        Everything else stays in her records.
      </p>

      {/* Deliberately not the shared Tabs component: the face tab needs to look
          different from its neighbours, and a shared control that takes a
          per-tab colour would be a worse abstraction than three buttons. */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'videos', label: 'Videos', count: videos.length },
          { key: 'photos', label: 'Photos at work', count: photos.length },
          { key: 'faces', label: '🙂 Photos of the face', count: pictures.length },
        ].map((t) => {
          const active = section === t.key;
          const face = t.key === 'faces';
          return (
            <button
              key={t.key}
              onClick={() => setSection(t.key)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                face
                  ? active
                    ? 'bg-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/30'
                    : 'bg-fuchsia-500/15 text-fuchsia-300 hover:bg-fuchsia-500/25 ring-1 ring-fuchsia-500/40'
                  : active
                    ? 'bg-brand-500/20 text-brand-300 ring-1 ring-brand-500/40'
                    : 'bg-ink-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.label}
              <span className={`ml-2 ${face && active ? 'text-white/70' : 'text-slate-500'}`}>
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      <section hidden={section !== 'videos'}>
        <h4 className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-2">
          Videos
          <span className="ml-2 text-slate-600">{videos.length}</span>
          <span className={`ml-2 normal-case ${shownVideos >= MAX_VIDEOS ? 'text-amber-400' : 'text-slate-600'}`}>
            {shownVideos}/{MAX_VIDEOS} on profile
          </span>
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
                  src={mediaUrl(v.url)}
                  poster={v.thumbnailUrl}
                  controls
                  preload="metadata"
                  className="w-full rounded bg-black max-h-52"
                />
                <Controls
                  item={v}
                  full={shownVideos >= MAX_VIDEOS}
                  onApprove={(on) => setApproved('video', v, on)}
                  onFeature={(on) => setFeatured('video', v, on)}
                  onRemove={() => remove('video', v)}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Her headshots. Kept apart from the photos of her at work because they
          answer a different question — what she looks like, rather than what
          she is like — and because only one of them can be in use. The colour
          carries that difference: everything here behaves like a choice, not
          like a collection. */}
      <section
        hidden={section !== 'faces'}
        className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/[0.04] p-4"
      >
        <h4 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-fuchsia-300 mb-1">
          🙂 Photos of the face
          <span className="rounded-full bg-fuchsia-500/20 px-2 py-0.5 text-[11px] font-normal text-fuchsia-200">
            {pictures.length} stored
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-normal ${
            shownPictures
              ? 'bg-emerald-500/20 text-emerald-300'
              : 'bg-amber-500/20 text-amber-300'
          }`}>
            {shownPictures ? '1 in use' : 'none in use'}
          </span>
        </h4>

        <p className="text-xs text-fuchsia-200/70 mb-4">
          This is the picture families see beside her name. Only one can be in use at a
          time — choosing another replaces it.
        </p>

        <AddForm kind="picture" onAdd={(url, label) => add('profile-picture', url, label)} />

        {pictures.length === 0 ? (
          <p className="text-xs text-slate-600 rounded-lg border border-dashed border-ink-800 px-3 py-4 text-center">
            She has no profile pictures yet.
          </p>
        ) : (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
            {pictures.map((p) => (
              <div
                key={p._id || p.url}
                className={`rounded-lg border bg-ink-950/60 p-2 ${
                  p.approved && p.featured
                    ? 'border-fuchsia-400 ring-2 ring-fuchsia-400/40'
                    : 'border-ink-800'
                }`}
              >
                <a href={mediaUrl(p.url)} target="_blank" rel="noreferrer">
                  <img
                    src={mediaUrl(p.url)}
                    alt={p.caption || 'Profile picture'}
                    loading="lazy"
                    className="w-full h-32 object-cover rounded bg-ink-900"
                  />
                </a>
                {/* `full` stays false: picking a new one is how you swap it,
                    so the box must never be disabled for being "full". */}
                <Controls
                  item={p}
                  full={false}
                  onApprove={(on) => setApproved('profile-picture', p, on)}
                  onFeature={(on) => setFeatured('profile-picture', p, on)}
                  onRemove={() => remove('profile-picture', p)}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <section hidden={section !== 'photos'}>
        <h4 className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-2">
          Photos at work
          <span className="ml-2 text-slate-600">{photos.length}</span>
          <span className={`ml-2 normal-case ${shownPhotos >= MAX_PHOTOS ? 'text-amber-400' : 'text-slate-600'}`}>
            {shownPhotos}/{MAX_PHOTOS} on profile
          </span>
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
                <a href={mediaUrl(p.url)} target="_blank" rel="noreferrer">
                  <img
                    src={mediaUrl(p.url)}
                    alt={p.caption || 'Nanny photo'}
                    loading="lazy"
                    className="w-full h-32 object-cover rounded bg-ink-900"
                  />
                </a>
                <Controls
                  item={p}
                  full={shownPhotos >= MAX_PHOTOS}
                  onApprove={(on) => setApproved('photo', p, on)}
                  onFeature={(on) => setFeatured('photo', p, on)}
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
