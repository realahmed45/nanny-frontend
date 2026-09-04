import { useEffect, useState } from 'react';
import api from '../lib/api.js';
import {
  PageHeader, Table, Tabs, Badge, StatCard, Pagination,
  Skeleton, ErrorBox, useToast, dateTime, date, money,
} from '../components/ui.jsx';

/**
 * The referral engine's own screens.
 *
 * Three views because they answer three different questions: which links are
 * live, what happened to every click, and which patterns need a person to
 * look. The last is not decoration — credit can be taken, and this is the
 * only place that shows it happening.
 */

const TABS = [
  { value: 'links', label: 'Links' },
  { value: 'clicks', label: 'Click Stream' },
  { value: 'alerts', label: 'Alerts' },
];

/**
 * What each outcome means, in the operator's words rather than the enum's.
 * A blank reason means the click won — it deliberately does not also mean
 * "no idea", because then frozen and never-replied look identical.
 */
const OUTCOME = {
  won: { label: 'Credited', tone: 'text-emerald-400', hint: 'This click won the referral.' },
  no_interaction: { label: 'No reply', tone: 'text-slate-500', hint: 'Tapped the link, never wrote to us.' },
  outside_window: { label: 'Too late', tone: 'text-amber-400', hint: 'The link had already lapsed.' },
  frozen: { label: 'Already settled', tone: 'text-blue-400', hint: 'They were attributed for good by an earlier booking.' },
  self_click: { label: 'Own link', tone: 'text-slate-500', hint: 'The sharer opened their own link.' },
  superseded: { label: 'Lost the claim', tone: 'text-orange-400', hint: 'A later click took the referral.' },
  already_credited: { label: 'Same referrer', tone: 'text-slate-500', hint: 'Already credited to this sharer.' },
};

const ALERT_LABEL = {
  mass_blast: 'Mass blast',
  burst: 'Automated clicks',
  collusion: 'Repeat clicker',
  credit_sniping: 'Credit sniping',
  self_referral: 'Self referral',
  conversion_too_high: 'Conversion too high',
  insider_click: 'Insider click',
  recycled_number: 'Recycled number',
  link_flood: 'Link flood',
};

const SEVERITY_TONE = {
  high: 'bg-red-500/10 text-red-300 border-red-500/40',
  medium: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  low: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
};

export default function ReferralEngine() {
  const { toast, notify, error: toastError } = useToast();
  const [tab, setTab] = useState('links');
  const [data, setData] = useState({ items: [], page: 1, pages: 1, total: 0 });
  const [extra, setExtra] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [outcome, setOutcome] = useState('');
  const [alertStatus, setAlertStatus] = useState('open');
  const [sweeping, setSweeping] = useState(false);

  const load = () => {
    setLoading(true);
    const qs = new URLSearchParams({ page, limit: tab === 'clicks' ? 50 : 25 });

    let path = '/referral-links';
    if (tab === 'clicks') {
      path = '/referral-links/clicks';
      if (outcome) qs.set('skipReason', outcome === 'won' ? '' : outcome);
    }
    if (tab === 'alerts') {
      path = '/referral-alerts';
      qs.set('status', alertStatus);
    }

    api(`${path}?${qs}`)
      .then((r) => {
        setData(r);
        setExtra({ outcomes: r.outcomes, summary: r.summary });
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [tab, page, outcome, alertStatus]);
  useEffect(() => { setPage(1); }, [tab, outcome, alertStatus]);

  const review = async (alert, status) => {
    try {
      await api(`/referral-alerts/${alert._id}`, { method: 'PATCH', body: { status } });
      notify(status === 'dismissed' ? 'Alert dismissed.' : 'Alert marked reviewed.');
      load();
    } catch (e) {
      toastError(e.message);
    }
  };

  const sweep = async () => {
    setSweeping(true);
    try {
      await api('/referral-alerts/sweep', { method: 'POST', body: {} });
      notify('Detectors ran.');
      load();
    } catch (e) {
      toastError(e.message);
    } finally {
      setSweeping(false);
    }
  };

  const linkColumns = [
    {
      key: 'code', header: 'Code',
      render: (l) => <span className="font-mono text-xs text-brand-400">{l.linkId}</span>,
    },
    {
      key: 'sharer', header: 'Shared by',
      render: (l) => (
        <div>
          <div className="text-sm text-white">{l.sharer?.fullName || '—'}</div>
          <div className="font-mono text-[11px] text-slate-500">{l.sharer?.referralCode}</div>
        </div>
      ),
    },
    {
      key: 'kind', header: 'For',
      render: (l) => (l.kind === 'nanny'
        ? <span className="text-slate-300 text-sm">{l.nanny?.nickname || 'A nanny'}</span>
        : <span className="text-slate-500 text-sm">The platform</span>),
    },
    { key: 'clicks', header: 'Clicks', render: (l) => <span className="font-mono text-xs">{l.clicks}</span> },
    {
      key: 'replied', header: 'Replied',
      render: (l) => <span className="font-mono text-xs text-slate-300">{l.replied}</span>,
    },
    {
      key: 'conv', header: 'Booked',
      render: (l) => (l.conversionCount
        ? <span className="font-mono text-xs text-emerald-400">{l.conversionCount}</span>
        : <span className="text-slate-600 text-xs">—</span>),
    },
    {
      key: 'window', header: 'Window',
      render: (l) => (l.live
        ? <span className="text-xs text-emerald-400">{l.daysLeft}d left</span>
        : <span className="text-xs text-slate-500">{l.status}</span>),
    },
    { key: 'made', header: 'Created', render: (l) => <span className="font-mono text-xs">{date(l.createdAt)}</span> },
  ];

  const clickColumns = [
    { key: 'when', header: 'When', render: (c) => <span className="text-xs whitespace-nowrap">{dateTime(c.createdAt)}</span> },
    { key: 'link', header: 'Link', render: (c) => <span className="font-mono text-[11px] text-slate-400">{c.linkId}</span> },
    {
      key: 'sharer', header: 'Shared by',
      render: (c) => <span className="text-sm text-slate-300">{c.sharer?.fullName || '—'}</span>,
    },
    {
      key: 'who', header: 'Clicked by',
      render: (c) => (c.clickerPhone
        ? <span className="font-mono text-xs">{c.clickerPhone}</span>
        : <span className="text-xs text-slate-600 italic">not known yet</span>),
    },
    {
      key: 'outcome', header: 'Outcome',
      render: (c) => {
        const o = OUTCOME[c.skipReason || 'won'] || OUTCOME.no_interaction;
        return <span className={`text-xs ${o.tone}`} title={o.hint}>{o.label}</span>;
      },
    },
    {
      key: 'confidence', header: 'Match',
      render: (c) => <span className="text-xs text-slate-500">{c.matchConfidence}</span>,
    },
  ];

  const outcomes = extra.outcomes || {};

  if (error) return <ErrorBox error={error} onRetry={load} />;

  return (
    <>
      {toast}
      <PageHeader
        title="Referral Engine"
        subtitle="Links, every click, and the patterns worth a second look"
        actions={tab === 'alerts' && (
          <button className="btn-ghost" onClick={sweep} disabled={sweeping}>
            {sweeping ? 'Checking…' : 'Run detectors now'}
          </button>
        )}
      />

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'clicks' && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 mb-5">
            <StatCard label="Credited" value={outcomes.won ?? 0} tone="emerald" />
            <StatCard label="Never replied" value={outcomes.no_interaction ?? 0} />
            <StatCard label="Lost the claim" value={outcomes.superseded ?? 0} tone="amber" />
            <StatCard label="Already settled" value={outcomes.frozen ?? 0} tone="blue" />
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <button
              className={`btn-ghost text-xs ${!outcome ? 'text-brand-400' : ''}`}
              onClick={() => setOutcome('')}
            >
              All
            </button>
            {Object.entries(OUTCOME).map(([key, o]) => (
              <button
                key={key}
                title={o.hint}
                className={`btn-ghost text-xs ${outcome === key ? 'text-brand-400' : ''}`}
                onClick={() => setOutcome(key)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}

      {tab === 'alerts' && (
        <div className="flex flex-wrap gap-2 mb-4">
          {['open', 'reviewed', 'dismissed', 'all'].map((s) => (
            <button
              key={s}
              className={`btn-ghost text-xs capitalize ${alertStatus === s ? 'text-brand-400' : ''}`}
              onClick={() => setAlertStatus(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {loading ? <Skeleton rows={8} /> : (
        <>
          {tab === 'alerts' ? (
            (data.items || []).length === 0 ? (
              <div className="card p-12 text-center text-sm text-slate-500">
                Nothing flagged. The detectors run twice a day.
              </div>
            ) : (
              <div className="space-y-3">
                {data.items.map((a) => (
                  <div key={a._id} className="card p-4">
                    <div className="flex flex-wrap items-start gap-3">
                      <span className={`px-2 py-0.5 rounded text-xs border ${SEVERITY_TONE[a.severity]}`}>
                        {a.severity}
                      </span>
                      <div className="flex-1 min-w-[220px]">
                        <div className="text-sm font-medium text-white">
                          {ALERT_LABEL[a.kind] || a.kind}
                        </div>
                        <p className="text-sm text-slate-400 mt-0.5">{a.detail}</p>
                        <div className="text-xs text-slate-600 mt-1.5 font-mono">
                          {a.subjectType}: {a.subject} · {dateTime(a.createdAt)}
                          {a.sharer?.fullName && ` · shared by ${a.sharer.fullName}`}
                        </div>
                      </div>
                      {a.status === 'open' ? (
                        <div className="flex gap-2 shrink-0">
                          <button className="btn-ghost text-xs" onClick={() => review(a, 'reviewed')}>
                            Mark reviewed
                          </button>
                          <button className="btn-ghost text-xs text-slate-500" onClick={() => review(a, 'dismissed')}>
                            Dismiss
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500 shrink-0">
                          {a.status} {a.reviewedAt && dateTime(a.reviewedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <Table
              columns={tab === 'clicks' ? clickColumns : linkColumns}
              rows={data.items || []}
              dense
              startIndex={((data.page || 1) - 1) * (tab === 'clicks' ? 50 : 25)}
              empty={tab === 'clicks'
                ? 'No clicks recorded yet.'
                : 'No links minted yet. They appear when a family opens Refer a Friend.'}
            />
          )}

          <Pagination
            page={data.page}
            pages={data.pages}
            total={data.total}
            onChange={setPage}
          />
        </>
      )}
    </>
  );
}
