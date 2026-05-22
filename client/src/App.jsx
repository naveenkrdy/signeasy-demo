import { useState, useCallback } from 'react';
import UploadStep from './components/UploadStep.jsx';
import RecipientForm from './components/RecipientForm.jsx';
import StatusPanel, { deriveStatus } from './components/StatusPanel.jsx';
import DownloadButton from './components/DownloadButton.jsx';

export default function App() {
  const [document, setDocument] = useState(null);
  const [envelope, setEnvelope] = useState(null);
  const [latestEnvelopePayload, setLatestEnvelopePayload] = useState(null);

  const handleSigned = useCallback((payload) => {
    setLatestEnvelopePayload(payload);
  }, []);

  function reset() {
    setDocument(null);
    setEnvelope(null);
    setLatestEnvelopePayload(null);
  }

  const isSigned = latestEnvelopePayload
    ? deriveStatus(latestEnvelopePayload) === 'signed'
    : false;

  return (
    <main className="app">
      <header>
        <h1>Signeasy eSignature Demo</h1>
        <p className="muted">
          Upload a document, send it to a signer, watch the status, and download the signed PDF.
        </p>
        {(document || envelope) && (
          <button type="button" className="link" onClick={reset}>
            Start over
          </button>
        )}
      </header>

      <UploadStep document={document} onUploaded={setDocument} />
      <RecipientForm
        documentId={document?.id}
        documentName={document?.name}
        envelope={envelope}
        onSent={setEnvelope}
      />
      <StatusPanel envelopeId={envelope?.id} onSigned={handleSigned} />
      <DownloadButton envelopeId={envelope?.id} ready={isSigned} />

      <footer>
        <small className="muted">
          Token exchange &amp; Signeasy calls happen server-side at <code>/api/*</code>.
          Client never sees your client_id / client_secret.
        </small>
      </footer>
    </main>
  );
}
