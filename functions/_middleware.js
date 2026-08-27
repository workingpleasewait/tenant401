/**
 * Cloudflare Pages Middleware
 * After CF Access authenticates a visitor, CF injects:
 *   CF-Access-Authenticated-User-Email: user@example.com
 * We use that to enroll the visitor in the Brevo list, then serve the page normally.
 */
export async function onRequest({ request, next, env }) {
  const email = request.headers.get('CF-Access-Authenticated-User-Email');

  if (email && env.BREVO_API_KEY && env.BREVO_LIST_ID) {
    // Fire-and-forget — don't block page load on Brevo
    subscribeToBrevo(email, env.BREVO_API_KEY, parseInt(env.BREVO_LIST_ID, 10)).catch(() => {});
  }

  return next();
}

async function subscribeToBrevo(email, apiKey, listId) {
  // Try to create or update the contact
  const body = JSON.stringify({
    email,
    listIds: [listId],
    updateEnabled: true,   // if contact already exists, just add list
  });

  const resp = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body,
  });

  // 204 = created, 400 with code "duplicate_parameter" = already exists (also fine)
  // Anything else we log but don't surface to the user
  if (!resp.ok && resp.status !== 204) {
    const txt = await resp.text();
    // Only throw so the outer catch can silence it
    if (!txt.includes('duplicate_parameter')) {
      throw new Error(`Brevo ${resp.status}: ${txt.slice(0, 200)}`);
    }
  }
}
