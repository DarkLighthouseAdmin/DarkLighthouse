# Paste-ready writeups (post next week)

Storefront: https://www.darklighthousesolutions.com/  
NetSuite page: https://www.darklighthousesolutions.com/netsuite-adf.html  
Checkout (SKU 11): https://buy.polar.sh/polar_cl_wxHzL3HgmiAQqjV72w8QZftRYE9CL0LCt1IT63LWS0I  
Support: admin@darklighthousesolutions.com  
Reddit: DarkLighthouseAdmin  
X: @DarkLighthouses  

---

## 1) LinkedIn (your real name — best for $349)

**Post:**

Most NetSuite → Azure paths I see fall into two buckets:

1. Pay for SuiteAnalytics Connect / a sync vendor ($1k–$10k+/yr)
2. A one-off script that works until pagination or auth breaks in prod

There’s a third shape that fits a lot of ADF shops:

ADF Web Activity → small API → SuiteQL (TBA) → JSON in Blob → rest of the pipeline in ADF

Token-Based Auth (not “get a bearer token every run”). Paginate until hasMore is false. Keep transforms in ADF or the warehouse.

I packaged that path as a starter kit (FastAPI + Docker + mock mode) so you can prove the flow before wiring prod tokens.

Details: https://www.darklighthousesolutions.com/netsuite-adf.html

If you’re mid-migration and want the boring parts done: happy to answer architecture questions in the comments.

---

## 2) Reddit — r/AzureDataFactory or r/netsuite (technical, disclose)

**Title:** SuiteQL → Azure Blob for ADF Web Activity (TBA, pagination, mock mode)

**Body:**

I kept running into the same ADF + NetSuite setup:

- Need scheduled extracts into Blob/ADLS
- Don’t want SuiteAnalytics Connect pricing for a handful of SuiteQL pulls
- Don’t want a fragile notebook with no pagination

Pattern that worked:

1. NetSuite TBA (Token-Based Auth / OAuth 1.0a HMAC) — long-lived tokens from the NetSuite UI, signed per request
2. SuiteQL with limit/offset until `hasMore` is false
3. Write JSON to Azure Blob
4. ADF Web Activity calls `POST /v1/extract` with query + destination blob name
5. ADF continues with whatever silver/gold you already use

I wrapped it as a small FastAPI service with Docker + MOCK_MODE so you can demo without prod NetSuite/Azure.

Writeup + kit (affiliate/product — I sell this):  
https://www.darklighthousesolutions.com/netsuite-adf.html

Happy to share the request/response shape or Container Apps notes if useful.

---

## 3) DEV.to / Hashnode (long SEO piece)

**Title:** NetSuite to Azure Data Factory without SuiteAnalytics Connect

**Body (paste into DEV.to editor):**

# NetSuite to Azure Data Factory without SuiteAnalytics Connect

If your goal is “run SuiteQL on a schedule and land files for ADF,” you do not always need a full SuiteAnalytics Connect license or a managed sync platform.

## The shape

```
ADF schedule
  → Web Activity
    → POST /v1/extract { query, destination_blob_name }
      → NetSuite TBA + SuiteQL pages
      → Azure Blob JSON
  → ADF Data Flow / copy / warehouse ELT
```

## Auth note

This uses **Token-Based Authentication** (TBA): Consumer Key/Secret + Token ID/Secret created in NetSuite. Each request is OAuth-signed. It is not the “fetch OAuth2 bearer every run” flow.

Prefer a dedicated integration user when your admin allows it.

## Pagination

SuiteQL responses include `hasMore`. Keep requesting with limit/offset until `hasMore` is false or you will silently drop rows.

## Why Blob JSON

ADF Web Activity + JSON in bronze is easy to reason about. Transform in ADF Data Flows or ELT in the warehouse — your call.

## Kit

I published a starter that implements this path (FastAPI, Docker, mock mode, verify scripts):

https://www.darklighthousesolutions.com/netsuite-adf.html

One-time purchase via Polar. Commercial use allowed.

Questions about TBA setup or Container Apps deployment — comment below.

---

## 4) Indie Hackers (short story)

Shipped a catalog of data engineering starter kits after Lemon Squeezy wouldn’t enable the store.

Moved checkout to Polar (MoR, ~5%+$0.50). Storefront on GitHub Pages.

Hero SKU: NetSuite → ADF bridge ($349) — SuiteQL + TBA → Blob for Web Activity. Also ClickHouse, Salesforce middleware, validation, etc.

Site: https://www.darklighthousesolutions.com/

Still figuring out distribution (LinkedIn + niche Reddit). If you’ve sold boring B2B boilerplate, what actually moved units?

---

## How to post without being “good at it”

You do **not** need to improvise. Next week:

1. Open this file
2. Copy section 1 → LinkedIn → Post
3. Copy section 2 → Reddit → Submit
4. Copy section 3 → DEV.to → Publish

I cannot log into LinkedIn/Reddit as you. Options that *can* auto-post after you connect once:

- **Buffer** or **Typefully** (schedule LinkedIn/X; you approve queue)
- **LinkedIn native scheduler** (paste once, pick time)
- Weekly Cursor Automation that refreshes drafts in `promo/WEEKLY.md` — you still click Post

Best lazy path: Buffer free tier + these drafts preloaded.
