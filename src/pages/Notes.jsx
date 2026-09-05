import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api.js';
import {
  PageHeader, Skeleton, ErrorBox, Avatar, Pagination, dateTime,
} from '../components/ui.jsx';

/**
 * Every note, from everywhere, newest first.
 *
 * Notes are written inside a profile or a booking, which is where they are
 * useful later — but it means nobody can see what the team has been saying
 * without opening records one at a time. This is the read-across: what was
 * decided today, about whom, in one list.
 *
 * Read-only on purpose. A note is edited where it lives, next to the record
 * that gives it meaning, and only within its three-hour window.
 */

const TARGET_LABEL = { family: 'Family', nanny: 'Nanny', booking: 'Booking' };

const FILTERS = [
  { value: '', label: 'Everything' },
  { value: 'nanny', label: 'Nannies' },
  { value: 'family', label: 'Families' },
  { value: 'booking', label: 'Bookings' },
];

function NoteCard({ note, onOpen }) {
  const who = note.person;
  const booking = note.booking;
  // A note written on a booking is about it by definition; one on a person is
  // about a booking only if it was filed against one.
  const linked = note.targetType === 'booking' || note.bookingRef;

  return (
    <div className="rounded-lg border border-ink-800 bg-ink-950/40 p-3">
      <div className="flex items-start gap-3">
        {who ? <Avatar name={who.fullName} /> : (
          <div className="h-9 w-9 rounded-full bg-ink-800 grid place-items-center text-xs shrink-0">
            📋
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
            {who ? (
              <button
                className="text-sm text-white hover:text-brand-400 truncate"
                onClick={() => onOpen(note.targetType, note.target)}
              >
                {who.nickname || who.fullName || 'Unnamed'}
              </button>
            ) : (
              <span className="text-sm text-slate-400">
                {TARGET_LABEL[note.targetType] || note.targetType}
              </span>
            )}

            <span className="text-[10px] px-1.5 py-0.5 rounded bg-ink-800 text-slate-400">
              {TARGET_LABEL[note.targetType] || note.targetType}
            </span>

            {/* Same badges as the profile: general, or the booking it concerns. */}
            {linked && booking ? (
              <button
                className="text-[10px] px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-400 hover:bg-brand-500/30"
                onClick={() => onOpen('booking', booking._id, booking.bookingNumber)}
                title="Open this booking"
              >
                📅 #{booking.bookingNumber}
              </button>
            ) : note.targetType !== 'booking' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-ink-800 text-slate-500">
                📌 General
              </span>
            )}
          </div>

          <p className="text-sm text-slate-200 whitespace-pre-wrap mt-1.5">{note.body}</p>

          {(note.attachments || []).length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {note.attachments.map((a) => (
                <a
                  key={a._id || a.url}
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs bg-ink-800 hover:bg-ink-700 rounded px-2 py-1 text-slate-300 max-w-[200px] truncate"
                >
                  📎 {a.name || a.url}
                </a>
              ))}
            </div>
          )}

          <p className="text-[11px] text-slate-600 mt-2">
            {note.authorName || 'Unknown'} · {dateTime(note.createdAt)}
            {note.editedAt && <span className="italic"> · edited {dateTime(note.editedAt)}</span>}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Notes() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [targetType, setTargetType] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page) });
    if (targetType) params.set('targetType', targetType);
    if (query) params.set('search', query);
    api(`/notes?${params}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [page, targetType, query]);

  /** Open whatever a note is about, on the page that owns it. */
  const open = (type, id, bookingNumber) => {
    if (type === 'booking') navigate(`/bookings?search=${bookingNumber || id}`);
    else if (type === 'nanny') navigate(`/nannies?open=${id}`);
    else if (type === 'family') navigate(`/families?open=${id}`);
  };

  const items = data?.items || [];

  return (
    <div>
      <PageHeader title="Notes" subtitle="Everything the team has written, newest first" />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => { setTargetType(f.value); setPage(1); }}
            className={`text-xs rounded-full px-3 py-1.5 ${
              targetType === f.value
                ? 'bg-brand-500/20 text-brand-400'
                : 'bg-ink-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {f.label}
          </button>
        ))}

        <input
          className="input text-xs ml-auto w-56"
          placeholder="Search inside notes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { setQuery(search.trim()); setPage(1); }
          }}
        />
      </div>

      {error && <ErrorBox error={error} />}
      {loading && <Skeleton rows={6} />}

      {!loading && !error && (
        items.length === 0 ? (
          <p className="text-sm text-slate-600 rounded-lg border border-dashed border-ink-800 px-3 py-10 text-center">
            {query || targetType ? 'No notes match that.' : 'No notes have been written yet.'}
          </p>
        ) : (
          <>
            <div className="space-y-2">
              {items.map((n) => (
                <NoteCard key={n._id} note={n} onOpen={open} />
              ))}
            </div>

            <Pagination
              page={data.page}
              pages={data.pages}
              total={data.total}
              onChange={setPage}
            />
          </>
        )
      )}
    </div>
  );
}
