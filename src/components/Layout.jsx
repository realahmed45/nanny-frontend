import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api, { clearToken } from '../lib/api.js';
import { setCurrency } from './ui.jsx';
import {
  IconDashboard, IconNanny, IconFamily, IconBookings, IconCalendar,
  IconPayments, IconSupport, IconReferrals, IconSettings, IconChats,
  IconSearch, IconBell, IconMenu, IconPhone,
} from './icons.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', Icon: IconDashboard, end: true },
  { to: '/nannies', label: 'Nannies', Icon: IconNanny, count: 'nannies' },
  { to: '/families', label: 'Families', Icon: IconFamily },
  { to: '/callbacks', label: 'Call Straight Away', Icon: IconPhone, count: 'callbacks' },
  { to: '/bookings', label: 'Bookings', Icon: IconBookings, count: 'bookings' },
  { to: '/calendar', label: 'Calendar', Icon: IconCalendar },
  { to: '/payments', label: 'Payments', Icon: IconPayments, count: 'payments' },
  { to: '/pricing', label: 'Pricing', Icon: IconPayments },
  { to: '/support', label: 'Support Tickets', Icon: IconSupport, count: 'tickets' },
  { to: '/referrals', label: 'Referrals', Icon: IconReferrals },
  { to: '/referral-engine', label: 'Referral Engine', Icon: IconReferrals },
  { to: '/conversations', label: 'Conversations', Icon: IconChats },
  { to: '/activity', label: 'Activity Log', Icon: IconSupport },
  { to: '/notes', label: 'Notes', Icon: IconSupport },
  { to: '/settings', label: 'Settings', Icon: IconSettings },
];

/** Page title shown in the top bar, derived from the active route. */
function usePageTitle() {
  const { pathname } = useLocation();
  const match = NAV.find((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to)));
  return match?.label || 'Dashboard';
}

export default function Layout({ admin }) {
  const navigate = useNavigate();
  const title = usePageTitle();
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState({});

  // Sidebar badges mirror the "needs attention" counts on the dashboard.
  useEffect(() => {
    let alive = true;
    const load = () =>
      api('/dashboard/stats')
        .then((s) => {
          if (!alive) return;
          setCounts({
            nannies: s.users?.pendingNannies || 0,
            bookings: s.bookings?.replacementNeeded || 0,
            payments: s.revenue?.pendingCount || 0,
            tickets: s.support?.openTickets || 0,
            callbacks: s.callbacks?.pending || 0,
          });
        })
        .catch(() => {});
    load();
    // The platform currency drives every money value on screen.
    api('/settings').then((s) => setCurrency(s.currency)).catch(() => {});
    const t = setInterval(load, 60000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const signOut = () => {
    clearToken();
    navigate('/login', { replace: true });
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex bg-ink-950">
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-[250px] bg-ink-900 border-r border-ink-800 flex flex-col transition-transform ${
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-[68px] flex items-center gap-3 px-5 border-b border-ink-800">
          <span className="w-9 h-9 rounded-lg bg-brand-600 grid place-items-center shrink-0">
            <IconNanny size={20} className="text-white" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-white leading-tight">NannyBot</p>
            <p className="text-[11px] font-mono text-slate-500">Admin</p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, label, Icon, end, count }) => {
            const n = counts[count];
            return (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-600/15 text-brand-400'
                      : 'text-slate-400 hover:bg-ink-800 hover:text-slate-200'
                  }`
                }
              >
                <Icon size={18} />
                <span className="truncate">{label}</span>
                {n > 0 && <span className="nav-count">{n}</span>}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-3 border-t border-ink-800">
          <div className="px-2 py-1.5 min-w-0">
            <p className="text-sm font-medium text-slate-200 truncate">{admin?.name || 'Admin User'}</p>
            <p className="text-[11px] font-mono text-slate-500 truncate">{admin?.email}</p>
          </div>
          <button onClick={signOut} className="btn-ghost w-full mt-2 text-xs">Sign out</button>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setOpen(false)} />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-[68px] border-b border-ink-800 bg-ink-950 flex items-center gap-3 px-4 lg:px-6 shrink-0">
          <button
            onClick={() => setOpen(true)}
            className="text-slate-400 hover:text-white lg:hidden"
            aria-label="Open menu"
          >
            <IconMenu size={20} />
          </button>
          <span className="hidden lg:inline text-slate-500"><IconMenu size={18} /></span>
          <h2 className="font-medium text-slate-200">{title}</h2>

          <div className="ml-auto flex items-center gap-3">
            <div className="relative hidden sm:block">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                <IconSearch size={15} />
              </span>
              <input
                className="input pl-9 py-2 w-56 lg:w-64 bg-ink-900"
                placeholder="Quick search..."
                aria-label="Quick search"
              />
            </div>
            <button className="relative text-slate-400 hover:text-white" aria-label="Notifications">
              <IconBell size={19} />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500" />
            </button>
            <span className="w-8 h-8 rounded-full bg-brand-600 grid place-items-center text-xs font-semibold text-white">
              {(admin?.name || 'A').charAt(0).toUpperCase()}
            </span>
          </div>
        </header>

        <main className="flex-1 p-5 lg:p-6 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
