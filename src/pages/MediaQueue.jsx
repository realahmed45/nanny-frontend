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
 * Rejecting demands a reason, and the reason is sent to her. A nanny cannot
 * send a better photo if nobody tells her what was wrong with this one.
 */

const REASONS = [
  { value: 'bad_quality', label: 'Bad quality', hint: 'Blurry, dark, or hard to make out' },
  { value: 'misconduct', label: 'Misconduct', hint: 'Not suitable for a public profile' },
  { value: 'other', label: 'Other reason', hint: 'You will write what to tell her' },
];

/** The reject panel — a reason is required, and "Other" needs words. */
function RejectBox({ onCancel, onConfirm, busy }) {
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');

  const needsDetail = reason === 'other';
  const ready = reason && (!needsDetail || detail.trim());

  return (
    <div className="mt-2 rounded-lg border border-red-900/60 bg-red-950/20 p-2.5">
      <p className="text-[11px] text-slate-400 mb-2">Why is it being turned down?</p>

      <div className="space-y-1">
        {REASONS.map((r) => (
          <label key={r.value} className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              className="mt-1 accent-red-500"
              checked={reason === r.value}
              onChange={() => setReason(r.value)}
            />
            <span>
              <span className="text-xs text-slate-200">{r.label}</span>
              <span className="block text-[10px] text-slate-500">{r.hint}</span>
            </span>
          </label>
        ))}
      </div>

      {needsDetail && (
        <textarea
          autoFocus
          rows={2}
          className="input text-xs w-full mt-2"
          placeholder="What should she be told? She sees this."
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
        />
      )}

      <div className="flex gap-2 mt-2">
        <button
          className="btn-ghost text-xs text-red-400"
          disabled={!ready || busy}
          onClick={() => onConfirm(reason, detail.trim())}
        >
          {busy ? 'Sending…' : 'Reject & tell her'}
        </button>
        <button className="btn-ghost text-xs" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/** One pending item: the media, then approve / reject. */
function MediaCard({ item, kind, full, onApprove, onReject }) {
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (fn) => {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  return (
    <div className="w-52 shrink-0 rounded-lg border border-ink-800 bg-ink-950/60 p-2">
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

      {rejecting ? (
        <RejectBox
          busy={busy}
          onCancel={() => setRejecting(false)}
          onConfirm={(reason, detail) => run(() => onReject(reason, detail))}
        />
      ) : (
        <div className="mt-2 space-y-1.5">
          {/* Approving and featuring in one action, because at the moment of
              judging it the reviewer already knows whether it is good enough
              to show. Disabled — not hidden — when the profile is full, so
              the reason is visible. */}
          <button
            className="btn-ghost text-xs w-full"
            disabled={busy}
            onClick={() => run(() => onApprove(false))}
          >
            Approve
          </button>
          <button
            className="btn-ghost text-xs w-full text-emerald-400 disabled:opacity-40"
            disabled={busy || full}
            title={full ? 'Her profile is already full for this kind' : 'Approve and show it on her profile'}
            onClick={() => run(() => onApprove(true))}
          >
            Approve + show on profile
          </button>
          <button
            className="btn-ghost text-xs w-full text-red-400"
            disabled={busy}
            onClick={() => setRejecting(true)}
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

/** One nanny: her details on the left, everything she sent on the right. */
function NannyRow({ nanny, limits, onAction }) {
  const waiting = nanny.videos.length + nanny.photos.length;

  return (
    <div className="rounded-xl border border-ink-800 bg-ink-950/40 p-4">
      <div className="flex gap-5">
        {/* Who sent it — kept beside the media, because the judgement is
            about her, not just the file. */}
        <div className="w-56 shrink-0">
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
          </p>

          <p className="mt-2 text-[11px] text-amber-400">
            {waiting} waiting
          </p>
        </div>

        {/* What she sent. Scrolls sideways rather than wrapping, so a nanny
            with twenty photos stays one row. */}
        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="flex gap-3 pb-1">
            {nanny.videos.map((v) => (
              <MediaCard
                key={v._id}
                item={v}
                kind="video"
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
                full={nanny.featuredPhotos >= limits.photos}
                onApprove={(feature) => onAction.approve(nanny, 'photos', p, feature)}
                onReject={(reason, detail) => onAction.reject(nanny, 'photos', p, reason, detail)}
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
    reject: async (nanny, kind, item, reason, detail) => {
      try {
        await api(`/nannies/${nanny._id}/${kind}/${item._id}/reject`, {
          method: 'POST', body: { reason, detail },
        });
        notify('Rejected — she has been told why.');
        await load();
      } catch (e) {
        toastError(e.message);
      }
    },
  };

  const items = data?.items || [];
  const limits = data?.limits || { videos: 2, photos: 6 };

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
              <NannyRow key={n._id} nanny={n} limits={limits} onAction={onAction} />
            ))}
          </div>
        )
      )}
    </div>
  );
}
