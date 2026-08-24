import { useEffect, useState } from 'react';

/* ------------------------------------------------------------------ *
 * Status badges — colour-coded to match the chatbot's own vocabulary.
 * ------------------------------------------------------------------ */

const BADGE_STYLES = {
  // Booking statuses
  upcoming: 'bg-amber-100 text-amber-800',
  ongoing: 'bg-blue-100 text-blue-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-800',
  draft: 'bg-slate-100 text-slate-700',
  pending_payment: 'bg-orange-100 text-orange-800',
  pending_additional_payment: 'bg-orange-100 text-orange-800',
  // Nanny statuses
  verified: 'bg-emerald-100 text-emerald-800',
  pending_verification: 'bg-amber-100 text-amber-800',
  rejected: 'bg-red-100 text-red-800',
  suspended: 'bg-red-100 text-red-800',
  // Payments
  payment_completed: 'bg-emerald-100 text-emerald-800',
  payment_in_process: 'bg-amber-100 text-amber-800',
  refund_in_process: 'bg-orange-100 text-orange-800',
  refunded: 'bg-slate-100 text-slate-700',
  payment_failed: 'bg-red-100 text-red-800',
  // Payouts
  pending: 'bg-amber-100 text-amber-800',
  processing: 'bg-blue-100 text-blue-800',
  final_payment_done: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-red-100 text-red-800',
  // Tickets
  open: 'bg-amber-100 text-amber-800',
  in_progress: 'bg-blue-100 text-blue-800',
  resolved: 'bg-emerald-100 text-emerald-800',
  closed: 'bg-slate-100 text-slate-700',
  urgent: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-slate-100 text-slate-700',
};

export function Badge({ value, children }) {
  const key = String(value || '').toLowerCase();
  const style = BADGE_STYLES[key] || 'bg-slate-100 text-slate-700';
  return <span className={`badge ${style}`}>{children ?? humanize(value)}</span>;
}

export const humanize = (s) =>
  String(s || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

/* ------------------------------------------------------------------ *
 * Formatting
 * ------------------------------------------------------------------ */

export const money = (n, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 })
    .format(Number(n || 0));

export const date = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export const dateTime = (d) =>
  d ? new Date(d).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

/* ------------------------------------------------------------------ *
 * Layout primitives
 * ------------------------------------------------------------------ */

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, tone = 'default', icon }) {
  const tones = {
    default: 'text-slate-900',
    positive: 'text-emerald-600',
    negative: 'text-red-600',
    warn: 'text-amber-600',
    brand: 'text-brand-600',
  };
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {icon && <span className="text-lg" aria-hidden="true">{icon}</span>}
      </div>
      <p className={`text-2xl font-semibold mt-2 ${tones[tone]}`}>{value}</p>
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

export function Table({ columns, rows, empty = 'No records found.', onRowClick, loading }) {
  if (loading) return <Skeleton rows={5} />;
  if (!rows?.length) {
    return (
      <div className="card p-10 text-center text-sm text-slate-500">{empty}</div>
    );
  }
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>{columns.map((c) => <th key={c.key} className="th">{c.header}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, i) => (
              <tr
                key={row._id || i}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={onRowClick ? 'cursor-pointer hover:bg-slate-50' : undefined}
              >
                {columns.map((c) => (
                  <td key={c.key} className="td">{c.render ? c.render(row) : row[c.key] ?? '—'}</td>
                ))}
              </tr>
            ))}
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
        <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
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

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-slate-200 mb-5">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            active === t.value
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          {t.label}
          {t.count !== undefined && (
            <span className="ml-2 text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, title, onClose, children, footer }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative card w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

/** Small toast used for action feedback. */
export function useToast() {
  const [toast, setToast] = useState(null);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const node = toast ? (
    <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
      toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-slate-900 text-white'
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
    <div className="card p-5 border-red-200 bg-red-50">
      <p className="text-sm text-red-800 font-medium">{error}</p>
      {onRetry && <button className="btn-ghost mt-3" onClick={onRetry}>Try again</button>}
    </div>
  );
}
