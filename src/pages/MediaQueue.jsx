import { useEffect, useState } from 'react';
import api from '../lib/api.js';
import {
  PageHeader, Skeleton, ErrorBox, Avatar, useToast, money, date, humanize, Badge,
} from '../components/ui.jsx';

/**
 * Everything waiting to be ruled on, grouped by the nanny who sent it.
 *
 * Grouped rather than a flat stream because reviewing is a judgement about a
 * person, not a file: three blurry photos from someone with a strong profile
 * read differently from the same three as her only submission. Her details sit
 * on the left of every row so that context never leaves the screen.
 *
 * Turning something down demands at least one reason, and everything ticked
 * is sent to her. A nanny cannot send a better video if nobody tells her what
 * was wrong with this one.
 */

/**
 * "Move to Video Not Passed".
 *
 * Several reasons can apply at once — a video is often both dark and too
 * short — so these are checkboxes, not a single choice. Everything ticked is
 * sent to her, so the panel says so before anything is ticked rather than
 * after it has gone.
 *
 * Opens as a modal rather than inside the card: fourteen reasons will not fit
 * in a 208px column, and a reviewer needs to read them.
 */
function RejectDialog({ kind, reasons, onCancel, onConfirm, busy }) {
  const [picked, setPicked] = useState([]);
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);

  const toggle = (value) => setPicked((p) => (
    p.includes(value) ? p.filter((v) => v !== value) : [...p, value]
  ));

  // The note is optional everywhere except "Other", which says nothing alone.
  const needsNote = picked.includes('other');
  const ready = picked.length > 0 && (!needsNote || note.trim());

  // Built here from the same wording the server sends, so what a reviewer
  // reads before pressing send is what the nanny actually receives.
  const told = picked
    .map((v) => reasons.find((r) => r.value === v)?.told)
    .filter(Boolean);

  const preview = (() => {
    const lines = [`\u{1F4F7} About the ${kind} you sent`, ''];
    if (told.length === 1) {
      lines.push(`We could not add it to your profile because ${told[0]}.`);
    } else if (told.length > 1) {
      lines.push('We could not add it to your profile for these reasons:', '');
      told.forEach((t) => lines.push(`\u2022 ${t.charAt(0).toUpperCase()}${t.slice(1)}`));
    } else {
      lines.push('We could not add it to your profile.');
    }
    if (note.trim()) lines.push('', `\u{1F4DD} ${note.trim()}`);
    lines.push(
      '',
      `Please send another when you can \u2014 a ${kind} of you with a family or at work helps you get chosen more often.`,
    );
    return lines.join('\n');
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-xl border border-ink-800 bg-ink-950 p-4 sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Step two: the actual words, so a misclick is caught before it
            reaches her. A rejection cannot be unsent, which is the whole
            reason this step exists. */}
        {confirming ? (
          <>
            <h3 className="text-lg font-semibold text-white">Send this to her?</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              This is exactly what she will receive on WhatsApp. It cannot be unsent.
            </p>

            <pre className="whitespace-pre-wrap break-words rounded-lg border border-ink-800 bg-ink-900/60 p-3 text-sm text-slate-200 font-sans">
              {preview}
            </pre>

            <div className="flex flex-wrap items-center gap-2 mt-5">
              <button
                className="btn-primary text-sm disabled:opacity-40"
                disabled={busy}
                onClick={() => onConfirm(picked, note.trim())}
              >
                {busy ? 'Sending\u2026' : 'Yes, send it'}
              </button>
              <button
                className="btn-ghost text-sm"
                onClick={() => setConfirming(false)}
                disabled={busy}
              >
                Back
              </button>
              <button className="btn-ghost text-sm" onClick={onCancel} disabled={busy}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="text-lg font-semibold text-white">Move to Video Not Passed</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              The reasons you tick and the note you write are recorded against this {kind} and
              sent to her on WhatsApp, so she knows what to fix.
            </p>

            <p className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-2">Reason</p>
            <div className="space-y-1.5">
              {reasons.map((r) => (
                <label
                  key={r.value}
                  className="flex items-start gap-2.5 cursor-pointer rounded px-2 py-1.5 hover:bg-ink-900/60"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 accent-red-500"
                    checked={picked.includes(r.value)}
                    onChange={() => toggle(r.value)}
                  />
                  <span className="text-sm text-slate-200">{r.label}</span>
                </label>
              ))}
            </div>

            <label className="block text-xs font-mono uppercase tracking-wider text-slate-500 mt-4 mb-2">
              Note {needsNote
                ? <span className="text-red-400 normal-case font-sans">(required for &ldquo;Other reason&rdquo;)</span>
                : <span className="text-slate-600 normal-case font-sans">(optional)</span>}
            </label>
            <textarea
              rows={3}
              className="input text-sm w-full"
              placeholder="Anything else she should know. She reads this."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />

            <div className="flex flex-wrap items-center gap-2 mt-5">
              <button
                className="btn-primary text-sm disabled:opacity-40"
                disabled={!ready || busy}
                onClick={() => setConfirming(true)}
              >
                Review message
              </button>
              <button className="btn-ghost text-sm" onClick={onCancel} disabled={busy}>
                Cancel
              </button>
              {picked.length > 0 && (
                <span className="ml-auto text-xs text-slate-600">
                  {picked.length} reason{picked.length === 1 ? '' : 's'} selected
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** One pending item: the media, then approve / reject. */
function MediaCard({ item, kind, full, reasons, onApprove, onReject }) {
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (fn) => {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  return (
    <div className="w-full sm:w-52 sm:shrink-0 rounded-lg border border-ink-800 bg-ink-950/60 p-2">
      {kind === 'video' ? (
        <video
          src={item.url}
          poster={item.thumbnailUrl}
          controls
          preload="metadata"
          className="w-full rounded bg-black h-32 object-cover"
        />
      ) : (
        <a href={item.url} target="_blank" rel="noreferrer">
          <img
            src={item.url}
            alt={item.caption || 'Pending photo'}
            loading="lazy"
            className="w-full h-32 object-cover rounded bg-ink-900"
          />
        </a>
      )}

      <p className="text-[10px] text-slate-500 mt-1.5 truncate">
        {item.title || item.caption || (item.uploadedAt ? date(item.uploadedAt) : '—')}
      </p>

      {rejecting && (
        <RejectDialog
          kind={kind}
          reasons={reasons}
          busy={busy}
          onCancel={() => setRejecting(false)}
          onConfirm={(picked, note) => run(() => onReject(picked, note))}
        />
      )}

      <div className="mt-2 space-y-2">
        {/* Approving and showing are two different decisions, and the
            difference is not self-evident — someone will approve fifty items
            believing they are publishing them. So each button says what it
            actually does, rather than leaving it to be discovered. */}
        <div>
          <button
            className="btn-ghost text-xs w-full"
            disabled={busy}
            onClick={() => run(() => onApprove(false))}
          >
            Approve only
          </button>
          <p className="text-[10px] leading-tight text-slate-600 mt-1 px-0.5">
            Marks it as checked and safe. Families still will not see it.
          </p>
        </div>

        <div>
          <button
            className="btn-ghost text-xs w-full text-emerald-400 disabled:opacity-40"
            disabled={busy || full}
            onClick={() => run(() => onApprove(true))}
          >
            Approve + show on profile
          </button>
          <p className="text-[10px] leading-tight text-slate-600 mt-1 px-0.5">
            {full
              ? 'Her profile is already full for this kind — untick another first.'
              : 'Checks it and puts it on her public profile for families to see.'}
          </p>
        </div>

        <div>
          <button
            className="btn-ghost text-xs w-full text-red-400"
            disabled={busy}
            onClick={() => setRejecting(true)}
          >
            Not passed
          </button>
          <p className="text-[10px] leading-tight text-slate-600 mt-1 px-0.5">
            Turns it down and sends her the reason on WhatsApp. You will see the
            message before it goes.
          </p>
        </div>
      </div>
    </div>
  );
}

/** One nanny: her details on the left, everything she sent on the right. */
function NannyRow({ nanny, limits, reasons, onAction }) {
  const waiting = nanny.videos.length + nanny.photos.length
    + (nanny.profilePictures?.length || 0);

  return (
    <div className="rounded-xl border border-ink-800 bg-ink-950/40 p-4">
      {/* Side by side on a desktop, stacked on a phone: a 224px details
          column beside a media strip leaves the media a useless sliver on a
          375px screen. */}
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">
        {/* Who sent it — kept beside the media, because the judgement is
            about her, not just the file. */}
        <div className="w-full sm:w-56 sm:shrink-0">
          <div className="flex items-start gap-3">
            <Avatar name={nanny.fullName} />
            <div className="min-w-0">
              <p className="text-sm text-white truncate">{nanny.nickname || nanny.fullName}</p>
              <p className="text-[11px] font-mono text-slate-500 truncate">{nanny.phone}</p>
            </div>
          </div>

          <div className="mt-3">
            <Badge value={nanny.nannyStatus}>{humanize(nanny.nannyStatus)}</Badge>
          </div>

          <dl className="mt-3 space-y-1 text-[11px] text-slate-500">
            {nanny.age > 0 && <div>Age {nanny.age}</div>}
            {nanny.experienceYears > 0 && <div>{nanny.experienceYears} yrs experience</div>}
            {nanny.hourlyRate > 0 && <div>{money(nanny.hourlyRate)}/hr</div>}
            {nanny.ratingAverage > 0 && <div>★ {nanny.ratingAverage.toFixed(1)}</div>}
          </dl>

          {/* How full her profile already is, so the reviewer knows before
              they reach for "show on profile". */}
          <p className="mt-3 text-[11px] text-slate-600">
            On profile: {nanny.featuredVideos}/{limits.videos} videos,{' '}
            {nanny.featuredPhotos}/{limits.photos} photos
            {nanny.featuredProfilePictures ? ' · picture set' : ''}
          </p>

          <p className="mt-2 text-[11px] text-amber-400">
            {waiting} waiting
          </p>
        </div>

        {/* What she sent. Scrolls sideways rather than wrapping, so a nanny
            with twenty photos stays one row. */}
        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="grid grid-cols-2 gap-3 sm:flex sm:gap-3 sm:pb-1">
            {nanny.videos.map((v) => (
              <MediaCard
                key={v._id}
                item={v}
                kind="video"
                reasons={reasons}
                full={nanny.featuredVideos >= limits.videos}
                onApprove={(feature) => onAction.approve(nanny, 'videos', v, feature)}
                onReject={(reason, detail) => onAction.reject(nanny, 'videos', v, reason, detail)}
              />
            ))}
            {nanny.photos.map((p) => (
              <MediaCard
                key={p._id}
                item={p}
                kind="photo"
                reasons={reasons}
                full={nanny.featuredPhotos >= limits.photos}
                onApprove={(feature) => onAction.approve(nanny, 'photos', p, feature)}
                onReject={(reason, detail) => onAction.reject(nanny, 'photos', p, reason, detail)}
              />
            ))}
            {/* `full` is never true for a headshot: only one can be in use,
                and choosing a new one replaces the old rather than being
                refused for lack of room. */}
            {(nanny.profilePictures || []).map((p) => (
              <MediaCard
                key={p._id}
                item={p}
                kind="profile picture"
                reasons={reasons}
                full={false}
                onApprove={(feature) => onAction.approve(nanny, 'profile-pictures', p, feature)}
                onReject={(reason, detail) => onAction.reject(nanny, 'profile-pictures', p, reason, detail)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MediaQueue() {
  const { toast, notify, error: toastError } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api('/media-queue'));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onAction = {
    approve: async (nanny, kind, item, feature) => {
      try {
        await api(`/nannies/${nanny._id}/${kind}/${item._id}`, {
          method: 'PATCH',
          body: feature ? { approved: true, featured: true } : { approved: true },
        });
        notify(feature ? 'Approved and now on her profile.' : 'Approved.');
        await load();
      } catch (e) {
        toastError(e.message);
      }
    },
    reject: async (nanny, kind, item, reasons, note) => {
      try {
        await api(`/nannies/${nanny._id}/${kind}/${item._id}/reject`, {
          method: 'POST', body: { reasons, note },
        });
        notify('Moved to Video Not Passed — she has been told why.');
        await load();
      } catch (e) {
        toastError(e.message);
      }
    },
  };

  const items = data?.items || [];
  const limits = data?.limits || { videos: 2, photos: 6 };
  // Defined by the server, so the labels a reviewer ticks cannot drift from
  // the wording she is actually sent.
  const reasons = data?.reasons || [];

  return (
    <div>
      {toast}

      <PageHeader
        title="Videos to be approved"
        subtitle={data
          ? `${data.waiting} item${data.waiting === 1 ? '' : 's'} from ${data.total} nann${data.total === 1 ? 'y' : 'ies'}`
          : 'Photos and videos waiting to be reviewed'}
      />

      {error && <ErrorBox error={error} onRetry={load} />}
      {loading && <Skeleton rows={4} />}

      {!loading && !error && (
        items.length === 0 ? (
          <p className="text-sm text-slate-600 rounded-lg border border-dashed border-ink-800 px-3 py-12 text-center">
            Nothing is waiting. Everything sent has been reviewed.
          </p>
        ) : (
          <div className="space-y-4">
            {items.map((n) => (
              <NannyRow key={n._id} nanny={n} limits={limits} reasons={reasons} onAction={onAction} />
            ))}
          </div>
        )
      )}
    </div>
  );
}
