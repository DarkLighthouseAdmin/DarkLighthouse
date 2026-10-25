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

- **v68**: Search (`#/search`, Home search bar, 🔎 in the header on wide screens, menu item, `/` key); "What's new" after updates
- **v69**: Sample family demo (`?demo` / Home "Try a sample family": separate local database, fake names, no sync or telemetry, "Start my own family" wipes it); homeschool field-trip log (`#/fieldtrips`, subjects/hours/learned per trip, printable sheet → PDF); time capsules (`#/capsules`, open on a date or when the kid gets their own login; sealed, not encrypted); kid graduates to own login (`#/graduate/<id>` parent confirms 13+, teen redeems code at `#/grad/<code>` while signed in; history kept, parent keeps family view); invite-a-family referral link + tracking (`#/invite`, no rewards or billing). SQL: `supabase/migrations/20261025020000_graduate_referrals.sql` (additive, not applied).
- **v71**: Robustness (`robust.js`, `sync-core.js`): journal pages, game boards, game stamps and time capsules merge piece by piece on pull instead of last-write-wins (tombstones `trip.journalGone`, `person.capsGone`; merged rows are pushed straight back; no schema change); failed photo uploads are recorded (`c.failed`), retried every sync and shown on Home with Try again, plus a "Sync stuck since …" card after 6 h of waiting changes; new-trip drafts autosave to localStorage and Home offers "Finish your trip?"; duplicate-trip check on save with "Add to that trip" merge; restore (file or automatic copy) shows a preview first; a weekly automatic copy (no photos, last 4) in IndexedDB `famstamp-autocopies` and a "Last backup file · Automatic copy" line on More and Back up.
- **v70**: New navigation (`nav.js`): bottom bar Home · Map · big ＋ Stamp · Trips · More; Map has a Family/person picker and USA/World/Parks; `#/trips` lists every trip (person filter, field-trip log + PDF); `#/more` groups everything (Our family, Earn, Play & make, Share & keep, Account) so nothing is link-only; one top-left Back arrow that follows the same history as the phone's Back (and closes sheets first); Search at the top right on every tab; "You're on" line (family log + person); skippable 3-step tour; written labels on emoji buttons; one-handed kid mode (Map, Stamp, Games). Grandparent simple view: 3 big tabs (Highlights, Weekly recap, Reactions & news `#/news`), 19px text, 48px+ targets, no editing screens, a first-open how-to tip, switch to the full app from More. `robust.js`: asks for persistent storage, keeps a privacy-safe error log on the phone, and `#/report` opens an email to support (nothing sent automatically).
  (`extras.js` NOTES); Undo bars instead of confirm dialogs for trip, postcard and station deletes; stamp sound off unless
  switched on in Help; rate-limited "Enjoying it?" after 10+ stamps (7 days after first use, every 90 days, max 3);
  Help settings: miles/km, °F/°C, reminder hour, quiet hours (needs `notify-quiet.sql`), storage used; lazy photo
  loading (book/slideshow/print load all); dates use the phone's own day in every time zone; Utah stamp's gull drawn at
  the set's size; privacy page states the parent owns the account and kids never sign up.
