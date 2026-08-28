/**
 * Middleware — runs on every request.
 * Public routes: /, /api/login, /api/logout
 * Everything else requires a valid signed session cookie.
 */
export async function onRequest({ request, next, env }) {
  const url = new URL(request.url);
  let response;

  // Always allow the landing page, the login POST, and logout
  if (url.pathname === '/' || url.pathname === '/api/login' || url.pathname === '/api/logout') {
    response = await next();
  } else {
    // Check for a valid session cookie
    const cookie = getCookie(request, 't401_session');
    if (cookie && env.COOKIE_SECRET && await verifySessionCookie(cookie, env.COOKIE_SECRET)) {
      response = await next();
    } else {
      // No valid session — redirect to landing page
      response = Response.redirect(new URL('/', request.url), 303);
    }
  }

  return withSecurityHeaders(response);
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

function withSecurityHeaders(response) {
  const secured = new Response(response.body, response);
  secured.headers.set('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://us-assets.i.posthog.com",
    "connect-src 'self' https://a.tenant401.com https://us-assets.i.posthog.com",
    "img-src 'self' data: https://us.posthog.com",
    "style-src 'self' 'unsafe-inline'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
  ].join('; '));
  secured.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  secured.headers.set('X-Content-Type-Options', 'nosniff');
  secured.headers.set('X-Frame-Options', 'DENY');
  secured.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  secured.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return secured;
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
