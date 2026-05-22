import { Router } from 'express';
import multer from 'multer';
import { signeasyFetch } from './signeasy.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB matches Signeasy's limit
});

const router = Router();

/** Stream a JSON response from a Signeasy call back to the client. */
async function passThroughJson(res, signeasyResponse) {
  const text = await signeasyResponse.text();
  res.status(signeasyResponse.status).type('application/json').send(text);
}

// 1. Upload a document.
router.post('/documents', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'file is required' });
    // Use native FormData + Blob so undici streams the multipart body correctly.
    const form = new FormData();
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype || 'application/octet-stream' });
    form.append('file', blob, req.file.originalname);
    form.append('name', req.file.originalname);
    form.append('rename_if_exists', 'true');

    const upstream = await signeasyFetch('/original/', { method: 'POST', body: form });
    await passThroughJson(res, upstream);
  } catch (err) {
    next(err);
  }
});

// 2. Create envelope (send for signature).
router.post('/envelopes', async (req, res, next) => {
  try {
    const { documentId, documentName, recipient, message } = req.body || {};
    if (!documentId) return res.status(400).json({ error: 'documentId is required' });
    if (!recipient?.name || !recipient?.email) {
      return res.status(400).json({ error: 'recipient.name and recipient.email are required' });
    }

    // Split "Jane Doe" -> {first_name: "Jane", last_name: "Doe"}.
    const trimmed = recipient.name.trim().replace(/\s+/g, ' ');
    const firstSpace = trimmed.indexOf(' ');
    const firstName = firstSpace === -1 ? trimmed : trimmed.slice(0, firstSpace);
    const lastName = firstSpace === -1 ? '' : trimmed.slice(firstSpace + 1);

    const payload = {
      embedded_signing: false,
      is_ordered: true,
      message: message || 'Please review and sign this document.',
      sources: [
        {
          id: Number(documentId),
          type: 'original',
          name: documentName || `document-${documentId}`,
          source_id: 1,
        },
      ],
      recipients: [
        {
          recipient_id: 1,
          email: recipient.email,
          first_name: firstName,
          last_name: lastName,
        },
      ],
    };

    const upstream = await signeasyFetch('/rs/envelope/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    await passThroughJson(res, upstream);
  } catch (err) {
    next(err);
  }
});

// 3. Get envelope status.
router.get('/envelopes/:id', async (req, res, next) => {
  try {
    const upstream = await signeasyFetch(`/rs/envelope/${encodeURIComponent(req.params.id)}`);
    await passThroughJson(res, upstream);
  } catch (err) {
    next(err);
  }
});

// 4. Download the signed PDF.
// Signeasy exposes the signed PDF at /rs/signed/{signed_id}/download. The signed_id
// is usually surfaced once the envelope status is "signed" -- we try both shapes:
// first look up /rs/envelope/signed/{id} (returns a signed file payload), and if that
// returns a downloadable URL/id, follow it; otherwise fall through to the direct
// /rs/signed/{id}/download endpoint using the envelope id.
router.get('/envelopes/:id/signed', async (req, res, next) => {
  try {
    const id = encodeURIComponent(req.params.id);

    // Direct attempt: many Signeasy accounts can call /rs/signed/{envelope_id}/download
    // with the envelope id directly once signing is complete.
    let upstream = await signeasyFetch(`/rs/signed/${id}/download`);

    if (upstream.status === 404 || upstream.status === 400) {
      // Fallback: discover the signed document id from the envelope.
      const lookup = await signeasyFetch(`/rs/envelope/signed/${id}`);
      if (lookup.ok) {
        const data = await lookup.json().catch(() => ({}));
        const signedId =
          data?.signed_id ||
          data?.id ||
          (Array.isArray(data?.documents) && data.documents[0]?.id) ||
          (Array.isArray(data) && data[0]?.id);
        if (signedId) {
          upstream = await signeasyFetch(`/rs/signed/${signedId}/download`);
        }
      }
    }

    if (!upstream.ok) {
      const text = await upstream.text();
      return res.status(upstream.status).type('application/json').send(text || JSON.stringify({ error: 'download failed' }));
    }

    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      upstream.headers.get('content-disposition') || `attachment; filename="signed-${req.params.id}.pdf"`
    );
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf);
  } catch (err) {
    next(err);
  }
});

export default router;
