import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, XAxis, ResponsiveContainer, Tooltip,
} from 'recharts';
import api from '../lib/api.js';
import {
  PageHeader, StatCard, Badge, Skeleton, ErrorBox, money, date, Avatar,
} from '../components/ui.jsx';
import {
  IconNanny, IconShield, IconFamily, IconCalendar, IconActivity, IconClock,
  IconSupport, IconPayments, IconRefresh, IconDollar, IconAlert, IconTrend,
} from '../components/icons.jsx';

const SEVERITY = {
  critical: 'text-red-400 bg-red-400',
  high: 'text-orange-400 bg-orange-400',
  medium: 'text-amber-400 bg-amber-400',
  low: 'text-slate-400 bg-slate-400',
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [actions, setActions] = useState([]);
  const [recent, setRecent] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      api('/dashboard/stats'),
      api('/dashboard/actions'),
      api('/bookings?limit=6'),
    ])
      .then(([s, a, b]) => {
        setStats(s);
        setActions(a.items || []);
        setRecent(b.items || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading && !stats) return <Skeleton rows={8} />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  const { users = {}, bookings = {}, revenue = {}, support = {}, trend = [] } = stats || {};

  // The API only returns days that had activity; fill the gaps so the 14-day
  // window is continuous and the trend line reads honestly.
  const byDay = Object.fromEntries(trend.map((t) => [t._id, t]));
  const series = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const iso = d.toISOString().slice(0, 10);
    const row = byDay[iso];
    return { day: iso.slice(5), bookings: row?.count || 0, revenue: row?.revenue || 0 };
  });

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`Platform overview — ${date(new Date())}`}
        actions={
          <button className="btn-ghost" onClick={load} disabled={loading}>
            <IconRefresh size={15} /> Refresh
          </button>
        }
      />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 mb-4">
        <StatCard
          label="Total Nannies" value={users.nannies ?? 0} tone="blue" icon={<IconNanny size={17} />}
          hint={`${users.pendingNannies || 0} pending verification`}
        />
        <StatCard
          label="Verified Nannies" value={users.verifiedNannies ?? 0} tone="emerald" icon={<IconShield size={17} />}
          hint={users.nannies ? `${Math.round((users.verifiedNannies / users.nannies) * 100)}% verified` : '—'}
        />
        <StatCard
          label="Active Families/Customers" value={users.families ?? 0} tone="violet" icon={<IconFamily size={17} />}
          hint={`${users.suspendedFamilies || 0} suspended`}
        />
        <StatCard
          label="Upcoming Bookings" value={bookings.upcoming ?? 0} tone="amber" icon={<IconCalendar size={17} />}
          hint={bookings.nextUpcomingDate ? `Next: ${date(bookings.nextUpcomingDate)}` : 'None scheduled'}
        />
        <StatCard
          label="Ongoing Bookings" value={bookings.active ?? 0} tone="blue" icon={<IconActivity size={17} />}
          hint={bookings.otpPending ? `${bookings.otpPending} OTP pending` : 'All confirmed'}
        />
        <StatCard
          label="Pending Requests" value={bookings.pendingRequests ?? 0} tone="amber" icon={<IconClock size={17} />}
          hint="awaiting nanny response"
        />
        <StatCard
          label="Open Tickets" value={support.openTickets ?? 0} tone="red" icon={<IconSupport size={17} />}
          hint={`${support.criticalTickets || 0} critical/high`}
        />
        <StatCard
          label="Payments Pending" value={revenue.pendingCount ?? 0} tone="violet" icon={<IconPayments size={17} />}
          hint={`${money(revenue.pendingAmount)} total`}
        />
        <StatCard
          label="Refunds In Process" value={revenue.refundsInProcess ?? 0} tone="violet" icon={<IconRefresh size={17} />}
          hint={`${money(revenue.refundsAmount)} pending`}
        />
        <StatCard
          label="Total Revenue" value={money(revenue.total)} tone="emerald" icon={<IconDollar size={17} />}
          hint="all completed payments"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mb-4">
        {/* Action Required — the prioritised work queue. */}
        <div className="card lg:col-span-2 flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-ink-800">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <span className="text-amber-400"><IconAlert size={17} /></span>
              Action Required
            </h3>
            <span className="text-xs font-mono text-slate-500">
              {actions.reduce((n, a) => n + (a.count || 1), 0)} items
            </span>
          </div>

          {actions.length === 0 ? (
            <p className="p-10 text-center text-sm text-slate-500">
              Nothing needs attention right now.
            </p>
          ) : (
            <ul className="divide-y divide-ink-800">
              {actions.map((a, i) => {
                const [text, dot] = (SEVERITY[a.severity] || SEVERITY.low).split(' ');
                return (
                  <li key={i} className="flex items-center gap-4 px-5 py-3.5">
                    <span className={`flex items-center gap-1.5 text-[11px] font-mono w-16 shrink-0 ${text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                      {a.severity}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-200 truncate">{a.title}</p>
                      <p className="text-xs font-mono text-slate-500 truncate">{a.subtitle}</p>
                    </div>
                    <span className="text-xs font-mono text-slate-500">{a.count}</span>
                    <button
                      onClick={() => navigate(a.link)}
                      className="text-xs font-medium text-brand-400 hover:text-brand-300 shrink-0"
                    >
                      {a.action}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="space-y-4">
          <ChartCard title="Bookings / 14 days" icon={<IconTrend size={15} />}>
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={series} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
                <defs>
                  <linearGradient id="bookingFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTip suffix=" bookings" />} cursor={{ stroke: '#334155' }} />
                <Area type="monotone" dataKey="bookings" stroke="#3b82f6" strokeWidth={2} fill="url(#bookingFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Revenue / 14 days" icon={<IconDollar size={15} />}>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={series} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
                <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTip money />} cursor={{ fill: '#1e293b50' }} />
                <Bar dataKey="revenue" fill="#22c55e" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-ink-800">
          <h3 className="font-semibold text-white">Recent Bookings</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-ink-800">
              <tr>
                {['Booking ID', 'Family/Customer', 'Nanny', 'Date', 'Type', 'Status', 'Payment'].map((h) => (
                  <th key={h} className="th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {recent.map((b) => (
                <tr
                  key={b._id}
                  className="cursor-pointer hover:bg-ink-800/60"
                  onClick={() => navigate('/bookings')}
                >
                  <td className="td font-mono text-brand-400">#{b.bookingNumber}</td>
                  <td className="td">
                    <span className="flex items-center gap-2">
                      <Avatar name={b.family?.fullName} size="sm" />
                      {b.family?.fullName || '—'}
                    </span>
                  </td>
                  <td className="td">{b.nanny?.fullName || '—'}</td>
                  <td className="td font-mono text-xs">{date(b.startDate)}</td>
                  <td className="td text-xs">{b.isMultiDay ? 'Multiple Days' : 'Single Day'}</td>
                  <td className="td"><Badge value={statusOf(b)} /></td>
                  <td className="td"><Badge value={b.paymentStatus || 'pending'} /></td>
                </tr>
              ))}
              {!recent.length && (
                <tr><td colSpan={7} className="td text-center text-slate-500 py-10">No bookings yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/** A booking awaiting a replacement reads as its own status in the UI. */
export const statusOf = (b) =>
  b.subStatus === 'nanny_cancelled_awaiting_replacement' ? 'replacement_needed' : b.status;

function ChartCard({ title, icon, children }) {
  return (
    <div className="card p-4">
      <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
        <span className="text-slate-600">{icon}</span>{title}
      </p>
      {children}
    </div>
  );
}

function ChartTip({ active, payload, label, suffix = '', money: isMoney }) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  return (
    <div className="bg-ink-800 border border-ink-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="font-mono text-slate-500">{label}</p>
      <p className="text-slate-100 font-medium">
        {isMoney ? money(v) : `${v}${suffix}`}
      </p>
    </div>
  );
}
