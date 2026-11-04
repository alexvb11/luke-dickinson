(function () {
  const CFG = window.SITE_CONFIG;
  const S = window.Scheduler;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const range = (p, a, b) => clamp((p - a) / (b - a)); // remap p∈[a,b] → [0,1]
  const ease = (t) => 1 - Math.pow(1 - t, 3);            // easeOutCubic
  const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  /* ===========================================================
     CONTENT FROM CONFIG — gallery cards + reviews
     (built first so the scroll scenes below measure the real track)
     =========================================================== */
  (function buildGallery() {
    const end = $(".work__end");
    (CFG.gallery || []).forEach((g, i) => {
      const fig = document.createElement("figure");
      fig.className = "work__card" + (i % 2 ? " work__card--offset" : "");
      fig.innerHTML = `<div class="work__img"><img src="${esc(g.src)}" alt="${esc(g.caption)}" loading="${i < 3 ? "eager" : "lazy"}" /></div>
        <figcaption><span>${String(i + 1).padStart(2, "0")}</span>${esc(g.caption)}</figcaption>`;
      end.before(fig);
    });
  })();
  (function buildReviews() {
    const list = CFG.reviews || [];
    if (!list.length) return; // section stays hidden until there are real reviews
    const ul = $("#reviewsList");
    list.forEach((r) => {
      const li = document.createElement("li");
      li.className = "review reveal";
      li.innerHTML = `<blockquote>“${esc(r.quote)}”</blockquote><cite>${esc(r.name)}</cite>`;
      ul.appendChild(li);
    });
    $("#reviews").hidden = false;
  })();

  /* ===========================================================
     SCROLL SCENES — each pinned section maps scroll → progress,
     smoothed with a lerp so motion glides instead of stepping.
     =========================================================== */
  const scenes = [];
  function scene(el, render) {
    const s = { el, render, target: 0, cur: 0 };
    scenes.push(s);
    return s;
  }
  function measure(s) {
    const r = s.el.getBoundingClientRect();
    const total = r.height - innerHeight;
    s.target = total > 0 ? clamp(-r.top / total) : 0;
  }

  // ---------- HERO ----------
  const hero = $('[data-scene="hero"]');
  const cards = $$(".hero__card", hero);
  const heroTitle = $(".hero__title", hero);
  const tagWords = $$(".hero__tagline span", hero);
  const hint = $(".hero__hint", hero);
  scene(hero, (p) => {
    const vw = innerWidth / 100, vh = innerHeight / 100;
    const narrow = innerWidth < 700;
    const spread = narrow ? 31 * vw : Math.min(28 * vw, 400);
    cards.forEach((card, i) => {
      const k = i - 1; // -1, 0, 1
      const t = easeIO(range(p, 0.02 + i * 0.07, 0.55 + i * 0.05));
      const x = lerp(k * 6 * vw, k * spread, t);
      const y = lerp(115 * vh + i * 8 * vh, (k === 0 ? -3 : 5) * vh, t);
      const r = lerp(k * -18 + 4, k * 6, t);
      const sc = lerp(0.8, k === 0 ? 1.08 : 0.96, t);
      // gentle drift after landing, so they never fully stop
      const drift = range(p, 0.6, 1) * (k === 0 ? -2 : -4 - i) * vh;
      card.style.transform = `translate3d(${x}px, ${y + drift}px, 0) rotate(${r}deg) scale(${sc})`;
      card.firstElementChild.style.transform = `scale(${lerp(1.3, 1.02, t)})`;
    });
    const tp = ease(range(p, 0, 0.6));
    heroTitle.style.transform = `translate3d(0, ${lerp(0, -14, tp) * vh}px, 0) scale(${lerp(1, 0.78, tp)})`;
    heroTitle.style.opacity = lerp(1, 0.22, tp);
    tagWords.forEach((w, i) => {
      const t = ease(range(p, 0.55 + i * 0.07, 0.75 + i * 0.07));
      w.style.opacity = t;
      w.style.transform = `translateY(${lerp(30, 0, t)}px)`;
    });
    hint.style.opacity = 1 - range(p, 0, 0.06);
  });

  // ---------- DETAIL ----------
  const detail = $('[data-scene="detail"]');
  const frame = $(".detail__frame", detail);
  const frameImg = $("img", frame);
  const words = $$(".detail__words > *", detail);
  scene(detail, (p) => {
    const narrow = innerWidth < 700;
    const t = easeIO(range(p, 0, 0.55));
    const iy = lerp(narrow ? 24 : 26, 0, t), ix = lerp(narrow ? 18 : 37, 0, t);
    const rad = lerp(24, 0, t);
    frame.style.clipPath = `inset(${iy}% ${ix}% round ${rad}px)`;
    frameImg.style.transform = `scale(${lerp(1.4, 1.02, t)}) translateY(${lerp(0, -3, p)}%)`;
    words.forEach((w, i) => {
      const k = ease(range(p, 0.5 + i * 0.08, 0.72 + i * 0.08));
      w.style.opacity = k;
      w.style.transform = `translateY(${lerp(50, 0, k)}px)`;
    });
  });

  // ---------- WORK (horizontal) ----------
  const work = $('[data-scene="work"]');
  const track = $(".work__track", work);
  const bar = $(".work__progress span", work);
  const workImgs = $$(".work__img img", work);
  let travel = 0;
  function sizeWork() {
    travel = Math.max(0, track.scrollWidth - innerWidth);
    work.style.height = `${travel + innerHeight * 1.4}px`;
  }
  scene(work, (p) => {
    const x = -travel * easeIO(range(p, 0.08, 0.92));
    track.style.transform = `translate3d(${x}px, 0, 0)`;
    bar.style.transform = `scaleX(${p})`;
    const mid = innerWidth / 2;
    workImgs.forEach((img) => {
      const r = img.parentElement.getBoundingClientRect();
      const off = (r.left + r.width / 2 - mid) / innerWidth; // -1..1-ish
      img.style.transform = `translate3d(${off * -12}%, 0, 0) scale(1.05)`;
    });
  });

  // ---------- Free-floating parallax (not pinned) ----------
  const aboutInner = $(".about__photo-inner");
  function parallax() {
    const r = aboutInner.parentElement.getBoundingClientRect();
    const t = clamp((innerHeight - r.top) / (innerHeight + r.height));
    aboutInner.style.transform = `translate3d(0, ${lerp(-6, 6, t)}%, 0)`;
  }

  // ---------- Loop ----------
  const nav = $("#nav");
  let running = false;
  function tick() {
    let moving = false;
    for (const s of scenes) {
      measure(s);
      s.cur += (s.target - s.cur) * 0.14;
      if (Math.abs(s.target - s.cur) < 0.0004) s.cur = s.target; else moving = true;
      s.render(s.cur);
    }
    parallax();
    nav.classList.toggle("scrolled", scrollY > 40);
    running = moving;
    if (moving) requestAnimationFrame(tick);
  }
  function kick() { if (!running) { running = true; requestAnimationFrame(tick); } }

  if (!reduced) {
    sizeWork();
    addEventListener("scroll", kick, { passive: true });
    addEventListener("resize", () => { sizeWork(); kick(); });
    addEventListener("load", () => { sizeWork(); kick(); });
    // start already-settled at current scroll position (e.g. after refresh)
    scenes.forEach((s) => { measure(s); s.cur = s.target; s.render(s.cur); });
    kick();
  } else {
    addEventListener("scroll", () => nav.classList.toggle("scrolled", scrollY > 40), { passive: true });
  }

  /* ===========================================================
     REVEALS + COUNTERS
     =========================================================== */
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add("in");
      io.unobserve(e.target);
      $$("[data-count]", e.target).forEach(countUp);
    }
  }, { threshold: 0.18, rootMargin: "0px 0px -6% 0px" });
  function countUp(el) {
    const end = +el.dataset.count, suf = el.dataset.suffix || "";
    const t0 = performance.now(), dur = 1600;
    const step = (now) => {
      const t = ease(clamp((now - t0) / dur));
      el.textContent = Math.round(end * t) + suf;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ===========================================================
     SERVICES LIST
     =========================================================== */
  const money = (n) => `$${n}`;
  const servicesList = $("#servicesList");
  CFG.services.forEach((sv, i) => {
    const li = document.createElement("li");
    li.className = "service reveal";
    li.innerHTML = `
      <span class="service__n">0${i + 1}</span>
      <div class="service__name">${sv.name}<span class="service__desc">${sv.desc}</span></div>
      <span class="service__dur">${sv.duration} min</span>
      <span class="service__price">${money(sv.price)}</span>`;
    li.addEventListener("click", () => {
      selectService(sv.id);
      $("#book").scrollIntoView({ behavior: "smooth" });
    });
    servicesList.appendChild(li);
  });

  // Where + how to pay, under the menu.
  $("#servicesNote").textContent = [CFG.barber.location, CFG.barber.payment && `Payment: ${CFG.barber.payment}`]
    .filter(Boolean).join(" · ");

  /* ===========================================================
     BOOKING
     =========================================================== */
  // No way to deliver bookings yet → don't pretend to take them.
  const canBook = !!(CFG.calendarScriptUrl || CFG.bookingEndpoint || CFG.barber.email);
  if (!canBook) {
    $("#bookerClosed").hidden = false;
    $("#bookerClosedContact").textContent = CFG.barber.phone
      ? `Text Luke at ${CFG.barber.phone} to book in the meantime.`
      : "Check back shortly.";
    $("#booker").classList.add("closed");
  }
  const STORE = "ld_bookings_v1";
  const loadBookings = () => { try { return JSON.parse(localStorage.getItem(STORE)) || []; } catch { return []; } };
  const saveBookings = (b) => localStorage.setItem(STORE, JSON.stringify(b));

  const state = { service: CFG.services[0], date: null, start: null, last: null };
  const chipsEl = $("#serviceChips"), daysEl = $("#days"), slotsEl = $("#slots");
  const summary = $("#summary"), submitBtn = $("#submitBtn"), formErr = $("#formError");
  const dayLabel = $("#dayLabel");

  // Busy times pulled from Luke's Google Calendar (via apps-script/Code.gs).
  let remoteBusy = [];
  // + time off Luke saved on this device when the calendar script isn't connected (admin.js)
  const allBusy = () => [...loadBookings(), ...remoteBusy, ...(window.LDAdmin ? window.LDAdmin.localBusy() : [])];
  async function fetchBusy() {
    if (!CFG.calendarScriptUrl) return;
    try {
      const res = await fetch(`${CFG.calendarScriptUrl}?action=busy`);
      const data = await res.json();
      if (data.ok) {
        remoteBusy = data.busy;
        if (Array.isArray(data.terms) && data.terms.length) CFG.terms = data.terms; // saved in admin panel
        renderDays(); renderSlots(); renderSummary();
      }
    } catch { /* calendar unreachable: fall back to class schedule + local bookings */ }
  }

  function radio(btn, on) { btn.setAttribute("role", "radio"); btn.setAttribute("aria-checked", on ? "true" : "false"); }

  function renderChips() {
    chipsEl.innerHTML = "";
    CFG.services.forEach((sv) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "chip";
      radio(b, sv.id === state.service.id);
      b.innerHTML = `<b>${sv.name}</b><span>${sv.duration} min · ${money(sv.price)}</span>`;
      b.onclick = () => selectService(sv.id);
      chipsEl.appendChild(b);
    });
  }
  function selectService(id) {
    state.service = CFG.services.find((s) => s.id === id);
    state.start = null;
    renderChips(); renderDays(); renderSlots(); renderSummary();
  }

  function upcomingDays() {
    const out = [], base = new Date(); base.setHours(0, 0, 0, 0);
    for (let i = 0; i < CFG.daysAhead; i++) {
      const d = new Date(base); d.setDate(base.getDate() + i);
      out.push(d);
    }
    return out;
  }

  function renderDays() {
    const bookings = allBusy();
    daysEl.innerHTML = "";
    let firstOpen = null;
    upcomingDays().forEach((d, i) => {
      const key = S.dateKey(d);
      const n = S.slotsFor(CFG, d, state.service.duration, bookings).length;
      if (n && !firstOpen) firstOpen = key;
      const b = document.createElement("button");
      b.type = "button"; b.className = "day"; b.disabled = !n; b.dataset.key = key;
      radio(b, key === state.date);
      const wd = i === 0 ? "Today" : d.toLocaleDateString(undefined, { weekday: "short" });
      b.innerHTML = `<small>${wd}</small><b>${d.getDate()}</b><i>${n ? `${n} open` : "Full"}</i>`;
      b.onclick = () => { state.date = key; state.start = null; renderDays(); renderSlots(); renderSummary(); };
      daysEl.appendChild(b);
    });
    // keep a valid day selected
    const selBtn = state.date && daysEl.querySelector(`[data-key="${state.date}"]`);
    if (!selBtn || selBtn.disabled) {
      state.date = firstOpen;
      if (firstOpen) radio(daysEl.querySelector(`[data-key="${firstOpen}"]`), true);
    }
  }
  $("#daysPrev").onclick = () => daysEl.scrollBy({ left: -88 * 4 });
  $("#daysNext").onclick = () => daysEl.scrollBy({ left: 88 * 4 });

  function renderSlots() {
    slotsEl.innerHTML = "";
    if (!state.date) {
      dayLabel.textContent = "";
      slotsEl.innerHTML = `<p class="slots__empty">No openings in the next ${CFG.daysAhead} days — check back soon.</p>`;
      return;
    }
    const d = S.fromKey(state.date);
    dayLabel.textContent = "— " + d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
    const slots = S.slotsFor(CFG, d, state.service.duration, allBusy());
    const groups = [["Morning", (m) => m < 720], ["Afternoon", (m) => m >= 720 && m < 1020], ["Evening", (m) => m >= 1020]];
    let delay = 0;
    for (const [label, test] of groups) {
      const list = slots.filter(test);
      if (!list.length) continue;
      const g = document.createElement("div");
      g.className = "slots__group";
      g.innerHTML = `<h4>${label}</h4><div class="slots__grid"></div>`;
      const grid = g.lastElementChild;
      list.forEach((m) => {
        const b = document.createElement("button");
        b.type = "button"; b.className = "slot"; b.textContent = S.fmt(m);
        b.style.animationDelay = `${(delay++) * 18}ms`;
        radio(b, m === state.start);
        b.onclick = () => {
          state.start = m;
          $$(".slot", slotsEl).forEach((x) => radio(x, x === b));
          renderSummary();
        };
        grid.appendChild(b);
      });
      slotsEl.appendChild(g);
    }
  }

  function whenText() {
    const d = S.fromKey(state.date);
    return `${d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })} at ${S.fmt(state.start)}`;
  }
  function renderSummary() {
    const ready = state.service && state.date && state.start != null;
    submitBtn.disabled = !ready || !canBook;
    summary.innerHTML = ready
      ? `<strong>${state.service.name}</strong> · ${whenText()} · ${state.service.duration} min · <strong>${money(state.service.price)}</strong>`
      : "Choose a service, day, and time.";
  }

  $("#bookForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    formErr.textContent = "";
    if (!canBook) return;
    const f = e.currentTarget;
    const name = f.name.value.trim(), phone = f.phone.value.trim(), notes = f.notes.value.trim();
    const email = f.email.value.trim();
    f.name.classList.toggle("invalid", !name);
    const phoneOk = phone.replace(/\D/g, "").length >= 10;
    f.phone.classList.toggle("invalid", !phoneOk);
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    f.email.classList.toggle("invalid", !emailOk);
    if (!name || !phoneOk) { formErr.textContent = "Add your name and a 10-digit phone number."; return; }
    if (!emailOk) { formErr.textContent = "Add your email so we can send the calendar invite."; return; }

    // Re-check the slot is still free right before booking.
    const stillOpen = S.slotsFor(CFG, S.fromKey(state.date), state.service.duration, allBusy()).includes(state.start);
    if (!stillOpen) { formErr.textContent = "That time was just taken — pick another."; renderDays(); renderSlots(); renderSummary(); return; }

    const booking = {
      id: Date.now().toString(36),
      service: state.service.name, duration: state.service.duration, price: state.service.price,
      date: state.date, start: state.start, time: S.fmt(state.start),
      name, phone, email, notes, created: new Date().toISOString(),
    };

    submitBtn.disabled = true; submitBtn.textContent = "Booking…";
    let invited = false;
    try {
      if (CFG.calendarScriptUrl) {
        // No custom headers (text/plain) keeps this a "simple" request Apps Script accepts cross-origin.
        const res = await fetch(CFG.calendarScriptUrl, {
          method: "POST",
          // The real address is added by the script (kept off the public site).
          body: JSON.stringify({ ...booking, when: whenText() }),
        });
        const data = await res.json();
        if (!data.ok) {
          if (data.error === "taken" || data.error === "past") {
            formErr.textContent = "That time was just taken — pick another.";
            submitBtn.textContent = "Book";
            state.start = null;
            await fetchBusy(); renderDays(); renderSlots(); renderSummary();
            return;
          }
          throw new Error(data.error);
        }
        invited = true;
      } else if (CFG.bookingEndpoint) {
        const res = await fetch(CFG.bookingEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          // Keys become the row labels in Luke's email, so keep them human.
          body: JSON.stringify({
            _subject: `New booking: ${name} — ${whenText()}`,
            When: whenText(),
            Service: `${booking.service} (${booking.duration} min)`,
            Price: `$${booking.price}`,
            Name: name,
            Phone: phone,
            ...(email ? { email } : {}), // Formspree uses "email" as the reply-to address
            Notes: notes || "—",
          }),
        });
        if (!res.ok) throw new Error("bad status");
      } else if (CFG.barber.email) {
        const body = `Service: ${booking.service} (${booking.duration} min, $${booking.price})\nWhen: ${whenText()}\nName: ${name}\nPhone: ${phone}\nNotes: ${notes || "—"}`;
        location.href = `mailto:${CFG.barber.email}?subject=${encodeURIComponent("Booking request — " + whenText())}&body=${encodeURIComponent(body)}`;
      }
    } catch {
      formErr.textContent = "Couldn't send that — check your connection and try again.";
      submitBtn.disabled = false; submitBtn.textContent = "Book";
      return;
    }

    saveBookings([...loadBookings(), booking]);
    state.last = booking;
    if (invited) remoteBusy.push({ date: booking.date, start: booking.start, duration: booking.duration });
    $("#confirmText").textContent = invited
      ? `${booking.service} on ${whenText()}. A calendar invite with the address is on its way to ${email}.`
      : `${booking.service} on ${whenText()}. Luke will text ${phone} with the address.`;
    const info = [
      invited && "You'll get a reminder email the day before.",
      CFG.barber.payment && `Payment: ${CFG.barber.payment}`,
      CFG.barber.phone ? `Need to reschedule? Text Luke at ${CFG.barber.phone}.` : "Need to reschedule? Text Luke.",
    ].filter(Boolean);
    $("#confirmInfo").innerHTML = info.map((t) => `<li>${esc(t)}</li>`).join("");
    $("#gcalBtn").hidden = $("#icsBtn").hidden = invited;
    $("#booker").classList.add("done");
    $("#confirm").hidden = false;
    $("#booker").scrollIntoView({ behavior: "smooth", block: "center" });
    f.reset();
    submitBtn.textContent = "Book";
  });

  $("#againBtn").onclick = () => {
    $("#booker").classList.remove("done");
    $("#confirm").hidden = true;
    state.start = null;
    renderDays(); renderSlots(); renderSummary();
  };

  $("#gcalBtn").onclick = () => {
    const b = state.last; if (!b) return;
    const pad = (n) => String(n).padStart(2, "0");
    const stamp = (key, min) => `${key.replace(/-/g, "")}T${pad(Math.floor(min / 60))}${pad(min % 60)}00`;
    const q = new URLSearchParams({
      action: "TEMPLATE",
      text: `${b.service} with Luke Dickinson`,
      dates: `${stamp(b.date, b.start)}/${stamp(b.date, b.start + b.duration)}`,
      details: `${b.service} (${b.duration} min) — $${b.price}`,
      location: CFG.barber.location || "",
    });
    open(`https://calendar.google.com/calendar/render?${q}`, "_blank", "noopener");
  };

  $("#icsBtn").onclick = () => {
    const b = state.last; if (!b) return;
    const pad = (n) => String(n).padStart(2, "0");
    const stamp = (key, min) => `${key.replace(/-/g, "")}T${pad(Math.floor(min / 60))}${pad(min % 60)}00`;
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Luke Dickinson//Booking//EN", "BEGIN:VEVENT",
      `UID:${b.id}@lukedickinson`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
      `DTSTART:${stamp(b.date, b.start)}`, `DTEND:${stamp(b.date, b.start + b.duration)}`,
      `SUMMARY:${b.service} with Luke Dickinson`,
      CFG.barber.location ? `LOCATION:${CFG.barber.location}` : "",
      "END:VEVENT", "END:VCALENDAR",
    ].filter(Boolean).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    a.download = "luke-dickinson-appointment.ics";
    a.click();
  };

  renderChips(); renderDays(); renderSlots(); renderSummary();
  fetchBusy();

  // Lets the admin panel refresh availability after Luke blocks/unblocks time.
  window.LD = {
    refresh: async () => {
      state.start = null;
      await fetchBusy();
      renderDays(); renderSlots(); renderSummary();
    },
  };

  /* ===========================================================
     FOOTER
     =========================================================== */
  $("#year").textContent = new Date().getFullYear();
  $("#footLocation").textContent = CFG.barber.location || "";
  const contact = [];
  if (CFG.barber.instagram) contact.push(`<a href="https://instagram.com/${CFG.barber.instagram}" target="_blank" rel="noopener">@${CFG.barber.instagram}</a>`);
  if (CFG.barber.phone) contact.push(`<a href="tel:${CFG.barber.phone.replace(/\D/g, "")}">${CFG.barber.phone}</a>`);
  $("#footContact").innerHTML = contact.join(" · ") || "";

  // Observe reveals last so dynamically-added service rows are included.
  $$(".reveal").forEach((el) => io.observe(el));
})();
