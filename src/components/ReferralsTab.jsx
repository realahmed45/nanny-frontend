import { useEffect, useState } from 'react';
import api from '../lib/api.js';
import { Skeleton, ErrorBox, Avatar, date, money } from './ui.jsx';

/**
 * Both sides of one person's referral tree.
 *
 * Who introduced them, and everyone they introduced — each row carrying the
 * date it happened and opening that person's own profile, so a chain can be
 * walked in either direction without going back to a list and searching.
 */

const ROLE_LABEL = { family: 'Family/Customer', nanny: 'Nanny' };

/** A claim that is settled, still takeable, or lapsed — worth saying plainly. */
const STATUS_NOTE = {
  frozen: 'Settled',
  credited: 'Claimable',
  expired: 'Expired',
};

function Row({ person, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen?.(person)}
      className="w-full flex items-center gap-3 rounded-lg border border-ink-800 bg-ink-950/40 px-3 py-2.5 text-left hover:border-brand-500/50 hover:bg-ink-800/40 transition-colors"
    >
      <Avatar name={person.fullName} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm text-white truncate">{person.fullName || 'Unnamed'}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-ink-800 text-slate-400 shrink-0">
            {ROLE_LABEL[person.role] || person.role}
          </span>
          {person.blocked && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 shrink-0">
              Blocked
            </span>
          )}
        </div>
        <div className="text-[11px] font-mono text-slate-500 truncate">
          {person.phone}
          {person.referralCode ? ` · ${person.referralCode}` : ''}
        </div>
      </div>

      {/* When the referral happened — the thing a count alone never says. */}
      <div className="text-right shrink-0">
        <div className="text-xs text-slate-300">
          {person.referredAt ? date(person.referredAt) : 'Date not recorded'}
        </div>
        {/* Older records predate the attribution engine, so the date shown is
            the signup rather than the credit. Better to say so than imply
            a precision the record does not have. */}
        {person.approximate && person.referredAt && (
          <div className="text-[10px] text-slate-600">approx. (signup)</div>
        )}
        {STATUS_NOTE[person.status] && (
          <div className="text-[10px] text-slate-600">{STATUS_NOTE[person.status]}</div>
        )}
      </div>

      <span className="text-slate-600 text-xs shrink-0">→</span>
    </button>
  );
}

/**
 * @param role  Show only the people referred who have this role. A nanny
 *              recruits two different things — customers and colleagues —
 *              and they are read for different reasons, so each gets its own
 *              tab rather than a mixed list to sort through by eye. Omit to
 *              show everyone, which is what a family's page still does.
 */
export default function ReferralsTab({ personId, onOpenPerson, role }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!personId) return;
    setLoading(true);
    setError(null);
    api(`/users/${personId}/referrals`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [personId]);

  if (error) return <ErrorBox error={error} />;
  if (loading) return <Skeleton rows={4} />;

  const inbound = data?.inbound;
  const all = data?.outbound || [];
  const outbound = role ? all.filter((p) => p.role === role) : all;

  const noun = role === 'family' ? 'customers'
    : role === 'nanny' ? 'nannies'
      : 'anyone';

  return (
    <div className="space-y-6">
      <section>
        <h4 className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-2">
          Referred by
        </h4>
        {inbound ? (
          <Row person={inbound} onOpen={onOpenPerson} />
        ) : (
          <p className="text-xs text-slate-600 rounded-lg border border-dashed border-ink-800 px-3 py-4 text-center">
            Nobody referred this person — they signed up on their own.
          </p>
        )}
      </section>

      <section>
        <h4 className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-2">
          {role === 'family' ? 'Customers/families they referred'
            : role === 'nanny' ? 'Nannies they referred'
              : 'Referred by them'}
          <span className="ml-2 text-slate-600">{outbound.length}</span>
        </h4>

        {outbound.length === 0 ? (
          <p className="text-xs text-slate-600 rounded-lg border border-dashed border-ink-800 px-3 py-4 text-center">
            {role ? `They have not referred any ${noun} yet.`
              : 'They have not referred anyone yet.'}
          </p>
        ) : (
          <div className="space-y-1.5">
            {outbound.map((p) => (
              <Row key={p._id} person={p} onOpen={onOpenPerson} />
            ))}
          </div>
        )}

        {/* Earnings cover every referral, not just the ones on this tab, so
            they are stated once rather than repeated as if each tab earned
            them separately. */}
        {data?.earnings > 0 && role !== 'nanny' && (
          <p className="text-xs text-slate-500 mt-3">
            Referral earnings (all referrals):{' '}
            <span className="font-mono text-emerald-400">{money(data.earnings)}</span>
          </p>
        )}
      </section>
    </div>
  );
}
