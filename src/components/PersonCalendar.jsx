import { useEffect, useMemo, useState } from 'react';
import api from '../lib/api.js';
import { Skeleton, ErrorBox, money } from './ui.jsx';
import WeekCalendar, { startOfWeek } from './WeekCalendar.jsx';
import DayBookingsModal from './DayBookingsModal.jsx';

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
  // Week first: a busy day has more bookings than a month cell can show, and
  // hiding the rest behind a count is what made them unreachable.
  const [span, setSpan] = useState('week');
  const [cursor, setCursor] = useState(() => new Date());
  const [events, setEvents] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openDate, setOpenDate] = useState(null);

  const month = monthKey(cursor);
  const weekStart = useMemo(() => startOfWeek(cursor), [cursor]);

  // A week can straddle two months; both are fetched so a Monday at the end
  // of a month is not silently empty.
  const months = useMemo(() => {
    if (span === 'month') return [month];
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    return [...new Set([monthKey(weekStart), monthKey(end)])];
  }, [span, month, weekStart]);

  useEffect(() => {
    if (!personId) return;
    setLoading(true);
    setError(null);
    Promise.all(months.map((m) => {
      const qs = new URLSearchParams({ month: m, [role]: personId });
      return api(`/calendar?${qs}`);
    }))
      .then((rs) => {
        setEvents(rs.flatMap((r) => r.events || []));
        // Totals are summed across whatever was fetched, so the figures
        // always describe the period on screen.
        setSummary(rs.reduce((acc, r) => {
          const s = r.summary || {};
          return {
            days: (acc.days || 0) + (s.days || 0),
            hours: (acc.hours || 0) + (s.hours || 0),
            bookings: (acc.bookings || 0) + (s.bookings || 0),
            value: (acc.value || 0) + (s.value || 0),
          };
        }, {}));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [months.join(','), personId, role]);

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
    if (span === 'week') {
      const next = new Date(cursor);
      next.setDate(next.getDate() + delta * 7);
      setCursor(next);
      return;
    }
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));
  };

  const rangeLabel = () => {
    if (span === 'month') return `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    return weekStart.getMonth() === end.getMonth()
      ? `${weekStart.getDate()} – ${end.getDate()} ${MONTHS[end.getMonth()]}`
      : `${weekStart.getDate()} ${MONTHS[weekStart.getMonth()].slice(0, 3)} – ${end.getDate()} ${MONTHS[end.getMonth()].slice(0, 3)}`;
  };

  if (error) return <ErrorBox error={error} />;

  const selected = openDate ? byDate[openDate] || [] : null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h4 className="text-sm font-semibold text-white">{rangeLabel()}</h4>
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-lg border border-ink-800 overflow-hidden">
            {['week', 'month'].map((s) => (
              <button
                key={s}
                onClick={() => { setSpan(s); setOpenDate(null); }}
                className={`px-2.5 py-1 text-xs capitalize transition-colors ${
                  span === s ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
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

      {loading ? <Skeleton rows={5} /> : span === 'week' ? (
        <WeekCalendar
          weekStart={weekStart}
          events={events}
          onBooking={onBooking}
          showNanny={role !== 'nanny'}
          showFamily={role !== 'family'}
        />
      ) : (
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
                            <button
                              type="button"
                              className="w-full text-[10px] font-medium text-brand-300 bg-brand-500/10 hover:bg-brand-500/25 border border-brand-500/30 rounded px-1 py-0.5 transition-colors"
                            >
                              +{dayEvents.length - 2} more →
                            </button>
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

      <DayBookingsModal
        date={openDate}
        events={selected || []}
        onClose={() => setOpenDate(null)}
        onBooking={(e) => { setOpenDate(null); onBooking?.(e); }}
        showNanny={role !== 'nanny'}
        showFamily={role !== 'family'}
      />

      {!loading && events.length === 0 && span === 'month' && (
        <p className="text-xs text-slate-600 text-center py-6">
          Nothing booked in {MONTHS[cursor.getMonth()]}.
        </p>
      )}
    </div>
  );
}
