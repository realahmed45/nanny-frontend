import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { clearToken } from '../lib/api.js';

const NAV = [
  { to: '/', label: 'Dashboard', icon: '📊', end: true },
  { to: '/bookings', label: 'Bookings', icon: '📅' },
  { to: '/nannies', label: 'Nannies', icon: '👩' },
  { to: '/families', label: 'Families', icon: '👨‍👩‍👧' },
  { to: '/payments', label: 'Payments', icon: '💳' },
  { to: '/support', label: 'Support', icon: '🆘' },
  { to: '/chats', label: 'Chats', icon: '💬' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function Layout({ admin }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const signOut = () => {
    clearToken();
    navigate('/login', { replace: true });
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform ${
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-slate-200">
          <span className="text-2xl">👶</span>
          <div>
            <p className="font-semibold text-slate-900 leading-tight">My Nanny</p>
            <p className="text-xs text-slate-500">Admin Dashboard</p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'
                }`
              }
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-200">
          <div className="px-3 py-2">
            <p className="text-sm font-medium text-slate-900 truncate">{admin?.name || 'Administrator'}</p>
            <p className="text-xs text-slate-500 truncate">{admin?.email}</p>
          </div>
          <button onClick={signOut} className="btn-ghost w-full mt-2">Sign out</button>
        </div>
      </aside>

      {open && <div className="fixed inset-0 bg-slate-900/30 z-30 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-4 lg:px-8 gap-3 lg:hidden">
          <button onClick={() => setOpen(true)} className="btn-ghost px-2.5" aria-label="Open menu">☰</button>
          <span className="font-semibold">My Nanny Admin</span>
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
