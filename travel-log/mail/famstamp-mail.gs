/**
 * Famstamp booking forwarding: Google Apps Script for the darklighthousesolutions.com mailbox that receives trips@.
 * Free (runs on Google's quota). No secrets in this file: they live in Project Settings → Script Properties.
 *
 * What it does, every 10 minutes:
 *  1. Finds new mail sent to trips@ or trips+CODE@darklighthousesolutions.com.
 *  2. Reads the flight/hotel confirmation with booking-core.js (the same reader the app uses).
 *  3. Sends ONLY the airports, dates, hotel name and city to Famstamp (ingest_booking), with the family's code
 *     (from trips+CODE@) or the forwarder's address (matched to a family member's sign-in email).
 *  4. Moves the email to Trash (Gmail empties Trash after 30 days), so no copy of the booking email is kept.
 *     Mail that can't be read or matched is labeled "Famstamp/unmatched" and also trashed after 7 days.
 * It never replies to anyone and never reads other mail (the search only matches trips@ addresses).
 *
 * Setup (one time, as the mailbox owner):
 *  - Project files: this file, plus a script file named booking-core containing travel-log/app/booking-core.js as-is.
 *  - Script Properties: FS_SUPABASE_URL = https://ercowufdbmvqagshduxh.supabase.co
 *                       FS_PUBLISHABLE_KEY = the app's publishable key (travel-log/app/sync-config.js)
 *                       FS_INGEST_SECRET = the mail secret (kept by the bot in .secrets/mail-ingest-secret)
 *  - Run setup() once and allow Gmail + external requests. It adds the 10-minute trigger.
 */
var FS_ADDR = /(^|[<\s,;"])trips(?:\+([a-z0-9]{1,12}))?@darklighthousesolutions\.com/i;
var FS_QUERY = "(to:trips@darklighthousesolutions.com OR deliveredto:trips@darklighthousesolutions.com OR cc:trips@darklighthousesolutions.com) -label:Famstamp/unmatched newer_than:7d";

function setup() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === "famstampCheckMail") ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("famstampCheckMail").timeBased().everyMinutes(10).create();
  label_();
  return "ok";
}

function label_() { return GmailApp.getUserLabelByName("Famstamp/unmatched") || GmailApp.createLabel("Famstamp/unmatched"); }

function famstampCheckMail() {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty("FS_SUPABASE_URL"), key = props.getProperty("FS_PUBLISHABLE_KEY"), secret = props.getProperty("FS_INGEST_SECRET");
  if (!url || !key || !secret) throw new Error("Set FS_SUPABASE_URL, FS_PUBLISHABLE_KEY and FS_INGEST_SECRET in Script Properties");
  var today = Utilities.formatDate(new Date(), "UTC", "yyyy-MM-dd");
  GmailApp.search(FS_QUERY, 0, 30).forEach(function (thread) {
    var unmatched = false;
    thread.getMessages().forEach(function (msg) {
      if (msg.isInTrash()) return;
      var hdr = [msg.getTo(), msg.getCc(), msg.getHeader("Delivered-To"), msg.getHeader("X-Original-To")].join(" ");
      var m = FS_ADDR.exec(hdr); if (!m) return;                       // not for trips@: leave it alone
      var code = (m[2] || "").toLowerCase(), sender = (/<([^>]+)>/.exec(msg.getFrom()) || [null, msg.getFrom()])[1].trim();
      var res = FS_BOOKING_CORE.parse(msg.getPlainBody() + "\n" + ldJson_(msg.getBody()), today);
      var out = "empty";
      if (res.flights.length || res.hotels.length) {
        var parsed = { flights: res.flights.map(function (f) { return { dep: f.dep, arr: f.arr, date: f.date || null }; }),
                       hotels: res.hotels.map(function (h) { return { name: h.name, city: h.city || "", checkIn: h.checkIn || null, checkOut: h.checkOut || null, nights: h.nights == null ? null : h.nights }; }) };
        var r = UrlFetchApp.fetch(url + "/rest/v1/rpc/ingest_booking", {
          method: "post", contentType: "application/json", muteHttpExceptions: true,
          headers: { apikey: key, Authorization: "Bearer " + key },
          payload: JSON.stringify({ p_secret: secret, p_code: code, p_sender: sender, p_parsed: parsed })
        });
        if (r.getResponseCode() !== 200) throw new Error("Famstamp said " + r.getResponseCode());   // try again next run; nothing trashed
        out = JSON.parse(r.getContentText());
      }
      if (out === "code" || out === "sender") msg.moveToTrash();
      else unmatched = true;
    });
    if (unmatched) thread.addLabel(label_());
  });
  // unmatched or unreadable mail: kept a week so a person can look, then trashed
  GmailApp.search("label:Famstamp/unmatched older_than:7d", 0, 50).forEach(function (t) { t.moveToTrash(); });
}

// schema.org booking data some airlines and hotels put in the email's HTML
function ldJson_(html) {
  var out = [], re = /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi, m;
  while ((m = re.exec(html || ""))) out.push(m[0]);
  return out.join("\n");
}
