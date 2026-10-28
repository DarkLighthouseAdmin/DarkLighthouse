# Famstamp (travel log)

The family travel log PWA lives in `app/` and is served at https://darklighthousesolutions.com/travel-log/app/.
The product name and logo come from `app/brand.js` (`FS_BRAND`), and so do the contact addresses (`FS_BRAND.CONTACT`) and page links (`FS_BRAND.PAGES`). Change them there.
The "invite a family" reward is `FS_BRAND.REFERRAL`: both families get 1 free month of Premium when the invited family starts their own log, granted only once payments are live (`LIVE: false` until then; no billing code yet).

## Contacts

| Address | For |
| --- | --- |
| support@darklighthousesolutions.com | Help, bug reports, account deletion requests |
| privacy@darklighthousesolutions.com | Privacy policy, COPPA and parent requests, data deletion |
| partners@darklighthousesolutions.com | Parks, libraries, museums, QR stamp stations |
| press@darklighthousesolutions.com | Media |

## Site pages

- `privacy/`: privacy policy (published v73; self-reviewed against Google Play User Data, account deletion, Families and Data safety rules and COPPA basics)
- `terms/`: terms of use (published v73)
- `delete-account/`: how to delete an account and data (the URL for Google Play's data deletion question)
- `support/`: help and contacts
- `waitlist/`: public "Get notified when Famstamp launches" page (v73; linked from the site home, Travel home and every Famstamp page; stores email, source tag and date through the `join_waitlist` database function; adults only; unsubscribe by emailing support@; the list is deleted within 3 months after the launch email)

The pages use `site.css`, load `app/brand.js` to fill in the name, logo and addresses, and have no analytics.
Their database functions are in `supabase` migration `20261025000000_launch_basics.sql` (kept outside this repo).

## Releases

Bump `VERSION` in `app/app.js` and `CACHE` in `app/sw.js` for every release, then run `scripts/test_*.js`.

- **v68**: Search (`#/search`, Home search bar, 🔎 in the header on wide screens, menu item, `/` key); "What's new" after updates
- **v69**: Sample family demo (`?demo` / Home "Try a sample family": separate local database, fake names, no sync or telemetry, "Start my own family" wipes it); homeschool field-trip log (`#/fieldtrips`, subjects/hours/learned per trip, printable sheet → PDF); time capsules (`#/capsules`, open on a date or when the kid gets their own login; sealed, not encrypted); kid graduates to own login (`#/graduate/<id>` parent confirms 13+, teen redeems code at `#/grad/<code>` while signed in; history kept, parent keeps family view); invite-a-family referral link + tracking (`#/invite`, no rewards or billing). SQL: `supabase/migrations/20261025020000_graduate_referrals.sql` (additive, not applied).
- **v78**: Every town worldwide in place search. 225,978 towns and villages (GeoNames cities500, CC BY 4.0) with English and local spellings (Ghent/Gent, Bruges/Brugge, Cologne/Köln), accents optional, in `app/data/towns/<prefix>.json` files (about 1,000 files, the biggest ~430 KB) so a search downloads only the one file for what you typed; the service worker keeps it for offline. Built by `scripts/build_towns.py` (GeoNames files in a folder). `towns-core.js` folds accents and St/Saint, Mt/Mount, Ft/Fort the same way as the build. `data/places.json` is untouched; worldwide towns are an extra layer and a town already in the list is not shown twice. Exact name first, then bigger places. Typing an English name shows the local one next to it ("Ghent · Gent · Flanders, Belgium").
- **v77**: Sync fix for "Sync paused: new row for relation \"people\" violates check constraint \"people_data_check\"". The cloud keeps a person's profile in `people.data` (under ~8 KB), and a kid's drawn stamps (up to 90 KB each) or a long list pushed a person past that, so every push failed and changes waited. A person now syncs as two parts: small fields in `data`, drawings and the biggest other fields in the new `people.data_more` column (added 2026-10-28, additive: `add column ... default '{}'`, its own 8 MB check; nothing dropped or rewritten). `data_more` only goes up when it changes, one row per request; older rows without it keep what a phone has; two phones' drawings merge. Waiting changes go through on the next sync.
- **v76**: Neutral sample text: the family setup screen placeholders now read "e.g. Rivera, or The Rivera crew" and "e.g. Mom, Dad, Sam"; code notes and test fixtures use generic names. No data or features changed.
- **v75**: Small-phone top bar fits (320–400 px: search label and sync label shrink on inner pages and when the family chip shows, so nothing scrolls sideways). Grandparent view allows `#/report` and `#/sync` (More has "Family and sign-in"), so grandparents can report a problem and leave/switch family. Remember to rebuild `app-bundle.js` after editing any bundled script.
- **v74**: Faster first visit. The app's 54 scripts ship as one minified file, `app/app-bundle.js` (plus `app-bundle.js.map` for debugging), built free with terser. **Rebuild before every release:** `NODE_PATH=<dir with terser> node scripts/build_app_bundle.js` (the script list and order live between `bundle:start` and `bundle:end` in `app/index.html`; add new scripts there). A test fails if the bundle is out of date. The offline cache now stores the bundle instead of 54 separate files. Slow-3G first visit (local GitHub Pages stand-in) went from about 7.1 s to about 3.0 s; installed-app open is about 0.15 s.
- **v73**: Waitlist page published (no draft, indexed, in the sitemap) and linked from the home page, Travel home and every Famstamp page; privacy policy, terms and deletion page self-reviewed against Google Play User Data, account deletion, Families and Data safety rules and COPPA basics: parent notice, kid-device data, waitlist, referrals, retention periods, partial deletion; parent/guardian confirmation before the first kid code; referral reward set to 1 free month of Premium for both families once payments are live (`FS_BRAND.REFERRAL`).
- **v72**: Empty-state audit with a brand-new phone (13 screens); the family map with nobody on it now shows "Add someone".
- **v71**: Robustness (`robust.js`, `sync-core.js`): journal pages, game boards, game stamps and time capsules merge piece by piece on pull instead of last-write-wins (tombstones `trip.journalGone`, `person.capsGone`; merged rows are pushed straight back; no schema change); failed photo uploads are recorded (`c.failed`), retried every sync and shown on Home with Try again, plus a "Sync stuck since …" card after 6 h of waiting changes; new-trip drafts autosave to localStorage and Home offers "Finish your trip?"; duplicate-trip check on save with "Add to that trip" merge; restore (file or automatic copy) shows a preview first; a weekly automatic copy (no photos, last 4) in IndexedDB `famstamp-autocopies` and a "Last backup file · Automatic copy" line on More and Back up.
- **v70**: New navigation (`nav.js`): bottom bar Home · Map · big ＋ Stamp · Trips · More; Map has a Family/person picker and USA/World/Parks; `#/trips` lists every trip (person filter, field-trip log + PDF); `#/more` groups everything (Our family, Earn, Play & make, Share & keep, Account) so nothing is link-only; one top-left Back arrow that follows the same history as the phone's Back (and closes sheets first); Search at the top right on every tab; "You're on" line (family log + person); skippable 3-step tour; written labels on emoji buttons; one-handed kid mode (Map, Stamp, Games). Grandparent simple view: 3 big tabs (Highlights, Weekly recap, Reactions & news `#/news`), 19px text, 48px+ targets, no editing screens, a first-open how-to tip, switch to the full app from More. `robust.js`: asks for persistent storage, keeps a privacy-safe error log on the phone, and `#/report` opens an email to support (nothing sent automatically).
  (`extras.js` NOTES); Undo bars instead of confirm dialogs for trip, postcard and station deletes; stamp sound off unless
  switched on in Help; rate-limited "Enjoying it?" after 10+ stamps (7 days after first use, every 90 days, max 3);
  Help settings: miles/km, °F/°C, reminder hour, quiet hours (needs `notify-quiet.sql`), storage used; lazy photo
  loading (book/slideshow/print load all); dates use the phone's own day in every time zone; Utah stamp's gull drawn at
  the set's size; privacy page states the parent owns the account and kids never sign up.
