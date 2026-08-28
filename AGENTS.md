---
type: Note
_organized: true
---

# AGENTS.md — tenant401

Password-gated tenant resource site at [tenant401.com](https://tenant401.com) for 205 East 17th Street, Brooklyn, NY 11226. Hosted on Cloudflare Pages.

## What this repo is

A static site that publishes a multi-screen rent-reduction playbook — a step-by-step guide for tenants filing a DHCR rent reduction complaint for elevator service failures. Access is gated by a session cookie (HMAC-signed, verified by a Cloudflare Pages Function). English only.

## Repo structure

| Path | Purpose |
|---|---|
| `index.html` | Public access-code gate and anonymous PostHog funnel events |
| `playbook.html` | Overview hub — 3 step cards, real-case result, "Already filed?" link |
| `step-1.html` | Step 1: File a 311 complaint |
| `step-2.html` | Step 2: Notify the landlord by certified mail |
| `step-3.html` | Step 3: File DHCR Form RA-84 |
| `after-you-file.html` | What to expect — post-filing timeline and restoration guidance |
| `style.css` | Shared stylesheet for all 5 playbook pages |
| `analytics.js` | Shared PostHog snippet |
| `functions/_middleware.js` | CF Pages middleware — validates `t401_session` cookie on all routes except `/` and `/api/login` |
| `functions/api/login.js` | Login endpoint — validates access, deduplicates Brevo enrollment, sends welcome email, issues session cookie |
| `designs/` | Stitch design reference screens (not served as live pages) |

## Deploy

`wrangler pages deploy . --project-name tenant401 --branch main` from the repo root. There is no build step; always verify the live gate and protected-route redirect after a push.

## Environment variables (set in CF Pages dashboard)

| Variable | Purpose |
|---|---|
| `ACCESS_CODE` | Shared tenant access code |
| `COOKIE_SECRET` | HMAC signing key for session cookies |
| `BREVO_API_KEY` | Brevo REST API key for email list enrollment |
| `BREVO_LIST_ID` | Brevo contact list numeric ID (must be a positive integer) |

## Local preview

```bash
npx wrangler pages dev . --compatibility-date=2024-01-01
```

## Conventions

- No build step — edit HTML files directly.
- Multi-screen flow: `playbook.html` is the hub; each step is a separate HTML file.
- Internal navigation links use extensionless URLs (`/playbook`, `/step-1`, etc.) — not `.html` extensions.
- Middleware runs on every non-public route; public routes are `/` and `/api/login`.
- Session cookie name: `t401_session`. Format: `base64(payload).hmac`. 7-day expiry.
- Session payloads contain only an expiry timestamp, never the tenant email.
- PostHog: `playbook_viewed` fires on overview only; step pages emit `playbook_screen_viewed`. `?is_test=1` suppresses all events.
- Brevo: login.js checks for existing contact before enrolling — repeat logins do not resend the welcome email.
- Do not commit secrets — all credentials live in the CF Pages dashboard.
- Design palette: terracotta `#bc5429` on warm ivory `#fafaf8`. Passes WCAG AA 4.5:1 against both white and ivory.
