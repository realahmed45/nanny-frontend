import { useState } from 'react';
import { login, setToken } from '../lib/api.js';

export default function Login({ onSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { token, admin } = await login(email.trim(), password);
      setToken(token);
      onSuccess(admin);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-brand-50 to-slate-100">
      <div className="card w-full max-w-md p-8">
        <div className="text-center mb-7">
          <div className="text-4xl mb-2">👶</div>
          <h1 className="text-xl font-semibold text-slate-900">My Nanny</h1>
          <p className="text-sm text-slate-500 mt-1">Sign in to the admin dashboard</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email" type="email" className="input" required autoComplete="username"
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@mynanny.com"
            />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password" type="password" className="input" required autoComplete="current-password"
              value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
