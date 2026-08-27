# tenant401

Password-gated tenant playbook site at [tenant401.com](https://tenant401.com).

## What this is

A single-page site for tenants at 205 East 17th Street, Brooklyn, NY 11226.  
Publishes the rent-reduction playbook (English + French) — a step-by-step guide to filing a DHCR rent reduction complaint for elevator service failures.

## How it works

1. **Cloudflare Access** (email OTP) gates the site — visitors enter their email and receive a one-time code.  
2. A **Cloudflare Pages Function** (`functions/_middleware.js`) reads the authenticated email from the `CF-Access-Authenticated-User-Email` header and enrolls the visitor in the Brevo mailing list.  
3. The site is a single static `index.html` — no build step required.

## Deploy

Push to `main` → Cloudflare Pages auto-deploys.

## Environment variables (set in CF Pages dashboard)

| Variable | Value |
|---|---|
| `BREVO_API_KEY` | Brevo REST API key (`xkeysib-...`) |
| `BREVO_LIST_ID` | Brevo contact list numeric ID |

## Local preview

```bash
npx wrangler pages dev . --compatibility-date=2024-01-01
```
