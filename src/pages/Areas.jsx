import { useEffect, useState } from 'react';
import api from '../lib/api.js';
import { PageHeader, Skeleton, ErrorBox, useToast, money } from '../components/ui.jsx';

/**
 * The areas we serve, and what transport costs to reach each one.
 *
 * A flat 50,000–100,000 band was only ever shorthand for "it depends where you
 * are". Naming the areas lets the fee be a number rather than a range, and
 * gives the team one list to point at when a family asks whether we cover
 * them.
 *
 * Nothing saves until Save is pressed, the same as Pricing — an area list is
 * read out to customers, and a half-typed name should not be.
 */

const BLANK = { name: '', transportFee: 50000, active: true, notes: '' };

function FeeInput({ value, onChange, disabled }) {
  return (
    <div className="relative">
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-600 pointer-events-none">
        Rp
      </span>
      <input
        type="number"
        min="0"
        step="5000"
        disabled={disabled}
        className="input font-mono w-full pl-8 disabled:opacity-40"
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      />
    </div>
  );
}

export default function Areas() {
  const { toast, notify, error: toastError } = useToast();
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    api('/settings')
      .then((s) => {
        setAreas(s.areas || []);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const update = (i, patch) => setAreas((list) =>
    list.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));

  const add = () => setAreas((list) => [...list, { ...BLANK }]);

  // Removing is immediate in the form but only real on Save, so a misclick is
  // undone by leaving the page rather than by retyping everything.
  const remove = (i) => setAreas((list) => list.filter((_, idx) => idx !== i));

  const save = async () => {
    setSaving(true);
    try {
      await api('/settings', {
        method: 'PATCH',
        body: { areas: areas.map((a) => ({ ...a, transportFee: Number(a.transportFee) || 0 })) },
      });
      notify('Areas saved.');
      load();
    } catch (e) {
      // The server refuses duplicates and bad fees, and the reason is worth
      // showing rather than a generic failure.
      toastError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Skeleton rows={6} />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  const live = areas.filter((a) => a.active !== false);
  const fees = live.map((a) => Number(a.transportFee) || 0);

  const names = areas.map((a) => String(a.name || '').trim().toLowerCase()).filter(Boolean);
  const duplicate = names.find((n, i) => names.indexOf(n) !== i);

  return (
    <>
      {toast}
      <PageHeader
        title="Areas"
        subtitle={live.length
          ? `${live.length} area${live.length === 1 ? '' : 's'} served · transport ${money(Math.min(...fees))}–${money(Math.max(...fees))}`
          : 'Where we work, and what transport costs there'}
        actions={
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        }
      />

      <div className="card p-4 sm:p-5">
        <p className="text-sm text-slate-400 mb-5">
          The transport fee is what a family pays the nanny to reach them. An emergency
          adds its surcharge on top of whichever area applies — that amount is set on
          the <span className="text-slate-300">Pricing</span> page.
        </p>

        {areas.length === 0 ? (
          <p className="text-sm text-slate-600 rounded-lg border border-dashed border-ink-800 px-3 py-10 text-center">
            No areas yet. Add the first one below.
          </p>
        ) : (
          <div className="space-y-3">
            {/* Column headings on wide screens only — on a phone each field
                carries its own label instead. */}
            <div className="hidden sm:grid sm:grid-cols-[1fr_150px_110px_1fr_90px] gap-3 text-[11px] font-mono uppercase tracking-wider text-slate-500">
              <div>Area</div>
              <div>Transport fee</div>
              <div>Serving</div>
              <div>Notes</div>
              <div />
            </div>

            {areas.map((a, i) => (
              <div
                key={i}
                className="grid grid-cols-1 sm:grid-cols-[1fr_150px_110px_1fr_90px] gap-3 sm:items-center rounded-lg border border-ink-800 p-3 sm:border-0 sm:p-0"
              >
                <div>
                  <label className="block sm:hidden text-[11px] text-slate-500 mb-1">Area</label>
                  <input
                    className="input w-full"
                    placeholder="e.g. Seminyak"
                    value={a.name}
                    onChange={(e) => update(i, { name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block sm:hidden text-[11px] text-slate-500 mb-1">Transport fee</label>
                  <FeeInput
                    value={Number(a.transportFee)}
                    onChange={(v) => update(i, { transportFee: v })}
                    disabled={a.active === false}
                  />
                </div>

                <div>
                  <label className="block sm:hidden text-[11px] text-slate-500 mb-1">Serving</label>
                  {/* Switched off rather than deleted: bookings already made in
                      an area still have to make sense afterwards. */}
                  <button
                    type="button"
                    onClick={() => update(i, { active: a.active === false })}
                    className={`w-full sm:w-auto rounded-full px-3 py-1.5 text-xs ${
                      a.active === false
                        ? 'bg-ink-800 text-slate-500'
                        : 'bg-emerald-500/15 text-emerald-300'
                    }`}
                  >
                    {a.active === false ? 'Paused' : 'Serving'}
                  </button>
                </div>

                <div>
                  <label className="block sm:hidden text-[11px] text-slate-500 mb-1">Notes</label>
                  <input
                    className="input w-full text-sm"
                    placeholder="Optional"
                    value={a.notes || ''}
                    onChange={(e) => update(i, { notes: e.target.value })}
                  />
                </div>

                <button
                  className="btn-ghost text-xs text-red-400 justify-self-start"
                  onClick={() => remove(i)}
                  title="Remove this area"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <button className="btn-ghost text-xs mt-4" onClick={add}>
          + Add an area
        </button>

        {/* The server refuses duplicates; saying so here saves a round trip
            and a more confusing error. */}
        {duplicate && (
          <p className="mt-4 text-xs text-red-400">
            &ldquo;{duplicate}&rdquo; is listed twice — each area needs its own row.
          </p>
        )}
      </div>
    </>
  );
}
