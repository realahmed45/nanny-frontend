import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api.js';
import { PageHeader, FilterPills, Skeleton, ErrorBox, Tabs } from '../components/ui.jsx';
import GeneralCalendar from './GeneralCalendar.jsx';
import WeekCalendar, { startOfWeek } from '../components/WeekCalendar.jsx';
import DayBookingsModal from '../components/DayBookingsModal.jsx';

const VIEW_FILTERS = [
  { value: 'all', label: 'All Bookings' },
  { value: 'nannies', label: 'Nannies Only' },
  { value: 'families', label: 'Families/Customers Only' },
  { value: 'blocked', label: 'Blocked Dates' },
];

const EVENT_STYLES = {
  ongoing: 'bg-blue-500/15 text-blue-300 border-blue-500/40',
  upcoming: 'bg-violet-500/15 text-violet-300 border-violet-500/40',
  completed: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  cancelled: 'bg-slate-500/15 text-slate-400 border-slate-500/40',
  replacement_needed: 'bg-red-500/15 text-red-300 border-red-500/50',
  blocked: 'bg-orange-500/15 text-orange-300 border-orange-500/40',
};

const LEGEND = [
  ['Ongoing', 'bg-blue-500'], ['Upcoming', 'bg-violet-500'],
  ['Completed', 'bg-emerald-500'], ['Cancelled', 'bg-slate-500'],
  ['Replacement Needed', 'bg-red-500'], ['Blocked', 'bg-orange-500'],
];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const pad = (n) => String(n).padStart(2, '0');
const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

const TOP_TABS = [
  { value: 'bookings', label: 'Bookings' },
  { value: 'general', label: 'General Calendar' },
];

export default function Calendar() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('bookings');
  // Week is the default: a month cell can only ever show a few of a busy
  // day's bookings, and the rest were unreachable.
  const [span, setSpan] = useState('week');
  const [cursor, setCursor] = useState(() => new Date());
  const [openDate, setOpenDate] = useState(null);
  const [view, setView] = useState('all');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const month = monthKey(cursor);
  const weekStart = useMemo(() => startOfWeek(cursor), [cursor]);

  // A week can straddle two months, so both are fetched and merged rather
  // than showing an empty Monday every time one does.
  const months = useMemo(() => {
    if (span === 'month') return [month];
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    return [...new Set([monthKey(weekStart), monthKey(end)])];
  }, [span, month, weekStart]);

  useEffect(() => {
    if (tab !== 'bookings') return;
    setLoading(true);
    setError(null);
    Promise.all(months.map((m) => api(`/calendar?month=${m}`)))
      .then((rs) => setEvents(rs.flatMap((r) => r.events || [])))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [months.join(','), tab]);

  // Build the 6x7 grid: leading blanks, the month's days, trailing blanks.
  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const m = cursor.getMonth();
    const first = new Date(year, m, 1).getDay();
    const days = new Date(year, m + 1, 0).getDate();

    const out = Array.from({ length: first }, () => null);
    for (let d = 1; d <= days; d += 1) out.push(`${year}-${pad(m + 1)}-${pad(d)}`);
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [cursor]);

  const byDate = useMemo(() => {
    const filtered = events.filter((e) => {
      if (view === 'blocked') return e.status === 'blocked';
      if (view === 'nannies') return Boolean(e.nanny) && e.status !== 'blocked';
      if (view === 'families') return Boolean(e.family);
      return e.status !== 'blocked';
    });
    const map = {};
    for (const e of filtered) (map[e.date] ||= []).push(e);
    return map;
  }, [events, view]);

  const today = `${new Date().getFullYear()}-${pad(new Date().getMonth() + 1)}-${pad(new Date().getDate())}`;

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

  /** "12 – 18 May 2026", or the month, depending on what is showing. */
  const rangeLabel = () => {
    if (span === 'month') return `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    const sameMonth = weekStart.getMonth() === end.getMonth();
    return sameMonth
      ? `${weekStart.getDate()} – ${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`
      : `${weekStart.getDate()} ${MONTHS[weekStart.getMonth()].slice(0, 3)} – ${end.getDate()} ${MONTHS[end.getMonth()].slice(0, 3)} ${end.getFullYear()}`;
  };

  const openBooking = (e) => {
    if (e.bookingNumber) navigate(`/bookings?search=${e.bookingNumber}`);
  };

  return (
    <>
      <PageHeader
        title="Platform Calendar"
        subtitle={
          tab === 'bookings'
            ? `${rangeLabel()} — every booking, with the family and the nanny on each`
            : 'Special days, surcharges, and days we cannot staff'
        }
      />

      <Tabs tabs={TOP_TABS} active={tab} onChange={setTab} />

      {tab === 'general' && <GeneralCalendar />}

      {tab === 'bookings' && error && <ErrorBox error={error} />}

      {tab === 'bookings' && !error && (
      <>
      <FilterPills options={VIEW_FILTERS} active={view} onChange={setView} />

      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <h3 className="text-lg font-semibold text-white">{rangeLabel()}</h3>

          <div className="flex flex-wrap gap-2">
            <div className="flex rounded-lg border border-ink-800 overflow-hidden">
              {['week', 'month'].map((s) => (
                <button
                  key={s}
                  onClick={() => { setSpan(s); setOpenDate(null); }}
                  className={`px-3 py-1.5 text-xs capitalize transition-colors ${
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
              onClick={() => { setCursor(new Date()); setOpenDate(null); }}
            >
              Today
            </button>
            <button className="btn-ghost text-xs" onClick={() => shift(1)}>Next →</button>
          </div>
        </div>

        {loading ? <Skeleton rows={6} /> : span === 'week' ? (
          <WeekCalendar
            weekStart={weekStart}
            events={Object.values(byDate).flat()}
            onBooking={openBooking}
          />
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              <div className="grid grid-cols-7 mb-1">
                {DAY_NAMES.map((d) => (
                  <div key={d} className="px-2 py-2 text-xs font-mono text-slate-500">{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 border-t border-l border-ink-800">
                {cells.map((iso, i) => {
                  const dayEvents = iso ? byDate[iso] || [] : [];
                  return (
                    <div
                      key={i}
                      onClick={dayEvents.length ? () => setOpenDate(iso === openDate ? null : iso) : undefined}
                      className={`min-h-[96px] border-r border-b border-ink-800 p-1.5 ${
                        iso ? '' : 'bg-ink-950/60'
                      } ${dayEvents.length ? 'cursor-pointer hover:bg-ink-800/40' : ''} ${
                        iso === openDate ? 'bg-ink-800/60' : ''
                      }`}
                    >
                      {iso && (
                        <>
                          <span
                            className={`inline-block text-xs font-mono mb-1 px-1.5 py-0.5 rounded ${
                              iso === today
                                ? 'bg-brand-600 text-white font-semibold'
                                : 'text-slate-500'
                            }`}
                          >
                            {Number(iso.slice(-2))}
                          </span>
                          <div className="space-y-1">
                            {dayEvents.slice(0, 3).map((e, j) => (
                              <div
                                key={j}
                                title={e.label}
                                className={`text-[11px] leading-tight px-1.5 py-1 rounded border truncate ${
                                  EVENT_STYLES[e.status] || EVENT_STYLES.cancelled
                                }`}
                              >
                                {e.label}
                              </div>
                            ))}
                            {dayEvents.length > 3 && (
                              <button
                                type="button"
                                className="w-full text-[10px] font-medium text-brand-300 bg-brand-500/10 hover:bg-brand-500/25 border border-brand-500/30 rounded px-1 py-1 transition-colors"
                              >
                                +{dayEvents.length - 3} more →
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

        <div className="flex flex-wrap gap-4 mt-5 pt-4 border-t border-ink-800">
          {LEGEND.map(([label, dot]) => (
            <span key={label} className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className={`w-2 h-2 rounded-full ${dot}`} />
              {label}
            </span>
          ))}
        </div>
      </div>

      <DayBookingsModal
        date={openDate}
        events={openDate ? byDate[openDate] || [] : []}
        onClose={() => setOpenDate(null)}
        onBooking={(e) => { setOpenDate(null); openBooking(e); }}
      />
      </>
      )}
    </>
  );
}
