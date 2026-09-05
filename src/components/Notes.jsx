import { useEffect, useState } from 'react';
import api from '../lib/api.js';
import { dateTime } from './ui.jsx';

/**
 * Notes on a booking, family or nanny.
 *
 * The system records what happened; a note records what someone decided to do
 * about it. Both are needed to pick up a case cold, so this sits next to the
 * automatic history rather than replacing it.
 */

const KINDS = [
  { value: 'image', label: 'Image' },
  { value: 'pdf', label: 'PDF' },
  { value: 'document', label: 'Document' },
  { value: 'other', label: 'Other' },
];

/** Guess the kind from the URL, so the picker is usually already right. */
function guessKind(url) {
  const clean = String(url).split('?')[0].toLowerCase();
  if (/\.(png|jpe?g|gif|webp|heic)$/.test(clean)) return 'image';
  if (/\.pdf$/.test(clean)) return 'pdf';
  if (/\.(docx?|xlsx?|pptx?|csv|txt|rtf|odt)$/.test(clean)) return 'document';
  return 'other';
}

const KIND_ICON = { image: '🖼️', pdf: '📄', document: '📎', other: '🔗' };

/**
 * What a note is filed under, shown beside it.
 *
 * A pin for a general note, a clickable booking number for one about a
 * booking, so the note and the thing it concerns are one click apart. On a
 * booking's own page a note written there needs no badge — the page is the
 * context — but a note pulled in from a person's profile is labelled with
 * whose it is, otherwise it reads as if it were written about this booking.
 */
function NoteTag({ note, targetType, onNavigate }) {
  const own = note.targetType === 'booking';

  if (targetType === 'booking') {
    if (own) return null;
    const who = note.targetType === 'family' ? 'Family' : 'Nanny';
    return (
      <span
        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 mr-1.5 ${
          note.relevant ? 'bg-brand-500/20 text-brand-400' : 'bg-ink-800 text-slate-400'
        }`}
        title={note.relevant
          ? `Filed against this booking on the ${who.toLowerCase()}'s profile`
          : `A general note from the ${who.toLowerCase()}'s profile`}
      >
        <span>{note.relevant ? '📅' : '📌'}</span>
        <span>{who}</span>
      </span>
    );
  }

  if (!note.bookingRef) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 mr-1.5 bg-ink-800 text-slate-400"
        title="A general note, not about a particular booking"
      >
        📌 General
      </span>
    );
  }

  const num = note.bookingNumber || String(note.bookingRef).slice(-6);
  return (
    <button
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 mr-1.5 bg-brand-500/20 text-brand-400 hover:bg-brand-500/30"
      onClick={() => onNavigate?.(note.bookingRef)}
      title={`About booking #${num} — open it`}
    >
      📅 #{num}
    </button>
  );
}

/**
 * A note stays editable for three hours, matching the server.
 *
 * Fixing a typo or a wrong booking soon after writing is honest; rewriting one
 * a day later, after people have acted on it, is not. Checked here too so the
 * button disappears instead of failing when pressed.
 */
const NOTE_EDIT_WINDOW_MS = 3 * 60 * 60 * 1000;
const editable = (n) => Date.now() - new Date(n.createdAt).getTime() <= NOTE_EDIT_WINDOW_MS;

/**
 * Whether a note gets the glow.
 *
 * On a booking: the notes actually about it, as against the ones borrowed
 * from the people involved for context. On a profile: the notes about one of
 * her bookings, as against the general ones — glowing every note there would
 * mark nothing at all. Both answer the same question, which is the one being
 * scanned for: is this about a job, or about her in general?
 */
const glowing = (n, targetType) => (
  targetType === 'booking' ? !!n.relevant : !!n.bookingRef
);

/** Label a booking the way an admin would recognise it in a dropdown. */
function bookingLabel(b) {
  const num = b.bookingNumber || String(b._id).slice(-6);
  const when = b.startDate ? ` · ${String(b.startDate).slice(0, 10)}` : '';
  return `#${num}${when}`;
}

/**
 * @param bookings  The person's bookings, so a note can be filed against one.
 *                  Not needed on a booking's own page: those notes are about
 *                  that booking by definition.
 * @param onNavigate  Called with a booking id when its badge is clicked.
 */
export default function Notes({ targetType, target, initial = [], bookings = [], onNavigate }) {
  const [notes, setNotes] = useState(initial);
  const [body, setBody] = useState('');
  const [bookingRef, setBookingRef] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [attachUrl, setAttachUrl] = useState('');
  const [attachName, setAttachName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editBody, setEditBody] = useState('');
  const [editRef, setEditRef] = useState('');

  const reload = () =>
    api(`/notes/${targetType}/${target}`)
      .then((r) => setNotes(r.items || []))
      .catch(() => {});

  /**
   * Own the list rather than mirroring the parent's copy.
   *
   * The profile opens before its notes have loaded and hands down [], then the
   * real list once the fetch resolves. Mirroring that meant either missing the
   * second hand-off — the bug that left profiles looking empty — or clobbering
   * our own reload on every re-render. Fetching once on open avoids both;
   * `initial` is only a seed so the list is not blank while that runs.
   */
  useEffect(() => {
    setNotes(initial);
    if (target) reload();
    // Re-fetching per target is the point; `initial` is deliberately not a
    // dependency, since a new array identity each render would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetType, target]);

  const addAttachment = () => {
    const url = attachUrl.trim();
    if (!url) return;
    setAttachments((p) => [...p, {
      url,
      name: attachName.trim() || url.split('/').pop(),
      kind: guessKind(url),
    }]);
    setAttachUrl('');
    setAttachName('');
  };

  const save = async () => {
    if (!body.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api(`/notes/${targetType}/${target}`, {
        method: 'POST',
        body: { body: body.trim(), attachments, bookingRef: bookingRef || null },
      });
      setBody('');
      setBookingRef('');
      setAttachments([]);
      await reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (id) => {
    if (!editBody.trim()) return;
    try {
      await api(`/notes/${id}`, {
        method: 'PATCH',
        body: { body: editBody.trim(), bookingRef: editRef || null },
      });
      setEditing(null);
      await reload();
    } catch (e) {
      setError(e.message);
    }
  };

  const remove = async (id) => {
    try {
      await api(`/notes/${id}`, { method: 'DELETE' });
      await reload();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div>
      <h4 className="text-sm font-semibold text-white mb-3">
        Notes
        <span className="ml-2 text-xs font-normal text-slate-500">{notes.length}</span>
      </h4>

      {/* The booking view borrows notes from the people involved, so say what
          the highlight means rather than leaving it to be guessed. */}
      {targetType === 'booking' && notes.some((n) => !n.relevant) && (
        <p className="text-xs text-slate-500 mb-3">
          <span className="text-brand-400">Glowing</span> notes are about this booking.
          The rest are from the family's and nanny's profiles, shown for context.
        </p>
      )}

      {/* Same glow, same meaning: it marks a note about a job. Only worth
          saying once both kinds are actually on screen. */}
      {targetType !== 'booking'
        && notes.some((n) => n.bookingRef) && notes.some((n) => !n.bookingRef) && (
        <p className="text-xs text-slate-500 mb-3">
          <span className="text-brand-400">Glowing</span> notes are about a specific booking.
          The rest are general.
        </p>
      )}

      {/* ---------------- Composer ---------------- */}
      <div className="rounded-lg border border-ink-800 bg-ink-950/60 p-3 mb-4">
        <textarea
          className="input min-h-[70px] text-sm"
          placeholder="What happened, what was decided, what to do next…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />

        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {attachments.map((a, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 text-xs bg-ink-800 rounded px-2 py-1"
              >
                <span>{KIND_ICON[a.kind]}</span>
                <span className="text-slate-300 max-w-[160px] truncate">{a.name}</span>
                <button
                  className="text-slate-500 hover:text-red-400"
                  onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {/* A note is general, or about one booking. Asked at writing time,
            because nobody comes back later to file it. */}
        {targetType !== 'booking' && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-slate-500 shrink-0">This note is about</span>
            <select
              className="input text-xs flex-1"
              value={bookingRef}
              onChange={(e) => setBookingRef(e.target.value)}
            >
              <option value="">📌 General — not a specific booking</option>
              {bookings.map((b) => (
                <option key={b._id} value={b._id}>📅 Booking {bookingLabel(b)}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-2">
          <input
            className="input text-xs flex-1 min-w-[180px]"
            placeholder="Attach a link — PDF, image, Word, anything"
            value={attachUrl}
            onChange={(e) => setAttachUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAttachment(); } }}
          />
          <input
            className="input text-xs w-36"
            placeholder="Label (optional)"
            value={attachName}
            onChange={(e) => setAttachName(e.target.value)}
          />
          <button className="btn-ghost text-xs" onClick={addAttachment} disabled={!attachUrl.trim()}>
            + Attach
          </button>
        </div>

        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-slate-600">
            Your name and the time are recorded with the note.
          </span>
          <button className="btn-primary text-xs" onClick={save} disabled={saving || !body.trim()}>
            {saving ? 'Saving…' : 'Add note'}
          </button>
        </div>

        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      </div>

      {/* ---------------- Existing notes ---------------- */}
      {notes.length === 0 ? (
        <p className="text-xs text-slate-600 py-2">No notes yet.</p>
      ) : (
        <div
          /* Roomier than a plain list so a glowing card has space to bleed
             into instead of butting against its neighbour. */
          className="space-y-4"
        >
          {notes.map((n) => (
            <div
              key={n._id}
              /* Notes tied to a booking glow; general ones stay muted. On a
                 booking that means the notes about it, on a profile the ones
                 about any of her bookings — either way the glow marks "this
                 is about a job", which is the distinction being scanned for.
                 The ring sits outside the border so it reads as light around
                 the card rather than as a thicker edge. */
              className={`rounded-lg border p-3 transition-shadow ${
                glowing(n, targetType)
                  ? 'border-brand-500 bg-brand-500/10 ring-2 ring-brand-500/40 shadow-[0_0_20px_-2px_rgba(59,130,246,0.55)]'
                  : 'border-ink-800 bg-ink-950/40'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <div className="text-xs">
                  <NoteTag note={n} targetType={targetType} onNavigate={onNavigate} />
                  <span className="text-slate-300 font-medium">{n.authorName || 'Unknown'}</span>
                  <span className="text-slate-600"> · {dateTime(n.createdAt)}</span>
                  {n.editedAt && (
                    <span className="text-slate-600 italic">
                      {' '}· edited by {n.editedByName || 'someone'} {dateTime(n.editedAt)}
                    </span>
                  )}
                </div>
                {/* A note borrowed from someone's profile is shown here for
                    context but belongs to that profile — it is edited there,
                    where its bookings are available to re-file against. */}
                {(targetType !== 'booking' || n.targetType === 'booking') && (
                  <div className="flex gap-2 shrink-0">
                    {editable(n) ? (
                      <button
                        className="text-xs text-slate-500 hover:text-slate-300"
                        onClick={() => {
                          setEditing(n._id);
                          setEditBody(n.body);
                          setEditRef(n.bookingRef || '');
                        }}
                      >
                        Edit
                      </button>
                    ) : (
                      <span
                        className="text-xs text-slate-700"
                        title="A note can only be edited within 3 hours of being written"
                      >
                        Locked
                      </span>
                    )}
                    <button
                      className="text-xs text-slate-500 hover:text-red-400"
                      onClick={() => remove(n._id)}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>

              {editing === n._id ? (
                <div>
                  <textarea
                    className="input min-h-[60px] text-sm"
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                  />
                  {/* Re-file a note put under the wrong heading. Notes written
                      on a booking are about it by definition, so they stay. */}
                  {n.targetType !== 'booking' && bookings.length > 0 && (
                    <select
                      className="input text-xs mt-2"
                      value={editRef}
                      onChange={(e) => setEditRef(e.target.value)}
                    >
                      <option value="">📌 General — not a specific booking</option>
                      {bookings.map((b) => (
                        <option key={b._id} value={b._id}>📅 Booking {bookingLabel(b)}</option>
                      ))}
                    </select>
                  )}
                  <div className="flex gap-2 mt-2">
                    <button className="btn-primary text-xs" onClick={() => saveEdit(n._id)}>Save</button>
                    <button className="btn-ghost text-xs" onClick={() => setEditing(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-200 whitespace-pre-wrap">{n.body}</p>
              )}

              {(n.attachments || []).length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2.5">
                  {n.attachments.map((a) => (
                    <a
                      key={a._id || a.url}
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs bg-ink-800 hover:bg-ink-700 rounded px-2 py-1 text-slate-300"
                    >
                      <span>{KIND_ICON[a.kind] || KIND_ICON.other}</span>
                      <span className="max-w-[200px] truncate">{a.name || a.url}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
