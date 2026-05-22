import { useState } from 'react';
import { downloadSignedDocument } from '../api.js';

export default function DownloadButton({ envelopeId, ready }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleClick() {
    setBusy(true);
    setError(null);
    try {
      await downloadSignedDocument(envelopeId);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`step ${ready ? '' : 'pending'}`}>
      <h2><span className="step-num">4</span> Download signed document</h2>
      <div className="step-body">
        {!ready && <p className="muted">Available once status is "Signed".</p>}
        {ready && (
          <>
            <button type="button" onClick={handleClick} disabled={busy}>
              {busy ? 'Downloading…' : 'Download signed PDF'}
            </button>
            {error && <p className="error">{error}</p>}
          </>
        )}
      </div>
    </section>
  );
}
