import { Modal, money } from './ui.jsx';

/**
 * Every booking on one day, opened from a calendar cell.
 *
 * A month cell can only show two or three bookings; the rest used to sit
 * behind a "+8 more" that went nowhere. Clicking a day now opens it here in
 * full — times, both names, and the state of each — so a busy day is
 * readable without leaving the month.
 */

const TONE = {
  ongoing: 'bg-blue-500/10 border-blue-500/40 text-blue-300',
  upcoming: 'bg-violet-500/10 border-violet-500/40 text-violet-300',
  completed: 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300',
  cancelled: 'bg-slate-500/10 border-slate-500/30 text-slate-400',
  replacement_needed: 'bg-red-500/10 border-red-500/50 text-red-300',
  pending_payment: 'bg-orange-500/10 border-orange-500/40 text-orange-300',
  blocked: 'bg-slate-700/30 border-slate-600/40 text-slate-400',
};

const DAY_TONE = {
  completed: 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300',
  cancelled: 'bg-slate-500/10 border-slate-500/30 text-slate-400',
};

const toneFor = (e) => DAY_TONE[e.dayStatus] || TONE[e.status] || TONE.upcoming;

const LABEL = {
  replacement_needed: 'Needs replacement',
  pending_payment: 'Awaiting payment',
};
const statusLabel = (e) => {
  const s = e.dayStatus || e.status || '';
  return LABEL[s] || s.replace(/_/g, ' ');
};

const shortDate = (d) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, {
  day: 'numeric', month: 'short',
});

/**
 * When the booking itself ends — not just this day. A single-day booking would
 * only repeat the date in the title, so it says nothing.
 */
const spanLabel = (e, date) => {
  if (!e.endDate || e.endDate === e.startDate) return null;
  const total = e.totalDays > 1 ? ` · ${e.totalDays} days` : '';
  return e.endDate === date
    ? `Last day (from ${shortDate(e.startDate)}${total})`
    : `Runs to ${shortDate(e.endDate)}${total}`;
};

export default function DayBookingsModal({ date, events, onClose, onBooking, showNanny = true, showFamily = true }) {
  if (!date) return null;

  const list = [...(events || [])].sort((a, b) =>
    String(a.time || '').localeCompare(String(b.time || '')));

  const hours = list.reduce((s, e) => s + (e.hours || 0), 0);
  const value = list.reduce((s, e) => s + (e.amount || e.value || 0), 0);
  const unstaffed = list.filter((e) => e.status !== 'blocked' && !e.nanny).length;

  const heading = new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <Modal open title={heading} onClose={onClose} wide>
      {/* What the day adds up to, before the detail. */}
      <div className="flex flex-wrap gap-4 pb-3 mb-3 border-b border-ink-800 text-xs">
        <span className="text-slate-400">
          <span className="text-white font-mono">{list.length}</span> booking{list.length === 1 ? '' : 's'}
        </span>
        {hours > 0 && (
          <span className="text-slate-400"><span className="text-white font-mono">{hours}</span> hours</span>
        )}
        {value > 0 && (
          <span className="text-slate-400">Value <span className="text-white font-mono">{money(value)}</span></span>
        )}
        {unstaffed > 0 && (
          <span className="text-red-400">{unstaffed} without a nanny</span>
        )}
      </div>

      <div className="space-y-2">
        {list.length === 0 && (
          <p className="text-sm text-slate-500 py-4 text-center">Nothing booked on this day.</p>
        )}

        {list.map((e, i) => (
          <div
            key={`${e.bookingId || 'x'}-${i}`}
            onClick={e.bookingNumber ? () => onBooking?.(e) : undefined}
            className={`rounded-lg border px-3 py-2.5 ${toneFor(e)} ${
              e.bookingNumber ? 'cursor-pointer hover:brightness-125' : ''
            }`}
          >
            {e.status === 'blocked' ? (
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-300">{e.nanny}</span>
                <span className="text-xs text-slate-500">Unavailable</span>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-sm text-white w-24 shrink-0">
                    {e.time ? `${e.time}${e.endTime ? `–${e.endTime}` : ''}` : '—'}
                  </span>

                  <div className="flex-1 min-w-[140px]">
                    {showFamily && (
                      <div className="text-sm text-white truncate">{e.family || 'Family'}</div>
                    )}
                    {showNanny && (
                      <div className={`text-xs truncate ${e.nanny ? 'text-slate-400' : 'text-red-400'}`}>
                        {e.nanny ? `Nanny: ${e.nanny}` : 'No nanny assigned'}
                      </div>
                    )}
                    {e.address && (
                      <div className="text-[11px] text-slate-600 truncate" title={e.address}>
                        {e.address}
                      </div>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-mono text-xs opacity-80">#{e.bookingNumber}</div>
                    {e.hours ? <div className="text-[11px] text-slate-500">{e.hours}h</div> : null}
                    {e.amount ? (
                      <div className="text-[11px] text-slate-500">{money(e.amount)}</div>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-1.5 pl-[100px]">
                  <span className="text-[11px] capitalize opacity-80">{statusLabel(e)}</span>
                  {spanLabel(e, date) && (
                    <span className="text-[10px] text-slate-500">{spanLabel(e, date)}</span>
                  )}
                  {e.isEmergency && (
                    <span className="text-[10px] px-1.5 rounded bg-red-500/25 text-red-300">URGENT</span>
                  )}
                  {e.rateLabel && (
                    <span className="text-[10px] text-amber-400/80">{e.rateLabel}</span>
                  )}
                  {e.bookingNumber && (
                    <span className="text-[10px] text-slate-600 ml-auto">Click to open booking →</span>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}
