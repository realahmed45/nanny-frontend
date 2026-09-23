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

/**
 * The two modes, and one worked example carried through both.
 *
 * The example is the same written answer in each, so the difference is the
 * reply and nothing else — which is the only thing that actually differs.
 */
const EXAMPLE = {
  written: 'Minimum 3 hours. Overtime is 1.5x after 8 hours.',
  asked: 'can she stay a bit longer if we run late?',
};

const MODES = [
  {
    mode: 'structured',
    title: 'Structured',
    level: 'No AI',
    blurb: 'The flow exactly as it has always been. The bot asks its questions in order, and a reply it cannot read gets the question again.',
    example: 'How long do you need the nanny?',
    exampleLabel: 'Bot replies',
    note: 'Nothing on this page is used. Predictable, free, and never wrong about what somebody meant.',
  },
  {
    mode: 'strict',
    title: 'Strict',
    level: 'Lower-level AI',
    blurb: 'When a family asks a question instead of answering, the bot sends exactly what you wrote in that step’s box — word for word, nothing reworded or added.',
    example: 'Minimum 3 hours. Overtime is 1.5x after 8 hours.',
    exampleLabel: 'Bot replies',
    note: 'Always correct, because it is your words. Can read as blunt when it only half answers what was asked.',
  },
  {
    mode: 'flexible',
    title: 'Flexible',
    level: 'Medium-level AI',
    blurb: 'The same written facts, worded to fit the question they actually asked. It may rephrase; it may never add a price, number or promise of its own.',
    example: 'Yes — she can stay on, and overtime is charged at 1.5x after 8 hours.',
    exampleLabel: 'Bot replies',
    note: 'Reads naturally. If your note does not cover what they asked, it says what it does cover rather than guessing.',
  },
];

function Step({ step, value, onChange, disabled, structured }) {
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
              {structured && (
                <span className="text-amber-400/80">
                  {' '}· not used while Structured is live
                </span>
              )}
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

      {/* The flow itself, stated once before the modes. All three ask the
          same questions in the same order — the difference is only in what
          happens when somebody asks something back. */}
      <div className="card border-l-4 border-ink-700 p-4">
        <p className="text-sm font-medium text-white">The structured flow</p>
        <p className="mt-1.5 text-xs text-slate-400">
          The bot asks a fixed set of questions, in a fixed order, and reads
          the reply with the strict parser. That never changes, in any mode —
          the questions listed below are exactly what it asks, and they are
          not editable. What the three modes change is only what happens when
          a family asks a question instead of answering one.
        </p>
      </div>

      {error && <ErrorBox error={error} onRetry={load} />}
      {loading && <Skeleton rows={6} />}

      {!loading && !error && data && (
        <>
          <div className="card p-5">
            <h2 className="text-sm font-medium text-white">Message mode</h2>
            <p className="mt-1 text-xs text-slate-500">
              Three settings, in increasing order of how much latitude the bot
              is given. Each one is the one before it plus a single degree of
              freedom, and every degree is bounded by what you type below.
            </p>

            <div className="mt-5 grid gap-3 lg:grid-cols-3">
              {MODES.map((opt) => {
                const active = data.mode === opt.mode;
                return (
                  <button
                    key={opt.mode}
                    type="button"
                    disabled={busy}
                    onClick={() => save({ mode: opt.mode })}
                    className={`flex flex-col rounded-lg border p-4 text-left transition-colors disabled:opacity-50 ${
                      active
                        ? 'border-brand-500/60 bg-brand-500/10'
                        : 'border-ink-800 hover:border-ink-700'
                    }`}
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span
                        className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ${
                          active ? 'border-brand-500' : 'border-ink-700'
                        }`}
                      >
                        {active && <span className="h-2 w-2 rounded-full bg-brand-500" />}
                      </span>
                      <span className="text-sm font-medium text-white">{opt.title}</span>
                      <span className="rounded-md bg-ink-800 px-2 py-0.5 text-[11px] text-slate-400">
                        {opt.level}
                      </span>
                      {active && (
                        <span className="rounded-md bg-brand-500/15 px-2 py-0.5 text-[11px] font-medium text-brand-400">
                          Live
                        </span>
                      )}
                    </span>

                    <span className="mt-2 block text-xs text-slate-400">{opt.blurb}</span>

                    {/* The same situation carried through all three, so the
                        only thing that differs is the reply each produces. */}
                    <span className="mt-3 block rounded-lg bg-ink-950/60 p-3">
                      {opt.mode !== 'structured' && (
                        <span className="mb-2 block text-[11px] text-slate-500">
                          You wrote:{' '}
                          <span className="text-slate-400">&ldquo;{EXAMPLE.written}&rdquo;</span>
                        </span>
                      )}
                      <span className="block text-[11px] text-slate-500">
                        They ask:{' '}
                        <span className="text-slate-400">&ldquo;{EXAMPLE.asked}&rdquo;</span>
                      </span>
                      <span className="mt-2 block text-[11px] text-slate-500">
                        {opt.exampleLabel}:
                      </span>
                      <span
                        className={`mt-0.5 block text-xs ${
                          opt.mode === 'structured' ? 'text-slate-400' : 'text-emerald-400'
                        }`}
                      >
                        {opt.example}
                      </span>
                      {opt.mode === 'structured' && (
                        <span className="mt-1 block text-[11px] text-slate-600">
                          (the question again — it has no answer to give)
                        </span>
                      )}
                    </span>

                    <span className="mt-2 block text-[11px] text-slate-600">{opt.note}</span>
                  </button>
                );
              })}
            </div>

            <p className="mt-4 text-xs text-slate-500">
              {written} of {data.counts.total} steps have an answer written.
              {data.mode === 'structured'
                && ' Structured is live, so none of them are being used.'}
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
                  structured={data.mode === 'structured'}
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
