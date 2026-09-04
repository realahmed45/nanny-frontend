import { useEffect, useState } from 'react';
import api from '../lib/api.js';
import {
  PageHeader, Table, Badge, Modal, Field, FilterPills, StatCard, Pagination,
  useToast, ErrorBox, Avatar, date, dateTime, age, humanize,
} from '../components/ui.jsx';
import {
  IconPhone, IconClock, IconCheck, IconActivity, IconEye,
} from '../components/icons.jsx';

const FILTERS = [
  { value: 'pending', label: 'To Call' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'called', label: 'Called' },
  { value: 'closed', label: 'Closed' },
  { value: '', label: 'All' },
];

/** Why the family is waiting on a call — the two paths look very different. */
const REASON = {
  no_nanny_found: { label: 'No match', tone: 'bg-red-500/10 text-red-300 border-red-500/40' },
  agent_requested: { label: 'Agent help', tone: 'bg-violet-500/10 text-violet-300 border-violet-500/30' },
  other: { label: 'Other', tone: 'bg-slate-500/10 text-slate-400 border-slate-500/30' },
};

const STATUS_TONE = {
  pending: 'open',
  in_progress: 'in_progress',
  called: 'resolved',
  closed: 'closed',
};

export default function Callbacks() {
  const { toast, notify, error: toastError } = useToast();
  const [filter, setFilter] = useState('pending');
  const [data, setData] = useState({ items: [], total: 0, pages: 0, summary: {} });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    const qs = new URLSearchParams({ page, limit: 25 });
    if (filter) qs.set('status', filter);
    api(`/callbacks?${qs}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [filter, page]);

  const open = (row) => {
    setSelected(row);
    setDetail(null);
    setNotes(row.notes || '');
    api(`/callbacks/${row._id}`).then(setDetail).catch(() => setDetail(null));
  };

  const update = async (status) => {
    setBusy(true);
    try {
      await api(`/callbacks/${selected._id}`, {
        method: 'PATCH',
        body: { status, notes },
      });
      notify(`Marked ${humanize(status).toLowerCase()}.`);
      setSelected(null);
      load();
    } catch (e) {
      toastError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const { summary = {} } = data;

  const columns = [
    {
      key: 'ref', header: 'Ref',
      render: (r) => <span className="font-mono text-xs text-brand-400">{r.reference}</span>,
    },
    {
      key: 'name', header: 'Customer',
      render: (r) => (
        <span className="flex items-center gap-2.5">
          <Avatar name={r.fullName || r.phone} />
          <span>
            <span className="block font-medium text-slate-100">{r.fullName || 'Unknown'}</span>
            <span className="block font-mono text-[11px] text-slate-500">{r.phone}</span>
          </span>
        </span>
      ),
    },
    {
      key: 'reason', header: 'Why',
      render: (r) => {
        const meta = REASON[r.reason] || REASON.other;
        return (
          <span className={`badge ${meta.tone}`}>{meta.label}</span>
        );
      },
    },
    {
      key: 'when', header: 'Wanted For',
      render: (r) => (
        <span className="font-mono text-xs">
          {date(r.request?.startDate)}
          {r.request?.isEmergency && (
            <span className="ml-1.5 px-1 py-0.5 rounded bg-red-500/15 text-red-300 text-[10px] border border-red-500/40">
              URGENT
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'time', header: 'Time',
      render: (r) => (
        <span className="font-mono text-xs">
          {r.request?.startTime || '—'}
          {r.request?.hoursPerDay ? ` · ${r.request.hoursPerDay}h` : ''}
        </span>
      ),
    },
    {
      key: 'children', header: 'Children',
      render: (r) => <span className="font-mono text-xs">{r.request?.children?.length ?? 0}</span>,
    },
    {
      key: 'call', header: 'Call',
      render: (r) => (
        <span className={`text-xs ${r.callWindow === 'morning' ? 'text-amber-400' : 'text-emerald-400'}`}>
          {r.callWindow === 'morning' ? '10:00 AM' : 'Straight away'}
        </span>
      ),
    },
    { key: 'waiting', header: 'Waiting', render: (r) => <span className="font-mono text-xs">{age(r.createdAt)}</span> },
    { key: 'status', header: 'Status', render: (r) => <Badge value={STATUS_TONE[r.status] || r.status}>{humanize(r.status)}</Badge> },
    {
      key: 'view', header: '',
      render: (r) => (
        <button
          onClick={(e) => { e.stopPropagation(); open(r); }}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-400 hover:text-brand-300"
        >
          <IconEye size={14} /> Open
        </button>
      ),
    },
  ];

  if (error) return <ErrorBox error={error} onRetry={load} />;

  const req = selected?.request || {};

  return (
    <>
      <PageHeader
        title="Call Straight Away"
        subtitle="Families waiting on a call — no nanny matched, or they asked for an agent"
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard label="Waiting For A Call" value={summary.pending ?? 0} icon={<IconPhone size={17} />} tone="red" />
        <StatCard label="In Progress" value={summary.inProgress ?? 0} icon={<IconActivity size={17} />} tone="amber" />
        <StatCard label="Called" value={summary.called ?? 0} icon={<IconCheck size={17} />} tone="emerald" />
      </div>

      <FilterPills options={FILTERS} active={filter} onChange={(v) => { setFilter(v); setPage(1); }} />

      <Table startIndex={(page - 1) * 25}
        columns={columns}
        rows={data.items || []}
        loading={loading}
        onRowClick={open}
        dense
        empty="Nobody is waiting for a call."
      />
      <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />

      <Modal
        open={Boolean(selected)}
        title={selected ? `${selected.reference} — ${selected.fullName || selected.phone}` : ''}
        onClose={() => setSelected(null)}
        wide
        footer={selected && (
          <>
            {selected.status === 'pending' && (
              <button className="btn-ghost" onClick={() => update('in_progress')} disabled={busy}>
                Start calling
              </button>
            )}
            {selected.status !== 'called' && selected.status !== 'closed' && (
              <button className="btn-primary" onClick={() => update('called')} disabled={busy}>
                <IconCheck size={14} /> Mark called
              </button>
            )}
            {selected.status !== 'closed' && (
              <button className="btn-ghost" onClick={() => update('closed')} disabled={busy}>Close</button>
            )}
          </>
        )}
      >
        {selected && (
          <div className="space-y-6">
            {/* Who to call — the first thing anyone needs. */}
            <div className="card p-4 bg-ink-800/40">
              <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-2">Call</p>
              <div className="flex flex-wrap items-center gap-4">
                <a
                  href={`tel:${selected.phone}`}
                  className="text-lg font-mono text-brand-300 hover:text-brand-200"
                >
                  {selected.phone}
                </a>
                <Badge value={STATUS_TONE[selected.status] || selected.status}>
                  {humanize(selected.status)}
                </Badge>
                <span className={`badge ${(REASON[selected.reason] || REASON.other).tone}`}>
                  {(REASON[selected.reason] || REASON.other).label}
                </span>
                <span className={`text-xs ${selected.callWindow === 'morning' ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {selected.callWindow === 'morning'
                    ? `Promised: 10:00 AM (${date(selected.promisedCallAt)})`
                    : 'Promised: straight away'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Field label="Name">{selected.fullName || '—'}</Field>
              <Field label="Email"><span className="font-mono text-xs">{selected.email || '—'}</span></Field>
              <Field label="Requested">{dateTime(selected.createdAt)}</Field>
            </div>

            {/* What they asked for */}
            <div>
              <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-2">
                What they asked for
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <Field label="Date">
                  {req.isMultiDay && req.endDate
                    ? `${date(req.startDate)} – ${date(req.endDate)}`
                    : date(req.startDate)}
                  {req.isEmergency && <span className="ml-2 text-red-300 text-xs">URGENT</span>}
                </Field>
                <Field label="Time">{req.startTime || '—'}</Field>
                <Field label="Hours / day">{req.hoursPerDay ?? '—'}</Field>
                {req.repeatDays?.length > 0 && (
                  <div className="col-span-2 sm:col-span-3">
                    <Field label="Repeat on">{req.repeatDays.join(', ')}</Field>
                  </div>
                )}
                <Field label="Languages">{req.languages?.join(', ') || '—'}</Field>
                <Field label="Skills">{req.skills?.join(', ') || '—'}</Field>
                {req.subjects?.length > 0 && <Field label="Subjects">{req.subjects.join(', ')}</Field>}
              </div>
            </div>

            <Field label="Address">
              {req.address?.addressLine || '—'}
              {req.address?.mapUrl && (
                <a href={req.address.mapUrl} target="_blank" rel="noreferrer" className="ml-2 text-brand-400 text-xs">
                  Map
                </a>
              )}
            </Field>

            {req.children?.length > 0 && (
              <div>
                <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-2">
                  Children ({req.children.length})
                </p>
                <div className="space-y-2">
                  {req.children.map((c, i) => (
                    <div key={i} className="card p-3 bg-ink-800/40">
                      <p className="text-sm font-medium text-slate-100">{c.name} — {c.age}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {c.medicalNotes || 'No allergies / medical notes'}
                        {' · '}
                        {c.dietaryNotes || 'No dietary notes'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {req.otherInstructions && (
              <Field label="Other instructions">{req.otherInstructions}</Field>
            )}

            {/* The whole conversation, so nothing has to be asked twice. */}
            <div>
              <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-2">
                Full chat {detail?.messages ? `(${detail.messages.length} messages)` : ''}
              </p>
              <div className="max-h-72 overflow-y-auto space-y-1.5 p-3 rounded-lg bg-ink-950 border border-ink-800">
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
                    <p className="whitespace-pre-wrap break-words">{m.body || <em className="text-slate-500">[media]</em>}</p>
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
                {detail?.messages?.length === 0 && (
                  <p className="text-sm text-slate-500">No messages logged.</p>
                )}
              </div>
            </div>

            <div>
              <label className="label" htmlFor="cbnotes">Notes from the call</label>
              <textarea
                id="cbnotes"
                className="input min-h-[70px] resize-y"
                placeholder="What was agreed, what to do next…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        )}
      </Modal>

      {toast}
    </>
  );
}
