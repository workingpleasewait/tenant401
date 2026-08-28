/**
 * GET /api/logout
 * Expires the session cookie and redirects to the gate.
 */
export async function onRequestGet({ request }) {
  const expiredCookie = 't401_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0';
  return new Response(null, {
    status: 303,
    headers: {
      Location: '/',
      'Set-Cookie': expiredCookie,
    },
  });
}
