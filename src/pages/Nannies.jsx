import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api.js';
import Notes from '../components/Notes.jsx';
import PersonCalendar from '../components/PersonCalendar.jsx';
import {
  PageHeader, Table, Badge, Modal, Field, Avatar, Pagination, useToast, ErrorBox, money, date, humanize, Tabs,
} from '../components/ui.jsx';
import { IconSearch, IconEye, IconCheck, IconX, IconStar } from '../components/icons.jsx';

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'verified', label: 'Verified' },
  { value: 'pending_verification', label: 'Pending' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'suspended', label: 'Suspended' },
];

const AVAILABILITY_FILTERS = [
  { value: '', label: 'All' },
  { value: 'available', label: 'Available' },
  { value: 'partially_booked', label: 'Partially Booked' },
  { value: 'unavailable', label: 'Unavailable' },
];

export default function Nannies() {
  const { toast, notify, error: toastError } = useToast();
  const [data, setData] = useState({ items: [], total: 0, pages: 0 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [availability, setAvailability] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);

  const load = () => {
    setLoading(true);
    const qs = new URLSearchParams({ page, limit: 25 });
    if (status) qs.set('status', status);
    if (search.trim()) qs.set('search', search.trim());
    api(`/nannies?${qs}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  // Debounce the search box so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [search, status, page]);

  const navigate = useNavigate();
  const [detailTab, setDetailTab] = useState('profile');

  const open = (n) => {
    setSelected(n);
    setDetail(null);
    setDetailTab('profile');
    api(`/nannies/${n._id}`).then(setDetail).catch(() => setDetail({ nanny: n }));
  };

  /** Approve, hide or delete one of her videos, then refresh the modal. */
  const onVideo = async (video, { approved, remove }) => {
    try {
      if (remove) {
        await api(`/nannies/${selected._id}/videos/${video._id}`, { method: 'DELETE' });
        notify('Video deleted.');
      } else {
        await api(`/nannies/${selected._id}/videos/${video._id}`, {
          method: 'PATCH', body: { approved },
        });
        notify(approved ? 'Video is now visible to families.' : 'Video hidden from families.');
      }
      const fresh = await api(`/nannies/${selected._id}`);
      setDetail(fresh);
    } catch (e) {
      toastError(e.message);
    }
  };

  const act = async (path, label) => {
    try {
      await api(`/nannies/${selected._id}/${path}`, { method: 'POST' });
      notify(`${selected.fullName} ${label}.`);
      setSelected(null);
      load();
    } catch (e) {
      toastError(e.message);
    }
  };

  // Availability is derived server-side; filtering it is a client concern.
  const rows = availability
    ? (data.items || []).filter((n) => n.availability === availability)
    : data.items || [];

  const verified = (data.items || []).filter((n) => n.nannyStatus === 'verified').length;

  const columns = [
    {
      key: 'id', header: 'Nanny ID',
      render: (n) => <span className="font-mono text-xs text-slate-500">N-{String(n._id).slice(-4).toUpperCase()}</span>,
    },
    {
      key: 'name', header: 'Name',
      render: (n) => (
        <span className="flex items-center gap-2.5">
          <Avatar name={n.fullName} />
          <span className="font-medium text-slate-100">{n.fullName || '—'}</span>
        </span>
      ),
    },
    {
      key: 'location', header: 'Location',
      render: (n) => (
        <span className="block max-w-[130px] truncate text-slate-400">
          {n.addresses?.[0]?.addressLine || n.addresses?.[0]?.label || '—'}
        </span>
      ),
    },
    {
      key: 'rating', header: 'Rating',
      render: (n) => (
        n.ratingCount
          ? <span className="inline-flex items-center gap-1 text-amber-400 font-mono text-xs">
              <IconStar size={12} />{n.ratingAverage?.toFixed(1)}
            </span>
          : <span className="text-slate-600">—</span>
      ),
    },
    {
      key: 'exp', header: 'Exp',
      render: (n) => <span className="font-mono text-xs">{n.experienceYears ? `${n.experienceYears}yr` : '—'}</span>,
    },
    {
      key: 'rate', header: 'Rate',
      render: (n) => <span className="font-mono text-xs">{n.hourlyRate ? `${money(n.hourlyRate)}/hr` : '—'}</span>,
    },
    {
      key: 'skills', header: 'Skills',
      render: (n) => {
        const s = n.skills || [];
        if (!s.length) return <span className="text-slate-600">—</span>;
        return (
          <span className="flex flex-wrap gap-1 max-w-[190px]">
            {s.slice(0, 2).map((k, i) => (
              <span key={i} className="px-1.5 py-0.5 rounded bg-ink-800 text-[11px] text-slate-400 whitespace-nowrap">
                {humanize(k.name)}
              </span>
            ))}
            {s.length > 2 && <span className="text-[11px] text-slate-500 self-center">+{s.length - 2}</span>}
          </span>
        );
      },
    },
    { key: 'verification', header: 'Verification', render: (n) => <Badge value={n.nannyStatus} /> },
    {
      key: 'cpr', header: 'CPR',
      render: (n) => (n.cprCertified
        ? <span className="text-emerald-400"><IconCheck size={16} /></span>
        : <span className="text-red-400"><IconX size={15} /></span>),
    },
    { key: 'availability', header: 'Availability', render: (n) => <Badge value={n.availability} /> },
    { key: 'active', header: 'Active', render: (n) => <span className="font-mono text-xs">{n.activeBookings ?? 0}</span> },
    { key: 'total', header: 'Total', render: (n) => <span className="font-mono text-xs">{n.totalBookings ?? 0}</span> },
    {
      key: 'status', header: 'Status',
      render: (n) => (
        <Badge value={
          n.blocked || ['suspended', 'rejected'].includes(n.nannyStatus) ? 'suspended' : 'active'
        } />
      ),
    },
    {
      key: 'view', header: '',
      render: (n) => (
        <button
          onClick={(e) => { e.stopPropagation(); open(n); }}
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
        title="Nannies"
        subtitle={`${data.total} registered · ${verified} verified`}
      />

      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
            <IconSearch size={15} />
          </span>
          <input
            className="input pl-9"
            placeholder="Search nannies..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="input w-auto min-w-[150px]"
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
        >
          {STATUS_FILTERS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          className="input w-auto min-w-[170px]"
          value={availability}
          onChange={(e) => setAvailability(e.target.value)}
        >
          {AVAILABILITY_FILTERS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <Table startIndex={(page - 1) * 25} columns={columns} rows={rows} loading={loading} onRowClick={open} dense empty="No nannies yet." />
      <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />

      <Modal
        open={Boolean(selected)}
        title={selected?.fullName || 'Nanny'}
        onClose={() => setSelected(null)}
        wide
        footer={
          <>
            {selected?.nannyStatus !== 'verified' && (
              <button className="btn-primary" onClick={() => act('verify', 'verified')}>Verify</button>
            )}
            {selected?.nannyStatus !== 'rejected' && (
              <button className="btn-ghost" onClick={() => act('reject', 'rejected')}>Reject</button>
            )}
            {selected?.nannyStatus !== 'suspended' && (
              <button className="btn-danger" onClick={() => act('suspend', 'suspended')}>Suspend</button>
            )}
          </>
        }
      >
        {selected && (
          <>
            <Tabs
              tabs={[
                { value: 'profile', label: 'Profile' },
                { value: 'calendar', label: 'Calendar' },
              ]}
              active={detailTab}
              onChange={setDetailTab}
            />

            {detailTab === 'profile' ? (
              <NannyDetail
                nanny={detail?.nanny || selected}
                extra={detail}
                onVideo={onVideo}
                onBooking={(b) => navigate(`/bookings?search=${b.bookingNumber}`)}
              />
            ) : (
              <PersonCalendar
                role="nanny"
                personId={selected._id}
                onBooking={(e) => navigate(`/bookings?search=${e.bookingNumber}`)}
              />
            )}
          </>
        )}
      </Modal>

      {toast}
    </>
  );
}

function NannyDetail({ nanny, extra, onBooking, onVideo }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Avatar name={nanny.fullName} />
        <div>
          <p className="font-semibold text-white">{nanny.fullName}</p>
          <p className="text-xs font-mono text-slate-500">{nanny.phone} · {nanny.email || 'no email'}</p>
        </div>
        <span className="ml-auto"><Badge value={nanny.nannyStatus} /></span>
      </div>

      {/* What she has actually earned and worked, which is the first thing
          anyone asks when they open a nanny. */}
      {extra?.stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg bg-ink-950/60 border border-ink-800 p-3">
            <div className="text-xs text-slate-500 mb-1">Total earned</div>
            <div className="text-sm text-emerald-400 font-mono">
              {money(extra.stats.totalEarned)}
            </div>
          </div>
          <div className="rounded-lg bg-ink-950/60 border border-ink-800 p-3">
            <div className="text-xs text-slate-500 mb-1">Awaiting payout</div>
            <div className="text-sm text-amber-400 font-mono">
              {money(extra.stats.pendingPayout)}
            </div>
          </div>
          <div className="rounded-lg bg-ink-950/60 border border-ink-800 p-3">
            <div className="text-xs text-slate-500 mb-1">Hours worked</div>
            <div className="text-sm text-white font-mono">
              {extra.stats.hoursWorked}h
              <span className="text-xs text-slate-500"> · {extra.stats.daysWorked} days</span>
            </div>
          </div>
          <div className="rounded-lg bg-ink-950/60 border border-ink-800 p-3">
            <div className="text-xs text-slate-500 mb-1">Bookings</div>
            <div className="text-sm text-white font-mono">
              {extra.stats.bookingsCompleted}
              <span className="text-xs text-slate-500"> of {extra.stats.bookingsTotal} completed</span>
            </div>
          </div>
        </div>
      )}

      {/* Her introduction video. Families only see it once it is approved. */}
      {nanny.videos?.length > 0 && (
        <div>
          <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-2">
            Presentation videos
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {nanny.videos.map((v) => (
              <div key={v._id || v.url} className="rounded-lg border border-ink-800 bg-ink-950/60 p-2">
                <video
                  src={v.url}
                  poster={v.thumbnailUrl}
                  controls
                  preload="metadata"
                  className="w-full rounded bg-black max-h-52"
                />
                <div className="flex items-center justify-between mt-2 px-1">
                  <span className="text-xs text-slate-400">{v.title || 'Introduction'}</span>
                  {v.approved
                    ? <span className="text-xs text-emerald-400">Live to families</span>
                    : <span className="text-xs text-amber-400">Awaiting review</span>}
                </div>
                <div className="flex gap-2 mt-2 px-1">
                  <button
                    className="btn-ghost text-xs"
                    onClick={() => onVideo?.(v, { approved: !v.approved })}
                  >
                    {v.approved ? 'Hide from families' : 'Approve'}
                  </button>
                  <button
                    className="btn-ghost text-xs text-red-400"
                    onClick={() => onVideo?.(v, { remove: true })}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Field label="Hourly Rate">{nanny.hourlyRate ? money(nanny.hourlyRate) : '—'}</Field>
        <Field label="Experience">{nanny.experienceYears ? `${nanny.experienceYears} years` : '—'}</Field>
        <Field label="Age">{nanny.age || '—'}</Field>
        <Field label="CPR Certified">{nanny.cprCertified ? 'Yes' : 'No'}</Field>
        <Field label="Background Check">{nanny.backgroundCheckPassed ? 'Passed' : 'Not passed'}</Field>
        <Field label="Rating">
          {nanny.ratingCount ? `${nanny.ratingAverage?.toFixed(1)} (${nanny.ratingCount})` : 'No ratings yet'}
        </Field>
        <Field label="Joined">{date(nanny.createdAt)}</Field>
        <Field label="Referral Code"><span className="font-mono text-xs">{nanny.referralCode || '—'}</span></Field>
        <Field label="Referrals">{nanny.referralCount || 0}</Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Languages">
          {nanny.languages?.length
            ? nanny.languages.map((l) => `${humanize(l.name)} ★${l.rating}`).join(', ')
            : '—'}
        </Field>
        <Field label="Skills">
          {nanny.skills?.length
            ? nanny.skills.map((s) => `${humanize(s.name)} ★${s.rating}`).join(', ')
            : '—'}
        </Field>
      </div>

      <Field label="Address">
        {nanny.addresses?.[0]?.addressLine || '—'}
        {nanny.addresses?.[0]?.mapUrl && (
          <a
            href={nanny.addresses[0].mapUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-2 text-brand-400 hover:text-brand-300 text-xs"
          >
            Map
          </a>
        )}
      </Field>

      <Field label="Availability">
        {nanny.availability?.days?.length ? nanny.availability.days.map(humanize).join(', ') : '—'}
        {nanny.availability?.startTime && ` · from ${nanny.availability.startTime}`}
        {nanny.availability?.maxHoursPerDay && ` · up to ${nanny.availability.maxHoursPerDay}h/day`}
        {nanny.availability?.blockedDates?.length > 0 && (
          <p className="text-xs text-slate-500 mt-1">
            Blocked: {nanny.availability.blockedDates.join(', ')}
          </p>
        )}
      </Field>

      {nanny.documents?.length > 0 && (
        <Field label="Documents">
          <div className="flex flex-wrap gap-2">
            {nanny.documents.map((d, i) => (
              <a
                key={i}
                href={d.url}
                target="_blank"
                rel="noreferrer"
                className="px-2 py-1 rounded bg-ink-800 text-xs text-brand-400 hover:text-brand-300"
              >
                {humanize(d.type)}
              </a>
            ))}
          </div>
        </Field>
      )}

      {extra?.bookings?.length > 0 && (
        <div>
          <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-2">
            Recent bookings
          </p>
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

      <Notes targetType="nanny" target={nanny._id} initial={extra?.notes || []} />
    </div>
  );
}
