import { useEffect, useState } from 'react';
import api from '../lib/api.js';
import {
  PageHeader, Table, Badge, Modal, Field, FilterPills, Pagination,
  useToast, ErrorBox, money, date, humanize,
} from '../components/ui.jsx';
import { IconEye, IconCheck, IconClock } from '../components/icons.jsx';

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'replacement_needed', label: 'Replacement Needed' },
];

/** A booking awaiting a replacement reads as its own status in the UI. */
export const statusOf = (b) =>
  b.subStatus === 'nanny_cancelled_awaiting_replacement' ? 'replacement_needed' : b.status;

/** "9:00–11:00 AM" from a start time and a duration. */
export function timeRange(startTime, hours) {
  if (!startTime) return '—';
  const [h, m = 0] = startTime.split(':').map(Number);
  const fmt = (hh, mm) => {
    const suffix = hh >= 12 ? 'PM' : 'AM';
    const hour = hh % 12 === 0 ? 12 : hh % 12;
    return `${hour}:${String(mm).padStart(2, '0')} ${suffix}`;
  };
  if (!hours) return fmt(h, m);
  const end = h + hours;
  return `${fmt(h, m).replace(/ [AP]M$/, '')}–${fmt(end % 24, m)}`;
}

export default function Bookings() {
  const { toast, notify, error: toastError } = useToast();
  const [data, setData] = useState({ items: [], total: 0, pages: 0 });
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [refund, setRefund] = useState(null);

  const load = () => {
    setLoading(true);
    const qs = new URLSearchParams({ page, limit: 25 });
    // "Replacement needed" is a sub-status, so it filters client-side.
    if (filter && filter !== 'replacement_needed') qs.set('status', filter);
    api(`/bookings?${qs}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [filter, page]);

  const open = (b) => {
    setSelected(b);
    setDetail(null);
    setRefund(null);
    api(`/bookings/${b._id}`).then(setDetail).catch(() => setDetail({ booking: b }));
    api(`/bookings/${b._id}/refund-preview`).then(setRefund).catch(() => {});
  };

  const cancel = async () => {
    if (!window.confirm('Cancel this booking and apply the refund policy?')) return;
    try {
      await api(`/bookings/${selected._id}/cancel`, {
        method: 'POST',
        body: { reason: 'Cancelled by admin' },
      });
      notify(`Booking #${selected.bookingNumber} cancelled.`);
      setSelected(null);
      load();
    } catch (e) {
      toastError(e.message);
    }
  };

  const rows = filter === 'replacement_needed'
    ? (data.items || []).filter((b) => statusOf(b) === 'replacement_needed')
    : data.items || [];

  const columns = [
    {
      key: 'id', header: 'Booking ID',
      render: (b) => <span className="font-mono text-xs text-brand-400">#{b.bookingNumber}</span>,
    },
    { key: 'family', header: 'Family', render: (b) => b.family?.fullName || '—' },
    { key: 'nanny', header: 'Nanny', render: (b) => b.nanny?.fullName || <span className="text-slate-600">Unassigned</span> },
    {
      key: 'date', header: 'Date',
      render: (b) => (
        <span className="font-mono text-xs">
          {b.isMultiDay && b.endDate
            ? `${date(b.startDate)} – ${date(b.endDate)}`
            : date(b.startDate)}
        </span>
      ),
    },
    {
      key: 'time', header: 'Time',
      render: (b) => <span className="font-mono text-xs">{timeRange(b.startTime, b.hoursPerDay)}</span>,
    },
    { key: 'type', header: 'Type', render: (b) => (b.isMultiDay ? 'Multiple Days' : 'Single Day') },
    { key: 'status', header: 'Status', render: (b) => <Badge value={statusOf(b)} /> },
    { key: 'arrival', header: 'Arrival OTP', render: (b) => <OtpCell booking={b} kind="arrival" /> },
    { key: 'end', header: 'End OTP', render: (b) => <OtpCell booking={b} kind="end" /> },
    { key: 'payment', header: 'Payment', render: (b) => <Badge value={b.paymentStatus} /> },
    {
      key: 'amount', header: 'Amount',
      render: (b) => <span className="font-mono text-xs">{money(b.totalAmount)}</span>,
    },
    {
      key: 'view', header: '',
      render: (b) => (
        <button
          onClick={(e) => { e.stopPropagation(); open(b); }}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-400 hover:text-brand-300"
        >
          <IconEye size={14} /> View
        </button>
      ),
    },
  ];

  if (error) return <ErrorBox error={error} onRetry={load} />;

  return (
    <>
      <PageHeader title="All Bookings" subtitle={`${data.total} total bookings on platform`} />
      <FilterPills options={FILTERS} active={filter} onChange={(v) => { setFilter(v); setPage(1); }} />

      <Table columns={columns} rows={rows} loading={loading} onRowClick={open} dense empty="No bookings yet." />
      <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />

      <Modal
        open={Boolean(selected)}
        title={selected ? `Booking #${selected.bookingNumber}` : ''}
        onClose={() => setSelected(null)}
        wide
        footer={
          selected && !['cancelled', 'completed'].includes(selected.status) ? (
            <button className="btn-danger" onClick={cancel}>Cancel booking</button>
          ) : null
        }
      >
        {selected && <BookingDetail booking={detail?.booking || selected} extra={detail} refund={refund} />}
      </Modal>

      {toast}
    </>
  );
}

/** Shows whether the arrival / end-of-service code has been confirmed. */
function OtpCell({ booking, kind }) {
  const days = booking.serviceDays || [];
  if (!days.length) return <span className="text-slate-600">—</span>;

  const done = kind === 'arrival'
    ? days.every((d) => ['arrival_confirmed', 'awaiting_end_of_service', 'completed'].includes(d.status))
    : days.every((d) => d.status === 'completed');

  const waiting = kind === 'arrival'
    ? days.some((d) => d.status === 'awaiting_arrival')
    : days.some((d) => d.status === 'awaiting_end_of_service');

  if (done) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
        <IconCheck size={13} /> Confirmed
      </span>
    );
  }
  if (waiting) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-400">
        <IconClock size={13} /> Pending
      </span>
    );
  }
  return <span className="text-slate-600">—</span>;
}

function BookingDetail({ booking, extra, refund }) {
  const b = booking;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Badge value={statusOf(b)} />
        <Badge value={b.paymentStatus} />
        <span className="ml-auto font-mono text-sm text-slate-300">{money(b.totalAmount)}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Field label="Family">{b.family?.fullName}</Field>
        <Field label="Nanny">{b.nanny?.fullName || 'Unassigned'}</Field>
        <Field label="Type">{b.isMultiDay ? 'Multiple days' : 'Single day'}</Field>
        <Field label="Dates">
          {b.isMultiDay && b.endDate ? `${date(b.startDate)} – ${date(b.endDate)}` : date(b.startDate)}
        </Field>
        <Field label="Time">{timeRange(b.startTime, b.hoursPerDay)}</Field>
        <Field label="Hours / day">{b.hoursPerDay ?? '—'}</Field>
        <Field label="Hourly rate">{money(b.hourlyRate)}</Field>
        <Field label="Transport fee">{money(b.transportFee)}</Field>
        <Field label="Paid">{money(b.paidAmount)}</Field>
        {b.refundedAmount > 0 && <Field label="Refunded">{money(b.refundedAmount)}</Field>}
        {b.additionalDue > 0 && <Field label="Additional due">{money(b.additionalDue)}</Field>}
        <Field label="Reschedules">{b.rescheduleCount || 0}</Field>
      </div>

      <Field label="Address">
        {b.address?.addressLine || '—'}
        {b.address?.mapUrl && (
          <a href={b.address.mapUrl} target="_blank" rel="noreferrer" className="ml-2 text-brand-400 text-xs">Map</a>
        )}
      </Field>

      {b.children?.length > 0 && (
        <Field label={`Children (${b.children.length})`}>
          <ul className="space-y-1">
            {b.children.map((c, i) => (
              <li key={i} className="text-sm">
                {c.name} — {c.age}
                {c.allergies && <span className="text-slate-500"> · {c.allergies}</span>}
                {c.dietary && <span className="text-slate-500"> · {c.dietary}</span>}
              </li>
            ))}
          </ul>
        </Field>
      )}

      {b.requirements && (
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Languages">
            {b.requirements.languages?.map(humanize).join(', ') || '—'}
          </Field>
          <Field label="Skills">
            {b.requirements.skills?.map(humanize).join(', ') || '—'}
          </Field>
        </div>
      )}

      {b.serviceDays?.length > 0 && (
        <div>
          <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-2">
            Service days ({b.serviceDays.length})
          </p>
          <ul className="space-y-1.5">
            {b.serviceDays.map((d, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <span className="font-mono text-xs text-slate-400">{date(d.startAt)}</span>
                <Badge value={d.status} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {refund && (
        <div className="card p-4 bg-ink-800/50">
          <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-2">
            Refund preview (if cancelled now)
          </p>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div><span className="text-slate-500">Refund</span><p className="font-mono">{money(refund.refund)}</p></div>
            <div><span className="text-slate-500">Penalty</span><p className="font-mono">{money(refund.penalty)}</p></div>
            <div><span className="text-slate-500">Band</span><p className="text-xs">{refund.band || '—'}</p></div>
          </div>
        </div>
      )}

      {extra?.payments?.length > 0 && (
        <div>
          <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-2">Payments</p>
          <ul className="space-y-1.5">
            {extra.payments.map((p) => (
              <li key={p._id} className="flex items-center justify-between text-sm">
                <span className="font-mono text-xs text-slate-500">{humanize(p.kind)}</span>
                <span className="font-mono text-xs">{money(p.amount)}</span>
                <Badge value={p.status} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
