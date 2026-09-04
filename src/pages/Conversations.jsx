import { useEffect, useState } from 'react';
import api from '../lib/api.js';
import {
  PageHeader, Table, Badge, Modal, Field, Pagination, Avatar,
  ErrorBox, date, dateTime, age, humanize, money,
} from '../components/ui.jsx';
import { IconSearch, IconEye } from '../components/icons.jsx';

export default function Conversations() {
  const [data, setData] = useState({ items: [], total: 0, pages: 0 });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);

  const load = () => {
    setLoading(true);
    const qs = new URLSearchParams({ page, limit: 25 });
    if (search.trim()) qs.set('search', search.trim());
    api(`/conversations?${qs}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  // Debounced so typing a number does not fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [search, page]);

  const open = (row) => {
    setSelected(row);
    setDetail(null);
    api(`/conversations/${row.phone}`).then(setDetail).catch(() => setDetail(null));
  };

  const columns = [
    {
      key: 'who', header: 'Customer',
      render: (r) => (
        <span className="flex items-center gap-2.5">
          <Avatar name={r.fullName || r.phone} />
          <span>
            <span className="block font-medium text-slate-100">{r.fullName || 'Unregistered'}</span>
            <span className="block font-mono text-[11px] text-slate-500">{r.phone}</span>
          </span>
        </span>
      ),
    },
    {
      key: 'role', header: 'Type',
      render: (r) => (r.role ? <Badge value={r.role} /> : <span className="text-slate-600">—</span>),
    },
    {
      key: 'last', header: 'Last Message',
      render: (r) => (
        <span className="block max-w-[280px] truncate text-slate-300" title={r.lastMessage}>
          {r.lastDirection === 'out' && <span className="text-slate-500">Bot: </span>}
          {r.lastMessage || <em className="text-slate-600">[media]</em>}
        </span>
      ),
    },
    {
      key: 'count', header: 'Messages',
      render: (r) => <span className="font-mono text-xs">{r.messageCount}</span>,
    },
    {
      key: 'state', header: 'Stopped At',
      render: (r) => <span className="font-mono text-[11px] text-slate-500">{r.lastState || '—'}</span>,
    },
    {
      key: 'when', header: 'Last Seen',
      render: (r) => <span className="font-mono text-xs">{age(r.lastMessageAt)} ago</span>,
    },
    {
      key: 'view', header: '',
      render: (r) => (
        <button
          onClick={(e) => { e.stopPropagation(); open(r); }}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-400 hover:text-brand-300"
        >
          <IconEye size={14} /> Read
        </button>
      ),
    },
  ];

  if (error) return <ErrorBox error={error} onRetry={load} />;

  return (
    <>
      <PageHeader
        title="Conversations"
        subtitle={`${data.total} people have messaged the chatbot`}
      />

      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
            <IconSearch size={15} />
          </span>
          <input
            className="input pl-9"
            placeholder="Search by phone number…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      <Table startIndex={(page - 1) * 25}
        columns={columns}
        rows={data.items || []}
        loading={loading}
        onRowClick={open}
        dense
        empty="No conversations yet."
      />
      <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />

      <Modal
        open={Boolean(selected)}
        title={selected ? `${selected.fullName || 'Unregistered'} · ${selected.phone}` : ''}
        onClose={() => setSelected(null)}
        wide
      >
        {selected && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Field label="Phone"><span className="font-mono text-xs">{selected.phone}</span></Field>
              <Field label="Name">{detail?.user?.fullName || '—'}</Field>
              <Field label="Email"><span className="font-mono text-xs">{detail?.user?.email || '—'}</span></Field>
              <Field label="Role">
                {detail?.user?.role ? <Badge value={detail.user.role} /> : '—'}
              </Field>
            </div>

            {detail?.user?.children?.length > 0 && (
              <div>
                <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-2">
                  Children on file ({detail.user.children.length})
                </p>
                <div className="space-y-1.5">
                  {detail.user.children.map((c, i) => (
                    <div key={i} className="card p-2.5 bg-ink-800/40 text-sm">
                      <span className="text-slate-100">{c.name} — {c.age}</span>
                      <span className="text-xs text-slate-400 block mt-0.5">
                        {c.medicalNotes || 'No allergies'} · {c.dietaryNotes || 'No dietary notes'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detail?.bookings?.length > 0 && (
              <div>
                <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-2">
                  Bookings ({detail.bookings.length})
                </p>
                <div className="space-y-1">
                  {detail.bookings.map((b) => (
                    <div key={b._id} className="flex items-center justify-between text-sm">
                      <span className="font-mono text-xs text-brand-400">#{b.bookingNumber}</span>
                      <span className="text-slate-400">{date(b.startDate)}</span>
                      <span className="font-mono text-xs">{money(b.totalAmount)}</span>
                      <Badge value={b.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detail?.callbacks?.length > 0 && (
              <div>
                <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-2">
                  Callback requests
                </p>
                {detail.callbacks.map((c) => (
                  <div key={c._id} className="flex items-center gap-3 text-sm">
                    <span className="font-mono text-xs text-brand-400">{c.reference}</span>
                    <span className="text-slate-400">{date(c.createdAt)}</span>
                    <Badge value={c.status === 'pending' ? 'open' : 'resolved'}>{humanize(c.status)}</Badge>
                  </div>
                ))}
              </div>
            )}

            <div>
              <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-2">
                Full chat {detail?.messages ? `(${detail.messages.length} messages)` : ''}
              </p>
              <div className="max-h-[420px] overflow-y-auto space-y-1.5 p-3 rounded-lg bg-ink-950 border border-ink-800">
                {!detail && <p className="text-sm text-slate-500">Loading conversation…</p>}
                {detail?.messages?.map((m) => (
                  <div
                    key={m._id}
                    className={`text-sm p-2 rounded-lg max-w-[85%] ${
                      m.direction === 'in'
                        ? 'bg-ink-800 text-slate-200'
                        : 'bg-brand-600/15 text-brand-100 ml-auto'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">
                      {m.body || <em className="text-slate-500">[media]</em>}
                    </p>
                    {m.mediaUrl && (
                      <a href={m.mediaUrl} target="_blank" rel="noreferrer" className="text-[11px] text-brand-400">
                        View attachment
                      </a>
                    )}
                    <p className="text-[10px] font-mono text-slate-500 mt-1">
                      {m.direction === 'in' ? 'Customer' : 'Bot'} · {dateTime(m.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
