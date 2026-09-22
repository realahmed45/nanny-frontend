import { useEffect, useState } from 'react';
import api from '../lib/api.js';
import { PageHeader, Skeleton, ErrorBox, useToast } from '../components/ui.jsx';

/**
 * What the bot says when somebody asks a question instead of answering one.
 *
 * The structured flow asks a fixed question at each step and expects a
 * particular answer back. Real families do not behave that way: asked how
 * long they need a nanny, they reply "what's the minimum?" — and the flow,
 * having no answer, repeats the question at them.
 *
 * This page is the answer sheet for those moments. The questions themselves
 * never change; only what the bot can say when asked something at that point.
 * An empty box means the bot behaves exactly as it does today.
 */

function Step({ step, value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const answered = Boolean(value?.trim());

  return (
    <div className="card p-4">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            {/* The bot's question, shown as it is actually asked. It is not
                editable here: the flow is structured and stays that way. */}
            <span className="text-sm font-medium text-white">
              {step.question.split('\n')[0]}
            </span>
            {answered ? (
              <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                Answer written
              </span>
            ) : (
              <span className="rounded-md bg-ink-800 px-2 py-0.5 text-[11px] text-slate-500">
                Empty
              </span>
            )}
          </span>
          <span className="mt-1 block truncate font-mono text-xs text-slate-500">
            {step.key}
          </span>
        </span>
        <span className="mt-1 shrink-0 text-slate-500">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-3 border-t border-ink-800 pt-4">
          <div>
            <p className="text-xs text-slate-500">The bot asks:</p>
            <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-ink-950/60 p-3 font-mono text-xs text-slate-400">
              {step.question}
            </pre>
          </div>

          {/* What people actually say here instead of answering — so the box
              is filled in with the real questions in mind. */}
          {step.asks?.length > 0 && (
            <p className="text-xs text-slate-500">
              People often ask:{' '}
              {step.asks.map((a, i) => (
                <span key={a} className="text-slate-400">
                  {i > 0 && ' · '}&ldquo;{a}&rdquo;
                </span>
              ))}
            </p>
          )}

          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">
              Your answer — what the bot should say if they ask something here
            </span>
            <textarea
              className="input text-sm"
              rows={4}
              value={value}
              disabled={disabled}
              placeholder="Leave empty and the bot just asks the question again, as it does now."
              onChange={(e) => onChange(step.key, e.target.value)}
            />
          </label>
        </div>
      )}
    </div>
  );
}

export default function Chatbot() {
  const { toast, notify, error: toastError } = useToast();
  const [data, setData] = useState(null);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    api('/replies')
      .then((d) => {
        setData(d);
        setAnswers(Object.fromEntries(d.steps.map((s) => [s.key, s.answer || ''])));
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  /** One save for the whole sheet, since it is edited as one page. */
  const save = (patch = {}) => {
    setBusy(true);
    const body = {
      replySheet: {
        enabled: patch.enabled ?? data.enabled,
        mode: patch.mode ?? data.mode,
        answers: patch.answers ?? answers,
      },
    };
    return api('/settings', { method: 'PATCH', body })
      .then(() => { notify('Saved'); load(); })
      .catch((e) => toastError(e.message))
      .finally(() => setBusy(false));
  };

  const dirty =
    data && data.steps.some((s) => (answers[s.key] || '') !== (s.answer || ''));

  const written = Object.values(answers).filter((v) => v?.trim()).length;

  // Steps are grouped in the order a family meets them, so the sheet reads
  // as a walk through the booking rather than an alphabetical list.
  const groups = data
    ? data.steps.reduce((acc, s) => {
      (acc[s.group] ||= []).push(s);
      return acc;
    }, {})
    : {};

  return (
    <div className="space-y-5">
      {toast}
      <PageHeader
        title="Chatbot answers"
        subtitle="What the bot says when a family asks a question instead of answering one. The questions themselves never change."
      />

      {error && <ErrorBox error={error} onRetry={load} />}
      {loading && <Skeleton rows={6} />}

      {!loading && !error && data && (
        <>
          <div className="card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-medium text-white">Answer sheet</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Off by default. While it is off the bot behaves exactly as it
                  does today — a question it cannot parse just gets asked again.
                </p>
              </div>
              <label className="flex shrink-0 cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="accent-brand-500"
                  checked={data.enabled}
                  disabled={busy}
                  onChange={(e) => save({ enabled: e.target.checked })}
                />
                <span className="text-sm text-slate-300">
                  {data.enabled ? 'On' : 'Off'}
                </span>
              </label>
            </div>

            {data.enabled && (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  {
                    mode: 'strict',
                    title: 'Strict',
                    blurb: 'Reply with exactly what you wrote, word for word. Nothing is reworded or added.',
                  },
                  {
                    mode: 'flexible',
                    title: 'Flexible',
                    blurb: 'The same facts, worded to fit what they actually asked. It can only use what you wrote — it never adds a price, number or promise of its own.',
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
                        name="replyMode"
                        className="mt-1 accent-brand-500"
                        checked={active}
                        disabled={busy}
                        onChange={() => save({ mode: opt.mode })}
                      />
                      <span>
                        <span className="text-sm font-medium text-white">{opt.title}</span>
                        <span className="mt-0.5 block text-xs text-slate-400">{opt.blurb}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            <p className="mt-4 text-xs text-slate-500">
              {written} of {data.counts.total} steps have an answer written.
              {!data.enabled && ' The sheet is off, so none of them are in use.'}
            </p>
          </div>

          {Object.entries(groups).map(([group, steps]) => (
            <div key={group} className="space-y-3">
              <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {group}
              </h3>
              {steps.map((s) => (
                <Step
                  key={s.key}
                  step={s}
                  value={answers[s.key] ?? ''}
                  disabled={busy}
                  onChange={(key, v) => setAnswers((a) => ({ ...a, [key]: v }))}
                />
              ))}
            </div>
          ))}

          {/* Pinned, because the sheet is long and a save button at the very
              bottom is one somebody scrolls past and forgets. */}
          {dirty && (
            <div className="sticky bottom-4 flex justify-end">
              <button
                type="button"
                className="btn-primary shadow-2xl"
                onClick={() => save()}
                disabled={busy}
              >
                {busy ? 'Saving…' : 'Save answers'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
