import { useEffect, useState } from 'react';
import api from '../lib/api.js';
import {
  PageHeader, Table, Badge, StatCard, ErrorBox, date,
} from '../components/ui.jsx';
import {
  IconReferrals, IconCheck, IconClock, IconTrend, IconX,
} from '../components/icons.jsx';

/** Green tick / red cross used for the boolean columns. */
const Bool = ({ on }) => (on
  ? <span className="text-emerald-400"><IconCheck size={16} /></span>
  : <span className="text-red-400"><IconX size={15} /></span>);

export default function Referrals() {
  const [data, setData] = useState({ rows: [], summary: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    api('/referrals')
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const { summary = {} } = data;

  const columns = [
    {
      key: 'ref', header: 'Ref ID',
      render: (r) => <span className="font-mono text-xs text-slate-500">REF-{String(r._id).slice(-4).toUpperCase()}</span>,
    },
    {
      key: 'referrer', header: 'Referrer',
      render: (r) => (
        <div>
          <p className="text-slate-100">{r.referrer}</p>
          {r.referrerCode && <p className="font-mono text-[11px] text-slate-500">{r.referrerCode}</p>}
        </div>
      ),
    },
    { key: 'type', header: 'Type', render: (r) => <Badge value={r.referrerRole} /> },
    { key: 'contact', header: 'Contact', render: (r) => <span className="font-medium text-slate-100">{r.contact}</span> },
    {
      key: 'email', header: 'Email',
      render: (r) => <span className="font-mono text-xs text-slate-400">{r.email || r.phone || '—'}</span>,
    },
    {
      key: 'referred', header: 'Date Referred',
      render: (r) => <span className="font-mono text-xs">{date(r.dateReferred)}</span>,
    },
    { key: 'joined', header: 'Joined', render: (r) => <Bool on={r.joined} /> },
    {
      key: 'userType', header: 'User Type',
      render: (r) => (r.userType
        ? <span className="capitalize text-slate-300">{r.userType}</span>
        : <span className="text-slate-600">—</span>),
    },
    { key: 'verified', header: 'Verified', render: (r) => <Bool on={r.verified} /> },
    { key: 'firstBooking', header: 'First Booking', render: (r) => <Bool on={r.firstBooking} /> },
    { key: 'status', header: 'Status', render: (r) => <Badge value={r.status} /> },
  ];

  if (error) return <ErrorBox error={error} onRetry={load} />;

  return (
    <>
      <PageHeader
        title="Referrals"
        subtitle="Platform-wide referral tracking for nannies and families"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <StatCard label="Total Referrals" value={summary.total ?? 0} icon={<IconReferrals size={17} />} tone="blue" />
        <StatCard label="Successful" value={summary.successful ?? 0} icon={<IconCheck size={17} />} tone="emerald" />
        <StatCard label="Pending" value={summary.pending ?? 0} icon={<IconClock size={17} />} tone="amber" />
        <StatCard
          label="Success Rate" value={`${summary.successRate ?? 0}%`}
          icon={<IconTrend size={17} />} tone="violet"
        />
      </div>

      <h3 className="font-semibold text-white mb-3">All Referral Contacts</h3>
      <Table
        columns={columns}
        rows={data.rows || []}
        loading={loading}
        empty="No referrals yet. They appear here once someone joins through a referral link."
      />
    </>
  );
}
