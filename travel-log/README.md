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
  (`extras.js` NOTES); Undo bars instead of confirm dialogs for trip, postcard and station deletes; stamp sound off unless
  switched on in Help; rate-limited "Enjoying it?" after 10+ stamps (7 days after first use, every 90 days, max 3);
  Help settings: miles/km, °F/°C, reminder hour, quiet hours (needs `notify-quiet.sql`), storage used; lazy photo
  loading (book/slideshow/print load all); dates use the phone's own day in every time zone; Utah stamp's gull drawn at
  the set's size; privacy page states the parent owns the account and kids never sign up.
