/**
 * POST /api/login
 * Body: application/x-www-form-urlencoded  { email, code, updates_consent? }
 *
 * 1. Validates code against ACCESS_CODE env var
 * 2. On success:
 *    - Always sends a transactional welcome email (first login only)
 *    - Enrolls in Brevo list only when updates_consent=1
 * 3. On failure: redirects to /?error=1
 */
export async function onRequestPost({ request, env, waitUntil }) {
  const body  = await request.formData();
  const email = (body.get('email') || '').trim().toLowerCase();
  const code  = (body.get('code')  || '').trim().toUpperCase();
  const stored = (env.ACCESS_CODE  || '').trim().toUpperCase();
  const updatesConsent = body.get('updates_consent') === '1';

  if (!isValidEmail(email) || !code || !stored || !(await timingSafeEqual(code, stored))) {
    return Response.redirect(new URL('/?error=1', request.url), 303);
  }

  // Fail closed before starting any external work.
  if (!env.COOKIE_SECRET) {
    return new Response('Server configuration error', { status: 500 });
  }

  // Validate Brevo list ID — must be a positive integer.
  const listId = parseInt(env.BREVO_LIST_ID || '', 10);
  const brevoListValid = Number.isInteger(listId) && listId > 0;
  if (!brevoListValid) {
    console.error(`Brevo list ID invalid or missing (BREVO_LIST_ID=${env.BREVO_LIST_ID}) — skipping enrollment`);
  }

  // Brevo: check for existing contact, then send welcome email and/or enroll.
  if (env.BREVO_API_KEY) {
    const headers = { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json' };

    const brevoWork = (async () => {
      // Check whether this email is already known to Brevo.
      let alreadyEnrolled = false;
      let contactExists   = false;
      try {
        const checkRes = await fetch(
          `https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`,
          { method: 'GET', headers }
        );
        if (checkRes.ok) {
          const contact = await checkRes.json();
          contactExists   = true;
          alreadyEnrolled = brevoListValid &&
            Array.isArray(contact.listIds) && contact.listIds.includes(listId);
          console.log(`Brevo contact check: found, enrolled=${alreadyEnrolled}`);
        } else if (checkRes.status === 404) {
          console.log('Brevo contact check: not found — new registration');
        } else {
          // Unexpected error: fail open.
          console.error(`Brevo contact check failed with HTTP ${checkRes.status} — proceeding`);
        }
      } catch (err) {
        console.error('Brevo contact check threw:', err, '— proceeding');
      }

      const tasks = [];

      // Transactional welcome email — send on first login regardless of consent.
      if (!contactExists) {
        tasks.push(brevoRequest('welcome email', 'https://api.brevo.com/v3/smtp/email', {
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
        }));
      }

      // Mailing-list enrollment — only when tenant opted in and list config is valid.
      if (updatesConsent && brevoListValid && !alreadyEnrolled) {
        tasks.push(brevoRequest('contact enrollment', 'https://api.brevo.com/v3/contacts', {
          method: 'POST',
          headers,
          body: JSON.stringify({ email, listIds: [listId], updateEnabled: true }),
        }));
        console.log('Brevo: enrolling with consent');
      } else if (!updatesConsent) {
        console.log('Brevo: no consent — skipping list enrollment');
      } else if (alreadyEnrolled) {
        console.log('Brevo: already enrolled — skipping');
      }

      const results = await Promise.allSettled(tasks);
      for (const result of results) {
        if (result.status === 'rejected') console.error(result.reason);
      }
    })();

    if (typeof waitUntil === 'function') {
      waitUntil(brevoWork);
    } else {
      await brevoWork;
    }
  }

  // Set signed session cookie and redirect to playbook
  const cookie = await buildSessionCookie(env.COOKIE_SECRET);
  return new Response(null, {
    status: 303,
    headers: { Location: '/playbook', 'Set-Cookie': cookie },
  });
}

function isValidEmail(email) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function timingSafeEqual(left, right) {
  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(left)),
    crypto.subtle.digest('SHA-256', encoder.encode(right)),
  ]);
  const leftBytes = new Uint8Array(leftHash);
  const rightBytes = new Uint8Array(rightHash);
  let mismatch = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    mismatch |= leftBytes[index] ^ rightBytes[index];
  }
  return mismatch === 0;
}

async function brevoRequest(label, url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Brevo ${label} failed with HTTP ${response.status}`);
  }
}

// ── Email content ─────────────────────────────────────────────────────────────

function welcomeEmailHtml(email) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>You now have access</title></head>
<body style="margin:0;padding:0;background:#fafaf8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td align="center" style="padding:32px 16px">
<table width="100%" style="max-width:560px" cellpadding="0" cellspacing="0" border="0">

  <!-- Header -->
  <tr><td style="background:#bc5429;border-radius:10px 10px 0 0;padding:28px 32px 24px;text-align:center">
    <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.75)">Brooklyn, NY 11226</p>
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
      The site contains a step-by-step guide for filing a rent reduction
      complaint with DHCR when elevator service is broken or degraded — covering
      how to file, what to send, and what to expect from DHCR. A tenant at
      this building used this process and received a formal rent reduction
      order from DHCR in 2024 that continues today.
    </p>

    <!-- CTA button -->
    <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px">
    <tr><td style="background:#bc5429;border-radius:6px;text-align:center;padding:14px 28px">
      <a href="https://tenant401.com/playbook" style="color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;display:block">
        Go to the playbook &rarr;
      </a>
    </td></tr>
    </table>

    <p style="margin:0;font-size:13px;color:#6b6b7b;line-height:1.6">
      You were registered at <strong>${email}</strong>.
      If you opted in to updates, you may receive occasional messages about
      tenant rights at 205 East 17th Street. If you did not sign up,
      you can ignore this email.
    </p>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#fafaf8;border:1px solid #e0ddd8;border-top:none;border-radius:0 0 10px 10px;padding:20px 32px;text-align:center">
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

The site contains a step-by-step guide for filing a rent reduction
complaint with DHCR when elevator service is broken or degraded — covering
how to file, what to send, and what to expect from DHCR. A tenant at this
building used this process and received a formal rent reduction order from
DHCR in 2024 that continues today.

Go to the playbook: https://tenant401.com/playbook

---
You were registered at ${email}.
If you opted in to updates, you may receive occasional messages about
tenant rights at 205 East 17th Street.

205 East 17th Street · Brooklyn, NY 11226
This site is not legal advice.`;
}

// ── Session cookie ─────────────────────────────────────────────────────────────

async function buildSessionCookie(secret) {
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const payload = btoa(JSON.stringify({ exp: expires.getTime() }));
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
