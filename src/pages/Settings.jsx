import { useEffect, useState } from 'react';
import api from '../lib/api.js';
import { PageHeader, Skeleton, ErrorBox, useToast, money } from '../components/ui.jsx';

export default function Settings({ admin }) {
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState('');
  const [phone, setPhone] = useState('');
  const [body, setBody] = useState('');
  const { toast, notify, error: notifyError } = useToast();

  const load = () => {
    setError('');
    api('/settings').then(setSettings).catch((e) => setError(e.message));
  };
  useEffect(load, []);

  const sendMessage = async (e) => {
    e.preventDefault();
    try {
      await api('/messages/send', { method: 'POST', body: { phone: phone.trim(), body } });
      notify('Message sent.');
      setBody('');
    } catch (err) {
      notifyError(err.message);
    }
  };

  if (error) return <ErrorBox error={error} onRetry={load} />;
  if (!settings) return <Skeleton rows={5} />;

  return (
    <>
      <PageHeader title="Settings" subtitle="Business rules and WhatsApp connection" />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Business rules</h2>
          <dl className="space-y-3 text-sm">
            <Row label="Currency" value={settings.currency} />
            <Row label="Transport fee"
              value={`${settings.transportFee.min.toLocaleString()} – ${settings.transportFee.max.toLocaleString()}`} />
            <Row label="New booking response window"
              value={`${settings.newBookingResponseMinutes} minutes`} />
            <Row label="Booking change response window"
              value={`${settings.changeBookingResponseMinutes} minutes`} />
            <Row label="Reschedule penalty" value={`${settings.reschedulePenaltyPercent}%`} />
            <Row label="Free reschedules" value={settings.freeRescheduleLimit} />
            <Row label="Live location opens" value={`${settings.liveLocationWindowHours}h before service`} />
          </dl>
          <p className="text-xs text-slate-400 mt-4">
            These are configured through the server environment (.env) and apply to new bookings.
          </p>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-slate-900 mb-4">WhatsApp connection</h2>
          <div className={`rounded-lg p-3 text-sm mb-4 ${
            settings.whatsappConfigured
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-amber-50 text-amber-800 border border-amber-200'
          }`}>
            {settings.whatsappConfigured
              ? '✅ UltraMsg is configured — messages are being delivered.'
              : '⚠️ UltraMsg credentials are missing. Messages are logged but not sent. Set ULTRAMSG_INSTANCE_ID and ULTRAMSG_TOKEN.'}
          </div>

          <form onSubmit={sendMessage} className="space-y-3">
            <p className="text-sm font-medium text-slate-700">Send a message</p>
            <div>
              <label className="label" htmlFor="phone">Phone number</label>
              <input id="phone" className="input" required value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="971500000000" />
            </div>
            <div>
              <label className="label" htmlFor="body">Message</label>
              <textarea id="body" className="input" rows={4} required value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Type your message…" />
            </div>
            <button type="submit" className="btn-primary">Send via WhatsApp</button>
          </form>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Signed in as</h2>
          <dl className="space-y-3 text-sm">
            <Row label="Name" value={admin?.name || '—'} />
            <Row label="Email" value={admin?.email} />
            <Row label="Role" value={admin?.role?.replace(/_/g, ' ')} />
          </dl>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Webhook</h2>
          <p className="text-sm text-slate-600 mb-2">
            Point your UltraMsg instance webhook at:
          </p>
          <code className="block bg-slate-100 rounded-lg px-3 py-2 text-xs break-all">
            {window.location.origin.replace(':5173', ':4000')}/webhook/ultramsg
          </code>
          <p className="text-xs text-slate-400 mt-3">
            Enable "Message Received" events in the UltraMsg dashboard. For local development,
            expose the port with a tunnel (ngrok, cloudflared) and use that public URL.
          </p>
        </div>
      </div>

      {toast}
    </>
  );
}

const Row = ({ label, value }) => (
  <div className="flex justify-between gap-4">
    <dt className="text-slate-500">{label}</dt>
    <dd className="font-medium text-slate-900 text-right">{value}</dd>
  </div>
);
