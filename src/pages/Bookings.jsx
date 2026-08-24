import { useEffect, useState, useCallback } from 'react';
import api from '../lib/api.js';
import {
  PageHeader, Table, Badge, Pagination, Tabs, Modal, ErrorBox,
  useToast, money, date, dateTime, humanize,
} from '../components/ui.jsx';

const TABS = [
  { value: '', label: 'All' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'pending_additional_payment', label: 'Pending Payment' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function Bookings() {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [refundPreview, setRefundPreview] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const { toast, notify, error: notifyError } = useToast();

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api('/bookings', { params: { status, search, page, limit: 20 } })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [status, search, page]);

  useEffect(load, [load]);

  const openDetail = async (row) => {
    setSelected(row);
    setDetail(null);
    setRefundPreview(null);
    setCancelReason('');
    try {
      const [d, preview] = await Promise.all([
        api(`/bookings/${row._id}`),
        row.status === 'cancelled' || row.status === 'completed'
          ? Promise.resolve(null)
          : api(`/bookings/${row._id}/refund-preview`).catch(() => null),
      ]);
      setDetail(d);
      setRefundPreview(preview);
    } catch (e) {
      notifyError(e.message);
    }
  };

  const cancel = async () => {
    if (!window.confirm('Cancel this booking? The family will be refunded for all unused services.')) return;
    try {
      const res = await api(`/bookings/${selected._id}/cancel`, {
        method: 'POST', body: { reason: cancelReason },
      });
      notify(`Booking cancelled. Refund: ${money(res.breakdown.totalRefund)}`);
      setSelected(null);
      load();
    } catch (e) {
      notifyError(e.message);
    }
  };

  const columns = [
    { key: 'bookingNumber', header: 'Booking', render: (r) => (
      <div>
        <p className="font-medium text-slate-900">#{r.bookingNumber}</p>
        <p className="text-xs text-slate-500">{date(r.startDate)}{r.isMultiDay ? ` – ${date(r.endDate)}` : ''}</p>
      </div>
    ) },
    { key: 'family', header: 'Family', render: (r) => r.family?.fullName || '—' },
    { key: 'nanny', header: 'Nanny', render: (r) =>
      r.nanny?.fullName || <span className="text-amber-700 text-xs">Replacement needed</span> },
    { key: 'status', header: 'Status', render: (r) => (
      <div className="space-y-1">
        <Badge value={r.status} />
        {r.subStatus && <p className="text-xs text-slate-500">{humanize(r.subStatus)}</p>}
      </div>
    ) },
    { key: 'days', header: 'Days', render: (r) => (r.serviceDays || []).length },
    { key: 'totalAmount', header: 'Amount', render: (r) => money(r.totalAmount) },
    { key: 'paymentStatus', header: 'Payment', render: (r) => <Badge value={r.paymentStatus} /> },
  ];

  const canCancel = selected && !['cancelled', 'completed'].includes(selected.status);

  return (
    <>
      <PageHeader title="Bookings" subtitle="Every booking across its full lifecycle" />

      <Tabs tabs={TABS} active={status} onChange={(v) => { setStatus(v); setPage(1); }} />

      <input
        className="input max-w-sm mb-4"
        placeholder="Search by booking number…"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
      />

      <ErrorBox error={error} onRetry={load} />
      {!error && (
        <>
          <Table columns={columns} rows={data?.items} loading={loading}
            onRowClick={openDetail} empty="No bookings found." />
          <Pagination page={data?.page} pages={data?.pages} total={data?.total} onChange={setPage} />
        </>
      )}

      <Modal
        open={!!selected}
        title={selected ? `Booking #${selected.bookingNumber}` : ''}
        onClose={() => setSelected(null)}
        footer={canCancel && (
          <button className="btn-danger" onClick={cancel}>Cancel Booking</button>
        )}
      >
        {selected && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge value={selected.status} />
              {selected.subStatus && <Badge value={selected.subStatus}>{humanize(selected.subStatus)}</Badge>}
              <Badge value={selected.paymentStatus} />
            </div>

            <dl className="grid grid-cols-2 gap-3">
              <Field label="Family" value={selected.family?.fullName || '—'} />
              <Field label="Nanny" value={selected.nanny?.fullName || 'Not assigned'} />
              <Field label="Dates" value={`${date(selected.startDate)}${selected.isMultiDay ? ` – ${date(selected.endDate)}` : ''}`} />
              <Field label="Time" value={`${selected.startTime} · ${selected.hoursPerDay}h/day`} />
              <Field label="Rate" value={`${money(selected.hourlyRate)}/hr`} />
              <Field label="Total" value={money(selected.totalAmount)} />
              <Field label="Paid" value={money(selected.paidAmount)} />
              <Field label="Refunded" value={money(selected.refundedAmount)} />
            </dl>

            {selected.repeatDays?.length > 0 && (
              <Section title="Repeats on">{selected.repeatDays.join(', ')}</Section>
            )}

            <Section title="Address">
              {selected.address?.addressLine || '—'}
              {selected.address?.mapUrl && (
                <a href={selected.address.mapUrl} target="_blank" rel="noreferrer"
                  className="block text-brand-600 hover:underline text-xs mt-0.5">📍 Open map</a>
              )}
            </Section>

            <Section title="Requirements">
              <p>🗣 {(selected.requirements?.languages || []).join(', ') || '—'}</p>
              <p>🛠 {(selected.requirements?.skills || []).join(', ') || '—'}</p>
              {selected.requirements?.subjects?.length > 0 && <p>📚 {selected.requirements.subjects.join(', ')}</p>}
              <p className="text-xs text-slate-500 mt-1">
                Budget {money(selected.requirements?.budgetMin)}–{money(selected.requirements?.budgetMax)}/hr
                {selected.requirements?.cpr === 'required' && ' · CPR required'}
              </p>
            </Section>

            {selected.children?.length > 0 && (
              <Section title={`Children (${selected.children.length})`}>
                <ul className="space-y-1.5 mt-1">
                  {selected.children.map((c, i) => (
                    <li key={i} className="text-xs">
                      <span className="font-medium text-slate-800">{c.name} — {c.age}</span>
                      {c.medicalNotes && <span className="block text-amber-700">⚠️ {c.medicalNotes}</span>}
                      {c.dietaryNotes && <span className="block text-slate-500">🍽 {c.dietaryNotes}</span>}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {selected.agentCallRequested && (
              <p className="text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-800">
                📞 Family asked an agent to call and collect the remaining child details.
              </p>
            )}

            {selected.otherInstructions && (
              <Section title="Other instructions">{selected.otherInstructions}</Section>
            )}

            <Section title={`Service days (${(selected.serviceDays || []).length})`}>
              <div className="max-h-44 overflow-y-auto space-y-1 mt-1">
                {(selected.serviceDays || []).map((d) => (
                  <div key={d._id} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-0">
                    <span>{date(d.date)}</span>
                    <div className="flex items-center gap-2">
                      {d.overtimeHours > 0 && <span className="text-amber-700">+{d.overtimeHours}h OT</span>}
                      <Badge value={d.status}>{humanize(d.status)}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {refundPreview && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                  If cancelled now (admin)
                </p>
                <p className="text-slate-700">Family refund: <strong>{money(refundPreview.totalRefund)}</strong></p>
                <p className="text-slate-700">Nanny compensation: <strong>{money(refundPreview.totalNannyCompensation)}</strong></p>
                {refundPreview.completedAmount > 0 && (
                  <p className="text-xs text-slate-500 mt-1">
                    {money(refundPreview.completedAmount)} already delivered and not refundable.
                  </p>
                )}
              </div>
            )}

            {detail?.payments?.length > 0 && (
              <Section title="Payments">
                <ul className="space-y-1 mt-1">
                  {detail.payments.map((p) => (
                    <li key={p._id} className="flex justify-between text-xs">
                      <span>{humanize(p.kind)} · {dateTime(p.createdAt)}</span>
                      <span className="font-medium">{money(p.amount)} <Badge value={p.status} /></span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {selected.rating?.stars && (
              <Section title="Rating">
                ⭐ {selected.rating.stars}/5
                {selected.rating.review && <p className="text-xs text-slate-600 mt-0.5">"{selected.rating.review}"</p>}
              </Section>
            )}

            {selected.cancelledAt && (
              <Section title="Cancellation">
                <p>By {humanize(selected.cancelledBy)} on {dateTime(selected.cancelledAt)}</p>
                {selected.cancellationReason && <p className="text-xs text-slate-500">{selected.cancellationReason}</p>}
              </Section>
            )}

            {canCancel && (
              <div>
                <label className="label">Cancellation reason</label>
                <textarea className="input" rows={2} value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Shared with the family" />
              </div>
            )}
          </div>
        )}
      </Modal>

      {toast}
    </>
  );
}

const Field = ({ label, value }) => (
  <div>
    <dt className="text-xs text-slate-500">{label}</dt>
    <dd className="font-medium text-slate-900">{value}</dd>
  </div>
);

const Section = ({ title, children }) => (
  <div>
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">{title}</p>
    <div className="text-slate-700">{children}</div>
  </div>
);
