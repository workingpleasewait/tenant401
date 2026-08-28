/**
 * POST /api/login
 * Body: application/x-www-form-urlencoded  { email, code }
 *
 * 1. Validates code against ACCESS_CODE env var
 * 2. On success: enrolls email in Brevo list, sends welcome email, sets session cookie
 * 3. On failure: redirects to /?error=1
 */
export async function onRequestPost({ request, env }) {
  const body  = await request.formData();
  const email = (body.get('email') || '').trim().toLowerCase();
  const code  = (body.get('code')  || '').trim().toUpperCase();
  const stored = (env.ACCESS_CODE  || '').trim().toUpperCase();

  if (!email || !code || code !== stored) {
    return Response.redirect(new URL('/?error=1', request.url), 303);
  }

  // Brevo: enroll + send welcome email (parallel, fire-and-forget — never block the user)
  const listId = parseInt(env.BREVO_LIST_ID || '5', 10);
  if (env.BREVO_API_KEY) {
    const headers = { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json' };

    // Run both calls concurrently; catch all errors silently
    Promise.allSettled([
      // 1. Enroll in contact list
      fetch('https://api.brevo.com/v3/contacts', {
        method: 'POST',
        headers,
        body: JSON.stringify({ email, listIds: [listId], updateEnabled: true }),
      }),
      // 2. Send welcome email
      fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sender: {
            name: '205 E 17th St Tenant Resource',
            email: 'tenants@tenant401.com',
          },
          to: [{ email }],
          replyTo: { email: 'tenants@tenant401.com' },
          subject: 'You now have access — 205 East 17th Street Tenant Resource',
          htmlContent: welcomeEmailHtml(email),
          textContent: welcomeEmailText(email),
          tags: ['tenant401-welcome'],
        }),
      }),
    ]).catch(() => {});
  }

  // Set signed session cookie and redirect to playbook
  const cookie = await buildSessionCookie(email, env.COOKIE_SECRET || 'fallback-secret');
  return new Response(null, {
    status: 303,
    headers: { Location: '/playbook', 'Set-Cookie': cookie },
  });
}

// ── Email content ─────────────────────────────────────────────────────────────

function welcomeEmailHtml(email) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>You now have access</title></head>
<body style="margin:0;padding:0;background:#f5f4f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td align="center" style="padding:32px 16px">
<table width="100%" style="max-width:560px" cellpadding="0" cellspacing="0" border="0">

  <!-- Header -->
  <tr><td style="background:#1a1a2e;border-radius:10px 10px 0 0;padding:28px 32px 24px;text-align:center">
    <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#8888aa">Brooklyn, NY 11226</p>
    <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3">
      205 East 17th Street<br>Tenant Resource
    </h1>
  </td></tr>

  <!-- Body -->
  <tr><td style="background:#ffffff;padding:32px 32px 28px;border-left:1px solid #e0ddd8;border-right:1px solid #e0ddd8">
    <p style="margin:0 0 20px;font-size:16px;color:#1a1a2e;line-height:1.6">
      You now have access to the 205 East 17th Street tenant resource site.
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:#444;line-height:1.65">
      The site contains a step-by-step playbook for filing a rent reduction
      complaint with DHCR when elevator service is broken or degraded — in
      both English and French. A tenant at this building used this process
      and received a formal rent reduction order from DHCR in 2024.
    </p>

    <!-- CTA button -->
    <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px">
    <tr><td style="background:#1a1a2e;border-radius:6px;text-align:center;padding:14px 28px">
      <a href="https://tenant401.com" style="color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;display:block">
        Open the playbook &rarr;
      </a>
    </td></tr>
    </table>

    <p style="margin:0;font-size:13px;color:#6b6b7b;line-height:1.6">
      You were enrolled at <strong>${email}</strong>. You may receive occasional
      updates about tenant rights at 205 East 17th Street. If you did not sign up,
      you can ignore this email.
    </p>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#f5f4f0;border:1px solid #e0ddd8;border-top:none;border-radius:0 0 10px 10px;padding:20px 32px;text-align:center">
    <p style="margin:0;font-size:12px;color:#8888aa;line-height:1.6">
      205 East 17th Street &middot; Brooklyn, NY 11226<br>
      This site is not legal advice.
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

function welcomeEmailText(email) {
  return `You now have access to the 205 East 17th Street tenant resource site.

The site contains a step-by-step playbook for filing a rent reduction
complaint with DHCR when elevator service is broken or degraded — in
both English and French.

Open the playbook: https://tenant401.com

---
You were enrolled at ${email}. You may receive occasional updates about
tenant rights at 205 East 17th Street.

205 East 17th Street · Brooklyn, NY 11226
This site is not legal advice.`;
}

// ── Session cookie ─────────────────────────────────────────────────────────────

async function buildSessionCookie(email, secret) {
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const payload = btoa(JSON.stringify({ email, exp: expires.getTime() }));
  const sig     = await hmacSign(payload, secret);
  return `t401_session=${payload}.${sig}; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=${expires.toUTCString()}`;
}

async function hmacSign(data, secret) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}
