---
type: Note
_organized: true
---

# AGENTS.md — tenant401

Password-gated tenant resource site at [tenant401.com](https://tenant401.com) for 205 East 17th Street, Brooklyn, NY 11226. Hosted on Cloudflare Pages.

## What this repo is

A static site that publishes the rent-reduction playbook (English + French) — a step-by-step guide for tenants filing a DHCR rent reduction complaint for elevator service failures. Access is gated by a session cookie (HMAC-signed, verified by a Cloudflare Pages Function).

## Repo structure

| Path | Purpose |
|---|---|
| `index.html` | Public access-code gate and anonymous PostHog funnel events |
| `playbook.html` | The rent-reduction playbook (English + French) |
| `functions/_middleware.js` | CF Pages middleware — validates `t401_session` cookie on all routes except `/` and `/api/login` |
| `functions/api/login.js` | Login endpoint — validates access, schedules Brevo work, and issues the signed session cookie |

## Deploy

Cloudflare Pages deploys from `main`. There is no build step; always verify the
live gate and protected-route redirect after a push.

## Environment variables (set in CF Pages dashboard)

| Variable | Purpose |
|---|---|
| `ACCESS_CODE` | Shared tenant access code |
| `COOKIE_SECRET` | HMAC signing key for session cookies |
| `BREVO_API_KEY` | Brevo REST API key for email list enrollment |
| `BREVO_LIST_ID` | Brevo contact list numeric ID |

## Local preview

```bash
npx wrangler pages dev . --compatibility-date=2024-01-01
```

## Conventions

- No build step — edit `index.html` and `playbook.html` directly.
- Middleware runs on every non-public route; public routes are `/` and `/api/login`.
- Session cookie name: `t401_session`. Format: `base64(payload).hmac`.
- Session payloads contain only an expiry timestamp, never the tenant email.
- PostHog receives anonymous explicit events only; `?is_test=1` suppresses it.
- Do not commit secrets — all credentials live in the CF Pages dashboard.
