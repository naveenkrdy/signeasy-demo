async function parseJsonOrThrow(res) {
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const message = data?.error || data?.message || data?.detail || text || `HTTP ${res.status}`;
    const err = new Error(typeof message === 'string' ? message : JSON.stringify(message));
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

export async function uploadDocument(file) {
  const form = new FormData();
  form.append('file', file, file.name);
  const res = await fetch('/api/documents', { method: 'POST', body: form });
  return parseJsonOrThrow(res);
}

export async function createEnvelope({ documentId, documentName, recipient, message }) {
  const res = await fetch('/api/envelopes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentId, documentName, recipient, message }),
  });
  return parseJsonOrThrow(res);
}

export async function getEnvelope(id) {
  const res = await fetch(`/api/envelopes/${encodeURIComponent(id)}`);
  return parseJsonOrThrow(res);
}

export async function downloadSignedDocument(id) {
  const res = await fetch(`/api/envelopes/${encodeURIComponent(id)}/signed`);
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(text || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `signed-${id}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
