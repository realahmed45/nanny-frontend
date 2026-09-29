import { useEffect, useState } from 'react';
import api from '../lib/api.js';
import { PageHeader, Skeleton, ErrorBox, money } from '../components/ui.jsx';

/**
 * Are the money safeguards holding?
 *
 * Four things were fixed in code and were provable only by reading it, which is
 * no use to whoever runs the business: a fix you cannot see is the same as a
 * fix that quietly stopped working. Each row asks a plain question, answers it
 * from live data, and says what to do when the answer is wrong.
 *
 * Read fresh on every visit, so a check that passes today and fails next month
 * says so on its own.
 */

/** What to do when a check goes red. Kept here so the page is self-explaining. */
const REMEDY = {
  advances:
    'Stop approving payouts and tell me. This means an advance was collected more than once, '
    + 'which takes money out of a nanny’s wages.',
  specialPayouts:
    'Add a cost entry for each payout named below, dated when it was paid. Until then, '
    + 'reported profit is higher than the real figure by that amount.',
  media:
    'Nothing automatic. If any older ID scans or receipts are among the public files and that '
    + 'worries you, they can be moved — it touches live data, so it is a planned job.',
  wages:
    'Check the payouts page. Money that has been earned is not reaching nannies, and the weekly '
    + 'release has probably stopped running.',
};

function Figure({ label, value }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="font-mono tabular-nums text-sm mt-0.5">{value}</div>
    </div>
  );
}

function Check({ check }) {
  const ok = check.healthy;
  const f = check.figures || {};

  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span
          className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${ok ? 'bg-emerald-400' : 'bg-red-400'}`}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="font-semibold">{check.title}</h3>
            <span
              className={`text-[11px] font-mono uppercase tracking-wider ${ok ? 'text-emerald-400' : 'text-red-400'}`}
            >
              {ok ? 'Holding' : 'Needs attention'}
            </span>
          </div>

          <p className="text-xs text-slate-500 mt-0.5">{check.question}</p>
          <p className="text-sm text-slate-300 mt-2">{check.detail}</p>

          {/* Only shown when something is wrong: a remedy beside a green row is
              noise, and noise is what stops people reading these. */}
          {!ok && REMEDY[check.key] && (
            <p className="mt-3 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              <span className="font-semibold">What to do: </span>
              {REMEDY[check.key]}
            </p>
          )}

          {check.key === 'advances' && (
            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
              <Figure label="Advances given" value={money(f.advancesIssued)} />
              <Figure label="Still owed" value={money(f.stillOwed)} />
              <Figure label="Collected back" value={money(f.recovered)} />
              <Figure label="Difference" value={money(f.drift)} />
            </div>
          )}

          {check.key === 'specialPayouts' && (
            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
              <Figure label="Special payouts" value={f.specialPayouts ?? 0} />
              <Figure label="Counted as a cost" value={f.withCost ?? 0} />
              <Figure label="Missing a cost" value={f.missingCost ?? 0} />
              {f.overstatedBy > 0 && (
                <Figure label="Profit overstated by" value={money(f.overstatedBy)} />
              )}
            </div>
          )}

          {check.key === 'media' && (
            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
              <Figure label="Need a login" value={f.privateFiles ?? 0} />
              <Figure label="On the public path" value={f.publicFiles ?? 0} />
            </div>
          )}

          {check.key === 'wages' && (
            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
              <Figure label="Earned, not yet sent" value={money(f.owedNow)} />
              <Figure label="Payouts waiting" value={f.pendingPayouts ?? 0} />
              <Figure label="Past their date" value={f.overdue ?? 0} />
            </div>
          )}

          {/* Named rows, so somebody can act on them rather than go hunting. */}
          {(check.missing || []).length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="pb-1 pr-4 font-medium">Payout</th>
                    <th className="pb-1 pr-4 font-medium">Amount</th>
                    <th className="pb-1 font-medium">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {check.missing.map((m) => (
                    <tr key={m.reference} className="border-t border-slate-700/60">
                      <td className="py-1.5 pr-4 font-mono">{m.reference}</td>
                      <td className="py-1.5 pr-4 font-mono tabular-nums">{money(m.amount)}</td>
                      <td className="py-1.5 text-slate-400">
                        {m.at ? new Date(m.at).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {(check.overdue || []).length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="pb-1 pr-4 font-medium">Payout</th>
                    <th className="pb-1 pr-4 font-medium">Amount</th>
                    <th className="pb-1 font-medium">Was due</th>
                  </tr>
                </thead>
                <tbody>
                  {check.overdue.map((m) => (
                    <tr key={m.reference} className="border-t border-slate-700/60">
                      <td className="py-1.5 pr-4 font-mono">{m.reference}</td>
                      <td className="py-1.5 pr-4 font-mono tabular-nums">{money(m.amount)}</td>
                      <td className="py-1.5 text-slate-400">
                        {m.due ? new Date(m.due).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Health() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    api('/finance/health')
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading) return <Skeleton rows={5} />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  const checks = data?.checks || [];
  const failing = checks.filter((c) => !c.healthy);

  return (
    <>
      <PageHeader
        title="System Health"
        subtitle={failing.length
          ? `${failing.length} of ${checks.length} checks need attention`
          : `All ${checks.length} checks holding · read ${new Date(data.checkedAt).toLocaleTimeString()}`}
        actions={
          <button className="btn-ghost" onClick={load}>
            Check again
          </button>
        }
      />

      <p className="text-sm text-slate-400 mb-4 max-w-2xl">
        Four things that were repaired, checked against live data rather than taken on
        trust. Each answers one question. Green means the safeguard is holding right
        now; red tells you what to do about it.
      </p>

      <div className="space-y-3">
        {checks.map((check) => (
          <Check key={check.key} check={check} />
        ))}
      </div>
    </>
  );
}
