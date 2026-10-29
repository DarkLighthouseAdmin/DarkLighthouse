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
 *  5. (v92) Mail from a known family that can't be read (or goes over the 30-a-day limit) leaves the family a short note in
 *     the app (note_booking_failed: arrival time, sender's domain, subject cut to 60 characters, reason) and is trashed too.
 *     Mail that can't be matched to a family is labeled "Famstamp/unmatched" and trashed after 7 days.
 *  6. (v108) One mail that fails never holds up the others: each mail is tried on its own. After FS_MAX_TRIES failed runs
 *     (about 3 hours) it gets the "couldn't read it" note (if the family is known) and the unmatched label, so it is trashed
 *     within a week like other mail nobody could use.
 *  7. (v108) A weekly sweep (famstampWeeklySweep) trashes any trips@ mail older than 7 days that is still in the mailbox,
 *     even if Famstamp was down the whole week, so "no copy kept" holds. Run setup() again once to add its trigger.
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
var FS_MAX_TRIES = 18;   // 10-minute runs: about 3 hours
var FS_QUERY = "(to:trips@darklighthousesolutions.com OR deliveredto:trips@darklighthousesolutions.com OR cc:trips@darklighthousesolutions.com) -label:Famstamp/unmatched newer_than:7d";

function setup() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === "famstampCheckMail") ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("famstampCheckMail").timeBased().everyMinutes(10).create();
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === "famstampWeeklySweep") ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("famstampWeeklySweep").timeBased().everyWeeks(1).onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(3).create();
  label_();
  return "ok";
}

function label_() { return GmailApp.getUserLabelByName("Famstamp/unmatched") || GmailApp.createLabel("Famstamp/unmatched"); }

function famstampCheckMail() {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty("FS_SUPABASE_URL"), key = props.getProperty("FS_PUBLISHABLE_KEY"), secret = props.getProperty("FS_INGEST_SECRET");
  if (!url || !key || !secret) throw new Error("Set FS_SUPABASE_URL, FS_PUBLISHABLE_KEY and FS_INGEST_SECRET in Script Properties");
  var today = Utilities.formatDate(new Date(), "UTC", "yyyy-MM-dd"), failed = 0;
  GmailApp.search(FS_QUERY, 0, 30).forEach(function (thread) {
    var unmatched = false;
    thread.getMessages().forEach(function (msg) {
      if (msg.isInTrash()) return;
      var hdr = [msg.getTo(), msg.getCc(), msg.getHeader("Delivered-To"), msg.getHeader("X-Original-To")].join(" ");
      var m = FS_ADDR.exec(hdr); if (!m) return;                       // not for trips@: leave it alone
      var code = (m[2] || "").toLowerCase(), sender = (/<([^>]+)>/.exec(msg.getFrom()) || [null, msg.getFrom()])[1].trim();
      try { var out = one_(msg, code, sender, url, key, secret, today); }
      catch (e) {   // v108: this mail only; the rest of the run goes on
        failed++;
        var k = "FS_TRY_" + msg.getId(), n = Number(props.getProperty(k) || 0) + 1;
        if (n < FS_MAX_TRIES) { props.setProperty(k, String(n)); return; }   // try again next run; nothing trashed
        props.deleteProperty(k);
        out = note_(url, key, secret, code, sender, msg.getSubject(), "unreadable", msg.getDate()) === "noted" ? "noted" : "gaveup";
      }
      props.deleteProperty("FS_TRY_" + msg.getId());
      if (out === "code" || out === "sender" || out === "noted") msg.moveToTrash();
      else unmatched = true;
    });
    if (unmatched) thread.addLabel(label_());
  });
  // unmatched or unreadable mail: kept a week so a person can look, then trashed
  GmailApp.search("label:Famstamp/unmatched older_than:7d", 0, 50).forEach(function (t) { t.moveToTrash(); });
  return failed;
}

// One mail: read it, send the places and dates, and say what happened. Throws if Famstamp didn't answer.
function one_(msg, code, sender, url, key, secret, today) {
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
      if (out === "empty" || out === "limit") {   // v92: tell the family in the app (if notes are set up; else keep the old way)
        var nr = note_(url, key, secret, code, sender, msg.getSubject(), out === "limit" ? "limit" : "unreadable", msg.getDate());
        if (nr === "noted" || nr === "skip") out = "noted";
      }
      return out;
}

// v108: weekly. Any trips@ mail older than 7 days still in the mailbox goes to Trash (only messages addressed to trips@).
function famstampWeeklySweep() {
  var n = 0, q = "(to:trips@darklighthousesolutions.com OR deliveredto:trips@darklighthousesolutions.com OR cc:trips@darklighthousesolutions.com) older_than:7d";
  for (var page = 0; page < 10; page++) {
    var ts = GmailApp.search(q, 0, 100), moved = 0;
    ts.forEach(function (thread) {
      thread.getMessages().forEach(function (msg) {
        if (msg.isInTrash()) return;
        var hdr = [msg.getTo(), msg.getCc(), msg.getHeader("Delivered-To"), msg.getHeader("X-Original-To")].join(" ");
        if (!FS_ADDR.test(hdr)) return;
        if (Date.now() - msg.getDate().getTime() < 7 * 864e5) return;
        msg.moveToTrash(); n++; moved++;
      });
    });
    if (ts.length < 100 || !moved) break;
  }
  return n;
}

// v92: a short "we couldn't read it" note for the family. Never the email itself: only the arrival time, the sender's
// address (the server keeps just its domain), the subject (cut to 60 characters) and why. Returns the server's answer, or "" on error.
function note_(url, key, secret, code, sender, subject, reason, date) {
  try {
    var r = UrlFetchApp.fetch(url + "/rest/v1/rpc/note_booking_failed", {
      method: "post", contentType: "application/json", muteHttpExceptions: true,
      headers: { apikey: key, Authorization: "Bearer " + key },
      payload: JSON.stringify({ p_secret: secret, p_code: code, p_sender: sender, p_subject: String(subject || "").slice(0, 60), p_reason: reason, p_received: (date || new Date()).toISOString() })
    });
    return r.getResponseCode() === 200 ? JSON.parse(r.getContentText()) : "";
  } catch (e) { return ""; }
}

// schema.org booking data some airlines and hotels put in the email's HTML
function ldJson_(html) {
  var out = [], re = /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi, m;
  while ((m = re.exec(html || ""))) out.push(m[0]);
  return out.join("\n");
}
