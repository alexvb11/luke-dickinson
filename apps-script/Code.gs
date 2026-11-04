/**
 * Luke Dickinson — booking backend (Google Apps Script, runs free on Luke's Google account).
 *
 *  GET  ?action=busy  → busy times on Luke's calendar (times only, no titles) + saved class schedule
 *  POST {booking}     → re-checks the time is free, creates the event on Luke's calendar,
 *                       invites the client (Google emails them the invite), and emails Luke the details.
 *  POST {action: …}   → admin actions from the hidden admin page (password required).
 *  sendReminders()    → runs every hour (after you run installReminders once) and emails each
 *                       client a reminder about a day before their cut.
 *
 * Setup steps are in README.md.
 */
const SETTINGS = {
  CALENDAR_ID: "primary",   // Luke's main calendar
  NOTIFY_LUKE: true,        // also email Luke the booking details (phone, notes)
  // Luke's real address. Private: it only goes out in the invite + reminder after someone books.
  LOCATION: "",             // TODO e.g. "123 Main St, Apt 4, West Lafayette, IN"
  LUKE_PHONE: "(574) 242-0325", // "text to reschedule" line
  PAYMENT: "Cash or Venmo",
  DAYS_AHEAD: 35,           // how far ahead to report busy times
  REMINDER_MINUTES: [60],   // popup reminders on Luke's copy of the event
  // The admin password is NOT in this file (so it can live in a public repo). Set it in the
  // Apps Script editor: Project Settings → Script Properties → add ADMIN_PASSWORD.
};
const BLOCK_TAG = "ld_block";        // time-off events created from the admin page
const BOOKING_TAG = "ld_booking";    // value = client email (used for reminders)
const BOOKED_AT_TAG = "ld_booked_at";
const REMINDED_TAG = "ld_reminded";

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || "busy";
  if (action !== "busy") return json_({ ok: false, error: "unknown_action" });
  return json_({ ok: true, busy: getBusy_(), terms: getTerms_() });
}

// Lines added to the invite + reminder: where, how to pay, how to reschedule.
function clientInfo_() {
  return [
    SETTINGS.LOCATION ? `Address: ${SETTINGS.LOCATION}` : null,
    SETTINGS.PAYMENT ? `Payment: ${SETTINGS.PAYMENT}` : null,
    `Need to reschedule? Text Luke${SETTINGS.LUKE_PHONE ? ` at ${SETTINGS.LUKE_PHONE}` : ""}.`,
  ].filter((l) => l !== null);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000); // two people clicking Book at the same moment can't both win
  try {
    const b = JSON.parse(e.postData.contents);
    if (b.action) return admin_(b);
    const err = validate_(b);
    if (err) return json_({ ok: false, error: err });

    const tz = Session.getScriptTimeZone();
    const start = Utilities.parseDate(`${b.date} ${hhmm_(b.start)}`, tz, "yyyy-MM-dd HH:mm");
    const end = new Date(start.getTime() + b.duration * 60000);
    if (start.getTime() < Date.now()) return json_({ ok: false, error: "past" });

    const cal = cal_();
    if (cal.getEvents(start, end).length) return json_({ ok: false, error: "taken" });

    const description = [
      `${b.service} (${b.duration} min) — $${b.price}`,
      "",
      `Client: ${b.name}`,
      `Phone: ${b.phone}`,
      `Email: ${b.email}`,
      b.notes ? `Notes: ${b.notes}` : null,
      "",
      ...clientInfo_(),
    ].filter((l) => l !== null).join("\n");

    const ev = cal.createEvent(`${b.service} with Luke Dickinson · ${b.name}`, start, end, {
      description,
      location: SETTINGS.LOCATION,
      guests: b.email,
      sendInvites: true, // ← this is what puts it in the client's inbox + Google Calendar
    });
    ev.setTag(BOOKING_TAG, b.email);
    ev.setTag(BOOKED_AT_TAG, String(Date.now()));
    ev.removeAllReminders();
    SETTINGS.REMINDER_MINUTES.forEach((m) => ev.addPopupReminder(m));

    if (SETTINGS.NOTIFY_LUKE) {
      MailApp.sendEmail({
        to: Session.getEffectiveUser().getEmail(),
        replyTo: b.email,
        subject: `New booking: ${b.name} — ${b.when}`,
        body: description,
      });
    }
    return json_({ ok: true, id: ev.getId() });
  } catch (x) {
    return json_({ ok: false, error: "server", detail: String(x) });
  } finally {
    lock.releaseLock();
  }
}

/* ---------- admin (time off) ---------- */

function admin_(b) {
  const real = PropertiesService.getScriptProperties().getProperty("ADMIN_PASSWORD");
  if (!real || b.password !== real) { // not set up yet → admin stays locked
    Utilities.sleep(800); // slow down password guessing
    return json_({ ok: false, error: "bad_password" });
  }
  const tz = Session.getScriptTimeZone();
  const cal = cal_();

  if (b.action === "verify") return json_({ ok: true });

  if (b.action === "listBlocks") {
    const now = new Date(), until = new Date(now.getTime() + 180 * 86400000);
    const blocks = cal.getEvents(now, until)
      .filter((ev) => ev.getTag(BLOCK_TAG))
      .map((ev) => ({
        id: ev.getId(),
        note: ev.getDescription() || "",
        allDay: ev.isAllDayEvent(),
        date: Utilities.formatDate(ev.getStartTime(), tz, "yyyy-MM-dd"),
        // all-day end dates are exclusive in Google Calendar; report the last day inclusive
        lastDate: Utilities.formatDate(new Date(ev.getEndTime().getTime() - (ev.isAllDayEvent() ? 1 : 0)), tz, "yyyy-MM-dd"),
        start: Utilities.formatDate(ev.getStartTime(), tz, "HH:mm"),
        end: Utilities.formatDate(ev.getEndTime(), tz, "HH:mm"),
      }));
    return json_({ ok: true, blocks });
  }

  if (b.action === "block") {
    const re = /^\d{4}-\d{2}-\d{2}$/;
    if (!re.test(b.from) || !re.test(b.to) || b.to < b.from) return json_({ ok: false, error: "bad_dates" });
    const title = `Unavailable${b.note ? " · " + b.note : ""}`;
    const first = Utilities.parseDate(b.from, tz, "yyyy-MM-dd");
    const created = [];
    if (b.allDay) {
      const endExclusive = Utilities.parseDate(nextKey_(b.to), tz, "yyyy-MM-dd");
      const ev = cal.createAllDayEvent(title, first, endExclusive, { description: b.note || "" });
      ev.setTag(BLOCK_TAG, "1");
      created.push(ev.getId());
    } else {
      if (!/^\d{2}:\d{2}$/.test(b.start) || !/^\d{2}:\d{2}$/.test(b.end) || b.end <= b.start) {
        return json_({ ok: false, error: "bad_times" });
      }
      // Same time window on each day in the range (e.g. "busy 9–1 every day Mon–Wed").
      for (let key = b.from, n = 0; key <= b.to && n < 60; key = nextKey_(key), n++) {
        const ev = cal.createEvent(title,
          Utilities.parseDate(`${key} ${b.start}`, tz, "yyyy-MM-dd HH:mm"),
          Utilities.parseDate(`${key} ${b.end}`, tz, "yyyy-MM-dd HH:mm"),
          { description: b.note || "" });
        ev.setTag(BLOCK_TAG, "1");
        created.push(ev.getId());
      }
    }
    return json_({ ok: true, ids: created });
  }

  if (b.action === "saveTerms") {
    const err = validateTerms_(b.terms);
    if (err) return json_({ ok: false, error: err });
    PropertiesService.getScriptProperties().setProperty("terms", JSON.stringify(b.terms));
    return json_({ ok: true });
  }

  if (b.action === "unblock") {
    const ev = cal.getEventById(b.id);
    if (!ev || !ev.getTag(BLOCK_TAG)) return json_({ ok: false, error: "not_found" }); // never deletes real bookings
    ev.deleteEvent();
    return json_({ ok: true });
  }

  return json_({ ok: false, error: "unknown_action" });
}

/* ---------- class schedule (saved from the admin page) ---------- */

function getTerms_() {
  const raw = PropertiesService.getScriptProperties().getProperty("terms");
  return raw ? JSON.parse(raw) : null; // null → site uses the schedule in config.js
}

function validateTerms_(terms) {
  const day = /^\d{4}-\d{2}-\d{2}$/, time = /^\d{2}:\d{2}$/;
  if (!Array.isArray(terms) || !terms.length || terms.length > 12) return "bad_terms";
  for (const t of terms) {
    if (!t || typeof t.name !== "string" || !t.name.trim()) return "bad_term_name";
    if ((t.start && !day.test(t.start)) || (t.end && !day.test(t.end))) return "bad_term_dates";
    if (t.classes === null) continue; // "not entered yet" → closed for booking
    if (!Array.isArray(t.classes) || t.classes.length > 20) return "bad_classes";
    for (const c of t.classes) {
      if (!c || typeof c.name !== "string" || !Array.isArray(c.days) || !c.days.every((d) => d >= 0 && d <= 6)) return "bad_class";
      if (!time.test(c.start) || !time.test(c.end) || c.end <= c.start) return "bad_class_time";
    }
  }
  return null;
}

/* ---------- reminders ---------- */

// Run this ONCE from the Apps Script editor (select it → Run). It schedules sendReminders hourly.
function installReminders() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === "sendReminders")
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("sendReminders").timeBased().everyHours(1).create();
}

// Emails each client ~24h before their cut. Skips bookings made less than a day ahead
// (they just booked; no need) and never sends twice.
function sendReminders() {
  const tz = Session.getScriptTimeZone();
  const now = Date.now();
  const events = cal_().getEvents(new Date(now), new Date(now + 25 * 3600e3));
  events.forEach((ev) => {
    const email = ev.getTag(BOOKING_TAG);
    if (!email || ev.getTag(REMINDED_TAG)) return;
    const start = ev.getStartTime().getTime();
    const bookedAt = +ev.getTag(BOOKED_AT_TAG) || 0;
    if (start - bookedAt < 24 * 3600e3) { ev.setTag(REMINDED_TAG, "skipped"); return; }
    if (start - now > 24 * 3600e3) return; // not yet — next hourly run will catch it

    const when = Utilities.formatDate(ev.getStartTime(), tz, "EEEE, MMM d 'at' h:mm a");
    const service = ev.getTitle().split(" with Luke Dickinson")[0];
    MailApp.sendEmail({
      to: email,
      name: "Luke Dickinson",
      subject: `Reminder: your cut tomorrow at ${Utilities.formatDate(ev.getStartTime(), tz, "h:mm a")}`,
      body: [`See you ${when} for ${service}.`, "", ...clientInfo_(), "", "— Luke"].join("\n"),
    });
    ev.setTag(REMINDED_TAG, String(now));
  });
}

/* ---------- helpers ---------- */

function getBusy_() {
  const tz = Session.getScriptTimeZone();
  const now = new Date();
  const until = new Date(now.getTime() + SETTINGS.DAYS_AHEAD * 86400000);
  const out = [];
  cal_().getEvents(now, until).forEach((ev) => {
    // Split each event into per-day [date, startMin, duration] pieces (handles all-day + overnight).
    let s = ev.getStartTime(), e = ev.getEndTime();
    while (s < e) {
      const dayKey = Utilities.formatDate(s, tz, "yyyy-MM-dd");
      const nextMidnight = Utilities.parseDate(nextKey_(dayKey), tz, "yyyy-MM-dd");
      const pieceEnd = e < nextMidnight ? e : nextMidnight;
      const startMin = +Utilities.formatDate(s, tz, "H") * 60 + +Utilities.formatDate(s, tz, "m");
      out.push({ date: dayKey, start: startMin, duration: Math.round((pieceEnd - s) / 60000) });
      s = pieceEnd;
    }
  });
  return out;
}

function validate_(b) {
  if (!b || typeof b !== "object") return "bad_request";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date)) return "bad_date";
  if (!(b.start >= 0 && b.start < 1440)) return "bad_time";
  if (!(b.duration > 0 && b.duration <= 240)) return "bad_duration";
  if (!b.name || String(b.name).length > 100) return "bad_name";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email || "")) return "bad_email";
  if (String(b.phone || "").replace(/\D/g, "").length < 10) return "bad_phone";
  return null;
}

function cal_() {
  return SETTINGS.CALENDAR_ID === "primary"
    ? CalendarApp.getDefaultCalendar()
    : CalendarApp.getCalendarById(SETTINGS.CALENDAR_ID);
}

// "2026-11-08" → "2026-11-09", using calendar dates only (immune to daylight-saving shifts).
function nextKey_(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

function hhmm_(min) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
