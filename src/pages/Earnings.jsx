import { useEffect, useState } from 'react';
import api from '../lib/api.js';
import { PageHeader, Skeleton, ErrorBox, money } from '../components/ui.jsx';

/**
 * What the business made, and what it owes.
 *
 * Two numbers meet on every booking, and confusing them is how the platform
 * ended up earning nothing for months:
 *
 *   charged — the family's price, from our rate card. Depends on how many
 *             children, not on who was booked.
 *   paid    — the nanny's own agreed rate. Admin-side only; a family never
 *             sees it.
 *
 * Commission is the difference. It is shown per booking as well as in total,
 * because "we made X this month" is only trustworthy if you can see which
 * jobs it came from.
 *
 * Completed days only. A booking that has not been worked has earned nothing,
 * and counting scheduled work as revenue is how a dashboard starts disagreeing
 * with the bank.
 */

/** The first of this month, and today — the default period. */
function defaultRange() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const iso = (d) => d.toISOString().slice(0, 10);
  return { from: iso(first), to: iso(now) };
}

function Stat({ label, value, tone = 'slate', hint }) {
  const tones = {
    slate: 'text-slate-100',
    green: 'text-emerald-400',
    amber: 'text-amber-400',
    red: 'text-rose-400',
  };
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold font-mono ${tones[tone]}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

export default function Earnings() {
  const [range, setRange] = useState(defaultRange);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    api(`/earnings?from=${range.from}&to=${range.to}`)
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [range.from, range.to]);

  const t = data?.totals;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Earnings"
        subtitle="What we charged, what we paid out, and what we kept — completed work only."
      />

      <div className="card p-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="block text-xs text-slate-500 mb-1">From</span>
          <input
            type="date" className="input" value={range.from}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
          />
        </label>
        <label className="text-sm">
          <span className="block text-xs text-slate-500 mb-1">To</span>
          <input
            type="date" className="input" value={range.to}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
          />
        </label>
        <button type="button" className="btn-ghost" onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && <ErrorBox error={error} onRetry={load} />}
      {loading && <Skeleton rows={4} />}

      {!loading && !error && data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Charged to families" value={money(t.charged)}
              hint={`${t.bookings} booking${t.bookings === 1 ? '' : 's'}, ${t.days} day${t.days === 1 ? '' : 's'}`}
            />
            <Stat label="Paid to nannies" value={money(t.paidToNannies)} tone="amber" />
            <Stat label="Refunded" value={money(t.refunded)} tone="red" />
            <Stat
              label="Our commission" value={money(t.commission)} tone="green"
              hint={t.charged ? `${Math.round((t.commission / t.charged) * 100)}% of what we charged` : null}
            />
          </div>

          {/* A booking with no recorded nanny rate cannot be settled, and its
              whole family payment looks like profit. Said plainly rather than
              left to make the totals quietly wrong. */}
          {data.unpriced?.length > 0 && (
            <div className="card p-4 border-l-4 border-amber-500/70">
              <div className="font-medium text-amber-300">
                {data.unpriced.length} booking{data.unpriced.length === 1 ? ' has' : 's have'} no nanny rate recorded
              </div>
              <p className="mt-1 text-sm text-slate-400">
                Until a rate is set on these nannies, their pay counts as zero and the
                commission above is overstated by whatever they are actually owed.
              </p>
              <ul className="mt-2 text-sm text-amber-200/90 font-mono">
                {data.unpriced.slice(0, 8).map((u) => (
                  <li key={u.bookingNumber}>#{u.bookingNumber} — {u.nanny}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="th">Booking</th>
                  <th className="th">Nanny</th>
                  <th className="th">Family</th>
                  <th className="th text-right">Days</th>
                  <th className="th text-right">Charged</th>
                  <th className="th text-right">Paid out</th>
                  <th className="th text-right">Commission</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-800">
                {data.rows.map((r) => (
                  <tr key={r.bookingId} className={r.missingNannyRate ? 'bg-amber-500/5' : undefined}>
                    <td className="px-4 py-3 font-mono">#{r.bookingNumber}</td>
                    <td className="px-4 py-3">
                      {r.nanny}
                      {/* Her rate against the family's, so the margin on this
                          job is visible without opening anything. */}
                      <div className="text-xs text-slate-500 font-mono">
                        {r.nannyHourlyRate ? `${money(r.nannyHourlyRate)}/hr` : 'no rate set'}
                        {r.familyHourlyRate ? ` · charged ${money(r.familyHourlyRate)}/hr` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3">{r.family}</td>
                    <td className="px-4 py-3 text-right font-mono">{r.completedDays}</td>
                    <td className="px-4 py-3 text-right font-mono">{money(r.charged)}</td>
                    <td className="px-4 py-3 text-right font-mono text-amber-400">{money(r.paidToNannies)}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-400">
                      {money(r.commission)}
                    </td>
                  </tr>
                ))}
                {!data.rows.length && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                      No completed work in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
