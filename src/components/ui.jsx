import { useEffect, useState } from 'react';

/* ------------------------------------------------------------------ *
 * Status badges — outlined pills, colour-coded to the chatbot's own
 * vocabulary so a status reads the same here as it does in WhatsApp.
 * ------------------------------------------------------------------ */

const BADGE_STYLES = {
  // Booking
  upcoming: 'bg-violet-500/10 text-violet-300 border-violet-500/30',
  ongoing: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
  completed: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  cancelled: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  replacement_needed: 'bg-red-500/10 text-red-300 border-red-500/40',
  draft: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  pending_payment: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
  pending_additional_payment: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
  // Nanny / account
  verified: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  pending_verification: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  pending: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  rejected: 'bg-red-500/10 text-red-300 border-red-500/40',
  suspended: 'bg-red-500/10 text-red-300 border-red-500/40',
  active: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  blocked: 'bg-red-500/10 text-red-300 border-red-500/40',
  available: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  partially_booked: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
  unavailable: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  // Payments
  paid: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  payment_completed: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  payment_in_process: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  in_process: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  refund_in_process: 'bg-violet-500/10 text-violet-300 border-violet-500/30',
  refunded: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  payment_failed: 'bg-red-500/10 text-red-300 border-red-500/40',
  processing: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
  final_payment_done: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  failed: 'bg-red-500/10 text-red-300 border-red-500/40',
  // Tickets
  open: 'bg-red-500/10 text-red-300 border-red-500/40',
  in_progress: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  resolved: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  closed: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  successful: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  invited: 'bg-violet-500/10 text-violet-300 border-violet-500/30',
  // Roles
  family: 'bg-violet-500/10 text-violet-300 border-violet-500/30',
  nanny: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
};

/** Shorter labels where the raw enum reads awkwardly in a table cell. */
const BADGE_LABELS = {
  payment_completed: 'Paid',
  payment_in_process: 'In Process',
  payment_failed: 'Failed',
  pending_verification: 'Pending',
  final_payment_done: 'Paid Out',
};

export function Badge({ value, children, className = '' }) {
  const key = String(value || '').toLowerCase();
  const style = BADGE_STYLES[key] || 'bg-slate-500/10 text-slate-400 border-slate-500/30';
  return (
    <span className={`badge ${style} ${className}`}>
      {children ?? BADGE_LABELS[key] ?? humanize(value)}
    </span>
  );
}

/** Coloured dot + label used for ticket priority in the design. */
const PRIORITY_TONE = {
  urgent: ['text-red-400', 'bg-red-400'],
  critical: ['text-red-400', 'bg-red-400'],
  high: ['text-orange-400', 'bg-orange-400'],
  medium: ['text-amber-400', 'bg-amber-400'],
  low: ['text-slate-400', 'bg-slate-400'],
};

export function Priority({ value }) {
  const key = String(value || 'low').toLowerCase();
  const [text, dot] = PRIORITY_TONE[key] || PRIORITY_TONE.low;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-mono ${text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {humanize(key)}
    </span>
  );
}

export const humanize = (s) =>
  String(s || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

/* ------------------------------------------------------------------ *
 * Formatting
 * ------------------------------------------------------------------ */

/**
 * The platform currency, read once from /settings and cached.
 *
 * The dashboard renders money in many places; threading a currency prop
 * through each of them would be noise, and hardcoding USD showed the wrong
 * symbol everywhere the moment the platform switched to rupiah.
 */
// The platform runs in rupiah, so that is the default rather than USD.
// /settings can still override it, but the wrong symbol must never flash on
// screen while that request is in flight.
/** Symbols people actually recognise, where Intl's default is not it. */
const SYMBOLS = { IDR: 'Rp' };

let activeCurrency = 'IDR';

/**
 * Every amount the API sends is a rupiah figure. A different currency code
 * would not convert them, only relabel them — which is how the calendar came
 * to read "USD 16,220,000" for a day worth Rp 16,220,000. So a setting we do
 * not have a symbol for is refused rather than displayed.
 */
export const setCurrency = (c) => {
  const want = String(c || '').trim().toUpperCase();
  if (!want) return;
  if (!SYMBOLS[want]) {
    console.warn(`[ui] currency ${want} ignored — amounts are rupiah; showing Rp.`);
    return;
  }
  activeCurrency = want;
};

export const money = (n, currency = activeCurrency) => {
  const value = Number(n || 0);

  // Intl renders IDR as "IDR 147,000"; in Indonesia it is written "Rp 147,000".
  // Anything else falls back to its own code rather than going through Intl,
  // which would render a currency symbol — and a dollar sign on a rupiah
  // platform is how a price gets misread by a factor of fifteen thousand.
  const symbol = SYMBOLS[currency] || SYMBOLS.IDR;
  return `${symbol} ${Math.round(value).toLocaleString('en-US')}`;
};

export const date = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export const shortDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : '—';

export const dateTime = (d) =>
  d ? new Date(d).toLocaleString('en-US', {
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  }) : '—';

/** "2h", "3d" — the age column on tickets. */
export const age = (d) => {
  if (!d) return '—';
  const mins = Math.floor((Date.now() - new Date(d)) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h`;
  return `${Math.floor(mins / 1440)}d`;
};

/** Initials avatar — the coloured circle beside names in the design. */
const AVATAR_TONES = [
  'bg-blue-500/20 text-blue-300', 'bg-violet-500/20 text-violet-300',
  'bg-emerald-500/20 text-emerald-300', 'bg-amber-500/20 text-amber-300',
  'bg-rose-500/20 text-rose-300', 'bg-cyan-500/20 text-cyan-300',
];

export function Avatar({ name, size = 'md' }) {
  const initial = String(name || '?').trim().charAt(0).toUpperCase();
  // Stable colour per name, so a person keeps the same avatar everywhere.
  const tone = AVATAR_TONES[
    String(name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TONES.length
  ];
  const dims = size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-xs';
  return (
    <span className={`${dims} ${tone} rounded-full inline-flex items-center justify-center font-semibold shrink-0`}>
      {initial}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Layout primitives
 * ------------------------------------------------------------------ */

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

const STAT_TONES = {
  default: 'bg-ink-800 text-slate-400',
  blue: 'bg-blue-500/15 text-blue-400',
  violet: 'bg-violet-500/15 text-violet-400',
  emerald: 'bg-emerald-500/15 text-emerald-400',
  amber: 'bg-amber-500/15 text-amber-400',
  red: 'bg-red-500/15 text-red-400',
};

export function StatCard({ label, value, hint, icon, tone = 'default' }) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500">{label}</p>
        {icon && (
          <span className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 ${STAT_TONES[tone]}`}>
            {icon}
          </span>
        )}
      </div>
      <p className="text-3xl font-semibold text-white mt-2 leading-none">{value}</p>
      {hint && <p className="text-xs text-slate-500 mt-2">{hint}</p>}
    </div>
  );
}

/**
 * A checkbox that can also show a partial state, for "some rows selected".
 * Rendered rather than using indeterminate, which cannot be set declaratively.
 */
function SelectBox({ checked, partial, onChange, label }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={partial ? 'mixed' : checked}
      aria-label={label}
      onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
      className={`w-4 h-4 rounded border grid place-items-center transition-colors ${
        checked || partial
          ? 'bg-brand-600 border-brand-600'
          : 'border-ink-600 hover:border-slate-500'
      }`}
    >
      {partial ? (
        <span className="w-2 h-0.5 bg-white rounded" />
      ) : checked ? (
        <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="white" strokeWidth="2">
          <path d="M2 6.5 4.5 9 10 3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </button>
  );
}

/**
 * `selectable` turns on a leading checkbox column. The parent owns the
 * selection so it can act on it — the table only reports what changed.
 */
export function Table({
  columns, rows, empty = 'No records found.', onRowClick, loading, dense,
  selectable = false, selected = [], onSelectionChange,
  // Row numbers are on by default; `startIndex` keeps them counting across
  // pages, so row 1 of page 2 reads as 26 rather than starting over.
  numbered = true, startIndex = 0,
}) {
  if (loading) return <Skeleton rows={5} />;
  if (!rows?.length) {
    return <div className="card p-12 text-center text-sm text-slate-500">{empty}</div>;
  }

  const ids = rows.map((r) => String(r._id));
  const selectedSet = new Set(selected.map(String));
  const shown = ids.filter((id) => selectedSet.has(id));
  const allShown = shown.length === ids.length && ids.length > 0;

  const toggleAll = (next) => {
    if (!onSelectionChange) return;
    // Only the rows on screen change; a selection made on another page stays.
    const others = selected.map(String).filter((id) => !ids.includes(id));
    onSelectionChange(next ? [...others, ...ids] : others);
  };

  const toggleRow = (id, next) => {
    if (!onSelectionChange) return;
    const asStrings = selected.map(String);
    onSelectionChange(next ? [...asStrings, id] : asStrings.filter((x) => x !== id));
  };

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-ink-800">
            <tr>
              {selectable && (
                <th className={`th w-8 ${dense ? 'px-2.5' : ''}`}>
                  <SelectBox
                    checked={allShown}
                    partial={shown.length > 0 && !allShown}
                    onChange={toggleAll}
                    label="Select all rows"
                  />
                </th>
              )}
              {numbered && (
                <th className={`th w-10 text-right ${dense ? 'px-2.5' : ''}`}>#</th>
              )}
              {columns.map((c) => (
                <th key={c.key} className={`th whitespace-nowrap ${dense ? 'px-2.5' : ''}`}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-800">
            {rows.map((row, i) => {
              const id = String(row._id);
              const isSelected = selectedSet.has(id);
              return (
                <tr
                  key={row._id || i}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`${onRowClick ? 'cursor-pointer transition-colors hover:bg-ink-800/60' : ''} ${
                    isSelected ? 'bg-brand-600/10' : ''
                  }`}
                >
                  {selectable && (
                    <td className={`td w-8 ${dense ? 'px-2.5 py-3' : ''}`}>
                      <SelectBox
                        checked={isSelected}
                        onChange={(next) => toggleRow(id, next)}
                        label="Select row"
                      />
                    </td>
                  )}
                  {numbered && (
                    <td className={`td w-10 text-right font-mono text-xs text-slate-500 ${dense ? 'px-2.5 py-3' : ''}`}>
                      {startIndex + i + 1}
                    </td>
                  )}
                  {columns.map((c) => (
                    <td key={c.key} className={`td ${dense ? 'px-2.5 py-3' : ''}`}>
                      {c.render ? c.render(row) : row[c.key] ?? '—'}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Skeleton({ rows = 4 }) {
  return (
    <div className="card p-4 space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 bg-ink-800 rounded animate-pulse" />
      ))}
    </div>
  );
}

export function Pagination({ page, pages, total, onChange }) {
  if (!pages || pages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-4">
      <p className="text-sm text-slate-500">{total} records · page {page} of {pages}</p>
      <div className="flex gap-2">
        <button className="btn-ghost" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</button>
        <button className="btn-ghost" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</button>
      </div>
    </div>
  );
}

/** Pill-style filter row (Bookings, Support, Calendar). */
export function FilterPills({ options, active, onChange }) {
  return (
    <div className="flex flex-wrap gap-2 mb-5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            active === o.value
              ? 'bg-brand-600 text-white'
              : 'bg-ink-800 text-slate-400 hover:text-slate-200 hover:bg-ink-700'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Underlined tabs (Payments). */
export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex flex-wrap gap-6 border-b border-ink-800 mb-5">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={`pb-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
            active === t.value
              ? 'border-brand-500 text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          {t.label}
          {t.count !== undefined && (
            <span className="ml-2 text-xs text-slate-500">{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, title, onClose, children, footer, wide }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative card w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[85vh] flex flex-col shadow-2xl`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-800">
          <h3 className="font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl leading-none">&times;</button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-ink-800 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

/** Label/value row used throughout the detail modals. */
export function Field({ label, children }) {
  return (
    <div>
      <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1">{label}</p>
      <div className="text-sm text-slate-200">{children ?? '—'}</div>
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState(null);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const node = toast ? (
    <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-2xl text-sm font-medium border ${
      toast.type === 'error'
        ? 'bg-red-950 border-red-800 text-red-200'
        : 'bg-ink-800 border-ink-700 text-slate-100'
    }`}>
      {toast.message}
    </div>
  ) : null;

  return {
    toast: node,
    notify: (message) => setToast({ message, type: 'info' }),
    error: (message) => setToast({ message, type: 'error' }),
  };
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="card p-5 border-red-900/60 bg-red-950/30">
      <p className="text-sm text-red-300 font-medium">{error}</p>
      {onRetry && <button className="btn-ghost mt-3" onClick={onRetry}>Try again</button>}
    </div>
  );
}
