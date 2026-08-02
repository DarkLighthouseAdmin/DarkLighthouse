# DNS — darklighthousesolutions.com

Provider: **Squarespace Domains** (nameservers `nsd*.squarespacedns.com`)  
Mail already on Google Workspace (`MX → smtp.google.com`).

## Google Search Console verification (do now)

In Squarespace → Domains → `darklighthousesolutions.com` → **DNS** → **DNS Settings** → **Add record**:

| Field | Value |
|--------|--------|
| Type | `TXT` |
| Host / Name | `@` (root) — or leave blank if Squarespace says “apex” |
| Data / Value | `google-site-verification=4glRlpDPg_rLW9juZwErIAh0Pc3W6HBYj-oaUOpcKp8` |
| TTL | Default |

Save. Wait 5–30 minutes. In Search Console click **Verify**.

Do **not** delete the existing SPF TXT (`v=spf1 include:_spf.google.com ~all`). Add a **second** TXT record.

## Optional next: point shop to your domain

After verification, to serve the storefront at `https://darklighthousesolutions.com` (or `www`):

1. GitHub repo → Settings → Pages → Custom domain → `www.darklighthousesolutions.com` (recommended) or apex
2. Squarespace DNS:

**For www → GitHub Pages:**

| Type | Host | Data |
|------|------|------|
| CNAME | `www` | `darklighthouseadmin.github.io` |

**For apex (@) → GitHub Pages** (A records GitHub publishes; confirm current IPs in GitHub docs):

| Type | Host | Data |
|------|------|------|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |

3. Add `CNAME` file or custom domain in Pages; enable HTTPS once DNS propagates.

Until then the live shop stays: https://darklighthousesolutions.com/
