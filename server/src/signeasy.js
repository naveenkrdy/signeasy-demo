function env() {
  return {
    SIGNEASY_CLIENT_ID: process.env.SIGNEASY_CLIENT_ID,
    SIGNEASY_CLIENT_SECRET: process.env.SIGNEASY_CLIENT_SECRET,
    SIGNEASY_AUTH_URL: process.env.SIGNEASY_AUTH_URL || 'https://auth.signeasy.com/oauth/token',
    SIGNEASY_AUDIENCE: process.env.SIGNEASY_AUDIENCE || 'https://api-ext.signeasy.com/',
    SIGNEASY_BASE_URL: (process.env.SIGNEASY_BASE_URL || 'https://api.signeasy.com/v3').replace(/\/$/, ''),
    // Space-separated list of OAuth scopes to request. Leave empty to take the app's defaults.
    SIGNEASY_SCOPE: process.env.SIGNEASY_SCOPE || '',
  };
}

let cachedToken = null;
let cachedExpiresAt = 0;

async function fetchAccessToken() {
  const { SIGNEASY_CLIENT_ID, SIGNEASY_CLIENT_SECRET, SIGNEASY_AUTH_URL, SIGNEASY_AUDIENCE, SIGNEASY_SCOPE } = env();
  if (!SIGNEASY_CLIENT_ID || !SIGNEASY_CLIENT_SECRET) {
    throw new Error(
      'Missing SIGNEASY_CLIENT_ID or SIGNEASY_CLIENT_SECRET. Copy .env.example to .env and fill them in.'
    );
  }
  console.log(`[signeasy] POST ${SIGNEASY_AUTH_URL} (token exchange${SIGNEASY_SCOPE ? `, scope=${SIGNEASY_SCOPE}` : ''})`);
  const tokenBody = {
    client_id: SIGNEASY_CLIENT_ID,
    client_secret: SIGNEASY_CLIENT_SECRET,
    audience: SIGNEASY_AUDIENCE,
    grant_type: 'client_credentials',
  };
  if (SIGNEASY_SCOPE) tokenBody.scope = SIGNEASY_SCOPE;

  let res;
  try {
    res = await fetch(SIGNEASY_AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tokenBody),
    });
  } catch (err) {
    console.error('[signeasy] network error on token exchange:', err?.cause || err);
    throw new Error(`Token exchange network error: ${err?.cause?.message || err?.cause?.code || err.message}`);
  }
  if (!res.ok) {
    const text = await res.text();
    console.error(`[signeasy] token exchange failed ${res.status}: ${text}`);
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  cachedToken = data.access_token;
  cachedExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  console.log(`[signeasy] new access token acquired; expires in ${data.expires_in}s; scope="${data.scope || '(default)'}"`);
  return cachedToken;
}

async function getToken(forceRefresh = false) {
  if (forceRefresh || !cachedToken || Date.now() >= cachedExpiresAt) {
    return fetchAccessToken();
  }
  return cachedToken;
}

/**
 * Call any Signeasy endpoint with Bearer auth.
 * Pass `body` as a native FormData for multipart uploads (Node 18+ has it globally),
 * a string/Buffer for JSON/binary, or undefined for GET.
 * On 401, drops the cached token and retries once.
 */
export async function signeasyFetch(path, { method = 'GET', headers = {}, body, signal } = {}) {
  const { SIGNEASY_BASE_URL: baseUrl } = env();
  const url = path.startsWith('http') ? path : `${baseUrl}${path.startsWith('/') ? path : '/' + path}`;

  const doFetch = async (token) => {
    const finalHeaders = { ...headers, Authorization: `Bearer ${token}` };
    console.log(`[signeasy] ${method} ${url}`);
    try {
      return await fetch(url, { method, headers: finalHeaders, body, signal });
    } catch (err) {
      console.error(`[signeasy] network error on ${method} ${url}:`, err?.cause || err);
      const detail = err?.cause?.message || err?.cause?.code || err.message;
      const wrapped = new Error(`Network error calling ${url}: ${detail}`);
      wrapped.cause = err.cause || err;
      throw wrapped;
    }
  };

  let token = await getToken();
  let res = await doFetch(token);
  if (res.status === 401) {
    console.log(`[signeasy] got 401, refreshing token and retrying`);
    token = await getToken(true);
    res = await doFetch(token);
  }
  return res;
}
