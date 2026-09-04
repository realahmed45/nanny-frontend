import { useEffect, useState } from 'react';
import api from '../lib/api.js';
import {
  PageHeader, Table, Badge, StatCard, ErrorBox, Modal, Skeleton, date, dateTime, money,
} from '../components/ui.jsx';
import {
  IconReferrals, IconCheck, IconClock, IconTrend, IconX,
} from '../components/icons.jsx';

/** Green tick / red cross used for the boolean columns. */
const Bool = ({ on }) => (on
  ? <span className="text-emerald-400"><IconCheck size={16} /></span>
  : <span className="text-red-400"><IconX size={15} /></span>);

/**
 * Everything about one person's referrals, in both directions.
 *
 * Who they brought in and what came of each, who brought them in, and the
 * clicks that never became anything — the last of which is the only way to
 * tell a link nobody opened from one that opened and lost people.
 */
function ReferralDetail({ userId, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) return;
    setData(null);
    setError(null);
    api(`/referrals/${userId}`).then(setData).catch((e) => setError(e.message));
  }, [userId]);

  const s = data?.summary || {};

  return (
    <Modal open={!!userId} title={data?.user?.name || 'Referral detail'} onClose={onClose} wide>
      {error && <ErrorBox error={error} />}
      {!data && !error && <Skeleton rows={6} />}

      {data && (
        <div className="space-y-5">
          {/* Who they are, and what their code has earned them. */}
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-ink-950/60 border border-ink-800 p-3">
              <div className="text-xs text-slate-500 mb-1">Referral code</div>
              <div className="font-mono text-sm text-white">{data.user.referralCode || '—'}</div>
            </div>
            <div className="rounded-lg bg-ink-950/60 border border-ink-800 p-3">
              <div className="text-xs text-slate-500 mb-1">People referred</div>
              <div className="text-sm text-white">{s.referred ?? 0}</div>
            </div>
            <div className="rounded-lg bg-ink-950/60 border border-ink-800 p-3">
              <div className="text-xs text-slate-500 mb-1">Became customers</div>
              <div className="text-sm text-emerald-400">{s.successful ?? 0}</div>
            </div>
            <div className="rounded-lg bg-ink-950/60 border border-ink-800 p-3">
              <div className="text-xs text-slate-500 mb-1">Revenue from them</div>
              <div className="text-sm text-white">{money(s.revenue || 0)}</div>
            </div>
          </div>

          {/* Whether the discount is actually live right now. */}
          {s.discount && (
            <div className={`rounded-lg border p-3 ${
              s.discount.active
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : 'bg-ink-950/60 border-ink-800'
            }`}>
              <div className="text-xs text-slate-500 mb-1">Referral discount</div>
              <div className="text-sm text-white">
                {s.discount.active ? 'Active' : 'Not active'}
                <span className="text-slate-500"> · {s.discount.reason?.replace(/_/g, ' ')}</span>
              </div>
              {s.discount.expiresAt && (
                <div className="text-xs text-slate-400 mt-1">
                  {s.discount.active ? 'Expires' : 'Expired'} {dateTime(s.discount.expiresAt)}
                  {s.discount.days ? ` · ${s.discount.days} day window` : ''}
                </div>
              )}
              {data.user.firstReferralAt && (
                <div className="text-xs text-slate-500 mt-0.5">
                  First referral {date(data.user.firstReferralAt)}
                </div>
              )}
            </div>
          )}

          {/* Who referred them. */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-2">Referred by</h4>
            {data.referredBy ? (
              <div className="rounded-lg bg-ink-950/60 border border-ink-800 p-3 flex flex-wrap gap-4">
                <div>
                  <div className="text-sm text-white">{data.referredBy.name}</div>
                  <div className="text-xs text-slate-500 capitalize">{data.referredBy.role}</div>
                </div>
                <div className="font-mono text-xs text-slate-400 self-center">
                  {data.referredBy.referralCode}
                </div>
                <div className="text-xs text-slate-500 self-center">
                  joined {date(data.referredBy.joinedAt)}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-600">Came to us directly — nobody referred them.</p>
            )}
          </div>

          {/* Everyone they brought in. */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-2">
              People they referred
              <span className="ml-2 text-xs font-normal text-slate-500">{data.referrals.length}</span>
            </h4>
            {data.referrals.length === 0 ? (
              <p className="text-xs text-slate-600">Nobody yet.</p>
            ) : (
              <div className="space-y-2">
                {data.referrals.map((r) => (
                  <div
                    key={r._id}
                    className="rounded-lg bg-ink-950/60 border border-ink-800 p-3 flex flex-wrap items-center gap-3"
                  >
                    <div className="min-w-[150px] flex-1">
                      <div className="text-sm text-white">{r.name}</div>
                      <div className="text-xs text-slate-500 font-mono">{r.phone}</div>
                    </div>
                    <Badge value={r.role} />
                    <div className="text-xs text-slate-400 w-28">
                      joined {date(r.joinedAt)}
                    </div>
                    <div className="text-xs text-slate-400 w-24">
                      {r.bookings} booking{r.bookings === 1 ? '' : 's'}
                    </div>
                    <div className="text-xs text-slate-300 w-28 text-right font-mono">
                      {money(r.totalSpent)}
                    </div>
                    <Badge value={r.status} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* The clicks, converted or not. */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-2">
              Link clicks
              <span className="ml-2 text-xs font-normal text-slate-500">
                {s.clicksConverted ?? 0} of {s.clicks ?? 0} started a chat
              </span>
            </h4>
            {(data.clicks || []).length === 0 ? (
              <p className="text-xs text-slate-600">No clicks recorded.</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {data.clicks.map((c, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 text-xs rounded bg-ink-950/40 border border-ink-800 px-3 py-2"
                  >
                    <span className="text-slate-400 w-40">{dateTime(c.at)}</span>
                    <span className="text-slate-500 w-20">{c.device}</span>
                    <span className="font-mono text-slate-600 flex-1">{c.ip}</span>
                    {c.converted
                      ? <span className="text-emerald-400">started a chat</span>
                      : <span className="text-slate-600">no chat</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function Referrals() {
  const [data, setData] = useState({ rows: [], summary: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openId, setOpenId] = useState(null);

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
        onRowClick={(r) => setOpenId(r._id)}
        empty="No referrals yet. They appear here once someone joins through a referral link."
      />

      <ReferralDetail userId={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
