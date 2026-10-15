# Public address and callback configuration

The owner deferred buying a domain on 2026-10-15. The active storefront is:

https://altum-web-six.vercel.app

GitHub repository: `Very-Lucky-Guy/altum-web`, production branch `main`.
Vercel project: `pecplus/altum-web`, automatically deployed from GitHub.

Use this HTTPS origin for the current integration:

- `SITE_URL=https://altum-web-six.vercel.app`
- Stripe: `https://altum-web-six.vercel.app/api/webhooks/stripe`
- Apliiq: `https://altum-web-six.vercel.app/api/webhooks/apliiq`

No domain purchase, DNS delegation or custom-domain activation is required to configure payments, persist orders or receive provider callbacks on this address.

## Previous domain investigation

`altumwear.com` ownership was not established. The owner's original registration expired in April 2021; current RDAP shows a new registration in April 2026 through Wix. GoDaddy contains a website workspace, not the domain registration. Do not treat this domain as an ALTUM-owned production address or attempt to change its authoritative DNS.

A pending, inactive Cloudflare zone and Vercel domain associations were prepared earlier. They do not establish domain ownership and do not change the current authoritative Wix DNS. The historical configuration is retained in `docs/archive/DOMAIN-SETUP-2026-10-15.md` for reference only; its activation instructions are superseded.

## When a domain is selected later

Verify ownership and the checkout price before registration. Add the chosen domain to Vercel and use the DNS targets Vercel returns for that specific project. Verify HTTPS before changing `SITE_URL`, callback URLs, payment return URLs or public links. Update the Stripe endpoint's signing secret if replacing the endpoint. Keep the existing callback address available while pending events are reconciled.
