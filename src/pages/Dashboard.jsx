import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import api from '../lib/api.js';
import { PageHeader, StatCard, Skeleton, ErrorBox, money } from '../components/ui.jsx';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    setError('');
    api('/dashboard/stats').then(setStats).catch((e) => setError(e.message));
  };
  useEffect(load, []);

  if (error) return <ErrorBox error={error} onRetry={load} />;
  if (!stats) return <Skeleton rows={6} />;

  const trend = (stats.trend || []).map((t) => ({
    date: new Date(t._id).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
    bookings: t.count,
    revenue: Math.round(t.revenue || 0),
  }));

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Live overview of bookings, nannies and revenue"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <StatCard label="Active Bookings" value={stats.bookings.active} icon="🔵"
          hint={`${stats.bookings.upcoming} upcoming`} tone="brand" />
        <StatCard label="Verified Nannies" value={stats.users.verifiedNannies} icon="👩"
          hint={`${stats.users.pendingNannies} awaiting verification`}
          tone={stats.users.pendingNannies > 0 ? 'warn' : 'default'} />
        <StatCard label="Families" value={stats.users.families} icon="👨‍👩‍👧" />
        <StatCard label="Total Revenue" value={money(stats.revenue.total)} icon="💰"
          hint={`${money(stats.revenue.thisWeek)} this week`} tone="positive" />
      </div>

      {stats.users.pendingNannies > 0 && (
        <Link to="/nannies?status=pending_verification"
          className="card p-4 mb-6 flex items-center justify-between hover:bg-amber-50 border-amber-200 bg-amber-50/60">
          <div className="flex items-center gap-3">
            <span className="text-xl">⏳</span>
            <div>
              <p className="text-sm font-medium text-amber-900">
                {stats.users.pendingNannies} nann{stats.users.pendingNannies === 1 ? 'y' : 'ies'} awaiting verification
              </p>
              <p className="text-xs text-amber-700">Review documents so they become visible to families.</p>
            </div>
          </div>
          <span className="text-sm font-medium text-amber-900">Review →</span>
        </Link>
      )}

      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <div className="card p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Bookings — last 14 days</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Line type="monotone" dataKey="bookings" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Revenue — last 14 days</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(v) => money(v)} />
                <Bar dataKey="revenue" fill="#a78bfa" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Completed Bookings" value={stats.bookings.completed} tone="positive" />
        <StatCard label="Cancelled Bookings" value={stats.bookings.cancelled} tone="negative" />
        <StatCard label="Refunded" value={money(stats.revenue.refunded)} tone="warn" />
        <StatCard label="Open Support Tickets" value={stats.support.openTickets}
          tone={stats.support.openTickets > 0 ? 'warn' : 'default'} />
      </div>
    </>
  );
}
