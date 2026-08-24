import { useEffect, useState, useCallback } from 'react';
import api from '../lib/api.js';
import {
  PageHeader, Table, Badge, Pagination, Tabs, Modal, ErrorBox,
  useToast, date, dateTime, humanize,
} from '../components/ui.jsx';

const TABS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

export default function Support() {
  const [status, setStatus] = useState('open');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [reply, setReply] = useState('');
  const { toast, notify, error: notifyError } = useToast();

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api('/tickets', { params: { status, page, limit: 20 } })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [status, page]);

  useEffect(load, [load]);

  const openTicket = async (row) => {
    setReply('');
    try {
      const { ticket } = await api(`/tickets/${row._id}`);
      setSelected(ticket);
    } catch (e) {
      notifyError(e.message);
    }
  };

  const sendReply = async () => {
    if (!reply.trim()) return;
    try {
      const { ticket } = await api(`/tickets/${selected._id}/reply`, {
        method: 'POST', body: { body: reply.trim() },
      });
      setSelected(ticket);
      setReply('');
      notify('Reply sent over WhatsApp.');
      load();
    } catch (e) {
      notifyError(e.message);
    }
  };

  const setTicketStatus = async (newStatus) => {
    try {
      const { ticket } = await api(`/tickets/${selected._id}`, {
        method: 'PATCH', body: { status: newStatus },
      });
      setSelected(ticket);
      notify(`Ticket marked ${humanize(newStatus)}.`);
      load();
    } catch (e) {
      notifyError(e.message);
    }
  };

  // Spec (8/11 update): the "Assigned to" column is removed for now.
  const columns = [
    { key: 'ticketNumber', header: 'Ticket', render: (r) => (
      <div>
        <p className="font-medium text-slate-900">{r.ticketNumber}</p>
        <p className="text-xs text-slate-500">{humanize(r.category)}</p>
      </div>
    ) },
    { key: 'subject', header: 'Subject', render: (r) => (
      <div className="max-w-xs">
        <p className="truncate">{r.subject}</p>
        <p className="text-xs text-slate-500 truncate">{r.description}</p>
      </div>
    ) },
    { key: 'raisedBy', header: 'Raised by', render: (r) => (
      <div>
        <p>{r.raisedBy?.fullName || '—'}</p>
        <p className="text-xs text-slate-500">{humanize(r.raisedByRole)}</p>
      </div>
    ) },
    { key: 'booking', header: 'Booking', render: (r) => r.booking ? `#${r.booking.bookingNumber}` : '—' },
    { key: 'priority', header: 'Priority', render: (r) => <Badge value={r.priority} /> },
    { key: 'status', header: 'Status', render: (r) => <Badge value={r.status} /> },
    { key: 'createdAt', header: 'Created', render: (r) => date(r.createdAt) },
  ];

  return (
    <>
      <PageHeader title="Support" subtitle="Tickets raised by families and nannies" />

      <Tabs tabs={TABS} active={status} onChange={(v) => { setStatus(v); setPage(1); }} />

      <ErrorBox error={error} onRetry={load} />
      {!error && (
        <>
          <Table columns={columns} rows={data?.items} loading={loading}
            onRowClick={openTicket} empty="No tickets found." />
          <Pagination page={data?.page} pages={data?.pages} total={data?.total} onChange={setPage} />
        </>
      )}

      <Modal
        open={!!selected}
        title={selected ? `Ticket ${selected.ticketNumber}` : ''}
        onClose={() => setSelected(null)}
        footer={selected && (
          <>
            {selected.status !== 'resolved' && (
              <button className="btn-ghost" onClick={() => setTicketStatus('resolved')}>Mark resolved</button>
            )}
            {selected.status !== 'closed' && (
              <button className="btn-ghost" onClick={() => setTicketStatus('closed')}>Close</button>
            )}
            <button className="btn-primary" onClick={sendReply} disabled={!reply.trim()}>Send reply</button>
          </>
        )}
      >
        {selected && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge value={selected.status} />
              <Badge value={selected.priority} />
              <Badge value={selected.category}>{humanize(selected.category)}</Badge>
            </div>

            <div>
              <p className="font-medium text-slate-900">{selected.subject}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {selected.raisedBy?.fullName} ({humanize(selected.raisedByRole)}) · {dateTime(selected.createdAt)}
              </p>
              {selected.raisedBy?.phone && (
                <p className="text-xs text-slate-500">📱 {selected.raisedBy.phone}</p>
              )}
            </div>

            <div className="bg-slate-50 rounded-lg p-3 text-slate-700 whitespace-pre-wrap">
              {selected.description}
            </div>

            {selected.booking && (
              <p className="text-xs text-slate-500">
                Related booking: <strong>#{selected.booking.bookingNumber}</strong>
              </p>
            )}

            {selected.replies?.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Conversation</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selected.replies.map((r, i) => (
                    <div key={i} className={`rounded-lg p-2.5 text-xs ${
                      r.from === 'admin' ? 'bg-brand-50 text-brand-900 ml-6' : 'bg-slate-100 text-slate-700 mr-6'
                    }`}>
                      <p className="whitespace-pre-wrap">{r.body}</p>
                      <p className="text-[10px] opacity-60 mt-1">{r.from === 'admin' ? 'Support' : 'User'} · {dateTime(r.at)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="label">Reply (sent over WhatsApp)</label>
              <textarea className="input" rows={3} value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Type your reply…" />
            </div>
          </div>
        )}
      </Modal>

      {toast}
    </>
  );
}
