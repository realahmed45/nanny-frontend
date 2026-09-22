import { useEffect, useState } from 'react';
import api from '../lib/api.js';
import { PageHeader, Skeleton, ErrorBox, useToast } from '../components/ui.jsx';

/**
 * What the bot says, and how many ways it can say it.
 *
 * Two modes, and the difference is only ever about wording:
 *
 *   Strict    — one wording per question, every time. Predictable, and what
 *               you want when a script is being reviewed or trained against.
 *   Flexible  — one of several written alternatives, picked at random, so a
 *               long booking does not read like a machine reciting a form.
 *
 * Nothing here is generated. Every alternative is written down, editable on
 * this page, and stored — which is the point. A bot that invents its own
 * wording can change what a question means without anyone noticing until a
 * booking is wrong.
 *
 * Separate from the conversation mode on the Settings page: that one governs
 * how a family's *reply* is understood. This governs how the *question* is
 * put. They do not affect each other.
 */

/** Some questions are never varied. The reason is worth showing. */
function FixedBadge({ reason }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400"
      title={reason || 'This question is always asked the same way.'}
    >
      Always strict
    </span>
  );
}

function Question({ q, onSave, onReset, busy }) {
  const [open, setOpen] = useState(false);
  const [strict, setStrict] = useState(q.strict || '');
  const [flexible, setFlexible] = useState(q.flexible || []);

  // A save elsewhere on the page reloads every question, so local edits are
  // re-seeded from what came back rather than left showing stale text.
  useEffect(() => {
    setStrict(q.strict || '');
    setFlexible(q.flexible || []);
  }, [q.strict, q.flexible]);

  const dirty =
    strict !== (q.strict || '') ||
    JSON.stringify(flexible) !== JSON.stringify(q.flexible || []);

  const setVariant = (i, value) =>
    setFlexible((list) => list.map((v, j) => (j === i ? value : v)));

  const addVariant = () => setFlexible((list) => [...list, '']);
  const removeVariant = (i) => setFlexible((list) => list.filter((_, j) => j !== i));

  return (
    <div className="card p-4">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-white">{q.label}</span>
            {q.fixed && <FixedBadge reason={q.fixedBecause} />}
            {q.edited && (
              <span className="rounded-md bg-brand-500/15 px-2 py-0.5 text-[11px] font-medium text-brand-400">
                Edited
              </span>
            )}
            {!q.fixed && (
              <span className="text-[11px] text-slate-500">
                {(q.flexible?.length || 0)} wording
                {(q.flexible?.length || 0) === 1 ? '' : 's'}
              </span>
            )}
          </span>
          <span className="mt-1 block truncate font-mono text-xs text-slate-500">
            {q.key}
          </span>
        </span>
        <span className="mt-1 shrink-0 text-slate-500">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-4 border-t border-ink-800 pt-4">
          {q.placeholders?.length > 0 && (
            <p className="text-xs text-slate-500">
              Must keep{' '}
              <span className="font-mono text-slate-400">
                {q.placeholders.join(', ')}
              </span>{' '}
              — it is replaced with the real name when the message is sent.
            </p>
          )}

          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">
              Strict — used every time in strict mode
            </span>
            <textarea
              className="input font-mono text-xs"
              rows={Math.min(6, (strict.match(/\n/g)?.length || 0) + 2)}
              value={strict}
              onChange={(e) => setStrict(e.target.value)}
              disabled={busy || q.strict === null}
            />
          </label>

          {q.fixed ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-slate-400">
              {q.fixedBecause}
            </p>
          ) : (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Flexible — one of these, picked at random
                </span>
                <button
                  type="button"
                  className="btn-ghost text-xs"
                  onClick={addVariant}
                  disabled={busy || flexible.length >= 8}
                >
                  Add wording
                </button>
              </div>

              <div className="space-y-2">
                {flexible.map((v, i) => (
                  <div key={i} className="flex gap-2">
                    <textarea
                      className="input flex-1 font-mono text-xs"
                      rows={Math.min(5, (v.match(/\n/g)?.length || 0) + 2)}
                      value={v}
                      onChange={(e) => setVariant(i, e.target.value)}
                      disabled={busy}
                    />
                    <button
                      type="button"
                      className="btn-ghost shrink-0 text-xs"
                      onClick={() => removeVariant(i)}
                      disabled={busy || flexible.length <= 1}
                      title={flexible.length <= 1 ? 'At least one wording is needed' : 'Remove'}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              {q.hasOptions && (
                <p className="mt-2 text-xs text-slate-500">
                  The numbered options are added automatically and are never
                  reworded — only the sentence above them changes.
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            {q.edited && (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => onReset(q.key)}
                disabled={busy}
              >
                Reset to default
              </button>
            )}
            <button
              type="button"
              className="btn-primary"
              onClick={() => onSave(q.key, { strict, flexible: q.fixed ? undefined : flexible })}
              disabled={busy || !dirty}
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Chatbot() {
  const { toast, notify, error: toastError } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    api('/phrasing')
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const setMode = (mode) => {
    setBusy(true);
    setData((d) => ({ ...d, mode }));   // reflect the click immediately
    api('/settings', { method: 'PATCH', body: { phrasing: { mode } } })
      .then(() => notify(mode === 'flexible'
        ? 'Flexible wording is on. The bot will vary how it asks.'
        : 'Strict wording is on. The bot asks the same way every time.'))
      .catch((e) => { toastError(e.message); load(); })
      .finally(() => setBusy(false));
  };

  const save = (key, value) => {
    setBusy(true);
    const overrides = {};
    for (const q of data.questions) {
      if (q.edited && q.key !== key) {
        overrides[q.key] = { strict: q.strict, flexible: q.flexible ?? undefined };
      }
    }
    overrides[key] = value;

    api('/settings', { method: 'PATCH', body: { phrasingOverrides: overrides } })
      .then(() => { notify('Wording saved'); load(); })
      .catch((e) => toastError(e.message))
      .finally(() => setBusy(false));
  };

  const reset = (key) => {
    setBusy(true);
    api(`/phrasing/${key}`, { method: 'DELETE' })
      .then(() => { notify('Reset to the wording that ships in the code'); load(); })
      .catch((e) => toastError(e.message))
      .finally(() => setBusy(false));
  };

  const flexible = data?.mode === 'flexible';

  return (
    <div className="space-y-5">
      {toast}
      <PageHeader
        title="Chatbot wording"
        subtitle="Every question the bot asks, and how many ways it can ask it. Nothing here is AI-generated."
      />

      {error && <ErrorBox error={error} onRetry={load} />}
      {loading && <Skeleton rows={6} />}

      {!loading && !error && data && (
        <>
          <div className="card p-5">
            <h2 className="text-sm font-medium text-white">Wording mode</h2>
            <p className="mt-1 text-xs text-slate-500">
              This is about how questions are <em>worded</em>. How a family&apos;s
              reply is <em>understood</em> is set separately, under Settings.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                {
                  mode: 'strict',
                  title: 'Strict',
                  blurb: 'One wording per question, every time. Predictable, and the easiest to review or train staff against.',
                },
                {
                  mode: 'flexible',
                  title: 'Flexible',
                  blurb: 'One of several written wordings, picked at random, so a long booking does not read like a form. Every alternative is written and stored — never generated.',
                },
              ].map((opt) => {
                const active = data.mode === opt.mode;
                return (
                  <label
                    key={opt.mode}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                      active
                        ? 'border-brand-500/60 bg-brand-500/10'
                        : 'border-ink-800 hover:border-ink-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="phrasing"
                      className="mt-1 accent-brand-500"
                      checked={active}
                      disabled={busy}
                      onChange={() => setMode(opt.mode)}
                    />
                    <span>
                      <span className="text-sm font-medium text-white">{opt.title}</span>
                      <span className="mt-0.5 block text-xs text-slate-400">{opt.blurb}</span>
                    </span>
                  </label>
                );
              })}
            </div>

            <p className="mt-4 text-xs text-slate-500">
              {data.counts.total} questions · {data.counts.fixed} always strict ·{' '}
              {data.counts.edited} edited here
              {flexible && ' · flexible wording is live'}
            </p>
          </div>

          <div className="space-y-3">
            {data.questions.map((q) => (
              <Question key={q.key} q={q} onSave={save} onReset={reset} busy={busy} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
