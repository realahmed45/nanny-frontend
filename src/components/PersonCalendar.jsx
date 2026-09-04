import { useEffect, useMemo, useState } from 'react';
import api from '../lib/api.js';
import { Skeleton, ErrorBox, money } from './ui.jsx';

/**
 * One person's month.
 *
 * The platform calendar answers "what is happening"; this answers "what is
 * this nanny working" or "when does this family have care" — so it carries
 * times and per-day state rather than just a label, and it summarises the
 * month, which is the thing anyone opening a profile actually wants to know.
 */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const pad = (n) => String(n).padStart(2, '0');
const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * A day's colour says what happened on that day, not what the booking as a
 * whole is doing — one day can be completed while the booking runs on.
 */
const DAY_TONE = {
  completed: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  cancelled: 'bg-slate-500/15 text-slate-500 border-slate-500/30 line-through',
  scheduled: 'bg-violet-500/15 text-violet-300 border-violet-500/40',
  awaiting_arrival: 'bg-blue-500/15 text-blue-300 border-blue-500/40',
  awaiting_end_of_service: 'bg-blue-500/15 text-blue-300 border-blue-500/40',
};

const STATUS_TONE = {
  ongoing: 'bg-blue-500/15 text-blue-300 border-blue-500/40',
  upcoming: 'bg-violet-500/15 text-violet-300 border-violet-500/40',
  completed: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  cancelled: 'bg-slate-500/15 text-slate-500 border-slate-500/30',
  replacement_needed: 'bg-red-500/15 text-red-300 border-red-500/50',
  pending_payment: 'bg-orange-500/15 text-orange-300 border-orange-500/40',
  blocked: 'bg-slate-700/40 text-slate-500 border-slate-600/40',
};

const toneFor = (e) => DAY_TONE[e.dayStatus] || STATUS_TONE[e.status] || STATUS_TONE.upcoming;

export default function PersonCalendar({ role, personId, onBooking }) {
  const [cursor, setCursor] = useState(() => new Date());
  const [events, setEvents] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openDate, setOpenDate] = useState(null);

  const month = monthKey(cursor);

  useEffect(() => {
    if (!personId) return;
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ month, [role]: personId });
    api(`/calendar?${qs}`)
      .then((r) => { setEvents(r.events || []); setSummary(r.summary || null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [month, personId, role]);

  // The grid, Monday-first — the week the booking days are described in.
  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const m = cursor.getMonth();
    // getDay() is Sunday-first; shift so Monday leads.
    const lead = (new Date(year, m, 1).getDay() + 6) % 7;
    const days = new Date(year, m + 1, 0).getDate();

    const out = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= days; d += 1) out.push(`${year}-${pad(m + 1)}-${pad(d)}`);
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [cursor]);

  const byDate = useMemo(() => {
    const map = {};
    for (const e of events) (map[e.date] ||= []).push(e);
    // Earliest first, so a day reads in the order it is worked.
    for (const day of Object.values(map)) {
      day.sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
    }
    return map;
  }, [events]);

  const today = isoOf(new Date());
  const shift = (delta) => {
    setOpenDate(null);
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));
  };

  if (error) return <ErrorBox error={error} />;

  const selected = openDate ? byDate[openDate] || [] : null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h4 className="text-sm font-semibold text-white">
          {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
        </h4>
        <div className="flex gap-2">
          <button className="btn-ghost text-xs" onClick={() => shift(-1)}>← Prev</button>
          <button
            className="btn-ghost text-xs"
            onClick={() => { setOpenDate(null); setCursor(new Date()); }}
          >
            Today
          </button>
          <button className="btn-ghost text-xs" onClick={() => shift(1)}>Next →</button>
        </div>
      </div>

      {/* What the month adds up to — the reason to open a profile at all. */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <div className="rounded-lg bg-ink-950/60 border border-ink-800 p-2.5">
            <div className="text-[11px] text-slate-500">Days</div>
            <div className="text-sm text-white font-mono">{summary.days}</div>
          </div>
          <div className="rounded-lg bg-ink-950/60 border border-ink-800 p-2.5">
            <div className="text-[11px] text-slate-500">Hours</div>
            <div className="text-sm text-white font-mono">{summary.hours}h</div>
          </div>
          <div className="rounded-lg bg-ink-950/60 border border-ink-800 p-2.5">
            <div className="text-[11px] text-slate-500">Bookings</div>
            <div className="text-sm text-white font-mono">{summary.bookings}</div>
          </div>
          <div className="rounded-lg bg-ink-950/60 border border-ink-800 p-2.5">
            <div className="text-[11px] text-slate-500">
              {role === 'nanny' ? 'Booking value' : 'Cost'}
            </div>
            <div className="text-sm text-white font-mono">{money(summary.value)}</div>
          </div>
        </div>
      )}

      {loading ? <Skeleton rows={5} /> : (
        <div className="overflow-x-auto">
          <div className="min-w-[560px]">
            <div className="grid grid-cols-7 mb-1">
              {DAY_NAMES.map((d) => (
                <div key={d} className="px-1.5 py-1.5 text-[11px] font-mono text-slate-500">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 border-t border-l border-ink-800">
              {cells.map((iso, i) => {
                const dayEvents = iso ? byDate[iso] || [] : [];
                const isToday = iso === today;
                return (
                  <div
                    key={i}
                    onClick={dayEvents.length ? () => setOpenDate(iso === openDate ? null : iso) : undefined}
                    className={`min-h-[74px] border-r border-b border-ink-800 p-1 ${
                      iso ? '' : 'bg-ink-950/60'
                    } ${dayEvents.length ? 'cursor-pointer hover:bg-ink-800/40' : ''} ${
                      iso === openDate ? 'bg-ink-800/60' : ''
                    }`}
                  >
                    {iso && (
                      <>
                        <span
                          className={`inline-block text-[11px] font-mono mb-1 px-1.5 py-0.5 rounded ${
                            isToday ? 'bg-brand-600 text-white font-semibold' : 'text-slate-500'
                          }`}
                        >
                          {Number(iso.slice(-2))}
                        </span>
                        <div className="space-y-0.5">
                          {dayEvents.slice(0, 2).map((e, j) => (
                            <div
                              key={j}
                              title={`${e.time ? `${e.time} · ` : ''}${e.label}`}
                              className={`text-[10px] leading-tight px-1 py-0.5 rounded border truncate ${toneFor(e)}`}
                            >
                              {e.status === 'blocked'
                                ? 'Unavailable'
                                : `${e.time || ''} ${role === 'nanny' ? (e.family || '') : (e.nanny || 'Nanny')}`.trim()}
                            </div>
                          ))}
                          {dayEvents.length > 2 && (
                            <p className="text-[10px] text-slate-500 px-1">
                              +{dayEvents.length - 2} more
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* The chosen day in full, since a cell can only ever hint. */}
      {selected && selected.length > 0 && (
        <div className="mt-4 rounded-lg border border-ink-800 bg-ink-950/60 p-3">
          <div className="flex items-center justify-between mb-2">
            <h5 className="text-xs font-mono uppercase tracking-wider text-slate-500">
              {new Date(`${openDate}T00:00:00`).toLocaleDateString(undefined, {
                weekday: 'long', day: 'numeric', month: 'long',
              })}
            </h5>
            <button className="text-xs text-slate-500 hover:text-slate-300" onClick={() => setOpenDate(null)}>
              Close
            </button>
          </div>

          <div className="space-y-2">
            {selected.map((e, i) => (
              <div
                key={i}
                onClick={e.bookingNumber ? () => onBooking?.(e) : undefined}
                className={`flex flex-wrap items-center gap-3 rounded px-2.5 py-2 border ${toneFor(e)} ${
                  e.bookingNumber ? 'cursor-pointer' : ''
                }`}
              >
                <span className="font-mono text-xs w-24">
                  {e.time ? `${e.time}${e.endTime ? `–${e.endTime}` : ''}` : '—'}
                </span>
                <span className="text-xs flex-1 min-w-[120px]">
                  {e.status === 'blocked'
                    ? 'Marked unavailable'
                    : role === 'nanny' ? e.family : (e.nanny || 'Nanny not yet assigned')}
                </span>
                {e.bookingNumber && (
                  <span className="font-mono text-[11px] opacity-70">#{e.bookingNumber}</span>
                )}
                {e.hours ? <span className="text-[11px] opacity-70">{e.hours}h</span> : null}
                {e.isEmergency && (
                  <span className="text-[10px] px-1 rounded bg-red-500/20 text-red-300">URGENT</span>
                )}
                {e.rateLabel && (
                  <span className="text-[10px] opacity-70">{e.rateLabel}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && events.length === 0 && (
        <p className="text-xs text-slate-600 text-center py-6">
          Nothing booked in {MONTHS[cursor.getMonth()]}.
        </p>
      )}
    </div>
  );
}
