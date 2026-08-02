# Where to reach buyers (Dark Lighthouse Solutions)

Polar is **checkout**, not a marketplace. There is **no Polar ad product that puts your kits in front of strangers**. (Polar “Ads” is a sponsor-logo benefit for *your* OSS subscribers — irrelevant here.)

You drive traffic. Polar takes payment + delivers the ZIP.

---

## Primary channels (do these)

| Channel | Fit | How |
|---------|-----|-----|
| **Reddit** (`DarkLighthouseAdmin`) | High for DE kits | Answer threads for 1–2 weeks. Soft promo only. Profile → storefront URL. Subs below. |
| **LinkedIn** (your real name) | Highest B2B $ | 1–2 posts/week: problem → pattern → link to storefront. Consultants + hiring managers buy $249–$349. |
| **Storefront** (this folder) | Hub | Put `index.html` on GitHub Pages / Cloudflare. Bio links go here. |
| **DEV.to / Hashnode** | Medium-high | Long technical posts (“SuiteQL → Blob → ADF”). CTA at end. |
| **Hacker News** (Show HN) | Spiky | One strong kit + honest demo. Easy to flop; worth one shot. |

## Secondary

| Channel | Notes |
|---------|--------|
| **X / Bluesky** | Low organic reach unless you already have audience. Pin storefront. |
| **ClickHouse Slack** | Product discussion only; no spam. Mention kit if asked for a starter. |
| **dbt Slack / DataTalks / DET Slack** | Same: help first. |
| **r/netsuite, r/AzureDataFactory, r/salesforce, r/FastAPI, r/terraform, r/aws** | SKU-specific. Best for SKU 11 / 2 / 4 / 7. |
| **Indie Hackers** | “I shipped 11 DE kits on Polar” story posts work better than pure ads. |
| **Product Hunt** | Optional launch day for storefront + one hero SKU. |

## Paid ads (optional later)

| Platform | When |
|----------|------|
| **Reddit Ads** | After organic posts don’t die. Target r/dataengineering interests. Start ≤$10–20/day on SKU 3 or 11. |
| **LinkedIn Ads** | Expensive. Only after organic LinkedIn converts. |
| **Google Ads** | “NetSuite ADF connector alternative” style keywords — test small. |
| **Polar** | No discovery ads for sellers. Don’t wait for Polar traffic. |

Skip paid until you have a storefront URL + 2–3 posts that got engagement.

---

## Reddit targets for `DarkLighthouseAdmin`

**General DE:** r/dataengineering, r/datascience, r/SQL, r/analytics  
**SKU-shaped:** r/ClickHouse, r/netsuite, r/AzureDataFactory, r/salesforce, r/FastAPI, r/terraform, r/aws, r/devops  
**Rules:** value first, disclose affiliation, link storefront not 11 checkout URLs.

---

## Weekly rhythm (human paste + automation drafts)

1. Mon — automation drops paste-ready drafts in `promo/WEEKLY.md`
2. You post 1 Reddit answer + 1 LinkedIn post
3. Wed — optional DEV.to / technical note
4. Fri — reply to comments; no new hard sell

---

## Host the storefront

```powershell
cd C:\Users\shue1\Projects\dark-lighthouse-store
# Option A: Cloudflare Pages / Netlify — drag this folder
# Option B: GitHub Pages — create repo, push index.html, enable Pages
```

Until hosted, open locally:

```powershell
start C:\Users\shue1\Projects\dark-lighthouse-store\index.html
```
