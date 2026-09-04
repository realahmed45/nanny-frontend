import { useEffect, useState } from 'react';
import api from '../lib/api.js';
import { PageHeader, Skeleton, ErrorBox, useToast, money } from '../components/ui.jsx';

/**
 * Pricing is what every family is charged, so this page is deliberately
 * explicit: the two rate tables sit side by side with the discount shown
 * against each row, and nothing saves until the operator presses Save.
 */

const TIERS = [1, 2, 3];

const TIER_LABEL = { 1: '1 Child', 2: '2 Children', 3: '3 Children' };

/** Percentage of the 1-child rate, which is how the rate card is described. */
const share = (rate, base) => (base ? Math.round((rate / base) * 100) : 0);

function RateInput({ value, onChange, disabled }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-mono">Rp</span>
      <input
        type="number"
        min="0"
        step="1000"
        className="input pl-9 font-mono"
        value={Number.isFinite(value) ? value : ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      />
    </div>
  );
}

export default function Pricing() {
  const { toast, notify, error: toastError } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [standard, setStandard] = useState({});
  const [referred, setReferred] = useState({});
  const [discount, setDiscount] = useState({
    validityDays: 30, neverExpires: false, stackReferrals: true,
  });

  const load = () => {
    setLoading(true);
    api('/settings')
      .then((s) => {
        setStandard({ ...(s.pricing?.standard || {}) });
        setReferred({ ...(s.pricing?.referred || {}) });
        setDiscount({ ...(s.referralDiscount || {}) });
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const save = async () => {
    setSaving(true);
    try {
      await api('/settings', {
        method: 'PATCH',
        body: {
          pricing: { standard, referred, extraChildShare: 0.35 },
          referralDiscount: discount,
        },
      });
      notify('Pricing saved. New bookings use these rates immediately.');
      load();
    } catch (e) {
      // The server rejects contradictory rates, and the reason is worth showing.
      toastError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Skeleton rows={6} />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  const baseStd = Number(standard[1]) || 0;
  const baseRef = Number(referred[1]) || 0;

  return (
    <>
      {toast}
      <PageHeader
        title="Pricing"
        subtitle="What families pay per hour, and how the referral discount behaves"
        actions={
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ---------------- Standard rates ---------------- */}
        <div className="card p-5">
          <h3 className="text-lg font-semibold text-white mb-1">Standard rates</h3>
          <p className="text-sm text-slate-400 mb-5">
            Charged to every family who has not referred anyone.
          </p>

          <div className="space-y-4">
            {TIERS.map((n) => (
              <div key={n} className="flex items-center gap-3">
                <div className="w-32 shrink-0">
                  <div className="text-sm text-white">{TIER_LABEL[n]}</div>
                  {n > 1 && baseStd > 0 && (
                    <div className="text-xs text-slate-500 font-mono">
                      {share(Number(standard[n]) || 0, baseStd)}%
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <RateInput
                    value={Number(standard[n])}
                    onChange={(v) => setStandard((p) => ({ ...p, [n]: v }))}
                  />
                </div>
                <div className="w-16 text-xs text-slate-500">/ hour</div>
              </div>
            ))}
          </div>
        </div>

        {/* ---------------- Referred rates ---------------- */}
        <div className="card p-5">
          <h3 className="text-lg font-semibold text-white mb-1">
            Referred rates
            <span className="ml-2 text-xs font-normal text-emerald-400">discounted</span>
          </h3>
          <p className="text-sm text-slate-400 mb-5">
            Charged to a family who has successfully referred someone.
          </p>

          <div className="space-y-4">
            {TIERS.map((n) => {
              const std = Number(standard[n]) || 0;
              const ref = Number(referred[n]) || 0;
              const off = std > 0 && ref > 0 ? Math.round(((std - ref) / std) * 100) : 0;
              return (
                <div key={n} className="flex items-center gap-3">
                  <div className="w-32 shrink-0">
                    <div className="text-sm text-white">{TIER_LABEL[n]}</div>
                    {n > 1 && baseRef > 0 && (
                      <div className="text-xs text-slate-500 font-mono">
                        {share(ref, baseRef)}%
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <RateInput
                      value={Number(referred[n])}
                      onChange={(v) => setReferred((p) => ({ ...p, [n]: v }))}
                    />
                  </div>
                  <div className="w-16 text-xs">
                    {off > 0
                      ? <span className="text-emerald-400 font-mono">&minus;{off}%</span>
                      : <span className="text-slate-500">/ hour</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {TIERS.some((n) => Number(referred[n]) > Number(standard[n])) && (
            <p className="mt-4 text-xs text-red-400">
              A referred rate is higher than the standard rate — referring a friend
              would make that family pay more.
            </p>
          )}
        </div>
      </div>

      {/* ---------------- Discount validity ---------------- */}
      <div className="card p-5 mt-5">
        <h3 className="text-lg font-semibold text-white mb-1">Referral discount</h3>
        <p className="text-sm text-slate-400 mb-5">
          How long referred pricing lasts after a family successfully refers someone.
        </p>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="block text-sm text-slate-300 mb-2">Discount duration</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0"
                max="3650"
                className="input font-mono w-32"
                value={discount.validityDays ?? ''}
                disabled={discount.neverExpires}
                onChange={(e) => setDiscount((p) => ({
                  ...p, validityDays: e.target.value === '' ? '' : Number(e.target.value),
                }))}
              />
              <span className="text-sm text-slate-400">days from the first referral</span>
            </div>

            <label className="flex items-start gap-3 mt-4 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={!!discount.neverExpires}
                onChange={(e) => setDiscount((p) => ({ ...p, neverExpires: e.target.checked }))}
              />
              <span>
                <span className="text-sm text-white">Discount stays forever, until cancelled</span>
                <span className="block text-xs text-slate-500">
                  Ignores the duration above. The discount ends only if an admin cancels it.
                </span>
              </span>
            </label>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">Multiple referrals</label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={!!discount.stackReferrals}
                disabled={!!discount.neverExpires}
                onChange={(e) => setDiscount((p) => ({ ...p, stackReferrals: e.target.checked }))}
              />
              <span>
                <span className="text-sm text-white">Each referral extends the discount</span>
                <span className="block text-xs text-slate-500">
                  3 referrals &times; {discount.validityDays || 0} days ={' '}
                  <span className="font-mono text-slate-400">
                    {(Number(discount.validityDays) || 0) * 3} days
                  </span>
                  . When off, any number of referrals gives{' '}
                  {discount.validityDays || 0} days.
                </span>
              </span>
            </label>
          </div>
        </div>

        <p className="mt-5 text-xs text-slate-500">
          {discount.neverExpires
            ? 'A family who refers someone keeps referred pricing indefinitely.'
            : `A family who refers someone pays ${money(referred[1] || 0)}/hour instead of ${money(standard[1] || 0)}/hour for ${discount.stackReferrals ? 'the accumulated' : 'the next'} ${discount.validityDays || 0} days.`}
        </p>
      </div>
    </>
  );
}
