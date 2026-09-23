import { useEffect, useState } from 'react';
import api from '../lib/api.js';
import { PageHeader, Skeleton, ErrorBox, useToast, money } from '../components/ui.jsx';

/**
 * What the business made, and what it spent.
 *
 * The Earnings page answers "what did we keep on the bookings?" — charged,
 * less what the nannies were paid. That is gross margin, and on its own it
 * flatters: it knows nothing about rent, transport or advertising, because
 * none of that passes through a booking.
 *
 * So this page carries both. Gross is what the work produced; net is what
 * survives the running costs, and it is the only one of the two that answers
 * whether the month made money.
 *
 * Costs are entered here and nowhere else, by finance or a super admin. An
 * ordinary admin can read every figure on this page and change none of them.
 */

/** The first of this month to today — the period people mean by default. */
function defaultRange() {
  const now = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) };
}

function Stat({ label, value, tone = 'slate', hint }) {
  const tones = {
    slate: 'text-slate-100',
    green: 'text-emerald-400',
    amber: 'text-amber-400',
    red: 'text-rose-400',
  };
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 font-mono text-2xl font-semibold ${tones[tone]}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

function Table({ columns, rows, empty }) {
  if (!rows.length) {
    return <div className="card p-10 text-center text-sm text-slate-500">{empty}</div>;
  }
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={`th ${c.right ? 'text-right' : ''}`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-800">
          {rows.map((r, i) => (
            <tr key={r._key ?? i}>
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`px-4 py-3 ${c.right ? 'text-right font-mono' : ''} ${c.className || ''}`}
                >
                  {c.render ? c.render(r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * The cost form
 * ------------------------------------------------------------------ */

const BLANK = {
  spentOn: new Date().toISOString().slice(0, 10),
  category: 'other',
  description: '',
  amount: '',
  paidTo: '',
  recurring: false,
  note: '',
};

function CostForm({ categories, onSaved, onError, notify }) {
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    setSaving(true);
    api('/costs', { method: 'POST', body: { ...form, amount: Number(form.amount) } })
      .then(() => {
        notify('Cost recorded');
        // Cleared except the date: receipts are usually entered in batches
        // from the same day, and retyping it every time is a papercut.
        setForm({ ...BLANK, spentOn: form.spentOn });
        onSaved();
      })
      .catch((err) => onError(err.message))
      .finally(() => setSaving(false));
  };

  return (
    <form onSubmit={submit} className="card space-y-4 p-5">
      <h3 className="text-sm font-medium text-white">Record a cost</h3>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">Date spent</span>
          <input
            type="date" className="input" required
            value={form.spentOn}
            onChange={(e) => set('spentOn', e.target.value)}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">Category</span>
          <select
            className="input" value={form.category}
            onChange={(e) => set('category', e.target.value)}
          >
            {categories.map((c) => (
              <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">Amount</span>
          <input
            type="number" min="0" step="1000" className="input font-mono" required
            placeholder="0"
            value={form.amount}
            onChange={(e) => set('amount', e.target.value)}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">Paid to</span>
          <input
            type="text" className="input" placeholder="Supplier, landlord…"
            value={form.paidTo}
            onChange={(e) => set('paidTo', e.target.value)}
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs text-slate-500">What was it for?</span>
        <input
          type="text" className="input" required
          placeholder="Petrol for the Ubud run, Canva subscription, new phone…"
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
        />
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-400">
          <input
            type="checkbox" className="accent-brand-500"
            checked={form.recurring}
            onChange={(e) => set('recurring', e.target.checked)}
          />
          This repeats every month
        </label>

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Record cost'}
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ *
 * Special payouts
 * ------------------------------------------------------------------ */

const BLANK_SPECIAL = { nannyId: '', amount: '', reason: '', note: '' };

/**
 * Something owed to a nanny that no booking covers.
 *
 * A taxi she paid for, a uniform, a medical bill. Both the reason and the
 * receipt are required, because unlike earnings there is no booking behind
 * the figure to check it against — a payment to a person with neither is
 * indistinguishable from a mistake.
 */
function SpecialPayoutForm({ nannies, onSaved, onError, notify }) {
  const [form, setForm] = useState(BLANK_SPECIAL);
  const [proofUrl, setProofUrl] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const upload = (file) => {
    if (!file) return;
    setBusy(true);
    const reader = new FileReader();
    reader.onerror = () => { onError('The file could not be read'); setBusy(false); };
    reader.onload = () => {
      const ext = (file.name.match(/\.[a-z0-9]+$/i)?.[0] || '.jpg').toLowerCase();
      api('/payouts/proof-upload', {
        method: 'POST',
        body: { data: String(reader.result).split(',')[1], ext },
      })
        .then((r) => { setProofUrl(r.url); notify('Receipt attached'); })
        .catch((e) => onError(e.message))
        .finally(() => setBusy(false));
    };
    reader.readAsDataURL(file);
  };

  const submit = (e) => {
    e.preventDefault();
    if (!proofUrl) return onError('Please attach a photo of the receipt');
    setBusy(true);
    api('/payouts/special', {
      method: 'POST',
      body: { ...form, amount: Number(form.amount), costProofUrl: proofUrl },
    })
      .then(() => {
        notify('Payment raised');
        setForm(BLANK_SPECIAL);
        setProofUrl('');
        onSaved();
      })
      .catch((err) => onError(err.message))
      .finally(() => setBusy(false));
  };

  return (
    <form onSubmit={submit} className="card space-y-4 p-5">
      <div>
        <h3 className="text-sm font-medium text-white">Pay a nanny for something</h3>
        <p className="mt-1 text-xs text-slate-500">
          Anything outside her earnings — a taxi she covered, a uniform, a
          medical cost. The receipt is required.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">Nanny</span>
          <select
            className="input" required value={form.nannyId}
            onChange={(e) => set('nannyId', e.target.value)}
          >
            <option value="">Choose…</option>
            {nannies.map((n) => (
              <option key={n.nannyId} value={n.nannyId}>{n.name}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">Amount</span>
          <input
            type="number" min="0" step="1000" className="input font-mono" required
            placeholder="0" value={form.amount}
            onChange={(e) => set('amount', e.target.value)}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">Receipt</span>
          {proofUrl ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-emerald-400">Attached</span>
              <button
                type="button" className="btn-ghost text-xs"
                onClick={() => setProofUrl('')}
              >
                Replace
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-ink-700 px-3 py-2.5 text-xs text-slate-400 hover:border-ink-600">
              <input
                type="file" className="hidden" accept=".jpg,.jpeg,.png,.webp,.pdf"
                disabled={busy}
                onChange={(e) => upload(e.target.files?.[0])}
              />
              {busy ? 'Uploading…' : 'Attach a photo'}
            </label>
          )}
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs text-slate-500">What is it for?</span>
        <input
          type="text" className="input" required
          placeholder="Taxi to the Seminyak booking, replacement uniform, clinic visit…"
          value={form.reason}
          onChange={(e) => set('reason', e.target.value)}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs text-slate-500">Note (optional)</span>
        <textarea
          className="input text-sm" rows={2}
          placeholder="Anything else worth recording about this payment."
          value={form.note}
          onChange={(e) => set('note', e.target.value)}
        />
      </label>

      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Raise payment'}
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ *
 * The page
 * ------------------------------------------------------------------ */

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'clients', label: 'By client' },
  { key: 'nannies', label: 'By nanny' },
  { key: 'payouts', label: 'Payments to nannies' },
  { key: 'costs', label: 'Costs' },
];

export default function Finance() {
  const { toast, notify, error: toastError } = useToast();
  const [range, setRange] = useState(defaultRange);
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState(null);
  const [costs, setCosts] = useState(null);
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    const q = `?from=${range.from}&to=${range.to}`;
    Promise.all([api(`/finance${q}`), api(`/costs${q}`), api('/auth/me').catch(() => null)])
      .then(([f, c, who]) => {
        setData(f);
        setCosts(c);
        setMe(who?.admin || who || null);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [range.from, range.to]);

  // Only finance and super admins may write. Everybody else reads.
  const canEdit = ['finance', 'super_admin'].includes(me?.role);

  const voidCost = (id) => {
    api(`/costs/${id}`, { method: 'DELETE' })
      .then(() => { notify('Cost voided'); load(); })
      .catch((e) => toastError(e.message));
  };

  const t = data?.totals;

  return (
    <div className="space-y-5">
      {toast}
      <PageHeader
        title="Finance"
        subtitle="Revenue, profit and running costs. Gross is what the bookings kept; net is what survives the costs."
      />

      <div className="card flex flex-wrap items-end gap-3 p-4">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-slate-500">From</span>
          <input
            type="date" className="input" value={range.from}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-slate-500">To</span>
          <input
            type="date" className="input" value={range.to}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
          />
        </label>
        <button type="button" className="btn-ghost" onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && <ErrorBox error={error} onRetry={load} />}
      {loading && <Skeleton rows={6} />}

      {!loading && !error && data && (
        <>
          {/* A booking with no nanny rate cannot be settled, and its whole
              family payment looks like profit. Said plainly rather than left
              to make every figure above quietly wrong. */}
          {data.unpriced?.length > 0 && (
            <div className="card border-l-4 border-amber-500/70 p-4">
              <div className="font-medium text-amber-300">
                {data.unpriced.length} booking{data.unpriced.length === 1 ? ' has' : 's have'} no
                nanny rate recorded
              </div>
              <p className="mt-1 text-sm text-slate-400">
                Their pay counts as zero, so the profit figures above are
                overstated by whatever those nannies are actually owed.
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {TABS.map((x) => (
              <button
                key={x.key}
                type="button"
                onClick={() => setTab(x.key)}
                className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                  tab === x.key
                    ? 'bg-brand-500/15 font-medium text-brand-400'
                    : 'text-slate-400 hover:bg-ink-800'
                }`}
              >
                {x.label}
              </button>
            ))}
          </div>

          {tab === 'overview' && (
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="card p-5">
                <h3 className="mb-3 text-sm font-medium text-white">Where the money went</h3>
                <dl className="space-y-2 text-sm">
                  <Line label="Charged to families" value={money(t.revenue)} />
                  <Line label="Paid to nannies" value={`− ${money(t.paidToNannies)}`} tone="amber" />
                  <Line label="Refunded" value={`− ${money(t.refunded)}`} tone="red" />
                  <Line label="Gross profit" value={money(t.grossProfit)} bold />
                  <Line label="Running costs" value={`− ${money(t.costs)}`} tone="red" />
                  <Line
                    label="Net profit" value={money(t.netProfit)} bold
                    tone={t.netProfit >= 0 ? 'green' : 'red'}
                  />
                </dl>
              </div>

              <div className="card p-5">
                <h3 className="mb-3 text-sm font-medium text-white">Costs by category</h3>
                {Object.keys(data.costs.byCategory).length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Nothing recorded for this period.
                  </p>
                ) : (
                  <dl className="space-y-2 text-sm">
                    {Object.entries(data.costs.byCategory)
                      .sort((a, b) => b[1] - a[1])
                      .map(([cat, amount]) => (
                        <Line
                          key={cat}
                          label={cat[0].toUpperCase() + cat.slice(1)}
                          value={money(amount)}
                        />
                      ))}
                  </dl>
                )}
              </div>
            </div>
          )}

          {tab === 'clients' && (
            <Table
              empty="No completed work from any client in this period."
              rows={data.byClient.map((r) => ({ ...r, _key: r.clientId }))}
              columns={[
                { key: 'name', label: 'Client' },
                { key: 'bookings', label: 'Bookings', right: true },
                { key: 'days', label: 'Days', right: true },
                { key: 'charged', label: 'Revenue', right: true, render: (r) => money(r.charged) },
                {
                  key: 'paidToNannies',
                  label: 'Paid out',
                  right: true,
                  className: 'text-amber-400',
                  render: (r) => money(r.paidToNannies),
                },
                {
                  key: 'profit',
                  label: 'Profit',
                  right: true,
                  className: 'font-semibold text-emerald-400',
                  render: (r) => money(r.profit),
                },
              ]}
            />
          )}

          {tab === 'nannies' && (
            <Table
              empty="No completed work by any nanny in this period."
              rows={data.byNanny.map((r) => ({ ...r, _key: r.nannyId }))}
              columns={[
                {
                  key: 'name',
                  label: 'Nanny',
                  render: (r) => (
                    <span>
                      {r.name}
                      {r.missingRate && (
                        <span className="mt-0.5 block text-xs text-amber-400/80">
                          no rate on some bookings
                        </span>
                      )}
                    </span>
                  ),
                },
                { key: 'bookings', label: 'Bookings', right: true },
                { key: 'days', label: 'Days', right: true },
                { key: 'charged', label: 'Revenue', right: true, render: (r) => money(r.charged) },
                {
                  key: 'earned',
                  label: 'She earned',
                  right: true,
                  className: 'text-amber-400',
                  render: (r) => money(r.earned),
                },
                {
                  key: 'profit',
                  label: 'Profit',
                  right: true,
                  className: 'font-semibold text-emerald-400',
                  render: (r) => money(r.profit),
                },
              ]}
            />
          )}

          {tab === 'payouts' && (
            <>
              {canEdit && (
                <SpecialPayoutForm
                  nannies={data.byNanny}
                  notify={notify}
                  onError={toastError}
                  onSaved={load}
                />
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <Stat label="Paid out" value={money(data.payouts.paid)} tone="green" />
                <Stat
                  label="Still owed" value={money(data.payouts.pending)} tone="amber"
                  hint="Queued or in progress — not yet left the account"
                />
              </div>
              <Table
                empty="No payouts in this period."
                rows={data.payouts.byNanny.map((r) => ({ ...r, _key: r.nannyId }))}
                columns={[
                  { key: 'name', label: 'Nanny' },
                  { key: 'count', label: 'Payouts', right: true },
                  {
                    key: 'paid',
                    label: 'Paid',
                    right: true,
                    className: 'text-emerald-400',
                    render: (r) => money(r.paid),
                  },
                  {
                    key: 'pending',
                    label: 'Still owed',
                    right: true,
                    className: 'text-amber-400',
                    render: (r) => money(r.pending),
                  },
                ]}
              />
            </>
          )}

          {tab === 'costs' && (
            <>
              {canEdit ? (
                <CostForm
                  categories={costs?.categories || []}
                  notify={notify}
                  onError={toastError}
                  onSaved={load}
                />
              ) : (
                <div className="card border-l-4 border-ink-700 p-4 text-sm text-slate-400">
                  Costs are entered by finance. You can see everything recorded
                  here, but not add or change it.
                </div>
              )}

              <Table
                empty="No costs recorded for this period."
                rows={(costs?.rows || []).map((r) => ({ ...r, _key: r._id }))}
                columns={[
                  {
                    key: 'spentOn',
                    label: 'Date',
                    render: (r) => new Date(r.spentOn).toLocaleDateString(),
                  },
                  {
                    key: 'category',
                    label: 'Category',
                    render: (r) => r.category[0].toUpperCase() + r.category.slice(1),
                  },
                  {
                    key: 'description',
                    label: 'What for',
                    render: (r) => (
                      <span className={r.voided ? 'text-slate-600 line-through' : undefined}>
                        {r.description}
                        {r.paidTo && (
                          <span className="mt-0.5 block text-xs text-slate-500">to {r.paidTo}</span>
                        )}
                        {r.recurring && (
                          <span className="ml-2 rounded bg-ink-800 px-1.5 py-0.5 text-[11px] text-slate-400">
                            monthly
                          </span>
                        )}
                      </span>
                    ),
                  },
                  {
                    key: 'amount',
                    label: 'Amount',
                    right: true,
                    render: (r) => (
                      <span className={r.voided ? 'text-slate-600 line-through' : 'text-rose-400'}>
                        {money(r.amount)}
                      </span>
                    ),
                  },
                  {
                    key: 'actions',
                    label: '',
                    right: true,
                    render: (r) =>
                      (canEdit && !r.voided ? (
                        <button
                          type="button"
                          className="btn-ghost text-xs"
                          onClick={() => voidCost(r._id)}
                        >
                          Void
                        </button>
                      ) : r.voided ? (
                        <span className="text-xs text-slate-600">voided</span>
                      ) : null),
                  },
                ]}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

function Line({ label, value, tone = 'slate', bold }) {
  const tones = {
    slate: 'text-slate-300',
    green: 'text-emerald-400',
    amber: 'text-amber-400',
    red: 'text-rose-400',
  };
  return (
    <div className={`flex justify-between gap-4 ${bold ? 'border-t border-ink-800 pt-2' : ''}`}>
      <dt className="text-slate-500">{label}</dt>
      <dd className={`font-mono ${tones[tone]} ${bold ? 'font-semibold' : ''}`}>{value}</dd>
    </div>
  );
}
