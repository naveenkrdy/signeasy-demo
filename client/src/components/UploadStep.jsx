import { useRef, useState } from 'react';
import { uploadDocument } from '../api.js';

export default function UploadStep({ document, onUploaded, disabled }) {
  const fileInputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleUpload(file) {
    setBusy(true);
    setError(null);
    try {
      const data = await uploadDocument(file);
      const id = data.id ?? data.document_id ?? data.original_id;
      onUploaded({ id, name: data.name || file.name, raw: data });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`step ${document ? 'done' : ''}`}>
      <h2><span className="step-num">1</span> Upload document</h2>
      {!document && (
        <div className="step-body">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf,.doc,.docx"
            disabled={busy || disabled}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
            }}
          />
          {busy && <p className="muted">Uploading…</p>}
          {error && <p className="error">{error}</p>}
        </div>
      )}
      {document && (
        <div className="step-body">
          <p className="success">
            Uploaded <strong>{document.name}</strong> · id <code>{document.id}</code>
          </p>
        </div>
      )}
    </section>
  );
}
