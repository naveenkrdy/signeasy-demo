import { useEffect, useState, useCallback } from 'react';
import { getEnvelope } from '../api.js';

const POLL_MS = 5000;

/**
 * Maps a Signeasy envelope payload to a simple status string.
 * Field names vary slightly across accounts; we look at several known signals.
 */
export function deriveStatus(envelope) {
  if (!envelope) return 'unknown';

  // Direct status field if present.
  const raw = (envelope.status || envelope.envelope_status || envelope.state || '').toString().toLowerCase();
  if (
    raw === 'completed' ||
    raw === 'complete' ||
    raw === 'signed' ||
    raw === 'finished' ||
    raw === 'done' ||
    (raw.includes('sign') && raw.includes('complete'))
  ) {
    return 'signed';
  }
  if (raw.includes('declin') || raw === 'cancelled' || raw === 'canceled' || raw === 'expired') return raw;

  // Completion flags.
  if (envelope.is_signed === true || envelope.signed === true || envelope.completed === true) return 'signed';

  // Recipient activity.
  const recipients = envelope.recipients || envelope.signers || [];
  const anySigned = recipients.some(
    (r) => r.signed_at || r.signed || (r.status || '').toLowerCase() === 'signed'
  );
  if (anySigned && recipients.every((r) => r.signed_at || r.signed || (r.status || '').toLowerCase() === 'signed')) {
    return 'signed';
  }
  const anyViewed = recipients.some(
    (r) => r.viewed_at || r.opened_at || (r.status || '').toLowerCase() === 'viewed'
  );
  if (anyViewed) return 'viewed';

  if (raw) return raw; // expose whatever Signeasy gave us
  return 'sent';
}

const LABELS = {
  sent: { text: 'Sent', tone: 'info' },
  viewed: { text: 'Viewed', tone: 'progress' },
  signed: { text: 'Signed', tone: 'success' },
  declined: { text: 'Declined', tone: 'error' },
  cancelled: { text: 'Cancelled', tone: 'error' },
  expired: { text: 'Expired', tone: 'error' },
  unknown: { text: 'Unknown', tone: 'muted' },
};

export default function StatusPanel({ envelopeId, onSigned }) {
  const [envelope, setEnvelope] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [lastChecked, setLastChecked] = useState(null);

  const refresh = useCallback(async () => {
    if (!envelopeId) return;
    setBusy(true);
    setError(null);
    try {
      const data = await getEnvelope(envelopeId);
      setEnvelope(data);
      setLastChecked(new Date());
      const status = deriveStatus(data);
      if (status === 'signed') onSigned?.(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [envelopeId, onSigned]);

  useEffect(() => {
    if (!envelopeId) return;
    refresh();
    const handle = setInterval(refresh, POLL_MS);
    return () => clearInterval(handle);
  }, [envelopeId, refresh]);

  const status = deriveStatus(envelope);
  const label = LABELS[status] || { text: status, tone: 'info' };

  return (
    <section className={`step ${envelopeId ? '' : 'pending'}`}>
      <h2><span className="step-num">3</span> Track status</h2>
      {!envelopeId && <p className="muted step-body">Send a signature request first.</p>}
      {envelopeId && (
        <div className="step-body">
          <div className="status-row">
            <span className={`status-pill status-${label.tone}`}>{label.text}</span>
            <button type="button" onClick={refresh} disabled={busy}>
              {busy ? 'Checking…' : 'Refresh'}
            </button>
            {lastChecked && (
              <span className="muted small">Last checked {lastChecked.toLocaleTimeString()}</span>
            )}
          </div>
          {error && <p className="error">{error}</p>}
          {envelope && (
            <details className="raw">
              <summary>Raw envelope response</summary>
              <pre>{JSON.stringify(envelope, null, 2)}</pre>
            </details>
          )}
          <p className="muted small">Auto-refreshes every {POLL_MS / 1000}s.</p>
        </div>
      )}
    </section>
  );
}
