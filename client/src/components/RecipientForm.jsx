import { useState } from 'react';
import { createEnvelope } from '../api.js';

export default function RecipientForm({ documentId, documentName, envelope, onSent, disabled }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('Please review and sign this document.');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await createEnvelope({
        documentId,
        documentName,
        recipient: { name: name.trim(), email: email.trim() },
        message: message.trim(),
      });
      const id = data.id ?? data.envelope_id ?? data.pending_file_id;
      onSent({ id, raw: data });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const ready = Boolean(documentId);
  const sent = Boolean(envelope);

  return (
    <section className={`step ${sent ? 'done' : ''} ${ready ? '' : 'pending'}`}>
      <h2><span className="step-num">2</span> Send for signature</h2>
      {!ready && <p className="muted step-body">Upload a document first.</p>}
      {ready && !sent && (
        <form onSubmit={handleSubmit} className="step-body">
          <label>
            Signer name
            <input value={name} onChange={(e) => setName(e.target.value)} required disabled={busy || disabled} />
          </label>
          <label>
            Signer email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={busy || disabled} />
          </label>
          <label>
            Message (optional)
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} disabled={busy || disabled} />
          </label>
          <button type="submit" disabled={busy || disabled || !name || !email}>
            {busy ? 'Sending…' : 'Send signature request'}
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      )}
      {sent && (
        <div className="step-body">
          <p className="success">
            Sent · envelope id <code>{envelope.id}</code>
          </p>
        </div>
      )}
    </section>
  );
}
