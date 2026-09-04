import { useEffect, useState } from 'react';
import api from '../lib/api.js';
import {
  PageHeader, Table, Pagination, Skeleton, ErrorBox, Badge, dateTime, humanize,
} from '../components/ui.jsx';

/**
 * Who did what, across the whole system.
 *
 * With several people sharing the dashboard, "the booking was cancelled" is
 * not an answer — this page exists so the next question, "by whom", always
 * has one.
 */

/** Verbs that change money or access are worth spotting at a glance. */
const TONE = {
  approve: 'text-emerald-400',
  reject: 'text-red-400',
  cancel: 'text-red-400',
  refund: 'text-amber-400',
  delete: 'text-red-400',
  suspend: 'text-red-400',
  block: 'text-red-400',
  verify: 'text-emerald-400',
  login: 'text-slate-400',
  update: 'text-blue-400',
  create: 'text-violet-400',
};

const toneFor = (action) => {
  const verb = String(action).split('.').pop();
  return TONE[verb] || 'text-slate-300';
};

/** Render a before/after pair as the handful of fields that moved. */
function Changes({ before, after }) {
  const keys = [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])]
    .filter((k) => k !== '_id');

  if (!keys.length) return <span className="text-slate-600">—</span>;

  return (
    <div className="space-y-0.5">
      {keys.slice(0, 4).map((k) => {
        const from = before?.[k];
        const to = after?.[k];
        const show = (v) => {
          if (v === undefined || v === null || v === '') return '—';
          if (typeof v === 'object') return JSON.stringify(v).slice(0, 60);
          return String(v).slice(0, 60);
        };
        return (
          <div key={k} className="text-xs font-mono">
            <span className="text-slate-500">{k}: </span>
            {from !== undefined && (
              <>
                <span className="text-red-400/70 line-through">{show(from)}</span>
                <span className="text-slate-600"> → </span>
              </>
            )}
            <span className="text-emerald-400/80">{show(to)}</span>
          </div>
        );
      })}
      {keys.length > 4 && (
        <div className="text-xs text-slate-600">+{keys.length - 4} more</div>
      )}
    </div>
  );
}

export default function Activity() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({ actions: [], admins: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [page, setPage] = useState(1);
  const [admin, setAdmin] = useState('');
  const [action, setAction] = useState('');
  const [search, setSearch] = useState('');

  const load = () => {
    setLoading(true);
    const qs = new URLSearchParams({ page, limit: 50 });
    if (admin) qs.set('admin', admin);
    if (action) qs.set('action', action);
    if (search.trim()) qs.set('search', search.trim());

    api(`/audit?${qs}`)
      .then((r) => {
        setRows(r.items || []);
        setMeta({ page: r.page, pages: r.pages, total: r.total });
        if (r.filters) setFilters(r.filters);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [page, admin, action]);
  useEffect(() => { setPage(1); }, [admin, action]);

  const columns = [
    {
      key: 'when',
      header: 'When',
      render: (r) => <span className="text-xs whitespace-nowrap">{dateTime(r.createdAt)}</span>,
    },
    {
      key: 'who',
      header: 'Who',
      render: (r) => (
        <div>
          <div className="text-sm text-white">{r.adminName || '—'}</div>
          <div className="text-xs text-slate-500">{r.adminEmail}</div>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (r) => (
        <span className={`font-mono text-xs ${toneFor(r.action)}`}>{r.action}</span>
      ),
    },
    {
      key: 'target',
      header: 'On',
      render: (r) => (
        <div>
          {r.targetType && <Badge value={r.targetType} />}
          {r.targetLabel && (
            <div className="text-xs text-slate-400 mt-0.5">{r.targetLabel}</div>
          )}
        </div>
      ),
    },
    {
      key: 'changes',
      header: 'Changed',
      render: (r) => <Changes before={r.before} after={r.after} />,
    },
    {
      key: 'ip',
      header: 'From',
      render: (r) => <span className="font-mono text-xs text-slate-500">{r.ip || '—'}</span>,
    },
  ];

  if (error) return <ErrorBox error={error} onRetry={load} />;

  return (
    <>
      <PageHeader
        title="Activity Log"
        subtitle={`${meta.total} recorded actions — every change made from this dashboard`}
      />

      <div className="flex flex-wrap gap-3 mb-5">
        <input
          className="input max-w-xs"
          placeholder="Search person, action or target…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); load(); } }}
        />
        <select className="input w-auto" value={admin} onChange={(e) => setAdmin(e.target.value)}>
          <option value="">Everyone</option>
          {filters.admins.map((a) => (
            <option key={a._id} value={a._id}>{a.name || a.email}</option>
          ))}
        </select>
        <select className="input w-auto" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">All actions</option>
          {filters.actions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      {loading ? <Skeleton rows={8} /> : (
        <>
          <Table
            columns={columns}
            rows={rows}
            dense
            startIndex={(meta.page - 1) * 50}
            empty="Nothing recorded yet. Actions taken from the dashboard appear here."
          />
          <Pagination
            page={meta.page}
            pages={meta.pages}
            total={meta.total}
            onChange={setPage}
          />
        </>
      )}
    </>
  );
}
