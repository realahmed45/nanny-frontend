import { useEffect, useState, useCallback } from 'react';
import api from '../lib/api.js';
import {
  PageHeader, Table, Badge, Pagination, Tabs, StatCard, ErrorBox,
  useToast, money, date, dateTime, humanize,
} from '../components/ui.jsx';

const PAYMENT_TABS = [
  { value: '', label: 'All' },
  { value: 'payment_completed', label: 'Completed' },
  { value: 'payment_in_process', label: 'In Process' },
  { value: 'refund_in_process', label: 'Refund In Process' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'payment_failed', label: 'Failed' },
];

const PAYOUT_TABS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'final_payment_done', label: 'Final Done' },
  { value: 'failed', label: 'Failed' },
];

export default function Payments() {
  const [view, setView] = useState('incoming');   // incoming = families, outgoing = nannies
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { toast, notify, error: notifyError } = useToast();

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    const path = view === 'incoming' ? '/payments' : '/payouts';
    api(path, { params: { status, page, limit: 20 } })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [view, status, page]);

  useEffect(load, [load]);
  useEffect(() => { api('/payments/summary').then(setSummary).catch(() => {}); }, []);

  const releaseAll = async () => {
    if (!window.confirm('Release all payouts that are due now?')) return;
    try {
      const res = await api('/payouts/release', { method: 'POST' });
      notify(`Released ${res.released} payout(s).`);
      load();
    } catch (e) {
      notifyError(e.message);
    }
  };

  const paymentColumns = [
    { key: 'reference', header: 'Reference', render: (r) => (
      <div>
        <p className="font-medium text-slate-900">{r.reference}</p>
        <p className="text-xs text-slate-500">{humanize(r.kind)}</p>
      </div>
    ) },
    { key: 'family', header: 'Family', render: (r) => r.family?.fullName || '—' },
    { key: 'booking', header: 'Booking', render: (r) => r.booking ? `#${r.booking.bookingNumber}` : '—' },
    { key: 'amount', header: 'Amount', render: (r) => money(r.amount) },
    { key: 'method', header: 'Method', render: (r) => humanize(r.method) },
    { key: 'status', header: 'Status', render: (r) => <Badge value={r.status} /> },
    { key: 'createdAt', header: 'Date', render: (r) => dateTime(r.createdAt) },
  ];

  const payoutColumns = [
    { key: 'reference', header: 'Reference', render: (r) => (
      <div>
        <p className="font-medium text-slate-900">{r.reference}</p>
        {r.isFinalForBooking && <p className="text-xs text-emerald-600">Final payment</p>}
      </div>
    ) },
    { key: 'nanny', header: 'Nanny', render: (r) => r.nanny?.fullName || '—' },
    { key: 'booking', header: 'Booking', render: (r) => r.booking ? `#${r.booking.bookingNumber}` : '—' },
    { key: 'amount', header: 'Amount', render: (r) => money(r.amount) },
    { key: 'status', header: 'Status', render: (r) => <Badge value={r.status} /> },
    { key: 'scheduledFor', header: 'Scheduled', render: (r) => date(r.scheduledFor) },
    { key: 'releasedAt', header: 'Released', render: (r) => r.releasedAt ? date(r.releasedAt) : '—' },
  ];

  return (
    <>
      <PageHeader
        title="Payments"
        subtitle="Family payments in, nanny payouts out — released every Monday"
        actions={view === 'outgoing' && (
          <button className="btn-primary" onClick={releaseAll}>Release due payouts</button>
        )}
      />

      {/* Summary cards per the 8/11 spec update. */}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-3 mb-6">
          <StatCard
            label="Family payments allocated this week"
            value={money(summary.familyPaymentsThisWeek.total)}
            hint={`${summary.familyPaymentsThisWeek.count} payment(s)`}
            tone="positive" icon="💳"
          />
          <StatCard
            label="Nanny payments allocated this week"
            value={money(summary.nannyPaymentsThisWeek.total)}
            hint={`${summary.nannyPaymentsThisWeek.count} payout(s)`}
            tone="brand" icon="👩"
          />
          <StatCard
            label="Delete pending Nanny"
            value={summary.deletePendingNanny.count}
            hint="Nannies awaiting verification"
            tone={summary.deletePendingNanny.count > 0 ? 'warn' : 'default'} icon="⏳"
          />
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <button
          className={view === 'incoming' ? 'btn-primary' : 'btn-ghost'}
          onClick={() => { setView('incoming'); setStatus(''); setPage(1); }}
        >
          Family Payments
        </button>
        <button
          className={view === 'outgoing' ? 'btn-primary' : 'btn-ghost'}
          onClick={() => { setView('outgoing'); setStatus(''); setPage(1); }}
        >
          Nanny Payouts
        </button>
      </div>

      <Tabs
        tabs={view === 'incoming' ? PAYMENT_TABS : PAYOUT_TABS}
        active={status}
        onChange={(v) => { setStatus(v); setPage(1); }}
      />

      <ErrorBox error={error} onRetry={load} />
      {!error && (
        <>
          <Table
            columns={view === 'incoming' ? paymentColumns : payoutColumns}
            rows={data?.items}
            loading={loading}
            empty="No records found."
          />
          <Pagination page={data?.page} pages={data?.pages} total={data?.total} onChange={setPage} />
        </>
      )}

      {toast}
    </>
  );
}
