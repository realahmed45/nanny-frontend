import { useEffect, useState, useCallback } from 'react';
import api from '../lib/api.js';
import {
  PageHeader, Table, Pagination, Modal, ErrorBox, Tabs,
  useToast, dateTime,
} from '../components/ui.jsx';

export default function Chats() {
  const [view, setView] = useState('threads');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [phoneFilter, setPhoneFilter] = useState('');
  const { toast, notify, error: notifyError } = useToast();

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    const path = view === 'threads' ? '/chats' : '/messages';
    const params = view === 'threads'
      ? { page, limit: 20 }
      : { page, limit: 50, phone: phoneFilter };
    api(path, { params })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [view, page, phoneFilter]);

  useEffect(load, [load]);

  const openThread = async (row) => {
    try {
      const { chat } = await api(`/chats/${row._id}`);
      setSelected(chat);
    } catch (e) {
      notifyError(e.message);
    }
  };

  const threadColumns = [
    { key: 'family', header: 'Family', render: (r) => (
      <div>
        <p className="font-medium text-slate-100">{r.family?.fullName || '—'}</p>
        <p className="text-xs text-slate-500">{r.family?.phone}</p>
      </div>
    ) },
    { key: 'nanny', header: 'Nanny', render: (r) => (
      <div>
        <p className="font-medium text-slate-100">{r.nanny?.fullName || '—'}</p>
        <p className="text-xs text-slate-500">{r.nanny?.phone}</p>
      </div>
    ) },
    { key: 'booking', header: 'Booking', render: (r) => r.booking ? `#${r.booking.bookingNumber}` : '—' },
    { key: 'messages', header: 'Messages', render: (r) => (r.messages || []).length },
    { key: 'lastMessageAt', header: 'Last message', render: (r) => dateTime(r.lastMessageAt) },
  ];

  const logColumns = [
    { key: 'direction', header: 'Dir', render: (r) => (
      <span className={r.direction === 'in' ? 'text-blue-600' : 'text-emerald-600'}>
        {r.direction === 'in' ? '⬅ In' : '➡ Out'}
      </span>
    ) },
    { key: 'phone', header: 'Phone' },
    { key: 'body', header: 'Message', render: (r) => (
      <p className="max-w-md truncate text-xs">{r.body || (r.mediaUrl ? '📎 media' : '—')}</p>
    ) },
    { key: 'state', header: 'State', render: (r) => (
      <code className="text-[10px] bg-ink-800 px-1.5 py-0.5 rounded text-slate-400">{r.state || '—'}</code>
    ) },
    { key: 'createdAt', header: 'Time', render: (r) => dateTime(r.createdAt) },
  ];

  return (
    <>
      <PageHeader
        title="Chats"
        subtitle="Relayed family–nanny conversations and the raw WhatsApp log"
      />

      <Tabs
        tabs={[
          { value: 'threads', label: 'Chat Threads' },
          { value: 'log', label: 'Message Log' },
        ]}
        active={view}
        onChange={(v) => { setView(v); setPage(1); }}
      />

      {view === 'log' && (
        <input
          className="input max-w-sm mb-4"
          placeholder="Filter by phone number…"
          value={phoneFilter}
          onChange={(e) => { setPhoneFilter(e.target.value); setPage(1); }}
        />
      )}

      <ErrorBox error={error} onRetry={load} />
      {!error && (
        <>
          <Table
            columns={view === 'threads' ? threadColumns : logColumns}
            rows={data?.items}
            loading={loading}
            onRowClick={view === 'threads' ? openThread : undefined}
            empty={view === 'threads' ? 'No chat threads yet.' : 'No messages logged yet.'}
          />
          <Pagination page={data?.page} pages={data?.pages} total={data?.total} onChange={setPage} />
        </>
      )}

      <Modal
        open={!!selected}
        title="Conversation"
        onClose={() => setSelected(null)}
      >
        {selected && (
          <div className="space-y-3">
            <div className="flex justify-between text-xs text-slate-500 pb-2 border-b border-ink-800">
              <span>👨‍👩‍👧 {selected.family?.fullName}</span>
              <span>👩 {selected.nanny?.fullName}</span>
            </div>

            {(selected.messages || []).length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">No messages in this thread.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {selected.messages.map((m) => (
                  <div key={m._id}
                    className={`rounded-lg p-2.5 text-xs max-w-[80%] ${
                      m.from === 'family'
                        ? 'bg-ink-800 text-slate-300'
                        : 'bg-brand-50 text-brand-900 ml-auto'
                    }`}>
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    {m.mediaUrl && (
                      <a href={m.mediaUrl} target="_blank" rel="noreferrer"
                        className="text-brand-600 hover:underline">📎 attachment</a>
                    )}
                    <p className="text-[10px] opacity-60 mt-1">
                      {m.from === 'family' ? 'Family' : 'Nanny'} · {dateTime(m.sentAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {toast}
    </>
  );
}
