import { useEffect, useMemo, useState } from 'react';
import api from '../lib/api.js';
import { Tabs, Skeleton, ErrorBox, useToast } from '../components/ui.jsx';

/**
 * The service calendar: days priced differently, and days nobody works.
 *
 * Kept apart from the bookings calendar because it is a settings screen, not
 * a report — everything here changes what the bot will quote and accept, so
 * nothing saves until the operator presses Save.
 */

const SUB_TABS = [
  { value: 'days', label: 'Special Days' },
  { value: 'nyepi', label: 'Nyepi Settings' },
];

const ISO = /^\d{4}-\d{2}-\d{2}$/;

const pad = (n) => String(n).padStart(2, '0');
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Human-readable date, without pulling in a date library for one label. */
const pretty = (iso) => {
  if (!ISO.test(iso || '')) return iso || '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
};

const shiftIso = (iso, days) => {
  if (!ISO.test(iso || '')) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
};

export default function GeneralCalendar() {
  const { toast, notify, error: toastError } = useToast();
  const [sub, setSub] = useState('days');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [specialDays, setSpecialDays] = useState([]);
  const [nyepi, setNyepi] = useState({
    enabled: true, dates: [], blockBookings: true,
    eveDate: null, eveMultiplier: 1, dayAfterMultiplier: 1, notice: '',
  });

  const [newDate, setNewDate] = useState('');
  const [newNyepiDate, setNewNyepiDate] = useState('');

  const load = () => {
    setLoading(true);
    api('/settings')
      .then((s) => {
        setSpecialDays([...(s.calendar?.specialDays || [])]);
        setNyepi({ ...(s.calendar?.nyepi || {}) });
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const save = async () => {
    setSaving(true);
    try {
      await api('/settings', {
        method: 'PATCH',
        body: { calendar: { specialDays, nyepi } },
      });
      notify('Calendar saved. New bookings follow these rules immediately.');
      load();
    } catch (e) {
      toastError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const addDay = () => {
    if (!ISO.test(newDate)) return;
    if (specialDays.some((d) => d.date === newDate)) {
      toastError('That date already has a rule.');
      return;
    }
    setSpecialDays((p) => [...p, {
      date: newDate, label: '', multiplier: 1.5, closed: false,
    }].sort((a, b) => a.date.localeCompare(b.date)));
    setNewDate('');
  };

  const patchDay = (date, patch) =>
    setSpecialDays((p) => p.map((d) => (d.date === date ? { ...d, ...patch } : d)));

  const removeDay = (date) =>
    setSpecialDays((p) => p.filter((d) => d.date !== date));

  const addNyepiDate = () => {
    if (!ISO.test(newNyepiDate)) return;
    if ((nyepi.dates || []).includes(newNyepiDate)) return;
    setNyepi((p) => ({ ...p, dates: [...(p.dates || []), newNyepiDate].sort() }));
    setNewNyepiDate('');
  };

  // Only dates still ahead of us are worth showing an operator.
  const upcomingNyepi = useMemo(
    () => (nyepi.dates || []).filter((d) => d >= todayIso()),
    [nyepi.dates],
  );

  if (loading) return <Skeleton rows={6} />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  return (
    <>
      {toast}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-400">
          Days that are priced differently, or that we cannot staff at all.
        </p>
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      <Tabs tabs={SUB_TABS} active={sub} onChange={setSub} />

      {/* ------------------------- Special days ------------------------- */}
      {sub === 'days' && (
        <div className="card p-5">
          <h3 className="text-lg font-semibold text-white mb-1">Special days</h3>
          <p className="text-sm text-slate-400 mb-5">
            Public holidays and peak dates. A multiplier raises the price for that
            day only; closing a day removes it from bookings entirely.
          </p>

          <div className="flex flex-wrap items-end gap-3 mb-5 pb-5 border-b border-ink-800">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Add a date</label>
              <input
                type="date"
                className="input font-mono"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>
            <button className="btn-ghost" onClick={addDay} disabled={!ISO.test(newDate)}>
              + Add day
            </button>
          </div>

          {specialDays.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">
              No special days yet. Nyepi is handled on its own tab.
            </p>
          ) : (
            <div className="space-y-3">
              {specialDays.map((d) => (
                <div
                  key={d.date}
                  className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-ink-950/60 border border-ink-800"
                >
                  <div className="w-40 shrink-0">
                    <div className="text-sm text-white font-mono">{d.date}</div>
                    <div className="text-xs text-slate-500">{pretty(d.date)}</div>
                  </div>

                  <input
                    className="input flex-1 min-w-[160px]"
                    placeholder="Label (e.g. Galungan)"
                    value={d.label || ''}
                    onChange={(e) => patchDay(d.date, { label: e.target.value })}
                  />

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      className="input font-mono w-24"
                      value={d.multiplier ?? 1}
                      disabled={d.closed}
                      onChange={(e) => patchDay(d.date, { multiplier: Number(e.target.value) })}
                    />
                    <span className="text-xs text-slate-500">&times; price</span>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!d.closed}
                      onChange={(e) => patchDay(d.date, { closed: e.target.checked })}
                    />
                    <span className="text-xs text-slate-300">Closed</span>
                  </label>

                  <button
                    className="btn-ghost text-xs text-red-400"
                    onClick={() => removeDay(d.date)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ------------------------- Nyepi ------------------------- */}
      {sub === 'nyepi' && (
        <div className="space-y-5">
          <div className="card p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">
                  Nyepi — Balinese Day of Silence
                </h3>
                <p className="text-sm text-slate-400 max-w-2xl">
                  For twenty-four hours nobody may travel, work, or light a lamp, and
                  the airport closes. A nanny cannot reach a booking, so bookings on
                  Nyepi are refused when they are made rather than cancelled on the day.
                </p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={nyepi.enabled !== false}
                  onChange={(e) => setNyepi((p) => ({ ...p, enabled: e.target.checked }))}
                />
                <span className="text-sm text-slate-300">Enabled</span>
              </label>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={nyepi.blockBookings !== false}
                disabled={nyepi.enabled === false}
                onChange={(e) => setNyepi((p) => ({ ...p, blockBookings: e.target.checked }))}
              />
              <span>
                <span className="text-sm text-white">Refuse bookings on Nyepi</span>
                <span className="block text-xs text-slate-500">
                  Families/customers choosing this date are told why and asked for another.
                  Multi-day bookings skip the date and are not charged for it.
                </span>
              </span>
            </label>
          </div>

          <div className="card p-5">
            <h4 className="text-sm font-semibold text-white mb-1">Nyepi dates</h4>
            <p className="text-xs text-slate-500 mb-4">
              Nyepi moves each year with the Balinese Saka calendar, so the dates are
              entered rather than calculated. Add the next one each year.
            </p>

            <div className="flex flex-wrap items-end gap-3 mb-4">
              <input
                type="date"
                className="input font-mono"
                value={newNyepiDate}
                onChange={(e) => setNewNyepiDate(e.target.value)}
              />
              <button
                className="btn-ghost"
                onClick={addNyepiDate}
                disabled={!ISO.test(newNyepiDate)}
              >
                + Add date
              </button>
            </div>

            {(nyepi.dates || []).length === 0 ? (
              <p className="text-sm text-red-400">
                No dates set — nothing is being blocked.
              </p>
            ) : (
              <div className="space-y-2">
                {(nyepi.dates || []).map((d) => {
                  const past = d < todayIso();
                  return (
                    <div
                      key={d}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border ${
                        past
                          ? 'bg-ink-950/40 border-ink-800 opacity-50'
                          : 'bg-orange-500/10 border-orange-500/30'
                      }`}
                    >
                      <span className="font-mono text-sm text-white w-28">{d}</span>
                      <span className="text-xs text-slate-400 flex-1">{pretty(d)}</span>
                      {past && <span className="text-xs text-slate-500">past</span>}
                      <button
                        className="btn-ghost text-xs text-red-400"
                        onClick={() => setNyepi((p) => ({
                          ...p, dates: (p.dates || []).filter((x) => x !== d),
                        }))}
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="card p-5">
            <h4 className="text-sm font-semibold text-white mb-1">
              The days either side
            </h4>
            <p className="text-xs text-slate-500 mb-4">
              These days are workable, but they are not ordinary days. Melasti
              processions restrict travel the day before, and on Ngembak Geni the
              whole island moves at once. Leave a multiplier at 1 to price it normally.
            </p>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">
                  Nyepi eve (Melasti) &mdash; price multiplier
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.1"
                  className="input font-mono w-32"
                  value={nyepi.eveMultiplier ?? 1}
                  onChange={(e) => setNyepi((p) => ({
                    ...p, eveMultiplier: Number(e.target.value),
                  }))}
                />
                <p className="text-xs text-slate-500 mt-1.5">
                  Applied to the day before each Nyepi date
                  {upcomingNyepi[0] && (
                    <span className="font-mono text-slate-400">
                      {' '}({shiftIso(upcomingNyepi[0], -1)})
                    </span>
                  )}
                  .
                </p>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5">
                  Ngembak Geni (day after) &mdash; price multiplier
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.1"
                  className="input font-mono w-32"
                  value={nyepi.dayAfterMultiplier ?? 1}
                  onChange={(e) => setNyepi((p) => ({
                    ...p, dayAfterMultiplier: Number(e.target.value),
                  }))}
                />
                <p className="text-xs text-slate-500 mt-1.5">
                  Applied to the day after each Nyepi date
                  {upcomingNyepi[0] && (
                    <span className="font-mono text-slate-400">
                      {' '}({shiftIso(upcomingNyepi[0], 1)})
                    </span>
                  )}
                  .
                </p>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <h4 className="text-sm font-semibold text-white mb-1">
              What families are told
            </h4>
            <p className="text-xs text-slate-500 mb-3">
              Shown when someone picks a Nyepi date. Left blank, a standard
              explanation is used.
            </p>
            <textarea
              className="input min-h-[90px]"
              maxLength={500}
              placeholder="Nyepi is Bali's day of silence. Nobody may travel or work, so we cannot arrange care on this date."
              value={nyepi.notice || ''}
              onChange={(e) => setNyepi((p) => ({ ...p, notice: e.target.value }))}
            />
          </div>
        </div>
      )}
    </>
  );
}
