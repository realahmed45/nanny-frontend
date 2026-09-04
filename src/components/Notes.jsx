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

export default function Notes({ targetType, target, initial = [] }) {
  const [notes, setNotes] = useState(initial);
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [attachUrl, setAttachUrl] = useState('');
  const [attachName, setAttachName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editBody, setEditBody] = useState('');

  useEffect(() => { setNotes(initial); }, [target]);

  const reload = () =>
    api(`/notes/${targetType}/${target}`)
      .then((r) => setNotes(r.items || []))
      .catch(() => {});

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
        body: { body: body.trim(), attachments },
      });
      setBody('');
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
      await api(`/notes/${id}`, { method: 'PATCH', body: { body: editBody.trim() } });
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
        <div className="space-y-3">
          {notes.map((n) => (
            <div key={n._id} className="rounded-lg border border-ink-800 bg-ink-950/40 p-3">
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <div className="text-xs">
                  <span className="text-slate-300 font-medium">{n.authorName || 'Unknown'}</span>
                  <span className="text-slate-600"> · {dateTime(n.createdAt)}</span>
                  {n.editedAt && (
                    <span className="text-slate-600 italic">
                      {' '}· edited by {n.editedByName || 'someone'} {dateTime(n.editedAt)}
                    </span>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    className="text-xs text-slate-500 hover:text-slate-300"
                    onClick={() => { setEditing(n._id); setEditBody(n.body); }}
                  >
                    Edit
                  </button>
                  <button
                    className="text-xs text-slate-500 hover:text-red-400"
                    onClick={() => remove(n._id)}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {editing === n._id ? (
                <div>
                  <textarea
                    className="input min-h-[60px] text-sm"
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                  />
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
