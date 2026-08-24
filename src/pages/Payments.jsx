import { useEffect, useState } from 'react';
import api from '../lib/api.js';
import {
  PageHeader, Table, Badge, Tabs, StatCard, Pagination,
  useToast, ErrorBox, money, date, humanize,
} from '../components/ui.jsx';
import { IconPayments, IconDollar, IconClock, IconRefresh } from '../components/icons.jsx';

const TABS = [
  { value: 'family', label: 'Family Payments' },
  { value: 'nanny', label: 'Nanny Payments' },
  { value: 'refunds', label: 'Refunds' },
];

export default function Payments() {
  const { toast, notify, error: toastError } = useToast();
  const [tab, setTab] = useState('family');
  const [summary, setSummary] = useState(null);
  const [data, setData] = useState({ items: [], total: 0, pages: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    const qs = new URLSearchParams({ page, limit: 25 });
    // Nanny money lives in /payouts; family money and refunds in /payments.
    if (tab === 'refunds') qs.set('kind', 'refund');
    const path = tab === 'nanny' ? '/payouts' : '/payments';

    Promise.all([api(`${path}?${qs}`), api('/payments/summary')])
      .then(([rows, s]) => { setData(rows); setSummary(s); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [tab, page]);

  const release = async (id) => {
    try {
      await api(`/payouts/${id}/release`, { method: 'POST' });
      notify('Payout released.');
      load();
    } catch (e) {
      toastError(e.message);
    }
  };

  const familyColumns = [
    {
      key: 'id', header: 'Payment ID',
      render: (p) => <span className="font-mono text-xs text-brand-400">{p.reference || `PAY-${String(p._id).slice(-5).toUpperCase()}`}</span>,
    },
    {
      key: 'booking', header: 'Booking ID',
      render: (p) => <span className="font-mono text-xs">{p.booking?.bookingNumber ? `#${p.booking.bookingNumber}` : '—'}</span>,
    },
    { key: 'family', header: 'Family', render: (p) => p.family?.fullName || '—' },
    { key: 'nanny', header: 'Nanny', render: (p) => p.booking?.nanny?.fullName || '—' },
    { key: 'amount', header: 'Amount', render: (p) => <span className="font-mono text-xs">{money(p.amount)}</span> },
    {
      key: 'method', header: 'Method',
      render: (p) => <span className="text-xs text-slate-400">{p.method ? humanize(p.method) : '—'}</span>,
    },
    { key: 'date', header: 'Date', render: (p) => <span className="font-mono text-xs">{date(p.createdAt)}</span> },
    { key: 'status', header: 'Status', render: (p) => <Badge value={p.status} /> },
  ];

  const nannyColumns = [
    {
      key: 'id', header: 'Payout ID',
      render: (p) => <span className="font-mono text-xs text-brand-400">{p.reference || `PO-${String(p._id).slice(-5).toUpperCase()}`}</span>,
    },
    {
      key: 'booking', header: 'Booking ID',
      render: (p) => <span className="font-mono text-xs">{p.booking?.bookingNumber ? `#${p.booking.bookingNumber}` : '—'}</span>,
    },
    { key: 'nanny', header: 'Nanny', render: (p) => p.nanny?.fullName || '—' },
    { key: 'amount', header: 'Amount', render: (p) => <span className="font-mono text-xs">{money(p.amount)}</span> },
    {
      key: 'scheduled', header: 'Scheduled For',
      render: (p) => <span className="font-mono text-xs">{date(p.scheduledFor)}</span>,
    },
    { key: 'status', header: 'Status', render: (p) => <Badge value={p.status} /> },
    {
      key: 'action', header: '',
      render: (p) => (p.status === 'pending' ? (
        <button
          onClick={(e) => { e.stopPropagation(); release(p._id); }}
          className="text-xs font-medium text-brand-400 hover:text-brand-300"
        >
          Release
        </button>
      ) : null),
    },
  ];

  if (error) return <ErrorBox error={error} onRetry={load} />;

  return (
    <>
      <PageHeader title="Payments" subtitle="Global payment centre — family & nanny transactions" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <StatCard
          label="Family Payments Allocated This Week"
          value={money(summary?.familyPaymentsThisWeek?.total)}
          hint={`${summary?.familyPaymentsThisWeek?.count || 0} transactions`}
          icon={<IconPayments size={17} />} tone="blue"
        />
        <StatCard
          label="Nanny Payments Allocated This Week"
          value={money(summary?.nannyPaymentsThisWeek?.total)}
          hint={`${summary?.nannyPaymentsThisWeek?.count || 0} pending/done`}
          icon={<IconDollar size={17} />} tone="emerald"
        />
        <StatCard
          label="Nanny Payments to Be Released Next Monday"
          value={money(summary?.nextMondayRelease?.total)}
          hint={summary?.nextMondayRelease?.date
            ? `${summary.nextMondayRelease.count} awaiting ${date(summary.nextMondayRelease.date)}`
            : 'awaiting Monday release'}
          icon={<IconClock size={17} />} tone="amber"
        />
        <StatCard
          label="Refunds In Process"
          value={summary?.refundsInProcess?.count ?? 0}
          hint={`${money(summary?.refundsInProcess?.total)} total`}
          icon={<IconRefresh size={17} />} tone="violet"
        />
      </div>

      <Tabs tabs={TABS} active={tab} onChange={(v) => { setTab(v); setPage(1); }} />

      <Table
        columns={tab === 'nanny' ? nannyColumns : familyColumns}
        rows={data.items || []}
        loading={loading}
        empty={tab === 'refunds' ? 'No refunds yet.' : 'No transactions yet.'}
      />
      <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />

      {toast}
    </>
  );
}
