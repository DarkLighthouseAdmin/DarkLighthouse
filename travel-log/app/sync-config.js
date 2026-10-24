/* Family Sync settings. Both values are public by design: the publishable key only lets the app talk to Supabase as
   "anyone", and Row Level Security on every table decides what a signed-in family member can see. Never put the
   secret (server) key here. */
window.MLTL_SYNC_CONFIG = {
  url: "https://ercowufdbmvqagshduxh.supabase.co",
  key: "sb_publishable_ea0LGZ0qR94t3_8AF_Gx0g_iKj88O6i",
  bucket: "trip-photos",
  // Show the Family Sync card on the home screen. While false, sync is reachable only from #/sync and ?join= links.
  showEntry: true,
  // Family testing: every Family Keeper feature is unlocked. Flip off when Family Keeper goes on sale.
  testing: true,
  // "Continue with Google": turn on once Google is set up in Supabase (Auth > Providers > Google, plus "Allow manual linking").
  google: true,
  // Email sign-in codes: off until custom SMTP is set up (Supabase's built-in mail only reaches the project team).
  email: false,
  price: "$24.99/yr for the whole family",
  // Web push (v61): the PUBLIC VAPID key. The private half lives only in Supabase Vault.
  pushKey: "BFSPIJ_FrJAAveKMA7AYt3qMTOWyqNRlWVAJLe0HupDutg26w-ndct14PsjjKP44LtS2B2Zea0uteikY-29kKHU",
  pushFunction: "famstamp-push"
};
