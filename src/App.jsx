import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import api, { getToken, clearToken } from './lib/api.js';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Bookings from './pages/Bookings.jsx';
import Nannies from './pages/Nannies.jsx';
import Families from './pages/Families.jsx';
import Payments from './pages/Payments.jsx';
import Support from './pages/Support.jsx';
import Chats from './pages/Chats.jsx';
import NotesPage from './pages/Notes.jsx';
import Settings from './pages/Settings.jsx';
import Pricing from './pages/Pricing.jsx';
import Activity from './pages/Activity.jsx';
import ReferralEngine from './pages/ReferralEngine.jsx';
import Calendar from './pages/Calendar.jsx';
import Referrals from './pages/Referrals.jsx';
import Callbacks from './pages/Callbacks.jsx';
import Conversations from './pages/Conversations.jsx';

export default function App() {
  const [admin, setAdmin] = useState(null);
  const [checking, setChecking] = useState(true);

  // Restore the session from a stored token on load.
  useEffect(() => {
    if (!getToken()) { setChecking(false); return; }
    api('/auth/me')
      .then(({ admin: me }) => setAdmin(me))
      .catch(() => clearToken())
      .finally(() => setChecking(false));
  }, []);

  // The API client fires this when a request comes back 401.
  useEffect(() => {
    const onUnauthorized = () => setAdmin(null);
    window.addEventListener('mynanny:unauthorized', onUnauthorized);
    return () => window.removeEventListener('mynanny:unauthorized', onUnauthorized);
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500 bg-ink-950">
        Loading…
      </div>
    );
  }

  if (!admin) return <Login onSuccess={setAdmin} />;

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout admin={admin} />}>
          <Route index element={<Dashboard />} />
          <Route path="callbacks" element={<Callbacks />} />
          <Route path="bookings" element={<Bookings />} />
          <Route path="nannies" element={<Nannies />} />
          <Route path="families" element={<Families />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="payments" element={<Payments />} />
          <Route path="pricing" element={<Pricing />} />
          <Route path="activity" element={<Activity />} />
          <Route path="support" element={<Support />} />
          <Route path="referrals" element={<Referrals />} />
          <Route path="referral-engine" element={<ReferralEngine />} />
          <Route path="conversations" element={<Conversations />} />
          <Route path="chats" element={<Chats />} />
          <Route path="notes" element={<NotesPage />} />
          <Route path="settings" element={<Settings admin={admin} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
