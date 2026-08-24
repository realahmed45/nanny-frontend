import { useEffect, useState, useCallback } from 'react';
import api from '../lib/api.js';
import {
  PageHeader, Table, Badge, Pagination, Modal, ErrorBox,
  useToast, money, date, dateTime,
} from '../components/ui.jsx';

export default function Families() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const { toast, notify, error: notifyError } = useToast();

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api('/families', { params: { search, page, limit: 20 } })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [search, page]);

  useEffect(load, [load]);

  const openDetail = async (row) => {
    setSelected(row);
    setDetail(null);
    try {
      setDetail(await api(`/families/${row._id}`));
    } catch (e) {
      notifyError(e.message);
    }
  };

  const act = async (path, body, message) => {
    try {
      await api(path, { method: 'POST', body });
      notify(message);
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
    { key: 'email', header: 'Email', render: (r) => (
      <span>{r.email || '—'} {r.emailVerified ? '✅' : ''}</span>
    ) },
    { key: 'idVerified', header: 'ID', render: (r) =>
      r.idVerified ? <Badge value="verified">Verified</Badge> : <Badge value="pending_verification">Pending</Badge> },
    { key: 'children', header: 'Children', render: (r) => (r.children || []).length },
    { key: 'addresses', header: 'Addresses', render: (r) => (r.addresses || []).length },
    { key: 'blocked', header: 'Status', render: (r) =>
      r.blocked ? <Badge value="suspended">Blocked</Badge> : <Badge value="verified">Active</Badge> },
    { key: 'createdAt', header: 'Joined', render: (r) => date(r.createdAt) },
  ];

  return (
    <>
      <PageHeader title="Families" subtitle="Customer accounts, children and booking history" />

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
            onRowClick={openDetail} empty="No families found." />
          <Pagination page={data?.page} pages={data?.pages} total={data?.total} onChange={setPage} />
        </>
      )}

      <Modal
        open={!!selected}
        title={selected?.fullName || 'Family'}
        onClose={() => setSelected(null)}
        footer={selected && (
          <>
            <button className="btn-ghost"
              onClick={() => act(`/families/${selected._id}/verify-id`, { verified: !selected.idVerified },
                selected.idVerified ? 'ID marked unverified.' : 'ID verified.')}>
              {selected.idVerified ? 'Unverify ID' : '✅ Verify ID'}
            </button>
            <button className={selected.blocked ? 'btn-ghost' : 'btn-danger'}
              onClick={() => act(`/families/${selected._id}/block`, { blocked: !selected.blocked },
                selected.blocked ? 'Family unblocked.' : 'Family blocked.')}>
              {selected.blocked ? 'Unblock' : 'Block'}
            </button>
          </>
        )}
      >
        {selected && (
          <div className="space-y-4 text-sm">
            <dl className="grid grid-cols-2 gap-3">
              <Field label="Name" value={selected.fullName || '—'} />
              <Field label="Phone" value={selected.phone} />
              <Field label="Email" value={`${selected.email || '—'} ${selected.emailVerified ? '✅' : ''}`} />
              <Field label="ID verified" value={selected.idVerified ? 'Yes ✅' : 'No'} />
              <Field label="Referral code" value={selected.referralCode || '—'} />
              <Field label="Referrals" value={selected.referralCount || 0} />
            </dl>

            {selected.addresses?.length > 0 && (
              <Section title="Saved addresses">
                <ul className="space-y-1 mt-1">
                  {selected.addresses.map((a) => (
                    <li key={a._id} className="text-xs">
                      <span className="font-medium text-slate-800">{a.label}</span> — {a.addressLine}
                      {a.mapUrl && (
                        <a href={a.mapUrl} target="_blank" rel="noreferrer"
                          className="ml-1 text-brand-600 hover:underline">📍</a>
                      )}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {selected.children?.length > 0 && (
              <Section title={`Children (${selected.children.length})`}>
                <ul className="space-y-1.5 mt-1">
                  {selected.children.map((c) => (
                    <li key={c._id} className="text-xs">
                      <span className="font-medium text-slate-800">{c.name} — {c.age}</span>
                      {c.medicalNotes && <span className="block text-amber-700">⚠️ {c.medicalNotes}</span>}
                      {c.dietaryNotes && <span className="block text-slate-500">🍽 {c.dietaryNotes}</span>}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {selected.familyInstructions && (
              <Section title="Instructions">{selected.familyInstructions}</Section>
            )}

            {selected.idDocuments?.length > 0 && (
              <Section title="ID documents">
                <div className="flex flex-wrap gap-2 mt-1">
                  {selected.idDocuments.map((d) => (
                    <a key={d._id} href={d.url} target="_blank" rel="noreferrer" className="btn-ghost text-xs py-1.5">
                      {d.type === 'id_front' ? 'ID front' : 'ID back'}
                    </a>
                  ))}
                </div>
              </Section>
            )}

            {detail && (
              <>
                <Section title={`Bookings (${detail.bookings.length})`}>
                  {detail.bookings.length === 0 ? '—' : (
                    <ul className="space-y-1 mt-1">
                      {detail.bookings.slice(0, 6).map((b) => (
                        <li key={b._id} className="flex justify-between text-xs">
                          <span>#{b.bookingNumber} · {b.nanny?.fullName || 'Unassigned'}</span>
                          <span className="flex items-center gap-2">
                            {money(b.totalAmount)} <Badge value={b.status} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>
                <Section title={`Payments (${detail.payments.length})`}>
                  {detail.payments.length === 0 ? '—' : (
                    <ul className="space-y-1 mt-1">
                      {detail.payments.slice(0, 6).map((p) => (
                        <li key={p._id} className="flex justify-between text-xs">
                          <span>{p.reference} · {dateTime(p.createdAt)}</span>
                          <span>{money(p.amount)} <Badge value={p.status} /></span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>
              </>
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
