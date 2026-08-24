import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../lib/api.js';
import {
  PageHeader, Table, Badge, Pagination, Tabs, Modal, ErrorBox,
  useToast, money, date, humanize,
} from '../components/ui.jsx';

const TABS = [
  { value: '', label: 'All' },
  { value: 'pending_verification', label: 'Pending Verification' },
  { value: 'verified', label: 'Verified' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'suspended', label: 'Suspended' },
];

export default function Nannies() {
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState(params.get('status') || '');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const { toast, notify, error: notifyError } = useToast();

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api('/nannies', { params: { status, search, page, limit: 20 } })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [status, search, page]);

  useEffect(load, [load]);

  const openDetail = async (row) => {
    setSelected(row);
    setDetail(null);
    try {
      setDetail(await api(`/nannies/${row._id}`));
    } catch (e) {
      notifyError(e.message);
    }
  };

  const act = async (path, body, successMessage) => {
    try {
      await api(path, { method: 'POST', body });
      notify(successMessage);
      setSelected(null);
      setRejectReason('');
      load();
    } catch (e) {
      notifyError(e.message);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Permanently delete this nanny? This cannot be undone.')) return;
    try {
      await api(`/nannies/${id}`, { method: 'DELETE' });
      notify('Nanny deleted.');
      setSelected(null);
      load();
    } catch (e) {
      notifyError(e.message);
    }
  };

  const columns = [
    { key: 'fullName', header: 'Name', render: (r) => (
      <div>
        <p className="font-medium text-slate-900">{r.fullName || '—'}</p>
        <p className="text-xs text-slate-500">{r.phone}</p>
      </div>
    ) },
    { key: 'nannyStatus', header: 'Status', render: (r) => <Badge value={r.nannyStatus} /> },
    { key: 'hourlyRate', header: 'Rate', render: (r) => r.hourlyRate ? `${money(r.hourlyRate)}/hr` : '—' },
    { key: 'experienceYears', header: 'Experience', render: (r) => r.experienceYears != null ? `${r.experienceYears} yrs` : '—' },
    { key: 'ratingAverage', header: 'Rating', render: (r) => r.ratingCount ? `⭐ ${r.ratingAverage} (${r.ratingCount})` : '—' },
    { key: 'skills', header: 'Skills', render: (r) => (r.skills || []).map((s) => s.name).join(', ') || '—' },
    { key: 'createdAt', header: 'Joined', render: (r) => date(r.createdAt) },
  ];

  return (
    <>
      <PageHeader title="Nannies" subtitle="Verify documents, manage profiles and availability" />

      <Tabs
        tabs={TABS}
        active={status}
        onChange={(v) => { setStatus(v); setPage(1); setParams(v ? { status: v } : {}); }}
      />

      <input
        className="input max-w-sm mb-4"
        placeholder="Search by name, email or phone…"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
      />

      <ErrorBox error={error} onRetry={load} />
      {!error && (
        <>
          <Table columns={columns} rows={data?.items} loading={loading}
            onRowClick={openDetail} empty="No nannies found." />
          <Pagination page={data?.page} pages={data?.pages} total={data?.total} onChange={setPage} />
        </>
      )}

      <Modal
        open={!!selected}
        title={selected?.fullName || 'Nanny'}
        onClose={() => { setSelected(null); setRejectReason(''); }}
        footer={selected && (
          <>
            {selected.nannyStatus !== 'verified' && (
              <button className="btn-primary"
                onClick={() => act(`/nannies/${selected._id}/verify`, { backgroundCheckPassed: true }, 'Nanny verified and notified.')}>
                ✅ Verify
              </button>
            )}
            {selected.nannyStatus === 'pending_verification' && (
              <button className="btn-danger"
                onClick={() => act(`/nannies/${selected._id}/reject`, { reason: rejectReason }, 'Nanny rejected and notified.')}>
                Reject
              </button>
            )}
            {selected.nannyStatus === 'verified' && (
              <button className="btn-danger"
                onClick={() => act(`/nannies/${selected._id}/suspend`, { reason: rejectReason }, 'Nanny suspended.')}>
                Suspend
              </button>
            )}
            <button className="btn-ghost" onClick={() => remove(selected._id)}>Delete</button>
          </>
        )}
      >
        {selected && (
          <div className="space-y-4 text-sm">
            <div className="flex items-start gap-4">
              {selected.profilePhotoUrl
                ? <img src={selected.profilePhotoUrl} alt="" className="w-16 h-16 rounded-full object-cover bg-slate-100" />
                : <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-2xl">👩</div>}
              <div>
                <p className="font-semibold text-slate-900">{selected.fullName}</p>
                <p className="text-slate-500">{selected.email}</p>
                <p className="text-slate-500">{selected.phone}</p>
                <div className="mt-1.5"><Badge value={selected.nannyStatus} /></div>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-3">
              <Field label="Age" value={selected.age ? `${selected.age} yrs` : '—'} />
              <Field label="Experience" value={selected.experienceYears != null ? `${selected.experienceYears} yrs` : '—'} />
              <Field label="Hourly rate" value={selected.hourlyRate ? `${money(selected.hourlyRate)}/hr` : '—'} />
              <Field label="CPR certified" value={selected.cprCertified ? 'Yes ✅' : 'No'} />
              <Field label="Background check" value={selected.backgroundCheckPassed ? 'Passed ✅' : 'Not done'} />
              <Field label="Rating" value={selected.ratingCount ? `⭐ ${selected.ratingAverage} (${selected.ratingCount})` : 'No ratings'} />
            </dl>

            <Section title="Languages">
              {(selected.languages || []).map((l) => `${l.name} ⭐${l.rating}`).join(', ') || '—'}
            </Section>
            <Section title="Skills">
              {(selected.skills || []).map((s) => `${s.name} ⭐${s.rating}`).join(', ') || '—'}
            </Section>
            {selected.subjects?.length > 0 && (
              <Section title="Tutoring subjects">{selected.subjects.join(', ')}</Section>
            )}
            <Section title="Availability">
              {(selected.availability?.days || []).join(', ') || 'Not set'}
              {selected.availability?.startTime && ` · from ${selected.availability.startTime}`}
              {selected.availability?.maxHoursPerDay && ` · up to ${selected.availability.maxHoursPerDay}h/day`}
              {selected.availability?.blockedDates?.length > 0 && (
                <p className="text-xs text-amber-700 mt-1">
                  🚫 Blocked: {selected.availability.blockedDates.map(date).join(', ')}
                </p>
              )}
            </Section>
            <Section title="Address">
              {selected.residingAddress || '—'}
              {selected.residingMapUrl && (
                <a href={selected.residingMapUrl} target="_blank" rel="noreferrer"
                  className="block text-brand-600 hover:underline text-xs mt-0.5">📍 Open map</a>
              )}
            </Section>

            <Section title="Documents">
              {(selected.documents || []).length === 0 ? '—' : (
                <div className="flex flex-wrap gap-2 mt-1">
                  {selected.documents.map((d) => (
                    <a key={d._id} href={d.url} target="_blank" rel="noreferrer"
                      className="btn-ghost text-xs py-1.5">
                      {humanize(d.type)} {d.verified ? '✅' : '⏳'}
                    </a>
                  ))}
                </div>
              )}
            </Section>

            {detail && (
              <Section title={`Recent bookings (${detail.bookings.length})`}>
                {detail.bookings.length === 0 ? '—' : (
                  <ul className="space-y-1 mt-1">
                    {detail.bookings.slice(0, 5).map((b) => (
                      <li key={b._id} className="flex justify-between text-xs">
                        <span>#{b.bookingNumber} · {date(b.startDate)}</span>
                        <Badge value={b.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            )}

            {selected.nannyStatus === 'pending_verification' && (
              <div>
                <label className="label">Rejection reason (if rejecting)</label>
                <textarea className="input" rows={2} value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. ID document is unreadable" />
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
