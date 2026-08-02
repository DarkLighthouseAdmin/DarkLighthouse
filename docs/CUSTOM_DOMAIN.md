# Custom domain cutover — darklighthousesolutions.com → GitHub Pages

Hosting stays on **GitHub Pages**. Squarespace only holds DNS for the domain name.
Do **not** touch MX / SPF (Google Workspace email).

## Part A — Squarespace DNS (you do this)

1. Open https://account.squarespace.com/domains
2. Click **darklighthousesolutions.com** → **DNS** → **DNS Settings**
3. Under **Custom records**, add these (**keep** existing Google MX + SPF TXT):

### Apex (root) — Type A — Host `@`

Add **four** A records (same host `@`, different IPs):

| Type | Host | Data |
|------|------|------|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |

### www — Type CNAME — Host `www`

| Type | Host | Data |
|------|------|------|
| CNAME | `www` | `darklighthouseadmin.github.io` |

4. **Save** all records.
5. Wait 10–60 minutes (sometimes up to a few hours).

### Do NOT change

- MX → `smtp.google.com` (Workspace email)
- TXT SPF → `v=spf1 include:_spf.google.com ~all`

## Part B — GitHub (already in repo / API)

- Repo: `DarkLighthouseAdmin/DarkLighthouse`
- `CNAME` file = `darklighthousesolutions.com`
- Pages custom domain set to `darklighthousesolutions.com`
- After DNS works: enable **Enforce HTTPS** in Pages if not auto-on

## Part C — Verify

1. `nslookup darklighthousesolutions.com` → should show the 185.199.x.x IPs
2. Open https://darklighthousesolutions.com/
3. Open https://www.darklighthousesolutions.com/ (should hit same site)
4. Email still works: send a test to yourself at `admin@...`

## Final URLs (after DNS)

- Shop: https://darklighthousesolutions.com/
- NetSuite kit: https://darklighthousesolutions.com/netsuite-adf.html
- Old github.io URL may redirect once custom domain is active

## Search Console

Add property `https://darklighthousesolutions.com/` after HTTPS works.
(The github.io HTML file verify was for the old URL.)
