/**
 * Middleware — runs on every request.
 * Public routes: /, /api/login  (the landing page and login endpoint)
 * Everything else requires a valid signed session cookie.
 */
export async function onRequest({ request, next, env }) {
  const url = new URL(request.url);

  // Always allow the landing page and the login POST
  if (url.pathname === '/' || url.pathname === '/api/login') {
    return next();
  }

  // Check for a valid session cookie
  const cookie = getCookie(request, 't401_session');
  if (cookie && await verifySessionCookie(cookie, env.COOKIE_SECRET || 'fallback-secret')) {
    return next();
  }

  // No valid session — redirect to landing page
  return Response.redirect(new URL('/', request.url), 303);
}

// ── helpers ────────────────────────────────────────────────────────────────

function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k.trim() === name) return v.join('=').trim();
  }
  return null;
}

async function verifySessionCookie(value, secret) {
  try {
    const [payload, sig] = value.split('.');
    if (!payload || !sig) return false;

    // Verify HMAC
    const expected = await hmacSign(payload, secret);
    if (sig !== expected) return false;

    // Check expiry
    const { exp } = JSON.parse(atob(payload));
    return Date.now() < exp;
  } catch (_) {
    return false;
  }
}

async function hmacSign(data, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}
