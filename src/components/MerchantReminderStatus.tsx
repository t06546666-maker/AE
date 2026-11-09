import {uiText} from "../uiText";
import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {apiFetch} from '../api';
import './MerchantReminderStatus.css';

type Slot = {
  slot: string;
  title: string;
  scheduledAt: string;
  status: string;
  recorded: boolean;
  accepted: number;
  failed: number;
  pending: number;
  missingToken: number;
  disabled: number;
  firstSentAt: string | null;
  lastSentAt: string | null;
  lastActivityAt: string | null;
  messages: string[];
  messageRecorded: boolean;
};

const labels: Record<string, string> = {
  scheduled: 'Scheduled',
  waiting: 'Waiting for scheduler',
  no_record: 'No send recorded',
  delayed: 'Delayed — retry pending',
  missed: 'Missed schedule',
  sent: 'Sent',
  partial: 'Partly sent',
  processing: 'Processing',
  unconfirmed: 'Send unconfirmed',
  failed: 'Failed or unconfirmed',
  no_eligible: 'No eligible phones',
  not_scheduled: 'Not scheduled'
};

const today = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
const time = (value: string) =>
  new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).format(new Date(value));

export function MerchantReminderStatus() {
  const [date, setDate] = useState(today);
  const [sendingSlot, setSendingSlot] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<{ slot: string; message: string; isError?: boolean } | null>(null);

  const query = useQuery({
    queryKey: ['admin', 'merchant-reminder-status', date],
    queryFn: ({signal}) =>
      apiFetch<{date: string; checkedAt: string; slots: Slot[]}>(
        `/api/admin/merchant-reminder-status?date=${date}`,
        {signal}
      ),
    enabled: !!date,
    refetchInterval: 60000
  });

  const handleManualSend = async (slot: Slot) => {
    const messageBody = slot.messages?.[0];
    if (!messageBody) {
      alert(uiText("No message text available for this slot."));
      return;
    }
    const targetUrl = slot.slot === 'morning' ? '/shop-checkout' : slot.slot === 'afternoon' ? '/offers' : '/dashboard';
    const confirmSend = window.confirm(
      `Send "${slot.title}" reminder now to all active merchants?\n\n"${messageBody}"`
    );
    if (!confirmSend) return;

    setSendingSlot(slot.slot);
    setSendResult(null);

    try {
      const formData = new FormData();
      formData.append('title', slot.title);
      formData.append('body', messageBody);
      formData.append('target', 'merchants');
      formData.append('url', targetUrl);

      const res = await apiFetch<{ success: boolean; delivered?: number; message?: string }>(
        '/api/admin/broadcast-notification',
        {
          method: 'POST',
          body: formData,
        }
      );

      setSendResult({
        slot: slot.slot,
        message: res.message || `Dispatched successfully to ${res.delivered ?? 'active'} merchant phones!`,
        isError: false,
      });
      void query.refetch();
    } catch (err: any) {
      setSendResult({
        slot: slot.slot,
        message: err?.message || 'Failed to dispatch notification to merchants.',
        isError: true,
      });
    } finally {
      setSendingSlot(null);
    }
  };

  return (
    <section className="panel merchant-reminder-status" aria-label={uiText("Daily merchant reminder status")}>
      <div className="merchant-reminder-status-heading">
        <div>
          <h2>{uiText("Daily merchant reminders")}</h2>
          <p>{uiText("Active merchants only · All times are India time (IST)")}</p>
        </div>
        <div className="merchant-reminder-status-controls">
          <label>
            {uiText("Date")}
            <input type="date" value={date} max={today()} onChange={event => setDate(event.target.value)} />
          </label>
          <button
            type="button"
            className="button secondary"
            disabled={query.isFetching || !date}
            onClick={() => void query.refetch()}
          >
            {uiText("Refresh status")}
          </button>
        </div>
      </div>

      <p className="merchant-reminder-status-note">
        {uiText("Sent means Firebase accepted the notification. Delivery to the phone is not confirmed. Scheduled times can run late; no record is not proof of a send.")}
      </p>

      {query.isPending ? (
        <p role="status">{uiText("Loading reminder records…")}</p>
      ) : query.isError ? (
        <p role="alert">{query.error.message}</p>
      ) : (
        <>
          <div className="merchant-reminder-status-grid">
            {query.data.slots.map(slot => (
              <article key={slot.slot} className="merchant-reminder-status-card">
                <div className="merchant-reminder-status-card-heading">
                  <strong>{time(slot.scheduledAt).replace(':00 ', ' ')}</strong>
                  <span className={`merchant-reminder-badge ${slot.status}`}>
                    {uiText(labels[slot.status] || 'Unconfirmed')}
                  </span>
                </div>
                <h3>{slot.title}</h3>
                <dl>
                  <div>
                    <dt>{uiText("Sent")}</dt>
                    <dd>{slot.recorded ? slot.accepted : '—'}</dd>
                  </div>
                  <div>
                    <dt>{uiText("Failed / unconfirmed")}</dt>
                    <dd>{slot.recorded ? slot.failed : '—'}</dd>
                  </div>
                  <div>
                    <dt>{uiText("Processing / unconfirmed")}</dt>
                    <dd>{slot.recorded ? slot.pending : '—'}</dd>
                  </div>
                  <div>
                    <dt>{uiText("No phone token")}</dt>
                    <dd>{slot.recorded ? slot.missingToken : '—'}</dd>
                  </div>
                  <div>
                    <dt>{uiText("Notifications off")}</dt>
                    <dd>{slot.recorded ? slot.disabled : '—'}</dd>
                  </div>
                </dl>

                {slot.lastSentAt ? (
                  <p>
                    {uiText("Last sent: ")}
                    <strong>{time(slot.lastSentAt)} IST</strong>
                  </p>
                ) : (
                  <p>
                    {uiText(
                      slot.status === 'missed'
                        ? 'No send was recorded before this greeting window closed.'
                        : slot.status === 'delayed' || slot.status === 'waiting'
                        ? 'No send record yet. Automatic retries remain active for this greeting.'
                        : 'No successful send recorded for this time.'
                    )}
                  </p>
                )}

                {slot.lastActivityAt && (
                  <small>
                    {uiText("Last activity: ")}
                    {time(slot.lastActivityAt)} IST
                  </small>
                )}

                {/* Instant Send Now Button for Admin */}
                <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
                  <button
                    type="button"
                    className="button"
                    disabled={sendingSlot === slot.slot}
                    onClick={() => handleManualSend(slot)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '12px',
                      fontWeight: 800,
                      borderRadius: '8px',
                      background: slot.status === 'sent' ? '#f1f5f9' : 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                      color: slot.status === 'sent' ? '#475569' : '#ffffff',
                      border: slot.status === 'sent' ? '1px solid #cbd5e1' : 'none',
                      cursor: sendingSlot === slot.slot ? 'wait' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      boxShadow: slot.status === 'sent' ? 'none' : '0 2px 8px rgba(37, 99, 235, 0.25)',
                    }}
                  >
                    <span>⚡</span>
                    <span>
                      {sendingSlot === slot.slot
                        ? uiText("Sending…")
                        : slot.status === 'sent'
                        ? uiText("Resend to Merchants")
                        : uiText("Send Notification Now")}
                    </span>
                  </button>

                  {sendResult && sendResult.slot === slot.slot && (
                    <p
                      style={{
                        margin: '8px 0 0 0',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: sendResult.isError ? '#dc2626' : '#16a34a',
                        lineHeight: 1.4,
                      }}
                    >
                      {sendResult.isError ? '✕ ' : '✓ '}
                      {sendResult.message}
                    </p>
                  )}
                </div>

                <details style={{ marginTop: '10px' }}>
                  <summary>{slot.messageRecorded ? uiText("Recorded message") : uiText("Scheduled message preview")}</summary>
                  {slot.messages.map((message, index) => (
                    <p lang="ml" key={index} style={{ margin: '6px 0', fontSize: '12px' }}>
                      {message}
                    </p>
                  ))}
                </details>
              </article>
            ))}
          </div>
          <small>
            {uiText("Last checked: ")}
            {time(query.data.checkedAt)}
            {uiText(" IST · Updates every minute")}
          </small>
        </>
      )}
    </section>
  );
}
