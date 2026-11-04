/* ============================================================
   Availability engine.
   free time = working hours − (classes ± buffer) − existing bookings
   Times are minutes-since-midnight in the visitor's local time.
   ============================================================ */
(function () {
  const toMin = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
  const pad = (n) => String(n).padStart(2, "0");
  const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fromKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };

  // Subtract a list of [s,e] blocks from a list of [s,e] windows.
  function subtract(windows, blocks) {
    let out = windows.map((w) => [...w]);
    for (const [bs, be] of blocks) {
      const next = [];
      for (const [ws, we] of out) {
        if (be <= ws || bs >= we) { next.push([ws, we]); continue; }
        if (bs > ws) next.push([ws, bs]);
        if (be < we) next.push([be, we]);
      }
      out = next;
    }
    return out;
  }

  // The term (semester) a date falls in, or null on breaks.
  function termFor(cfg, key) {
    return (cfg.terms || []).find((t) => (!t.start || key >= t.start) && (!t.end || key <= t.end)) || null;
  }

  // Busy blocks (with buffers) for a given date.
  function busyBlocks(cfg, date, bookings) {
    const key = dateKey(date);
    const dow = date.getDay();
    const blocks = [];
    const term = termFor(cfg, key);
    for (const c of (term && term.classes) || []) {
      if (c.days.includes(dow)) {
        blocks.push([toMin(c.start) - cfg.classBufferBeforeMinutes, toMin(c.end) + cfg.classBufferAfterMinutes]);
      }
    }
    for (const b of bookings) {
      if (b.date === key) {
        blocks.push([b.start - cfg.apptBufferMinutes, b.start + b.duration + cfg.apptBufferMinutes]);
      }
    }
    return blocks;
  }

  /** Returns available start times (minutes) for a date + service duration. */
  function slotsFor(cfg, date, duration, bookings = [], now = new Date()) {
    const key = dateKey(date);
    if ((cfg.blackoutDates || []).includes(key)) return [];
    // A term whose class schedule hasn't been entered yet stays closed (never guess around classes).
    const term = termFor(cfg, key);
    if (term && term.classes == null) return [];
    const hours = (cfg.workingHours[date.getDay()] || []).map(([s, e]) => [toMin(s), toMin(e)]);
    if (!hours.length) return [];

    let free = subtract(hours, busyBlocks(cfg, date, bookings));

    // Respect minimum notice for today/near-term.
    const earliest = new Date(now.getTime() + cfg.minNoticeHours * 3600e3);
    if (dateKey(earliest) > key) return [];
    if (dateKey(earliest) === key) {
      const cut = earliest.getHours() * 60 + earliest.getMinutes();
      free = subtract(free, [[0, cut]]);
    }

    const step = cfg.slotStepMinutes;
    const slots = [];
    for (const [s, e] of free) {
      // Start on the next clean quarter-hour so times look human (2:00, 2:15 …).
      let t = Math.ceil(s / 15) * 15;
      for (; t + duration <= e; t += step) slots.push(t);
    }
    return slots;
  }

  function fmt(min) {
    const h = Math.floor(min / 60), m = min % 60;
    const ap = h >= 12 ? "pm" : "am";
    const h12 = ((h + 11) % 12) + 1;
    return m ? `${h12}:${pad(m)}${ap}` : `${h12}${ap}`;
  }

  window.Scheduler = { slotsFor, termFor, fmt, dateKey, fromKey, toMin, subtract };
})();
