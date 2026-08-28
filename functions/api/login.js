/**
 * POST /api/login
 * Body: application/x-www-form-urlencoded  { email, code }
 *
 * Validates the access code against ACCESS_CODE env var.
 * On success: enrolls email in Brevo, sets signed session cookie, redirects to /playbook.
 * On failure: redirects to /?error=1
 */
export async function onRequestPost({ request, env }) {
  const body   = await request.formData();
  const email  = (body.get('email') || '').trim().toLowerCase();
  const code   = (body.get('code')  || '').trim().toUpperCase();
  const stored = (env.ACCESS_CODE   || '').trim().toUpperCase();

  // Validate
  if (!email || !code || code !== stored) {
    return Response.redirect(new URL('/?error=1', request.url), 303);
  }

  // Enroll in Brevo (fire-and-forget — don't block the redirect on Brevo failure)
  const listId = parseInt(env.BREVO_LIST_ID || '5', 10);
  if (env.BREVO_API_KEY) {
    try {
      await fetch('https://api.brevo.com/v3/contacts', {
        method: 'POST',
        headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, listIds: [listId], updateEnabled: true }),
      });
    } catch (_) { /* never block the user on a Brevo error */ }
  }

  // Build signed session cookie
  const cookie = await buildSessionCookie(email, env.COOKIE_SECRET || 'fallback-secret');

  return new Response(null, {
    status: 303,
    headers: {
      Location: '/playbook',
      'Set-Cookie': cookie,
    },
  });
}

// ── helpers ────────────────────────────────────────────────────────────────

async function buildSessionCookie(email, secret) {
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const payload = btoa(JSON.stringify({ email, exp: expires.getTime() }));
  const sig     = await hmacSign(payload, secret);
  const value   = `${payload}.${sig}`;
  return `t401_session=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=${expires.toUTCString()}`;
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
