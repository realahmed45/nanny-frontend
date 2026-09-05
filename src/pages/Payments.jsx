import { useEffect, useState } from 'react';
import api from '../lib/api.js';
import {
  PageHeader, Table, Badge, Tabs, StatCard, Pagination, Modal, Field,
  useToast, ErrorBox, money, date, dateTime, humanize,
} from '../components/ui.jsx';
import {
  IconPayments, IconDollar, IconClock, IconRefresh, IconEye, IconCheck, IconX,
} from '../components/icons.jsx';

const TABS = [
  { value: 'review', label: 'Awaiting Review' },
  { value: 'family', label: 'Family/Customer Payments' },
  { value: 'nanny', label: 'Nanny Payouts' },
  { value: 'refunds', label: 'Refunds' },
];

export default function Payments() {
  const { toast, notify, error: toastError } = useToast();
  const [tab, setTab] = useState('review');
  const [summary, setSummary] = useState(null);
  const [data, setData] = useState({ items: [], total: 0, pages: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [checkedIds, setCheckedIds] = useState([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = () => {
    setLoading(true);
    const qs = new URLSearchParams({ page, limit: 25 });
    let path = '/payments';

    if (tab === 'nanny') path = '/payouts';
    else if (tab === 'refunds') qs.set('kind', 'refund');
    else if (tab === 'review') qs.set('status', 'payment_in_process');

    Promise.all([api(`${path}?${qs}`), api('/payments/summary')])
      .then(([rows, s]) => { setData(rows); setSummary(s); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { setCheckedIds([]); }, [tab, page]);
  useEffect(load, [tab, page]);

  const open = (row) => {
    setSelected(row);
    setNote('');
    setProofUrl('');
  };

  const act = async (path, body, message) => {
    setBusy(true);
    try {
      await api(path, { method: 'POST', body });
      notify(message);
      setSelected(null);
      load();
    } catch (e) {
      toastError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const approve = () => act(
    `/payments/${selected._id}/approve`, { note },
    'Payment approved — the nanny has been notified.',
  );

  const reject = () => {
    if (!note.trim()) {
      toastError('Please say why, so the family knows what to fix.');
      return;
    }
    act(`/payments/${selected._id}/reject`, { note: note.trim() },
      'Payment rejected — the family can send a new screenshot.');
  };

  const completeRefund = () => act(
    `/payments/${selected._id}/complete-refund`, { proofUrl, note },
    'Refund marked as sent.',
  );

  const markPayoutPaid = () => act(
    `/payouts/${selected._id}/mark-paid`, { proofUrl, note },
    'Payout marked as transferred.',
  );

  const approveSelected = async () => {
    if (!checkedIds.length) return;
    setBulkBusy(true);
    try {
      const res = await api('/payments/bulk-approve', {
        method: 'POST',
        body: { ids: checkedIds, note: 'Bulk approved from dashboard' },
      });
      // Say what actually happened: a silent partial success is worse than
      // none, since the admin would assume the whole batch went through.
      notify(
        res.skippedCount
          ? `Approved ${res.approvedCount}, skipped ${res.skippedCount}.`
          : `Approved ${res.approvedCount} payment${res.approvedCount === 1 ? '' : 's'}.`,
      );
      setCheckedIds([]);
      load();
    } catch (e) {
      toastError(e.message);
    } finally {
      setBulkBusy(false);
    }
  };

  const paymentColumns = [
    {
      key: 'id', header: 'Payment ID',
      render: (p) => <span className="font-mono text-xs text-brand-400">{p.reference}</span>,
    },
    {
      key: 'booking', header: 'Booking',
      render: (p) => <span className="font-mono text-xs">{p.booking?.bookingNumber ? `#${p.booking.bookingNumber}` : '—'}</span>,
    },
    { key: 'family', header: 'Family/Customer', render: (p) => p.family?.fullName || '—' },
    { key: 'amount', header: 'Amount', render: (p) => <span className="font-mono text-xs">{money(p.amount)}</span> },
    { key: 'kind', header: 'Type', render: (p) => <span className="text-xs">{humanize(p.kind)}</span> },
    {
      key: 'proof', header: 'Proof',
      render: (p) => (p.proof?.url
        ? <span className="inline-flex items-center gap-1 text-xs text-emerald-400"><IconCheck size={13} /> Attached</span>
        : <span className="text-xs text-slate-600">—</span>),
    },
    { key: 'date', header: 'Submitted', render: (p) => <span className="font-mono text-xs">{date(p.createdAt)}</span> },
    { key: 'status', header: 'Status', render: (p) => <Badge value={p.status} /> },
    {
      key: 'view', header: '',
      render: (p) => (
        <button
          onClick={(e) => { e.stopPropagation(); open(p); }}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-400 hover:text-brand-300"
        >
          <IconEye size={14} /> {p.status === 'payment_in_process' ? 'Review' : 'View'}
        </button>
      ),
    },
  ];

  const payoutColumns = [
    {
      key: 'id', header: 'Payout ID',
      render: (p) => <span className="font-mono text-xs text-brand-400">{p.reference}</span>,
    },
    {
      key: 'booking', header: 'Booking',
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
      render: (p) => (
        <button
          onClick={(e) => { e.stopPropagation(); open(p); }}
          className="text-xs font-medium text-brand-400 hover:text-brand-300"
        >
          {['pending', 'processing'].includes(p.status) ? 'Mark paid' : 'View'}
        </button>
      ),
    },
  ];

  if (error) return <ErrorBox error={error} onRetry={load} />;

  const isPayout = tab === 'nanny';
  const awaiting = tab === 'review' ? data.total : summary?.awaitingReview?.count ?? 0;

  return (
    <>
      <PageHeader
        title="Payments"
        subtitle="Manual bank transfers — every payment is verified by an admin"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <StatCard
          label="Awaiting Review"
          value={awaiting}
          hint={`${money(summary?.awaitingReview?.total)} to verify`}
          icon={<IconClock size={17} />} tone="amber"
        />
        <StatCard
          label="Family/Customer Payments This Week"
          value={money(summary?.familyPaymentsThisWeek?.total)}
          hint={`${summary?.familyPaymentsThisWeek?.count || 0} verified`}
          icon={<IconPayments size={17} />} tone="blue"
        />
        <StatCard
          label="Payouts Due Next Monday"
          value={money(summary?.nextMondayRelease?.total)}
          hint={summary?.nextMondayRelease?.date
            ? `${summary.nextMondayRelease.count} awaiting ${date(summary.nextMondayRelease.date)}`
            : 'none scheduled'}
          icon={<IconDollar size={17} />} tone="emerald"
        />
        <StatCard
          label="Refunds To Send"
          value={summary?.refundsInProcess?.count ?? 0}
          hint={`${money(summary?.refundsInProcess?.total)} owed`}
          icon={<IconRefresh size={17} />} tone="violet"
        />
      </div>

      <Tabs tabs={TABS} active={tab} onChange={(v) => { setTab(v); setPage(1); }} />

      {/* Only the review queue can be bulk-approved: the other tabs are
          history, and a payout needs its own proof of transfer. */}
      {tab === 'review' && checkedIds.length > 0 && (
        <div className="card p-3 mb-3 flex flex-wrap items-center gap-3 border-brand-600/40 bg-brand-600/10">
          <span className="text-sm text-slate-200">
            {checkedIds.length} payment{checkedIds.length === 1 ? '' : 's'} selected
          </span>
          <button
            className="btn-primary ml-auto"
            onClick={approveSelected}
            disabled={bulkBusy}
          >
            <IconCheck size={14} /> {bulkBusy ? 'Approving…' : `Approve ${checkedIds.length}`}
          </button>
          <button className="btn-ghost" onClick={() => setCheckedIds([])} disabled={bulkBusy}>
            Clear
          </button>
        </div>
      )}

      <Table startIndex={(page - 1) * 25}
        columns={isPayout ? payoutColumns : paymentColumns}
        rows={data.items || []}
        loading={loading}
        onRowClick={open}
        selectable={tab === 'review'}
        selected={checkedIds}
        onSelectionChange={setCheckedIds}
        dense
        empty={
          tab === 'review' ? 'Nothing waiting for review — all transfers are verified.'
            : tab === 'refunds' ? 'No refunds yet.'
              : 'No transactions yet.'
        }
      />
      <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />

      <Modal
        open={Boolean(selected)}
        title={selected ? `${selected.reference}` : ''}
        onClose={() => setSelected(null)}
        wide
        footer={selected && (
          isPayout ? (
            ['pending', 'processing'].includes(selected.status) && (
              <button className="btn-primary" onClick={markPayoutPaid} disabled={busy}>
                {busy ? 'Saving…' : 'Mark as transferred'}
              </button>
            )
          ) : selected.kind === 'refund' ? (
            selected.status === 'refund_in_process' && (
              <button className="btn-primary" onClick={completeRefund} disabled={busy}>
                {busy ? 'Saving…' : 'Mark refund as sent'}
              </button>
            )
          ) : selected.status === 'payment_in_process' ? (
            <>
              <button className="btn-ghost" onClick={reject} disabled={busy}>
                <IconX size={14} /> Reject
              </button>
              <button className="btn-primary" onClick={approve} disabled={busy}>
                <IconCheck size={14} /> {busy ? 'Saving…' : 'Approve payment'}
              </button>
            </>
          ) : null
        )}
      >
        {selected && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <Badge value={selected.status} />
              {selected.kind && <span className="text-xs text-slate-400">{humanize(selected.kind)}</span>}
              <span className="ml-auto font-mono text-lg text-white">{money(selected.amount)}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Field label={isPayout ? 'Nanny' : 'Family/Customer'}>
                {isPayout ? selected.nanny?.fullName : selected.family?.fullName}
              </Field>
              <Field label="Booking">
                {selected.booking?.bookingNumber ? `#${selected.booking.bookingNumber}` : '—'}
              </Field>
              <Field label="Method">{humanize(selected.method || 'bank_transfer')}</Field>
              <Field label="Submitted">{dateTime(selected.createdAt)}</Field>
              {selected.reviewedAt && <Field label="Reviewed">{dateTime(selected.reviewedAt)}</Field>}
              {selected.scheduledFor && <Field label="Scheduled">{date(selected.scheduledFor)}</Field>}
            </div>

            {selected.proof?.url && (
              <div>
                <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-2">
                  Transfer receipt
                </p>
                <a href={selected.proof.url} target="_blank" rel="noreferrer" className="block">
                  <img
                    src={selected.proof.url}
                    alt="Transfer receipt"
                    className="max-h-80 rounded-lg border border-ink-700 bg-ink-950"
                  />
                </a>
                {selected.proof.note && (
                  <p className="text-sm text-slate-400 mt-2">
                    Family wrote: “{selected.proof.note}”
                  </p>
                )}
                <a
                  href={selected.proof.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-brand-400 hover:text-brand-300 mt-1 inline-block"
                >
                  Open full size
                </a>
              </div>
            )}

            {selected.refundProof?.url && (
              <div>
                <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-2">
                  Refund receipt
                </p>
                <a href={selected.refundProof.url} target="_blank" rel="noreferrer">
                  <img
                    src={selected.refundProof.url}
                    alt="Refund receipt"
                    className="max-h-64 rounded-lg border border-ink-700"
                  />
                </a>
              </div>
            )}

            {selected.reviewNote && (
              <Field label="Review note">{selected.reviewNote}</Field>
            )}

            {/* Action inputs, shown only when there is something to do. */}
            {!isPayout && selected.status === 'payment_in_process' && (
              <div>
                <label className="label" htmlFor="note">
                  Note <span className="text-slate-600">(required when rejecting — the family sees it)</span>
                </label>
                <textarea
                  id="note"
                  className="input min-h-[70px] resize-y"
                  placeholder="e.g. Amount does not match, or receipt is unreadable"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            )}

            {((isPayout && ['pending', 'processing'].includes(selected.status))
              || (selected.kind === 'refund' && selected.status === 'refund_in_process')) && (
              <div className="space-y-3">
                <div>
                  <label className="label" htmlFor="proof">Receipt image URL (optional)</label>
                  <input
                    id="proof"
                    className="input"
                    placeholder="https://…"
                    value={proofUrl}
                    onChange={(e) => setProofUrl(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="pnote">Note (optional)</label>
                  <input
                    id="pnote"
                    className="input"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {toast}
    </>
  );
}
