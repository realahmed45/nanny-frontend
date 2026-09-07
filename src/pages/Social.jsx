import { useEffect, useState } from 'react';
import api from '../lib/api.js';
import {
  PageHeader, Skeleton, ErrorBox, Avatar, Pagination, useToast, dateTime, LastActive,
} from '../components/ui.jsx';

/**
 * Who has followed us on Instagram and saved our number, and the discount it
 * earns them.
 *
 * Neither half can be checked automatically — Instagram will not tell us who
 * follows, and nothing can see whether someone saved a contact — so this is
 * built for the eyeball check it actually is: the handle is a link that opens
 * their profile, the two switches are one click each, and the discount starts
 * the moment the second one goes green.
 */

const FILTERS = [
  { value: 'waiting', label: 'Needs checking' },
  { value: 'verified', label: 'Both done' },
  { value: '', label: 'Everyone' },
];

/** Days left, or why there are none. */
function DiscountCell({ discount }) {
  if (!discount) return <span className="text-slate-600 text-xs">—</span>;

  if (discount.active) {
    const days = Math.max(0, Math.ceil((new Date(discount.expiresAt) - Date.now()) / 86400000));
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        {days === 0 ? 'Ends today' : `${days} day${days === 1 ? '' : 's'} left`}
      </span>
    );
  }

  const REASON = {
    not_verified: 'Not yet',
    expired: 'Expired',
    cancelled: 'Revoked',
    disabled: 'Turned off',
  };
  return (
    <span className="text-xs text-slate-500">{REASON[discount.reason] || '—'}</span>
  );
}

/** One of the two checks, as a switch that says who confirmed it. */
function Check({ on, label, at, onToggle, busy }) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onToggle}
      title={at ? `Confirmed ${dateTime(at)}` : `Mark ${label} as done`}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors disabled:opacity-50 ${
        on
          ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
          : 'bg-ink-800 text-slate-500 hover:bg-ink-700 hover:text-slate-300'
      }`}
    >
      <span>{on ? '✓' : '○'}</span>
      {label}
    </button>
  );
}

function Row({ user, onChange }) {
  const [busy, setBusy] = useState(false);
  const [handle, setHandle] = useState(user.social?.instagramHandle || '');
  const [editing, setEditing] = useState(false);
  const s = user.social || {};

  const patch = async (body) => {
    setBusy(true);
    try {
      await onChange(user._id, body);
    } finally {
      setBusy(false);
    }
  };

  const saveHandle = async () => {
    setEditing(false);
    if (handle.trim() !== (s.instagramHandle || '')) await patch({ instagramHandle: handle.trim() });
  };

  return (
    <div className="rounded-lg border border-ink-800 bg-ink-950/40 p-3">
      <div className="flex items-start gap-3">
        <Avatar name={user.fullName} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-white truncate">{user.nickname || user.fullName || 'Unnamed'}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-ink-800 text-slate-400">
              {user.role === 'nanny' ? 'Nanny' : 'Family/Customer'}
            </span>
            <DiscountCell discount={user.discount} />
          </div>

          <div className="text-[11px] font-mono text-slate-500 mt-0.5">{user.phone}</div>

          <div className="mt-1"><LastActive at={user.lastSeenAt} /></div>

          {/* The handle, editable inline — it is how the check is actually done. */}
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {editing ? (
              <input
                autoFocus
                className="input text-xs w-44"
                placeholder="instagram handle"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                onBlur={saveHandle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); saveHandle(); }
                  if (e.key === 'Escape') { setHandle(s.instagramHandle || ''); setEditing(false); }
                }}
              />
            ) : s.instagramHandle ? (
              <span className="inline-flex items-center gap-1">
                <a
                  href={`https://instagram.com/${s.instagramHandle}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-brand-400 hover:underline"
                >
                  @{s.instagramHandle}
                </a>
                <button className="text-[10px] text-slate-600 hover:text-slate-400" onClick={() => setEditing(true)}>
                  edit
                </button>
              </span>
            ) : (
              <button className="text-xs text-slate-600 hover:text-slate-400" onClick={() => setEditing(true)}>
                + add handle
              </button>
            )}

            <Check
              on={!!s.instagramFollowing}
              at={s.instagramVerifiedAt}
              label="Follows us"
              busy={busy}
              onToggle={() => patch({ instagramFollowing: !s.instagramFollowing })}
            />
            <Check
              on={!!s.whatsappSaved}
              at={s.whatsappVerifiedAt}
              label="Saved our number"
              busy={busy}
              onToggle={() => patch({ whatsappSaved: !s.whatsappSaved })}
            />

            {/* Only offered once there is something to revoke. */}
            {s.discountStartedAt && !s.discountCancelled && (
              <button
                className="text-[11px] text-slate-600 hover:text-red-400"
                disabled={busy}
                onClick={() => patch({ discountCancelled: true })}
              >
                Revoke discount
              </button>
            )}
            {s.discountCancelled && (
              <button
                className="text-[11px] text-slate-600 hover:text-emerald-400"
                disabled={busy}
                onClick={() => patch({ discountCancelled: false })}
              >
                Restore discount
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Social() {
  const { toast, notify, error: toastError } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('waiting');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page) });
    if (status) params.set('status', status);
    if (query) params.set('search', query);
    try {
      setData(await api(`/social?${params}`));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page, status, query]);

  const change = async (id, body) => {
    try {
      const res = await api(`/social/${id}`, { method: 'PATCH', body });
      if (res.discount?.active && body.instagramFollowing !== false && body.whatsappSaved !== false) {
        notify('Both confirmed — the discount is running and they have been told.');
      }
      await load();
    } catch (e) {
      toastError(e.message);
    }
  };

  const items = data?.items || [];
  const cfg = data?.config;

  return (
    <div>
      {toast}

      <PageHeader
        title="Follow & Save"
        subtitle={cfg
          ? `${cfg.validityDays}-day discount for following us on Instagram and saving our number`
          : 'Instagram follows and saved numbers'}
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => { setStatus(f.value); setPage(1); }}
            className={`text-xs rounded-full px-3 py-1.5 ${
              status === f.value
                ? 'bg-brand-500/20 text-brand-400'
                : 'bg-ink-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {f.label}
          </button>
        ))}

        <input
          className="input text-xs ml-auto w-56"
          placeholder="Name, phone or handle…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { setQuery(search.trim()); setPage(1); } }}
        />
      </div>

      {/* Both checks are somebody's judgement, so say so rather than implying
          the system knows. */}
      <p className="text-xs text-slate-600 mb-4">
        Instagram cannot tell us who follows, and nothing can see whether someone saved our
        number — so both are confirmed by hand here. The discount starts when the second one
        is ticked, and the customer is told straight away.
      </p>

      {error && <ErrorBox error={error} onRetry={load} />}
      {loading && <Skeleton rows={6} />}

      {!loading && !error && (
        items.length === 0 ? (
          <p className="text-sm text-slate-600 rounded-lg border border-dashed border-ink-800 px-3 py-10 text-center">
            {status === 'waiting' ? 'Nobody is waiting to be checked.' : 'Nobody here yet.'}
          </p>
        ) : (
          <>
            <div className="space-y-2">
              {items.map((u) => <Row key={u._id} user={u} onChange={change} />)}
            </div>
            <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />
          </>
        )
      )}
    </div>
  );
}
