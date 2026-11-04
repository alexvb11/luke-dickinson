/* ============================================================
   Hidden admin area: Luke blocks off time (vacations, busy days).
   - Connected (calendarScriptUrl set): time off is saved as events on Luke's
     Google Calendar, so it applies for every visitor. Password is checked server-side.
   - Not connected: time off is saved in this browser only (handy for previewing).
   ============================================================ */
(function () {
  const CFG = window.SITE_CONFIG;
  const S = window.Scheduler;
  const $ = (s, r = document) => r.querySelector(s);
  const remote = !!CFG.calendarScriptUrl;
  const SESSION = "ld_admin_session";
  const LOCAL = "ld_blocks_v1";

  /* ---------- local (this-browser) time off ---------- */
  const loadLocal = () => { try { return JSON.parse(localStorage.getItem(LOCAL)) || []; } catch { return []; } };
  const saveLocal = (b) => localStorage.setItem(LOCAL, JSON.stringify(b));
  const nextKey = (k) => { const d = S.fromKey(k); d.setDate(d.getDate() + 1); return S.dateKey(d); };

  function localBusy() {
    if (remote) return [];
    const out = [];
    for (const b of loadLocal()) {
      for (let k = b.from, n = 0; k <= b.to && n < 120; k = nextKey(k), n++) {
        out.push(b.allDay
          ? { date: k, start: 0, duration: 1440 }
          : { date: k, start: S.toMin(b.start), duration: S.toMin(b.end) - S.toMin(b.start) });
      }
    }
    return out;
  }
  window.LDAdmin = { localBusy };

  // Class schedules saved in preview mode (connected mode gets them from the script instead).
  const LOCAL_TERMS = "ld_terms_v1";
  if (!remote) {
    try { const t = JSON.parse(localStorage.getItem(LOCAL_TERMS)); if (Array.isArray(t) && t.length) CFG.terms = t; } catch {}
  }
  if (!remote && (loadLocal().length || localStorage.getItem(LOCAL_TERMS)) && window.LD) window.LD.refresh();

  /* ---------- server calls ---------- */
  // Held in memory only while the panel is open; closing the panel forgets it.
  let password = null;
  sessionStorage.removeItem(SESSION); // clear any login left over from an older version
  async function call(payload) {
    const res = await fetch(CFG.calendarScriptUrl, { method: "POST", body: JSON.stringify({ ...payload, password }) });
    return res.json();
  }
  async function sha256(text) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  /* ---------- open / close ---------- */
  const lock = $("#lock"), admin = $("#admin");
  function show(el) { el.hidden = false; requestAnimationFrame(() => el.classList.add("open")); document.body.style.overflow = "hidden"; }
  function hide(el) {
    if (el === admin) password = null; // leaving the admin panel always locks it again
    el.classList.remove("open"); setTimeout(() => { el.hidden = true; }, 300); document.body.style.overflow = "";
  }

  $("#stealth").addEventListener("click", () => {
    $("#lockError").textContent = "";
    show(lock);
    setTimeout(() => lock.querySelector("input").focus(), 50);
  });
  document.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => hide(b.closest(".lock, .admin"))));
  // Clicking the dark area outside the box closes it too.
  [lock, admin].forEach((el) => el.addEventListener("mousedown", (e) => { if (e.target === el) hide(el); }));
  addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!lock.hidden) hide(lock);
    if (!admin.hidden) hide(admin);
  });

  $("#lockForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#lockError"), input = e.currentTarget.pw, btn = e.currentTarget.querySelector(".btn");
    err.textContent = "";
    btn.disabled = true;
    let ok = false;
    try {
      if (remote) {
        password = input.value;
        ok = (await call({ action: "verify" })).ok;
      } else {
        ok = (await sha256(input.value)) === CFG.adminPasswordHash;
        password = ok ? input.value : null;
      }
    } catch { err.textContent = "Couldn't reach the calendar — try again."; }
    btn.disabled = false;
    if (!ok) {
      password = null;
      if (!err.textContent) err.textContent = "Wrong password.";
      lock.querySelector(".lock__box").animate(
        [{ transform: "translateX(0)" }, { transform: "translateX(-10px)" }, { transform: "translateX(10px)" }, { transform: "translateX(0)" }],
        { duration: 300 });
      input.select();
      return;
    }
    input.value = "";
    hide(lock);
    setTimeout(openAdmin, 250);
  });

  $("#adminLogout").addEventListener("click", () => hide(admin));

  /* ---------- admin panel ---------- */
  const form = $("#blockForm"), list = $("#blockList"), blockErr = $("#blockError");
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const plus = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

  function openAdmin() {
    const banner = $("#adminBanner");
    banner.hidden = remote;
    banner.textContent = "Preview mode: the calendar script isn't connected yet, so changes you make here only apply in this browser. Once calendarScriptUrl is set in config.js, they save to your Google account and apply for everyone.";
    if (!form.from.value) setRange(today(), today());
    form.from.min = form.to.min = S.dateKey(today());
    syncAllDay();
    renderList();
    loadTerms();
    selectTab("timeoff");
    show(admin);
  }

  /* ---------- tabs ---------- */
  function selectTab(name) {
    document.querySelectorAll(".admin__tabs [data-tab]").forEach((t) => t.setAttribute("aria-selected", t.dataset.tab === name));
    document.querySelectorAll(".admin__pane").forEach((p) => { p.hidden = p.dataset.pane !== name; });
  }
  document.querySelectorAll(".admin__tabs [data-tab]").forEach((t) => t.addEventListener("click", () => selectTab(t.dataset.tab)));

  function setRange(a, b) { form.from.value = S.dateKey(a); form.to.value = S.dateKey(b); }
  form.from.addEventListener("change", () => { if (form.to.value < form.from.value) form.to.value = form.from.value; });
  form.querySelectorAll("[data-quick]").forEach((btn) => btn.addEventListener("click", () => {
    const t = today(), toSat = ((6 - t.getDay()) + 7) % 7 || 7;
    const sat = plus(t, toSat);
    ({
      today: () => setRange(t, t),
      tomorrow: () => setRange(plus(t, 1), plus(t, 1)),
      sat: () => setRange(sat, sat),
      weekend: () => setRange(sat, plus(sat, 1)),
    })[btn.dataset.quick]();
    form.allDay.checked = true; syncAllDay();
  }));
  function syncAllDay() { form.classList.toggle("is-allday", form.allDay.checked); }
  form.allDay.addEventListener("change", syncAllDay);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    blockErr.textContent = "";
    const b = {
      from: form.from.value, to: form.to.value, allDay: form.allDay.checked,
      start: form.start.value, end: form.end.value, note: form.note.value.trim(),
    };
    if (!b.from || !b.to) return (blockErr.textContent = "Pick the dates.");
    if (b.to < b.from) return (blockErr.textContent = "The end date is before the start date.");
    if (!b.allDay && (!b.start || !b.end || b.end <= b.start)) return (blockErr.textContent = "\"Until\" has to be after \"Busy from\".");

    const btn = $("#blockBtn");
    btn.disabled = true; btn.textContent = "Saving…";
    try {
      if (remote) {
        const r = await call({ action: "block", ...b });
        if (!r.ok) throw new Error(r.error);
      } else {
        saveLocal([...loadLocal(), { id: Date.now().toString(36), ...b }]);
      }
      form.note.value = "";
      await Promise.all([renderList(), window.LD.refresh()]);
    } catch (x) {
      blockErr.textContent = x.message === "bad_password" ? "Session expired — log out and back in." : "Couldn't save that — try again.";
    }
    btn.disabled = false; btn.textContent = "Block off";
  });

  const fmtDay = (k) => S.fromKey(k).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const fmtTime = (hhmm) => S.fmt(S.toMin(hhmm));

  async function renderList() {
    list.innerHTML = `<li class="admin__empty">Loading…</li>`;
    let items = [];
    try {
      if (remote) {
        const r = await call({ action: "listBlocks" });
        if (!r.ok) throw new Error(r.error);
        items = r.blocks.map((x) => ({ id: x.id, from: x.date, to: x.lastDate, allDay: x.allDay, start: x.start, end: x.end, note: x.note }));
      } else {
        const todayKey = S.dateKey(today());
        items = loadLocal().filter((x) => x.to >= todayKey);
      }
    } catch {
      list.innerHTML = `<li class="admin__empty">Couldn't load your time off.</li>`;
      return;
    }
    items.sort((a, b) => (a.from + (a.allDay ? "" : a.start)).localeCompare(b.from + (b.allDay ? "" : b.start)));
    if (!items.length) { list.innerHTML = `<li class="admin__empty">Nothing blocked off. Every open slot is bookable.</li>`; return; }

    list.innerHTML = "";
    for (const x of items) {
      const li = document.createElement("li");
      const days = x.from === x.to ? fmtDay(x.from) : `${fmtDay(x.from)} – ${fmtDay(x.to)}`;
      const when = x.allDay ? "All day" : `${fmtTime(x.start)} – ${fmtTime(x.end)}`;
      li.innerHTML = `<div><b></b><span></span></div><button type="button">Remove</button>`;
      li.querySelector("b").textContent = days;
      li.querySelector("span").textContent = x.note ? `${when} · ${x.note}` : when;
      li.querySelector("button").addEventListener("click", async (ev) => {
        ev.currentTarget.disabled = true; ev.currentTarget.textContent = "Removing…";
        try {
          if (remote) {
            const r = await call({ action: "unblock", id: x.id });
            if (!r.ok) throw new Error(r.error);
          } else {
            saveLocal(loadLocal().filter((y) => y.id !== x.id));
          }
        } catch { /* fall through to re-render, which shows the true state */ }
        await Promise.all([renderList(), window.LD.refresh()]);
      });
      list.appendChild(li);
    }
  }

  /* ---------- classes (schedule per semester) ---------- */
  const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monFirst = (d) => (d === 0 ? 7 : d);
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const termSel = $("#termSelect"), classList = $("#classList"), termErr = $("#termError");
  const classForm = $("#classForm"), classErr = $("#classError");
  let terms = [], termIdx = 0;
  const cur = () => terms[termIdx];

  function loadTerms() {
    terms = clone(CFG.terms || []);
    if (!terms.length) terms.push({ name: "Current semester", start: null, end: null, classes: null });
    const k = S.dateKey(today()); // open on the semester we're in (or the next one)
    termIdx = Math.max(0, terms.findIndex((t) => !t.end || k <= t.end));
    termErr.textContent = "";
    renderTerm();
  }

  function renderTerm() {
    termSel.innerHTML = "";
    terms.forEach((t, i) => termSel.add(new Option(t.name || "Untitled", i)));
    termSel.value = termIdx;
    const t = cur();
    $("#termName").value = t.name || "";
    $("#termStart").value = t.start || "";
    $("#termEnd").value = t.end || "";
    const status = $("#termStatus");
    status.textContent = t.classes == null
      ? "Not entered yet. Days in this semester are closed for booking until you add classes (or pick “No classes this semester”) and save."
      : t.classes.length ? "" : "No classes this semester, so every day is open within your hours.";
    status.classList.toggle("warn", t.classes == null);

    const cls = (t.classes || []).slice().sort((a, b) =>
      monFirst(Math.min(...a.days.map(monFirst))) - monFirst(Math.min(...b.days.map(monFirst))) || a.start.localeCompare(b.start));
    classList.innerHTML = "";
    if (!cls.length) classList.innerHTML = `<li class="admin__empty">No classes added.</li>`;
    cls.forEach((c) => {
      const li = document.createElement("li");
      li.innerHTML = `<div><b></b><span></span></div><button type="button">Remove</button>`;
      li.querySelector("b").textContent = c.name;
      li.querySelector("span").textContent =
        `${c.days.slice().sort((a, b) => monFirst(a) - monFirst(b)).map((d) => DAY[d]).join(" ")} · ${fmtTime(c.start)} – ${fmtTime(c.end)}`;
      li.querySelector("button").addEventListener("click", () => {
        t.classes = t.classes.filter((x) => x !== c);
        renderTerm();
      });
      classList.appendChild(li);
    });
  }

  termSel.addEventListener("change", () => { termIdx = +termSel.value; renderTerm(); });
  $("#termName").addEventListener("input", (e) => { cur().name = e.target.value; termSel.options[termIdx].text = e.target.value || "Untitled"; });
  $("#termStart").addEventListener("change", (e) => { cur().start = e.target.value || null; });
  $("#termEnd").addEventListener("change", (e) => { cur().end = e.target.value || null; });

  classForm.addEventListener("submit", (e) => {
    e.preventDefault();
    classErr.textContent = "";
    const name = classForm.name.value.trim();
    const days = [...document.querySelectorAll("#dayPick input:checked")].map((i) => +i.value);
    const start = classForm.start.value, end = classForm.end.value;
    if (!name) return (classErr.textContent = "Give the class a name.");
    if (!days.length) return (classErr.textContent = "Pick at least one day.");
    if (!start || !end || end <= start) return (classErr.textContent = "The end time has to be after the start time.");
    (cur().classes = cur().classes || []).push({ name, days, start, end });
    classForm.name.value = "";
    document.querySelectorAll("#dayPick input").forEach((i) => { i.checked = false; });
    renderTerm();
    classForm.name.focus();
  });

  $("#noClasses").addEventListener("click", () => { cur().classes = []; renderTerm(); });
  $("#addTerm").addEventListener("click", () => {
    terms.push({ name: "New semester", start: null, end: null, classes: null });
    termIdx = terms.length - 1;
    renderTerm();
    $("#termName").select();
  });

  function validateTerms() {
    const sorted = terms.slice().sort((a, b) => (a.start || "").localeCompare(b.start || ""));
    for (const t of sorted) {
      if (!t.name || !t.name.trim()) return "Every semester needs a name.";
      if (t.start && t.end && t.end < t.start) return `“${t.name}” ends before it starts.`;
    }
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1], b = sorted[i];
      if (!a.end || !b.start || b.start <= a.end) return `“${a.name}” and “${b.name}” overlap. Check their first/last days.`;
    }
    return null;
  }

  $("#saveTerms").addEventListener("click", async (e) => {
    termErr.textContent = "";
    const bad = validateTerms();
    if (bad) return (termErr.textContent = bad);
    const btn = e.currentTarget;
    btn.disabled = true; btn.textContent = "Saving…";
    try {
      if (remote) {
        const r = await call({ action: "saveTerms", terms });
        if (!r.ok) throw new Error(r.error);
      } else {
        localStorage.setItem(LOCAL_TERMS, JSON.stringify(terms));
      }
      CFG.terms = clone(terms);
      await window.LD.refresh();
      btn.textContent = "Saved ✓";
      setTimeout(() => { btn.textContent = "Save schedule"; }, 1600);
    } catch (x) {
      termErr.textContent = x.message === "bad_password" ? "Session expired — log out and back in." : "Couldn't save that — try again.";
      btn.textContent = "Save schedule";
    }
    btn.disabled = false;
  });
})();
