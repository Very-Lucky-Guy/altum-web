# altumwear.com deployment

Configured on 2026-10-15:

- GitHub: Very-Lucky-Guy/altum-web, production branch main.
- Vercel: pecplus/altum-web, automatic deployments from GitHub.
- Existing public URL: https://altum-web-six.vercel.app
- Production domains added and verified in Vercel: altumwear.com and www.altumwear.com.
- www redirects permanently (308) to altumwear.com.
- Cloudflare account: 1dba4e14a82f10ce0e1be336ece6df28.
- Zone: d121d9f6b2a22a36902a1096e0be92cf, Free plan.
- Both Cloudflare CNAME records point to 0fe3b320e0d38551.vercel-dns-016.com, DNS only, TTL 300. This is the recommended target returned by Vercel's domain configuration API.

## Pending activation

The domain is registered at Wix.com Ltd., not GoDaddy. GoDaddy contains an old website workspace but no altumwear.com registration. RDAP and public DNS currently show ns6.wixdns.net and ns7.wixdns.net. No DS records are present.

Required Cloudflare nameservers:

- jacob.ns.cloudflare.com
- tori.ns.cloudflare.com

Sign into the owning Wix account, review/export the complete DNS zone, preserve any custom subdomain/email records, unassign the old Wix site if necessary, then change the nameservers. The initial Cloudflare scan found only the three Wix apex A records and www CNAME; those were replaced in the pending Cloudflare zone. Existing authoritative Wix records remain untouched.

After delegation changes, verify public NS and A/CNAME resolution, Vercel configuration and TLS for both names. Then set SITE_URL=https://altumwear.com in Vercel production and redeploy from GitHub before enabling checkout. Stripe/Apliiq callbacks should use the same canonical hostname.

## Previous public DNS

- A @: 185.230.63.171
- A @: 185.230.63.186
- A @: 185.230.63.107
- CNAME www: cdn3.wixdns.net

Official Wix instructions: https://support.wix.com/en/article/changing-nameserver-ns-records-for-a-wix-domain
