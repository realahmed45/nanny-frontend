import { useEffect, useState } from 'react';
import api from '../lib/api.js';
import {
  PageHeader, Table, Badge, Priority, Modal, Field, FilterPills, StatCard,
  Pagination, useToast, ErrorBox, date, dateTime, age, humanize,
} from '../components/ui.jsx';
import { IconEye, IconAlert, IconActivity, IconCheck, IconUser } from '../components/icons.jsx';

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

export default function Support() {
  const { toast, notify, error: toastError } = useToast();
  const [data, setData] = useState({ items: [], total: 0, pages: 0 });
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const load = () => {
    setLoading(true);
    const qs = new URLSearchParams({ page, limit: 25 });
    if (filter) qs.set('status', filter);
    api(`/tickets?${qs}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [filter, page]);

  const open = (t) => {
    setSelected(t);
    setDetail(null);
    setReply('');
    api(`/tickets/${t._id}`).then(setDetail).catch(() => setDetail({ ticket: t }));
  };

  const send = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      await api(`/tickets/${selected._id}/reply`, { method: 'POST', body: { body: reply.trim() } });
      notify('Reply sent over WhatsApp.');
      setReply('');
      api(`/tickets/${selected._id}`).then(setDetail);
    } catch (e) {
      toastError(e.message);
    } finally {
      setSending(false);
    }
  };

  const setStatus = async (status) => {
    try {
      await api(`/tickets/${selected._id}`, { method: 'PATCH', body: { status } });
      notify(`Ticket marked ${humanize(status).toLowerCase()}.`);
      setSelected(null);
      load();
    } catch (e) {
      toastError(e.message);
    }
  };

  const items = data.items || [];
  const counts = {
    open: items.filter((t) => t.status === 'open').length,
    inProgress: items.filter((t) => t.status === 'in_progress').length,
    resolved: items.filter((t) => t.status === 'resolved').length,
    unassigned: items.filter((t) => !t.assignedTo && ['open', 'in_progress'].includes(t.status)).length,
  };
  const highPriority = items.filter((t) => ['high', 'urgent'].includes(t.priority)).length;

  const columns = [
    {
      key: 'id', header: 'Ticket ID',
      render: (t) => <span className="font-mono text-xs text-brand-400">#{t.ticketNumber}</span>,
    },
    {
      key: 'user', header: 'User',
      render: (t) => (
        <div>
          <p className="text-slate-100">{t.raisedBy?.fullName || '—'}</p>
          <p className="font-mono text-[11px] text-slate-500">{t.raisedBy?.phone}</p>
        </div>
      ),
    },
    { key: 'type', header: 'Type', render: (t) => <Badge value={t.raisedByRole} /> },
    { key: 'category', header: 'Category', render: (t) => humanize(t.category) },
    {
      key: 'booking', header: 'Booking',
      render: (t) => <span className="font-mono text-xs">{t.booking?.bookingNumber ? `#${t.booking.bookingNumber}` : '—'}</span>,
    },
    {
      key: 'issue', header: 'Issue',
      render: (t) => (
        <span className="block max-w-[200px] truncate text-slate-300" title={t.subject || t.description}>
          {t.subject || t.description || '—'}
        </span>
      ),
    },
    { key: 'priority', header: 'Priority', render: (t) => <Priority value={t.priority} /> },
    { key: 'age', header: 'Age', render: (t) => <span className="font-mono text-xs">{age(t.createdAt)}</span> },
    { key: 'submitted', header: 'Submitted', render: (t) => <span className="font-mono text-xs">{date(t.createdAt)}</span> },
    { key: 'status', header: 'Status', render: (t) => <Badge value={t.status} /> },
    {
      key: 'assigned', header: 'Assigned To',
      render: (t) => t.assignedTo || <span className="text-slate-600">—</span>,
    },
    {
      key: 'view', header: '',
      render: (t) => (
        <button
          onClick={(e) => { e.stopPropagation(); open(t); }}
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
      <PageHeader
        title="Support Tickets"
        subtitle={`${counts.open} open · ${highPriority} high priority`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <StatCard label="Open" value={counts.open} icon={<IconAlert size={17} />} tone="red" />
        <StatCard label="In Progress" value={counts.inProgress} icon={<IconActivity size={17} />} tone="amber" />
        <StatCard label="Resolved" value={counts.resolved} icon={<IconCheck size={17} />} tone="emerald" />
        <StatCard label="Unassigned" value={counts.unassigned} icon={<IconUser size={17} />} tone="violet" />
      </div>

      <FilterPills options={FILTERS} active={filter} onChange={(v) => { setFilter(v); setPage(1); }} />

      <Table columns={columns} rows={items} loading={loading} onRowClick={open} dense empty="No tickets yet." />
      <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />

      <Modal
        open={Boolean(selected)}
        title={selected ? `Ticket #${selected.ticketNumber}` : ''}
        onClose={() => setSelected(null)}
        wide
        footer={
          <>
            {selected?.status !== 'in_progress' && (
              <button className="btn-ghost" onClick={() => setStatus('in_progress')}>Mark in progress</button>
            )}
            {selected?.status !== 'resolved' && (
              <button className="btn-primary" onClick={() => setStatus('resolved')}>Resolve</button>
            )}
          </>
        }
      >
        {selected && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <Badge value={selected.status} />
              <Priority value={selected.priority} />
              <Badge value={selected.raisedByRole} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Field label="Raised by">{selected.raisedBy?.fullName}</Field>
              <Field label="Phone"><span className="font-mono text-xs">{selected.raisedBy?.phone}</span></Field>
              <Field label="Category">{humanize(selected.category)}</Field>
              <Field label="Booking">
                {selected.booking?.bookingNumber ? `#${selected.booking.bookingNumber}` : '—'}
              </Field>
              <Field label="Submitted">{dateTime(selected.createdAt)}</Field>
              <Field label="Age">{age(selected.createdAt)}</Field>
            </div>

            <Field label="Issue">{selected.subject || '—'}</Field>
            {selected.description && <Field label="Details">{selected.description}</Field>}

            <div>
              <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-2">
                Conversation
              </p>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {(detail?.ticket?.replies || selected.replies || []).map((r, i) => (
                  <div
                    key={i}
                    className={`p-2.5 rounded-lg text-sm ${
                      r.from === 'admin'
                        ? 'bg-brand-600/15 text-brand-100 ml-8'
                        : 'bg-ink-800 text-slate-300 mr-8'
                    }`}
                  >
                    <p>{r.body}</p>
                    <p className="text-[10px] font-mono text-slate-500 mt-1">
                      {r.from === 'admin' ? 'Support' : 'User'} · {dateTime(r.at)}
                    </p>
                  </div>
                ))}
                {!(detail?.ticket?.replies || selected.replies || []).length && (
                  <p className="text-sm text-slate-500">No replies yet.</p>
                )}
              </div>
            </div>

            <div>
              <label className="label" htmlFor="reply">Reply (sent over WhatsApp)</label>
              <textarea
                id="reply"
                className="input min-h-[80px] resize-y"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Type your reply…"
              />
              <button className="btn-primary mt-2" onClick={send} disabled={sending || !reply.trim()}>
                {sending ? 'Sending…' : 'Send reply'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {toast}
    </>
  );
}
