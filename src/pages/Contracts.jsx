import { useEffect, useState } from 'react';
import api, { mediaUrl } from '../lib/api.js';
import { PageHeader, Skeleton, ErrorBox, useToast, money } from '../components/ui.jsx';

/**
 * Contract settings — what we have promised each nanny, and whether she has it.
 *
 * Only some nannies are on a contract. For those who are, a guarantee is a
 * real promise: contracted for 40 hours and booked for 30 means she is still
 * owed 40, and the shortfall comes out of the business rather than off her
 * pay. So this page exists to close gaps with work before the week ends, not
 * to report them afterwards.
 *
 * The safety buffer is why it aims high: scheduling targets 120% of the
 * threshold, because a cancellation on Friday leaves no time to find
 * replacement work and an unmet guarantee is paid for nothing.
 *
 * Her hourly rate is also edited here. That is her salary — admin-side only,
 * never shown to a family, and entirely separate from what families are
 * charged on the Pricing page.
 */

function Num({ label, value, onChange, suffix, hint, min = 0, step = 1 }) {
  return (
    <label className="block">
      <span className="block text-xs text-slate-500 mb-1">{label}</span>
      <div className="relative">
        <input
          type="number" min={min} step={step} className="input font-mono"
          value={Number.isFinite(value) ? value : ''}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">{suffix}</span>
        )}
      </div>
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

/** One nanny's row: how this week is tracking against what she was promised. */
function ContractRow({ row, onEdit }) {
  const short = !row.meetsContract;
  return (
    <tr className={short ? 'bg-amber-500/5' : undefined}>
      <td className="px-4 py-3">
        <div className="font-medium text-slate-200">{row.nanny.name}</div>
        <div className="text-xs text-slate-500 font-mono">
          {row.nanny.hourlyRate ? `${money(row.nanny.hourlyRate)}/hr` : 'no rate set'}
        </div>
        {/* An unsigned contract is a promise we cannot prove we made. */}
        {!row.nanny.hasContractDoc && (
          <div className="text-xs text-amber-400/80 mt-0.5">no signed contract on file</div>
        )}
      </td>
      <td className="px-4 py-3 text-right font-mono">
        <span className={row.hours.shortfall > 0 ? 'text-amber-400' : 'text-slate-300'}>
          {row.hours.booked} / {row.hours.minimum}
        </span>
        <div className="text-xs text-slate-500">target {row.hours.target}</div>
      </td>
      <td className="px-4 py-3 text-right font-mono">
        <span className={row.shifts.shortfall > 0 ? 'text-amber-400' : 'text-slate-300'}>
          {row.shifts.booked} / {row.shifts.minimum}
        </span>
        <div className="text-xs text-slate-500">target {row.shifts.target}</div>
      </td>
      <td className="px-4 py-3 text-right font-mono">
        {row.guaranteeShortfallCost > 0 ? (
          <span className="text-rose-400 font-semibold">{money(row.guaranteeShortfallCost)}</span>
        ) : (
          <span className="text-emerald-400">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <button type="button" className="btn-ghost" onClick={() => onEdit(row.nanny.id)}>Edit</button>
      </td>
    </tr>
  );
}

function EditPanel({ nannyId, onClose, onSaved }) {
  const { toast, notify, error: toastError } = useToast();
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api(`/contracts/${nannyId}`)
      .then((d) => {
        setData(d);
        setForm({
          hourlyRate: d.nanny.hourlyRate || 0,
          minimumHoursPerWeek: d.contract?.minimumHoursPerWeek || 0,
          minimumShiftsPerWeek: d.contract?.minimumShiftsPerWeek || 0,
          safetyBufferPercent: d.contract?.safetyBufferPercent ?? 20,
          notes: d.contract?.notes || '',
          documentUrl: d.contract?.documentUrl || '',
          documentUploadedAt: d.contract?.documentUploadedAt || null,
        });
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [nannyId]);

  const [uploading, setUploading] = useState(false);

  /**
   * Send the file as base64, matching how the phone app uploads — the server
   * has no multipart middleware, and this needs none.
   */
  const uploadDoc = (file) => {
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onerror = () => { toastError('The file could not be read'); setUploading(false); };
    reader.onload = () => {
      const ext = (file.name.match(/\.[a-z0-9]+$/i)?.[0] || '.jpg').toLowerCase();
      api(`/contracts/${nannyId}/document`, {
        method: 'POST',
        body: { data: String(reader.result).split(',')[1], ext },
      })
        .then((r) => {
          setForm((f) => ({ ...f, documentUrl: r.documentUrl, documentUploadedAt: r.documentUploadedAt }));
          notify('Contract uploaded');
          onSaved();
        })
        .catch((e) => toastError(e.message))
        .finally(() => setUploading(false));
    };
    reader.readAsDataURL(file);
  };

  /** Clears the pointer only — the archived file is deliberately kept. */
  const removeDoc = () => {
    setUploading(true);
    api(`/contracts/${nannyId}/document`, { method: 'DELETE' })
      .then(() => {
        setForm((f) => ({ ...f, documentUrl: '', documentUploadedAt: null }));
        notify('Contract removed');
        onSaved();
      })
      .catch((e) => toastError(e.message))
      .finally(() => setUploading(false));
  };

  const save = () => {
    setSaving(true);
    // Only the terms. The document has its own endpoint, and posting a stale
    // copy of its URL back here is how a freshly uploaded scan gets undone.
    const { documentUrl, documentUploadedAt, ...terms } = form;
    api(`/contracts/${nannyId}`, { method: 'PUT', body: terms })
      .then(() => { notify('Contract saved'); onSaved(); onClose(); })
      .catch((e) => toastError(e.message))
      .finally(() => setSaving(false));
  };

  if (error) return <ErrorBox error={error} />;
  if (!form) return <Skeleton rows={4} />;

  const target = Math.round(form.minimumHoursPerWeek * (1 + (form.safetyBufferPercent || 0) / 100));

  return (
    <div className="card p-5 space-y-5">
      {toast}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-medium text-slate-100">{data?.nanny?.name}</h3>
          <p className="text-xs text-slate-500">Her pay terms. Nothing here is visible to a family.</p>
        </div>
        <button type="button" className="btn-ghost" onClick={onClose}>Close</button>
      </div>

      <Num
        label="Her hourly rate (salary)"
        value={form.hourlyRate}
        step={1000}
        suffix="Rp/hr"
        hint="What we pay her. Separate from the rate card families are charged."
        onChange={(v) => setForm((f) => ({ ...f, hourlyRate: v }))}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Num
          label="Minimum hours per week"
          value={form.minimumHoursPerWeek}
          suffix="hrs"
          hint="Guaranteed: if she is booked below this, she is still paid it."
          onChange={(v) => setForm((f) => ({ ...f, minimumHoursPerWeek: v }))}
        />
        <Num
          label="Minimum client visits per week"
          value={form.minimumShiftsPerWeek}
          suffix="visits"
          hint="Counted separately — hours can be met while visits are short."
          onChange={(v) => setForm((f) => ({ ...f, minimumShiftsPerWeek: v }))}
        />
      </div>

      <Num
        label="Safety buffer"
        value={form.safetyBufferPercent}
        suffix="%"
        hint={form.minimumHoursPerWeek
          ? `Scheduling aims for ${target} hrs, so a late cancellation does not leave a guarantee unmet.`
          : 'How far above the minimum scheduling aims, to absorb cancellations.'}
        onChange={(v) => setForm((f) => ({ ...f, safetyBufferPercent: v }))}
      />


      {/* The signed contract itself. The fields above are what we believe we
          agreed; this is the proof, and it is what settles a dispute about
          guaranteed hours — which is always a dispute about money. */}
      <div>
        <span className="block text-xs text-slate-500 mb-1">Signed contract</span>
        {form.documentUrl ? (
          <div className="flex items-center gap-3 rounded-lg border border-ink-700 bg-ink-900 p-3">
            <a
              href={mediaUrl(form.documentUrl)} target="_blank" rel="noreferrer"
              className="text-sm text-brand-400 hover:underline truncate"
            >
              View signed contract
            </a>
            <span className="text-xs text-slate-500 whitespace-nowrap">
              {form.documentUploadedAt ? new Date(form.documentUploadedAt).toLocaleDateString() : ''}
            </span>
            <button
              type="button" className="btn-ghost ml-auto"
              onClick={removeDoc} disabled={uploading}
            >
              Remove
            </button>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-ink-700 p-4 text-sm text-slate-400 hover:border-ink-600 hover:text-slate-300">
            <input
              type="file" className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={(e) => uploadDoc(e.target.files?.[0])}
              disabled={uploading}
            />
            {uploading ? 'Uploading…' : 'Upload a scan or photo (PDF, JPG, PNG)'}
          </label>
        )}
      </div>

      <label className="block">
        <span className="block text-xs text-slate-500 mb-1">Notes</span>
        <textarea
          className="input" rows={3} value={form.notes}
          placeholder="Anything agreed that does not fit the fields above."
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        />
      </label>

      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save contract'}
        </button>
      </div>
    </div>
  );
}

export default function Contracts() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);

  const load = () => {
    setLoading(true);
    api('/contracts')
      .then((d) => { setRows(d.rows || []); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const owed = rows.reduce((sum, r) => sum + (r.guaranteeShortfallCost || 0), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Contract settings"
        subtitle="Guaranteed hours and visits, per nanny. Her rate here is her salary — families never see it."
      />

      {error && <ErrorBox error={error} onRetry={load} />}
      {loading && <Skeleton rows={4} />}

      {!loading && !error && (
        <>
          {owed > 0 && (
            <div className="card p-4 border-l-4 border-amber-500/70">
              <div className="font-medium text-amber-300">
                {money(owed)} of guaranteed work is unbooked this week
              </div>
              <p className="mt-1 text-sm text-slate-400">
                If the week ended now, that is what we would pay for work nobody did.
                Booking these nannies turns it into revenue instead.
              </p>
            </div>
          )}

          {editing && (
            <EditPanel nannyId={editing} onClose={() => setEditing(null)} onSaved={load} />
          )}

          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="th">Nanny</th>
                  <th className="th text-right">Hours (booked / min)</th>
                  <th className="th text-right">Visits (booked / min)</th>
                  <th className="th text-right">Guarantee at risk</th>
                  <th className="th text-right">&nbsp;</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-800">
                {rows.map((r) => (
                  <ContractRow key={r.nanny.id} row={r} onEdit={setEditing} />
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                      Nobody is on a contract yet. Open a nanny from the Nannies page to put her on one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
