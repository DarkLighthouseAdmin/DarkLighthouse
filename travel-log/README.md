# Famstamp (travel log)

The family travel log PWA lives in `app/` and is served at https://darklighthousesolutions.com/travel-log/app/.
The product name and logo come from `app/brand.js` (`FS_BRAND`), and so do the contact addresses (`FS_BRAND.CONTACT`) and page links (`FS_BRAND.PAGES`). Change them there.

## Contacts

| Address | For |
| --- | --- |
| support@darklighthousesolutions.com | Help, bug reports, account deletion requests |
| privacy@darklighthousesolutions.com | Privacy policy, COPPA and parent requests, data deletion |
| partners@darklighthousesolutions.com | Parks, libraries, museums, QR stamp stations |
| press@darklighthousesolutions.com | Media |

## Site pages

- `privacy/`: privacy policy (draft, needs a lawyer review)
- `terms/`: terms of use (draft)
- `delete-account/`: how to delete an account and data (the URL for Google Play's data deletion question)
- `support/`: help and contacts
- `waitlist/`: draft waitlist page (noindex; stores emails through the `join_waitlist` database function)

The pages use `site.css`, load `app/brand.js` to fill in the name, logo and addresses, and have no analytics.
Their database functions are in `supabase` migration `20261025000000_launch_basics.sql` (kept outside this repo).

## Releases

Bump `VERSION` in `app/app.js` and `CACHE` in `app/sw.js` for every release, then run `scripts/test_*.js`.
