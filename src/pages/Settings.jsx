import { useEffect, useState } from 'react';
import api from '../lib/api.js';
import {
  PageHeader, Field, Badge, Skeleton, ErrorBox, useToast,
} from '../components/ui.jsx';
import { IconCheck, IconX, IconChats } from '../components/icons.jsx';

export default function Settings({ admin }) {
  const { toast, notify, error: toastError } = useToast();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const load = () => {
    setLoading(true);
    api('/settings')
      .then(setSettings)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const send = async (e) => {
    e.preventDefault();
    if (!phone.trim() || !message.trim()) return;
    setSending(true);
    try {
      await api('/messages/send', {
        method: 'POST',
        body: { phone: phone.trim(), message: message.trim() },
      });
      notify(settings?.whatsappConfigured ? 'Message sent.' : 'Logged (WhatsApp not connected).');
      setMessage('');
    } catch (err) {
      toastError(err.message);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <Skeleton rows={6} />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  const s = settings || {};
  const webhookUrl = `${window.location.origin.replace(/:\d+$/, ':4000')}/webhook/ultramsg`;

  return (
    <>
      <PageHeader title="Settings" subtitle="Platform configuration" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="WhatsApp Connection">
          <div className="flex items-center gap-3 mb-4">
            {s.whatsappConfigured ? (
              <>
                <span className="text-emerald-400"><IconCheck size={18} /></span>
                <div>
                  <p className="text-sm text-slate-200">Connected</p>
                  <p className="text-xs text-slate-500">Messages are delivered to real numbers.</p>
                </div>
              </>
            ) : (
              <>
                <span className="text-amber-400"><IconX size={18} /></span>
                <div>
                  <p className="text-sm text-slate-200">Not connected</p>
                  <p className="text-xs text-slate-500">
                    Messages are logged, not sent. Add provider credentials to go live.
                  </p>
                </div>
              </>
            )}
          </div>

          <Field label="Webhook URL">
            <code className="block text-xs font-mono bg-ink-950 border border-ink-800 rounded-lg px-3 py-2 break-all">
              {webhookUrl}
            </code>
            <p className="text-xs text-slate-500 mt-1.5">
              Set this in your WhatsApp provider and enable the message-received event.
            </p>
          </Field>
        </Panel>

        <Panel title="Business Rules">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Currency">{s.currency || 'USD'}</Field>
            <Field label="Transport Fee">
              {s.transportFee
                ? `${s.transportFee.min.toLocaleString()} – ${s.transportFee.max.toLocaleString()} ${s.currency || ''}`.trim()
                : '—'}
            </Field>
            <Field label="New Booking Response">{s.newBookingResponseMinutes} min</Field>
            <Field label="Change Booking Response">{s.changeBookingResponseMinutes} min</Field>
            <Field label="Reschedule Penalty">{s.reschedulePenaltyPercent}%</Field>
            <Field label="Free Reschedules">{s.freeRescheduleLimit}</Field>
            <Field label="Live Location Window">{s.liveLocationWindowHours}h before service</Field>
          </div>
          <p className="text-xs text-slate-500 mt-4">
            These come from the server environment. Change them there and restart to apply.
          </p>
        </Panel>

        <Panel title="Admin Account">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Name">{admin?.name || '—'}</Field>
            <Field label="Email"><span className="font-mono text-xs">{admin?.email}</span></Field>
            <Field label="Role"><Badge value={admin?.role} /></Field>
          </div>
        </Panel>

        <Panel title="Send a WhatsApp Message" icon={<IconChats size={16} />}>
          <form onSubmit={send} className="space-y-3">
            <div>
              <label className="label" htmlFor="phone">Phone number</label>
              <input
                id="phone"
                className="input"
                placeholder="971500000000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="msg">Message</label>
              <textarea
                id="msg"
                className="input min-h-[90px] resize-y"
                placeholder="Type a message…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
            <button className="btn-primary" disabled={sending || !phone.trim() || !message.trim()}>
              {sending ? 'Sending…' : 'Send message'}
            </button>
          </form>
        </Panel>
      </div>

      {toast}
    </>
  );
}

function Panel({ title, icon, children }) {
  return (
    <div className="card p-5">
      <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
        {icon && <span className="text-slate-500">{icon}</span>}
        {title}
      </h3>
      {children}
    </div>
  );
}
