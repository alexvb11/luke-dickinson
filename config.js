/* ============================================================
   SITE CONFIG — edit this file to change hours, prices, classes.
   Everything marked TODO is a placeholder waiting on Luke.
   ============================================================ */
window.SITE_CONFIG = {
  barber: {
    name: "Luke Dickinson",
    instagram: "",           // TODO e.g. "lukecutz" (no @) — shown in footer if set
    phone: "(574) 242-0325", // footer + "text to reschedule" line
    email: "",               // bookings are emailed here only if nothing else is connected
    // Public text only. The real address lives in apps-script/Code.gs (LOCATION), which is
    // private and only goes out in the calendar invite + reminder after someone books.
    location: "Address provided upon booking",
    payment: "Cash or Venmo", // shown on services + confirmation
  },

  // Full public URL once the site is live (used for link previews in texts / Instagram).
  siteUrl: "",               // TODO e.g. "https://lukedickinson.com"

  // Services clients can pick. duration is in minutes.
  services: [
    { id: "cut",       name: "The Cut",          desc: "Fade or taper, scissor work up top, styled.", duration: 45, price: 30 },
    { id: "cut-beard", name: "Cut + Beard",      desc: "Full cut plus beard shape-up and line.",      duration: 60, price: 40 },
    { id: "lineup",    name: "Line-Up / Clean-Up", desc: "Edges, neckline, and a fresh taper between cuts.", duration: 20, price: 15 },
  ],

  // When Luke is willing to cut, by weekday (0 = Sunday … 6 = Saturday).
  // Each day is a list of [start, end] windows in 24h "HH:MM". TODO: confirm with Luke.
  workingHours: {
    0: [["12:00", "18:00"]],
    1: [["09:00", "21:00"]],
    2: [["09:00", "21:00"]],
    3: [["09:00", "21:00"]],
    4: [["09:00", "21:00"]],
    5: [["09:00", "21:00"]],
    6: [["10:00", "18:00"]],
  },

  // Class schedule by term. Dates are inclusive; null start/end = open-ended.
  // Days between terms (winter break) have no classes.
  // classes: null means "not entered yet" — those days are CLOSED for booking until Luke
  // adds the schedule (admin panel → Classes) or saves it with no classes.
  // Once the calendar script is connected, schedules saved in the admin panel override these.
  terms: [
    {
      name: "Fall 2026", start: null, end: "2026-12-18",
      classes: [
        { name: "ECON 47100", days: [1, 3, 5], start: "11:30", end: "12:20" },
        { name: "STRT 45900", days: [1, 3, 5], start: "12:30", end: "13:20" },
        { name: "PES 11600",  days: [2, 4],    start: "13:30", end: "14:45" },
        { name: "MIS 38200",  days: [2, 4],    start: "15:00", end: "16:15" },
        { name: "QM 30600",   days: [2, 4],    start: "16:30", end: "17:45" },
      ],
    },
    { name: "Spring 2027", start: "2027-01-11", end: null, classes: null },
  ],

  classBufferBeforeMinutes: 45, // time to wrap a cut and get to class
  classBufferAfterMinutes: 45,  // time to get home from class and set up
  apptBufferMinutes: 10,    // cleanup between clients
  slotStepMinutes: 30,      // spacing between offered start times
  minNoticeHours: 2,        // no same-hour surprise bookings
  daysAhead: 21,            // how far out clients can book
  blackoutDates: [],        // ["2026-11-26"] — days off (or use the admin panel)

  // Gallery photos (in order). Drop new files in assets/ and add a line here.
  gallery: [
    { src: "assets/cut-taper-side.webp",    caption: "Low taper · textured fringe" },
    { src: "assets/cut-taper-back.webp",    caption: "Burst taper · messy crop" },
    { src: "assets/cut-textured-fade.webp", caption: "Drop fade · spiked texture" },
  ],

  // Client reviews. The section stays hidden until there's at least one real review.
  reviews: [
    // { quote: "Best fade I've had on campus.", name: "Jake M." },
  ],

  // Google Apps Script web-app URL (apps-script/Code.gs). When set, each booking lands on
  // Luke's Google Calendar, the client gets a calendar invite by email, and anything already
  // on Luke's calendar is hidden from the site. Takes priority over Formspree. See README.md.
  calendarScriptUrl: "", // TODO e.g. "https://script.google.com/macros/s/AKfy.../exec"

  // Hidden admin page (tiny button at the very bottom of the footer).
  // SHA-256 of the admin password — currently "dickinson". With calendarScriptUrl set, the real
  // check happens in apps-script/Code.gs (ADMIN_PASSWORD) and this hash is unused.
  // New hash: run   printf %s 'newpassword' | shasum -a 256
  adminPasswordHash: "8292713bf28f92a4ad9d00a710ea80018a962b4cb59644a28aa500a09c7bee9c",

  // Formspree form URL (fallback if calendarScriptUrl is blank) — emails Luke each booking.
  bookingEndpoint: "", // e.g. "https://formspree.io/f/abcdwxyz"
};
