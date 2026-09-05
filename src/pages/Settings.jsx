import { useEffect, useState } from 'react';
import api from '../lib/api.js';
import {
  PageHeader, Field, Badge, Skeleton, ErrorBox, useToast, dateTime, money,
} from '../components/ui.jsx';
import { IconCheck, IconX, IconChats } from '../components/icons.jsx';

/**
 * Everyone who can sign in.
 *
 * Several people share this dashboard, so accounts are managed here rather
 * than by hand in the database — and because the activity log names whoever
 * acted, shared logins would make that record useless.
 */
function TeamPanel({ admin }) {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'admin' });

  const isSuper = admin?.role === 'super_admin';

  const load = () => {
    if (!isSuper) { setLoading(false); return; }
    api('/admins')
      .then((r) => setAdmins(r.items || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [isSuper]);

  const create = async (e) => {
    e.preventDefault();
    setAdding(true);
    setError(null);
    try {
      await api('/admins', { method: 'POST', body: form });
      setForm({ name: '', email: '', password: '', role: 'admin' });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  if (!isSuper) {
    return (
      <p className="text-xs text-slate-500">
        Only a super admin can add or see other accounts.
      </p>
    );
  }

  return (
    <div>
      {loading ? (
        <p className="text-xs text-slate-500">Loading…</p>
      ) : (
        <div className="space-y-2 mb-5">
          {admins.map((a) => (
            <div
              key={a._id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-ink-800 bg-ink-950/60 p-3"
            >
              <div className="flex-1 min-w-[160px]">
                <div className="text-sm text-white">{a.name || '—'}</div>
                <div className="text-xs font-mono text-slate-500">{a.email}</div>
              </div>
              <Badge value={a.role} />
              <Badge value={a.active ? 'active' : 'suspended'} />
              <div className="text-xs text-slate-500 w-40 text-right">
                {a.lastLoginAt ? `last in ${dateTime(a.lastLoginAt)}` : 'never signed in'}
              </div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={create} className="space-y-3 border-t border-ink-800 pt-4">
        <p className="text-xs text-slate-500">Add someone to the team</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className="input" placeholder="Name" value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <input
            className="input" type="email" placeholder="Email" value={form.email} required
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <input
            className="input" type="password" placeholder="Password" value={form.password} required
            minLength={8}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          />
          <select
            className="input" value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
          >
            <option value="support">Support — read and reply, no money actions</option>
            <option value="admin">Admin — approve payments and bookings</option>
            <option value="super_admin">Super admin — everything, including accounts</option>
          </select>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button className="btn-primary text-xs" disabled={adding}>
          {adding ? 'Adding…' : 'Add account'}
        </button>
      </form>
    </div>
  );
}

export default function Settings({ admin }) {
  const { toast, notify, error: toastError } = useToast();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [savingVoice, setSavingVoice] = useState(false);
  const [testing, setTesting] = useState(false);
  const [emailTest, setEmailTest] = useState(null);

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

  // Surface the provider's own error rather than a generic failure, since a
  // rejected send blocks every signup and the reason matters.
  const testEmail = async () => {
    setTesting(true);
    setEmailTest(null);
    try {
      setEmailTest(await api('/settings/test-email', { method: 'POST', body: {} }));
    } catch (err) {
      setEmailTest({ ok: false, error: err.message });
    } finally {
      setTesting(false);
    }
  };

  /** Runtime switches save immediately — there is no Save button to miss. */
  const toggleVoice = async (next) => {
    setSavingVoice(true);
    // Reflect the change straight away; the reload below confirms it.
    setSettings((prev) => ({ ...prev, voiceTranscription: next }));
    try {
      await api('/settings', { method: 'PATCH', body: { voiceTranscription: next } });
      notify(next ? 'Voice messages will be transcribed.' : 'Voice messages are now ignored.');
      load();
    } catch (e) {
      toastError(e.message);
      load();   // put the switch back if the save failed
    } finally {
      setSavingVoice(false);
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
            <Field label="Currency">Rupiah (Rp)</Field>
            <Field label="Transport Fee">
              {s.transportFee
                ? `${money(s.transportFee.min)} – ${money(s.transportFee.max)}`
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

        <Panel title="Bank Details (shown to families)">
          {s.bankConfigured ? (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Bank">{s.bank?.name}</Field>
              <Field label="Account name">{s.bank?.accountName}</Field>
              <Field label="Account number">
                <span className="font-mono text-xs">{s.bank?.accountNumber || '—'}</span>
              </Field>
              <Field label="IBAN"><span className="font-mono text-xs">{s.bank?.iban || '—'}</span></Field>
              {s.bank?.instructions && (
                <div className="col-span-2"><Field label="Instructions">{s.bank.instructions}</Field></div>
              )}
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <span className="text-amber-400 mt-0.5"><IconX size={18} /></span>
              <div>
                <p className="text-sm text-slate-200">Not configured</p>
                <p className="text-xs text-slate-500">
                  Families cannot be told where to transfer. Set BANK_ACCOUNT_NAME,
                  BANK_ACCOUNT_NUMBER and BANK_NAME on the server.
                </p>
              </div>
            </div>
          )}
        </Panel>

        <Panel title="Voice Messages">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm text-slate-200">
                {s.voiceTranscription ? 'Transcription is on' : 'Transcription is off'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {s.voiceTranscription
                  ? 'Voice notes are converted to text and answered like any other reply.'
                  : 'Voice notes are not read; families are asked to type instead.'}
              </p>
            </div>

            {/* A switch rather than a checkbox: this is a live setting, and it
                is worth it being obvious which way it is pointing. */}
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(s.voiceTranscription)}
              aria-label="Transcribe voice messages"
              disabled={savingVoice}
              onClick={() => toggleVoice(!s.voiceTranscription)}
              className={`relative w-12 h-6 rounded-full shrink-0 transition-colors disabled:opacity-50 ${
                s.voiceTranscription ? 'bg-emerald-500' : 'bg-ink-700'
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  s.voiceTranscription ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          <div className="mt-4 pt-4 border-t border-ink-800">
            {s.voiceConfigured ? (
              <div className="flex items-start gap-3">
                <span className="text-emerald-400 mt-0.5"><IconCheck size={18} /></span>
                <div>
                  <p className="text-sm text-slate-200">
                    Speech-to-text ready
                    {s.voiceProvider && (
                      <span className="text-slate-500"> · {s.voiceProvider}</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">
                    Transcripts appear in Conversations marked with a microphone.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <span className="text-amber-400 mt-0.5"><IconX size={18} /></span>
                <div>
                  <p className="text-sm text-slate-200">No speech-to-text key</p>
                  <p className="text-xs text-slate-500">
                    Even with the switch on, voice notes cannot be read until
                    GROQ_API_KEY (free tier) or OPENAI_API_KEY is set on the server.
                  </p>
                </div>
              </div>
            )}
          </div>
        </Panel>

        <Panel title="Email (verification codes)">
          <div className="flex items-start gap-3">
            {s.emailConfigured ? (
              <>
                <span className="text-emerald-400 mt-0.5"><IconCheck size={18} /></span>
                <div>
                  <p className="text-sm text-slate-200">{s.emailProvider || 'Connected'}</p>
                  <p className="text-xs text-slate-500">Verification codes are emailed to users.</p>
                </div>
              </>
            ) : (
              <>
                <span className="text-amber-400 mt-0.5"><IconX size={18} /></span>
                <div>
                  <p className="text-sm text-slate-200">Not configured</p>
                  <p className="text-xs text-slate-500">
                    Codes are logged to the server console, so nobody can verify their
                    account. Set RESEND_API_KEY (or SMTP_HOST) and credentials on the server.
                  </p>
                </div>
              </>
            )}
          </div>

          <button className="btn-ghost mt-4 text-xs" onClick={testEmail} disabled={testing}>
            {testing ? 'Sending…' : 'Send a test email'}
          </button>
          {emailTest && (
            <div className={`mt-3 text-xs rounded-lg p-3 border ${
              emailTest.ok
                ? 'bg-emerald-950/30 border-emerald-900 text-emerald-300'
                : 'bg-red-950/30 border-red-900 text-red-300'
            }`}>
              <p className="font-medium">
                {emailTest.ok ? `Sent to ${emailTest.to}` : `Failed: ${emailTest.error}`}
              </p>
              {(emailTest.hint || emailTest.note) && (
                <p className="mt-1 opacity-80">{emailTest.hint || emailTest.note}</p>
              )}
            </div>
          )}
        </Panel>

        <Panel title="Admin Account">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Name">{admin?.name || '—'}</Field>
            <Field label="Email"><span className="font-mono text-xs">{admin?.email}</span></Field>
            <Field label="Role"><Badge value={admin?.role} /></Field>
          </div>
        </Panel>

        <Panel title="Team & Access">
          <TeamPanel admin={admin} />
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
