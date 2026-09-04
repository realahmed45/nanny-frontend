import { useMemo } from 'react';
import { money } from './ui.jsx';

/**
 * A week, as seven columns of full days.
 *
 * The month grid has to truncate — a cell that fits three of eleven bookings
 * hides the other eight behind a "+8 more" that leads nowhere. A week gives
 * each day a whole column, so every booking on it is listed with both names
 * and nothing is cut off.
 */

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const pad = (n) => String(n).padStart(2, '0');
const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** The Monday on or before a date — the week the booking days are described in. */
export function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

const TONE = {
  ongoing: 'bg-blue-500/10 border-blue-500/40',
  upcoming: 'bg-violet-500/10 border-violet-500/40',
  completed: 'bg-emerald-500/10 border-emerald-500/40',
  cancelled: 'bg-slate-500/10 border-slate-500/30 opacity-60',
  replacement_needed: 'bg-red-500/10 border-red-500/50',
  pending_payment: 'bg-orange-500/10 border-orange-500/40',
  blocked: 'bg-slate-700/30 border-slate-600/40',
};

/** A day's own state outranks the booking's: one day can be done, the rest not. */
const DAY_TONE = {
  completed: 'bg-emerald-500/10 border-emerald-500/40',
  cancelled: 'bg-slate-500/10 border-slate-500/30 opacity-60',
};

const toneFor = (e) => DAY_TONE[e.dayStatus] || TONE[e.status] || TONE.upcoming;

export default function WeekCalendar({ weekStart, events, onBooking, showNanny = true, showFamily = true }) {
  const days = useMemo(() => {
    const out = [];
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      out.push(isoOf(d));
    }
    return out;
  }, [weekStart]);

  const byDate = useMemo(() => {
    const map = {};
    for (const e of events) (map[e.date] ||= []).push(e);
    // Earliest first, so a column reads in the order the day is worked.
    for (const list of Object.values(map)) {
      list.sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
    }
    return map;
  }, [events]);

  const today = isoOf(new Date());

  return (
    <div className="overflow-x-auto">
      <div className="grid grid-cols-7 gap-2 min-w-[980px]">
        {days.map((iso, i) => {
          const dayEvents = byDate[iso] || [];
          const isToday = iso === today;
          const hours = dayEvents.reduce((s, e) => s + (e.hours || 0), 0);

          return (
            <div
              key={iso}
              className={`rounded-lg border ${
                isToday ? 'border-brand-500/60 bg-brand-500/5' : 'border-ink-800 bg-ink-950/40'
              }`}
            >
              {/* Column head: which day, and what it adds up to. */}
              <div className={`px-2.5 py-2 border-b ${isToday ? 'border-brand-500/40' : 'border-ink-800'}`}>
                <div className="flex items-baseline justify-between gap-1">
                  <span className={`text-xs font-medium ${isToday ? 'text-brand-300' : 'text-slate-300'}`}>
                    {DAY_NAMES[i].slice(0, 3)}
                  </span>
                  <span className={`text-sm font-mono ${isToday ? 'text-brand-300' : 'text-slate-500'}`}>
                    {Number(iso.slice(-2))}
                  </span>
                </div>
                <div className="text-[10px] text-slate-600 mt-0.5">
                  {dayEvents.length
                    ? `${dayEvents.length} booking${dayEvents.length === 1 ? '' : 's'}${hours ? ` · ${hours}h` : ''}`
                    : '—'}
                </div>
              </div>

              {/* Every booking on the day. Nothing is truncated. */}
              <div className="p-1.5 space-y-1.5 min-h-[80px]">
                {dayEvents.length === 0 && (
                  <p className="text-[10px] text-slate-700 px-1 py-2">Nothing booked</p>
                )}

                {dayEvents.map((e, j) => (
                  <div
                    key={`${e.bookingId || 'x'}-${j}`}
                    onClick={e.bookingNumber ? () => onBooking?.(e) : undefined}
                    className={`rounded border px-2 py-1.5 ${toneFor(e)} ${
                      e.bookingNumber ? 'cursor-pointer hover:brightness-125' : ''
                    }`}
                  >
                    {e.status === 'blocked' ? (
                      <>
                        <div className="text-[11px] text-slate-400 truncate">{e.nanny}</div>
                        <div className="text-[10px] text-slate-600">Unavailable</div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-baseline justify-between gap-1">
                          <span className="text-[11px] font-mono text-slate-300">
                            {e.time || '—'}
                          </span>
                          {e.isEmergency && (
                            <span className="text-[9px] px-1 rounded bg-red-500/25 text-red-300">
                              URGENT
                            </span>
                          )}
                        </div>

                        {/* Both names, every day — the thing the month grid hid. */}
                        {showFamily && (
                          <div className="text-[11px] text-white truncate mt-0.5" title={e.family}>
                            {e.family || 'Family'}
                          </div>
                        )}
                        {showNanny && (
                          <div
                            className={`text-[10px] truncate ${e.nanny ? 'text-slate-400' : 'text-red-400'}`}
                            title={e.nanny || 'No nanny assigned'}
                          >
                            {e.nanny || 'Needs a nanny'}
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-1 mt-1">
                          <span className="text-[9px] font-mono text-slate-600">
                            #{e.bookingNumber}
                          </span>
                          {e.hours ? (
                            <span className="text-[9px] text-slate-600">{e.hours}h</span>
                          ) : null}
                        </div>

                        {e.rateLabel && (
                          <div className="text-[9px] text-amber-400/80 truncate mt-0.5">
                            {e.rateLabel}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
