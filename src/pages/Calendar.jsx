import { useEffect, useMemo, useState } from 'react';
import api from '../lib/api.js';
import { PageHeader, FilterPills, Skeleton, ErrorBox, Tabs } from '../components/ui.jsx';
import GeneralCalendar from './GeneralCalendar.jsx';

const VIEW_FILTERS = [
  { value: 'all', label: 'All Bookings' },
  { value: 'nannies', label: 'Nannies Only' },
  { value: 'families', label: 'Families Only' },
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
  const [tab, setTab] = useState('bookings');
  const [cursor, setCursor] = useState(() => new Date());
  const [view, setView] = useState('all');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const month = monthKey(cursor);

  useEffect(() => {
    if (tab !== 'bookings') return;
    setLoading(true);
    setError(null);
    api(`/calendar?month=${month}`)
      .then((r) => setEvents(r.events || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [month, tab]);

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
  const shift = (delta) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));

  return (
    <>
      <PageHeader
        title="Platform Calendar"
        subtitle={
          tab === 'bookings'
            ? `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()} — all bookings, blocks, and availability`
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
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-white">
            {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
          </h3>
          <div className="flex gap-2">
            <button className="btn-ghost text-xs" onClick={() => shift(-1)}>
              ← {MONTHS[(cursor.getMonth() + 11) % 12].slice(0, 3)}
            </button>
            <button className="btn-ghost text-xs" onClick={() => setCursor(new Date())}>Today</button>
            <button className="btn-ghost text-xs" onClick={() => shift(1)}>
              {MONTHS[(cursor.getMonth() + 1) % 12].slice(0, 3)} →
            </button>
          </div>
        </div>

        {loading ? <Skeleton rows={6} /> : (
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
                      className={`min-h-[96px] border-r border-b border-ink-800 p-1.5 ${
                        iso ? '' : 'bg-ink-950/60'
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
                              <p className="text-[10px] text-slate-500 px-1">
                                +{dayEvents.length - 3} more
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

        <div className="flex flex-wrap gap-4 mt-5 pt-4 border-t border-ink-800">
          {LEGEND.map(([label, dot]) => (
            <span key={label} className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className={`w-2 h-2 rounded-full ${dot}`} />
              {label}
            </span>
          ))}
        </div>
      </div>
      </>
      )}
    </>
  );
}
