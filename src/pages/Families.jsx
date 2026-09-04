import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api.js';
import Notes from '../components/Notes.jsx';
import {
  PageHeader, Table, Badge, Modal, Field, Avatar, Pagination,
  useToast, ErrorBox, money, date,
} from '../components/ui.jsx';
import { IconSearch, IconEye } from '../components/icons.jsx';

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'blocked', label: 'Suspended' },
];

export default function Families() {
  const { toast, notify, error: toastError } = useToast();
  const [data, setData] = useState({ items: [], total: 0, pages: 0 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);

  const load = () => {
    setLoading(true);
    const qs = new URLSearchParams({ page, limit: 25 });
    if (search.trim()) qs.set('search', search.trim());
    api(`/families?${qs}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [search, page]);

  const navigate = useNavigate();

  const open = (f) => {
    setSelected(f);
    setDetail(null);
    api(`/families/${f._id}`).then(setDetail).catch(() => setDetail({ family: f }));
  };

  const toggleBlock = async () => {
    try {
      await api(`/families/${selected._id}/block`, {
        method: 'POST',
        body: { blocked: !selected.blocked },
      });
      notify(`${selected.fullName} ${selected.blocked ? 'unblocked' : 'blocked'}.`);
      setSelected(null);
      load();
    } catch (e) {
      toastError(e.message);
    }
  };

  const rows = status
    ? (data.items || []).filter((f) => (status === 'blocked' ? f.blocked : !f.blocked))
    : data.items || [];

  const active = (data.items || []).filter((f) => !f.blocked).length;

  const columns = [
    {
      key: 'id', header: 'Family ID',
      render: (f) => <span className="font-mono text-xs text-slate-500">F-{String(f._id).slice(-4).toUpperCase()}</span>,
    },
    {
      key: 'name', header: 'Name',
      render: (f) => (
        <span className="flex items-center gap-2.5">
          <Avatar name={f.fullName} />
          <span className="font-medium text-slate-100">{f.fullName || '—'}</span>
        </span>
      ),
    },
    {
      key: 'email', header: 'Email',
      render: (f) => (
        <span className="block max-w-[170px] truncate font-mono text-xs text-slate-400" title={f.email}>
          {f.email || '—'}
        </span>
      ),
    },
    { key: 'phone', header: 'Phone', render: (f) => <span className="font-mono text-xs text-slate-400">{f.phone}</span> },
    {
      key: 'location', header: 'Location',
      render: (f) => (
        <span className="block max-w-[130px] truncate text-slate-400">
          {f.addresses?.[0]?.addressLine || f.addresses?.[0]?.label || '—'}
        </span>
      ),
    },
    { key: 'total', header: 'Total Bk.', render: (f) => <span className="font-mono text-xs">{f.stats?.total ?? 0}</span> },
    {
      key: 'active', header: 'Active',
      render: (f) => <span className="font-mono text-xs text-brand-400">{f.stats?.active ?? 0}</span>,
    },
    {
      key: 'completed', header: 'Completed',
      render: (f) => <span className="font-mono text-xs text-emerald-400">{f.stats?.completed ?? 0}</span>,
    },
    {
      key: 'cancelled', header: 'Cancelled',
      render: (f) => <span className="font-mono text-xs text-slate-400">{f.stats?.cancelled ?? 0}</span>,
    },
    {
      key: 'spent', header: 'Total Spent',
      render: (f) => <span className="font-mono text-xs">{money(f.stats?.spent)}</span>,
    },
    {
      key: 'tickets', header: 'Tickets',
      render: (f) => (
        <span className={`font-mono text-xs ${f.stats?.tickets ? 'text-red-400' : 'text-slate-500'}`}>
          {f.stats?.tickets ?? 0}
        </span>
      ),
    },
    { key: 'referrals', header: 'Referrals', render: (f) => <span className="font-mono text-xs">{f.referralCount || 0}</span> },
    { key: 'status', header: 'Status', render: (f) => <Badge value={f.blocked ? 'suspended' : 'active'} /> },
    {
      key: 'view', header: '',
      render: (f) => (
        <button
          onClick={(e) => { e.stopPropagation(); open(f); }}
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
      <PageHeader title="Families" subtitle={`${data.total} accounts · ${active} active`} />

      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
            <IconSearch size={15} />
          </span>
          <input
            className="input pl-9"
            placeholder="Search families..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select className="input w-auto min-w-[150px]" value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUS_FILTERS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <Table startIndex={(page - 1) * 25} columns={columns} rows={rows} loading={loading} onRowClick={open} dense empty="No families yet." />
      <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />

      <Modal
        open={Boolean(selected)}
        title={selected?.fullName || 'Family'}
        onClose={() => setSelected(null)}
        wide
        footer={
          <button className={selected?.blocked ? 'btn-primary' : 'btn-danger'} onClick={toggleBlock}>
            {selected?.blocked ? 'Unblock account' : 'Block account'}
          </button>
        }
      >
        {selected && (
          <FamilyDetail
            family={detail?.family || selected}
            extra={detail}
            onBooking={(b) => navigate(`/bookings?search=${b.bookingNumber}`)}
          />
        )}
      </Modal>

      {toast}
    </>
  );
}

function FamilyDetail({ family, extra, onBooking }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Avatar name={family.fullName} />
        <div>
          <p className="font-semibold text-white">{family.fullName}</p>
          <p className="text-xs font-mono text-slate-500">{family.phone} · {family.email || 'no email'}</p>
        </div>
        <span className="ml-auto"><Badge value={family.blocked ? 'suspended' : 'active'} /></span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Field label="Email Verified">{family.emailVerified ? 'Yes' : 'No'}</Field>
        <Field label="ID Verified">{family.idVerified ? 'Yes' : 'No'}</Field>
        <Field label="Joined">{date(family.createdAt)}</Field>
        <Field label="Referral Code"><span className="font-mono text-xs">{family.referralCode || '—'}</span></Field>
        <Field label="Referrals">{family.referralCount || 0}</Field>
        <Field label="Total Spent">{money(extra?.stats?.totalSpent ?? 0)}</Field>
      </div>

      {/* What this family is actually worth, and what they still owe. */}
      {extra?.stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg bg-ink-950/60 border border-ink-800 p-3">
            <div className="text-xs text-slate-500 mb-1">Paid</div>
            <div className="text-sm text-emerald-400 font-mono">{money(extra.stats.totalPaid)}</div>
          </div>
          <div className="rounded-lg bg-ink-950/60 border border-ink-800 p-3">
            <div className="text-xs text-slate-500 mb-1">Refunded</div>
            <div className="text-sm text-amber-400 font-mono">{money(extra.stats.totalRefunded)}</div>
          </div>
          <div className="rounded-lg bg-ink-950/60 border border-ink-800 p-3">
            <div className="text-xs text-slate-500 mb-1">Awaiting payment</div>
            <div className="text-sm text-orange-400 font-mono">{money(extra.stats.pendingPayment)}</div>
          </div>
          <div className="rounded-lg bg-ink-950/60 border border-ink-800 p-3">
            <div className="text-xs text-slate-500 mb-1">Care booked</div>
            <div className="text-sm text-white font-mono">
              {extra.stats.hoursBooked}h
              <span className="text-xs text-slate-500"> · {extra.stats.bookingsTotal} bookings</span>
            </div>
          </div>
        </div>
      )}

      {/* Who referred them in, so the chain can be walked from either end. */}
      {extra?.referredBy && (
        <Field label="Referred by">
          <span className="text-slate-200">{extra.referredBy.fullName}</span>
          <span className="font-mono text-xs text-slate-500 ml-2">
            {extra.referredBy.referralCode}
          </span>
        </Field>
      )}

      {family.children?.length > 0 && (
        <Field label="Children">
          <ul className="space-y-1">
            {family.children.map((c, i) => (
              <li key={i} className="text-sm">
                {c.name} — {c.age}
                {c.allergies && <span className="text-slate-500"> · {c.allergies}</span>}
                {c.dietary && <span className="text-slate-500"> · {c.dietary}</span>}
              </li>
            ))}
          </ul>
        </Field>
      )}

      {family.addresses?.length > 0 && (
        <Field label="Saved addresses">
          <ul className="space-y-1">
            {family.addresses.map((a, i) => (
              <li key={i} className="text-sm">
                {a.label ? <span className="text-slate-400">{a.label}: </span> : null}
                {a.addressLine || '—'}
                {a.mapUrl && (
                  <a href={a.mapUrl} target="_blank" rel="noreferrer" className="ml-2 text-brand-400 text-xs">Map</a>
                )}
              </li>
            ))}
          </ul>
        </Field>
      )}

      {extra?.bookings?.length > 0 && (
        <div>
          <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-2">Recent bookings</p>
          <ul className="space-y-1.5">
            {extra.bookings.slice(0, 6).map((b) => (
              <li
                key={b._id}
                onClick={() => onBooking?.(b)}
                className="flex items-center justify-between text-sm rounded px-2 py-1.5 -mx-2 cursor-pointer hover:bg-ink-800/60"
              >
                <span className="font-mono text-xs text-brand-400">#{b.bookingNumber}</span>
                <span className="text-slate-400">{date(b.startDate)}</span>
                <Badge value={b.status} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <Notes targetType="family" target={family._id} initial={extra?.notes || []} />
    </div>
  );
}
