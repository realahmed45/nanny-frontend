import { useEffect, useState } from 'react';
import api from '../lib/api.js';
import { PageHeader, Skeleton, ErrorBox, useToast } from '../components/ui.jsx';

/**
 * Who gets the nightly backup.
 *
 * It used to go to one hardcoded personal address. If that person left,
 * changed their email or let the inbox fill, every backup stopped arriving and
 * nothing said so — the one failure a backup cannot afford, because you only
 * find out on the day you need it.
 *
 * Nothing saves until Save is pressed, the same as Areas and Pricing: a
 * half-typed address should not become tonight's only recipient.
 */

const BLANK = { email: '', label: '' };

export default function Backups({ admin }) {
  // Sending a test emails the whole database, so the server restricts it to a
  // super admin. Shown as disabled with the reason rather than letting the
  // click fail, which reads as the feature being broken.
  const canSendTest = admin?.role === 'super_admin';

  const { toast, notify, error: toastError } = useToast();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState(null);
  const [lastTest, setLastTest] = useState(null);

  const load = () => {
    setLoading(true);
    api('/settings')
      .then((s) => {
        setList(s.backupRecipients || []);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const update = (i, patch) => setList((rows) =>
    rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const add = () => setList((rows) => [...rows, { ...BLANK }]);

  // Removing is immediate in the form but only real on Save, so a misclick is
  // undone by leaving the page rather than by retyping everything.
  const remove = (i) => setList((rows) => rows.filter((_, idx) => idx !== i));

  const save = async () => {
    setSaving(true);
    try {
      await api('/settings', {
        method: 'PATCH',
        body: {
          backupRecipients: list
            .filter((r) => String(r.email || '').trim())
            .map((r) => ({
              email: String(r.email).trim().toLowerCase(),
              label: String(r.label || '').trim(),
            })),
        },
      });
      notify('Backup recipients saved.');
      load();
    } catch (e) {
      // The server rejects malformed addresses by name, which is worth showing
      // rather than a generic failure.
      toastError(e.message);
    } finally {
      setSaving(false);
    }
  };

  /**
   * An address on the list that never receives anything is the same as no
   * backup at all, and the only way to know is to send one.
   */
  const sendTest = async () => {
    setTesting(true);
    setLastTest(null);
    try {
      const result = await api('/backups/test', { method: 'POST' });
      setLastTest(result);
      notify(`Backup sent to ${(result.sentTo || []).length} recipient(s).`);
    } catch (e) {
      toastError(e.message);
      setLastTest({ error: e.message });
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <Skeleton rows={5} />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  const filled = list.filter((r) => String(r.email || '').trim());
  const emails = filled.map((r) => String(r.email).trim().toLowerCase());
  const duplicate = emails.find((e, i) => emails.indexOf(e) !== i);
  const malformed = filled.find((r) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(r.email).trim()));

  return (
    <>
      {toast}
      <PageHeader
        title="Backups"
        subtitle={filled.length
          ? `The nightly backup goes to ${filled.length} address${filled.length === 1 ? '' : 'es'}`
          : 'Nobody is listed — the backup falls back to the configured address'}
        actions={
          <div className="flex gap-2">
            <button
              className="btn-ghost"
              onClick={sendTest}
              disabled={testing || !canSendTest}
              title={canSendTest
                ? 'Send tonight’s backup right now, to everyone listed'
                : 'Only a super admin can send a backup, because it emails the whole database'}
            >
              {testing ? 'Sending…' : 'Send one now'}
            </button>
            <button
              className="btn-primary"
              onClick={save}
              disabled={saving || !!duplicate || !!malformed}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        }
      />

      <div className="card p-4 sm:p-5">
        <p className="text-sm text-slate-400 mb-5">
          A copy of the whole database is emailed every night. Everyone listed here
          gets their own copy, sent separately — so one address bouncing does not
          stop the others arriving. Leave the list empty and it falls back to the
          address set in the server configuration.
        </p>

        {filled.length === 1 && (
          <div className="mb-4 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            Only one person receives the backup. If that inbox fills or the address
            changes, there is no second copy.
          </div>
        )}

        {duplicate && (
          <div className="mb-4 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            <span className="font-mono">{duplicate}</span> is listed twice.
          </div>
        )}

        {malformed && (
          <div className="mb-4 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            <span className="font-mono">{String(malformed.email).trim()}</span> does not
            look like an email address.
          </div>
        )}

        <div className="space-y-2">
          {list.map((row, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input
                type="email"
                className="input flex-1 min-w-[220px] font-mono"
                placeholder="name@example.com"
                value={row.email || ''}
                onChange={(e) => update(i, { email: e.target.value })}
              />
              <input
                className="input flex-1 min-w-[160px]"
                placeholder="Who this is (optional)"
                value={row.label || ''}
                onChange={(e) => update(i, { label: e.target.value })}
              />
              <button
                className="btn-ghost text-red-300 shrink-0"
                onClick={() => remove(i)}
                title="Remove this recipient"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <button className="btn-ghost mt-4" onClick={add}>
          + Add a recipient
        </button>
      </div>

      {lastTest && (
        <div className="card p-4 sm:p-5 mt-4">
          <h3 className="font-semibold mb-3">Last test</h3>

          {lastTest.error ? (
            <p className="text-sm text-red-300">{lastTest.error}</p>
          ) : (
            <>
              <p className="text-sm text-slate-300">
                Delivered to{' '}
                <span className="font-mono">{(lastTest.sentTo || []).join(', ')}</span>
                {typeof lastTest.rows === 'number' && (
                  <> · {lastTest.rows.toLocaleString()} rows</>
                )}
                {typeof lastTest.bytes === 'number' && (
                  <> · {Math.round(lastTest.bytes / 1024).toLocaleString()} KB</>
                )}
              </p>

              {(lastTest.failed || []).length > 0 && (
                <p className="mt-2 text-sm text-red-300">
                  Could not send to{' '}
                  {lastTest.failed.map((f) => `${f.to} (${f.error})`).join(', ')}
                </p>
              )}

              {(lastTest.sheets || []).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                  {lastTest.sheets.map((s) => (
                    <span key={s.name}>
                      {s.name}: <span className="font-mono">{s.rows}</span>
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="card p-4 sm:p-5 mt-4">
        <h3 className="font-semibold mb-2">What the backup does not cover</h3>
        <ul className="text-sm text-slate-400 list-disc pl-5 space-y-1">
          <li>
            It holds no photos or documents. ID scans, contracts and receipts are not
            in it, and the media folder is the only copy of those.
          </li>
          <li>
            It records people by name rather than by identifier, so the links between
            bookings, families and nannies cannot be rebuilt from it automatically.
          </li>
          <li>
            Payouts, admin accounts and message history are not included.
          </li>
        </ul>
        <p className="text-sm text-slate-400 mt-3">
          It is a readable record of what happened, not something the system can
          restore itself from.
        </p>
      </div>
    </>
  );
}
