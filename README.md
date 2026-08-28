# tenant401

Password-gated tenant resource site at [tenant401.com](https://tenant401.com)
for 205 East 17th Street, Brooklyn, NY 11226.

## What this is

The site publishes an English and French playbook for tenants filing a DHCR
rent-reduction complaint about building-wide elevator service failures. The
public landing page accepts an email address and shared access code; successful
login issues a seven-day HMAC-signed session cookie for the protected playbook.

## Request flow

1. `index.html` displays the public access-code gate.
2. `functions/api/login.js` validates the email and `ACCESS_CODE`.
3. A successful login schedules Brevo contact enrollment and the welcome email,
   then issues the `t401_session` cookie.
4. `functions/_middleware.js` validates that cookie before serving
   `playbook.html` or any other protected route.
5. PostHog records anonymous, explicit funnel events. It does not receive the
   visitor's email address or form values. Adding `?is_test=1` suppresses the
   PostHog SDK and events for local or marked browser checks.

## Environment variables

Set these in the Cloudflare Pages dashboard. Never commit their values.

| Variable | Required | Purpose |
|---|---:|---|
| `ACCESS_CODE` | Yes | Shared tenant access code |
| `COOKIE_SECRET` | Yes | HMAC key used to sign session cookies |
| `BREVO_API_KEY` | Yes for enrollment/email | Brevo REST API credential |
| `BREVO_LIST_ID` | Yes for enrollment | Numeric Brevo contact-list ID |

The PostHog project token is a public client token embedded in the two HTML
pages; it is not a secret.

## Deploy

Cloudflare Pages is configured from `main` with no build step. After pushing,
verify the deployed commit by checking the public gate and the unauthenticated
redirect from `/playbook` before distributing the access code.

## Local preview

Create an untracked `.dev.vars` file with local-only values, then run:

```bash
npx wrangler pages dev . --compatibility-date=2024-01-01
```

Use `?is_test=1` during browser checks so PostHog remains untouched.

## Focused validation

```bash
node --check functions/_middleware.js
node --check functions/api/login.js
awk '/<script>/{inside=1;next}/<\/script>/{inside=0}inside' index.html | node --check -
awk '/<script>/{inside=1;next}/<\/script>/{inside=0}inside' playbook.html | node --check -
```
