/* Forkcast — single-file app logic. Drives the landing animations and the live
   planner, which runs the real overlap engine (window.FC) on the embedded POOL. */
(function () {
  "use strict";
  var FC = window.FC;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var money = function (c) { return "$" + (c / 100).toFixed(2); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (m) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[m]; }); };
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---------- Landing: reveal + count-up (scroll-driven, works everywhere) ---------- */
  function inView(el, m) {
    var r = el.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    return r.bottom > 0 && r.top < vh * (m || 0.92) && r.width > 0;
  }
  function runCount(el) {
    var to = parseFloat(el.getAttribute("data-to")) || 0;
    var dec = parseInt(el.getAttribute("data-decimals") || "0", 10);
    var pre = el.getAttribute("data-prefix") || "", suf = el.getAttribute("data-suffix") || "";
    var t0 = performance.now(), dur = 1400;
    el.textContent = pre + (0).toFixed(dec) + suf;
    (function tick(t) { var p = Math.min(1, (t - t0) / dur); var v = to * (1 - Math.pow(1 - p, 3)); el.textContent = pre + v.toFixed(dec) + suf; if (p < 1) requestAnimationFrame(tick); })(t0);
  }
  function revealCheck() {
    $$("[data-reveal]").forEach(function (n) { if (!n.hasAttribute("data-shown") && inView(n)) n.setAttribute("data-shown", ""); });
    if (!reduce) $$(".countup").forEach(function (n) { if (!n.dataset.ran && inView(n, 0.85)) { n.dataset.ran = "1"; runCount(n); } });
  }
  if (reduce) {
    $$("[data-reveal]").forEach(function (n) { n.setAttribute("data-shown", ""); });
  } else {
    revealCheck();
    window.addEventListener("scroll", revealCheck, { passive: true });
    window.addEventListener("resize", revealCheck);
  }

  /* ---------- Landing: scroll progress ---------- */
  (function () {
    var bar = $(".scroll-progress");
    if (!bar) return;
    var raf = 0;
    function update() { raf = 0; var h = document.documentElement; var max = h.scrollHeight - h.clientHeight; bar.style.setProperty("--p", max > 0 ? Math.min(1, h.scrollTop / max) : 0); }
    function onScroll() { if (!raf) raf = requestAnimationFrame(update); }
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
  })();

  /* ---------- Landing: hero 3D tilt ---------- */
  (function () {
    var scene = $("#hero-tilt-scene"), card = $("#hero-tilt");
    if (!scene || !card || reduce) return;
    scene.addEventListener("mousemove", function (e) {
      var r = card.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width - 0.5;
      var py = (e.clientY - r.top) / r.height - 0.5;
      card.style.setProperty("--ry", (px * 7).toFixed(2) + "deg");
      card.style.setProperty("--rx", (-py * 7).toFixed(2) + "deg");
    });
    scene.addEventListener("mouseleave", function () { card.style.setProperty("--ry", "0deg"); card.style.setProperty("--rx", "0deg"); });
  })();

  /* ---------- View switching: landing <-> planner ---------- */
  var landing = $("#view-landing"), planner = $("#view-planner");
  function showPlanner() {
    landing.hidden = true; planner.hidden = false;
    window.scrollTo(0, 0);
    if (!planner.dataset.init) { initPlanner(); planner.dataset.init = "1"; }
  }
  function showLanding() { planner.hidden = true; landing.hidden = false; window.scrollTo(0, 0); revealCheck(); }
  $$(".js-plan").forEach(function (b) { b.addEventListener("click", showPlanner); });

  /* ---------- Landing: waitlist (no server — local confirmation) ---------- */
  (function () {
    var form = $("#waitlist-form"); if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = $("#waitlist-email").value.trim();
      var msg = $("#waitlist-msg");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = "That doesn't look like an email."; return; }
      form.innerHTML = '<p class="flex items-center gap-2 text-sm font-medium text-oat"><span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-oat/15 text-xs">✓</span> You’re on the list. (This single-file demo saves locally only.)</p>';
      try { var k = "forkcast.waitlist"; var list = JSON.parse(localStorage.getItem(k) || "[]"); list.push({ email: email, at: Date.now() }); localStorage.setItem(k, JSON.stringify(list)); } catch {}
    });
  })();

  /* ================= PLANNER ================= */
  var DIET = [["none", "Anything"], ["vegetarian", "Vegetarian"], ["vegan", "Vegan"], ["pescatarian", "Pescatarian"]];
  var LOC_KEY = "forkcast.location";
  var state = { servings: 2, nights: 5, diet: "none", dislikes: "", budget: "", location: FC.LOCATION_OPTIONS[0].id, plan: null, anchorIndex: 0 };

  function initPlanner() {
    // location select
    var sel = $("#pref-location");
    sel.innerHTML = FC.LOCATION_OPTIONS.map(function (o) { return '<option value="' + esc(o.id) + '">' + esc(o.label) + "</option>"; }).join("");
    try { var saved = localStorage.getItem(LOC_KEY); if (saved && FC.LOCATION_OPTIONS.some(function (o) { return o.id === saved; })) state.location = saved; } catch {}
    sel.value = state.location;
    sel.addEventListener("change", function () { state.location = sel.value; try { localStorage.setItem(LOC_KEY, sel.value); } catch {} if (state.plan) renderStores(); });

    // servings stepper
    $$("#view-planner [data-step]").forEach(function (b) {
      b.addEventListener("click", function () {
        var d = parseInt(b.getAttribute("data-step"), 10);
        state.servings = Math.max(1, Math.min(8, state.servings + d));
        $("#servings-val").textContent = state.servings;
        $("#servings-suffix").textContent = state.servings === 1 ? "person" : "people";
      });
    });

    // nights segmented
    var segN = $("#seg-nights");
    segN.innerHTML = [3, 4, 5, 6].map(function (n) { return segBtn(String(n), String(n), state.nights === n); }).join("");
    segN.addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; state.nights = parseInt(b.dataset.v, 10); markSeg(segN, b); });

    // diet segmented
    var segD = $("#seg-diet");
    segD.innerHTML = DIET.map(function (d) { return segBtn(d[0], d[1], state.diet === d[0]); }).join("");
    segD.addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; state.diet = b.dataset.v; markSeg(segD, b); });

    $("#pref-dislikes").addEventListener("input", function (e) { state.dislikes = e.target.value; });
    $("#pref-budget").addEventListener("input", function (e) { e.target.value = e.target.value.replace(/[^0-9.]/g, ""); state.budget = e.target.value; });

    $("#btn-generate").addEventListener("click", function () { generate(0); });
    $("#regen").addEventListener("click", function () { generate(state.anchorIndex + 1); });
    $("#planner-home").addEventListener("click", showLanding);
    $("#planner-home-2").addEventListener("click", showLanding);
  }

  function segBtn(v, label, active) {
    var cls = active ? "border-brand bg-brand text-white shadow-sm" : "border-stone-300 bg-white text-stone-600 hover:border-brand/40";
    return '<button type="button" data-v="' + esc(v) + '" class="rounded-lg border px-3 py-1.5 text-sm font-medium transition ' + cls + '">' + esc(label) + "</button>";
  }
  function markSeg(root, btn) {
    $$("button", root).forEach(function (b) { b.className = "rounded-lg border px-3 py-1.5 text-sm font-medium transition border-stone-300 bg-white text-stone-600 hover:border-brand/40"; });
    btn.className = "rounded-lg border px-3 py-1.5 text-sm font-medium transition border-brand bg-brand text-white shadow-sm";
  }

  function generate(anchor) {
    state.anchorIndex = anchor;
    var prefs = {
      servings: state.servings,
      nights: state.nights,
      diet: state.diet,
      dislikes: state.dislikes.split(",").map(function (s) { return s.trim(); }).filter(Boolean),
    };
    if (state.budget) prefs.budgetCents = Math.round(parseFloat(state.budget) * 100);
    var err = $("#gen-error"); err.hidden = true;
    var plan;
    try { plan = FC.buildPlan(POOL, prefs, anchor); } catch { showError("Something went wrong generating the plan."); return; }
    if (!plan || !plan.meals.length) { showError("No recipes matched — try loosening your filters."); state.plan = null; return; }
    state.plan = plan;
    $("#btn-generate").textContent = "Make a new plan";
    $("#regen").hidden = false; $("#planner-home-2").classList.remove("hidden");
    renderResults();
  }
  function showError(m) { var err = $("#gen-error"); err.textContent = m; err.hidden = false; $("#results").innerHTML = ""; }

  function renderResults() {
    var p = state.plan;
    $("#results").innerHTML =
      '<div class="space-y-8">' +
        statStrip(p) +
        section("This week’s plan", p.meals.length + " dinners", planGrid(p)) +
        section("One grocery list", p.distinctIngredients + " items · " + money(p.totalCents), groceryCard(p)) +
        '<div id="stores-slot"></div>' +
        section("Sunday prep", "~" + p.prep.reduce(function (s, b) { return s + b.minutes; }, 0) + " min, once", prepCard(p)) +
      "</div>";
    renderStores();
    // wire recipe buttons
    $$("#results [data-meal]").forEach(function (b) {
      b.addEventListener("click", function () { var m = state.plan.meals.find(function (x) { return String(x.id) === b.dataset.meal; }); if (m) openModal(m); });
    });
  }

  function section(title, hint, body) {
    return '<div><div class="mb-3 flex items-baseline justify-between"><h2 class="font-display text-xl font-bold tracking-tight text-stone-800">' + esc(title) + '</h2>' + (hint ? '<span class="text-xs text-stone-400">' + esc(hint) + "</span>" : "") + "</div>" + body + "</div>";
  }

  function statStrip(p) {
    function stat(label, value, big, accent) {
      return '<div class="rounded-xl border border-stone-200 bg-white p-3 shadow-sm"><div class="text-[11px] font-medium uppercase tracking-wide text-stone-400">' + label + '</div><div class="mt-1 ' + (big ? "font-display text-3xl font-black" : "text-xl font-bold") + " " + (accent ? "text-accent" : "text-stone-800") + '">' + value + "</div></div>";
    }
    var budgetNote = "";
    if (p.budgetCents != null) {
      budgetNote = p.overBudget
        ? ' <span class="ml-2 font-medium text-red-600">Over your ' + money(p.budgetCents) + " budget by " + money(p.totalCents - p.budgetCents) + ".</span>"
        : ' <span class="ml-2 font-medium text-brand-dark">' + money(p.budgetCents - p.totalCents) + " under your " + money(p.budgetCents) + " budget.</span>";
    }
    return '<div><div class="grid grid-cols-2 gap-3 sm:grid-cols-4">' +
      stat("Weekly total", money(p.totalCents), true, false) +
      stat("Per serving", money(p.perServingCents), false, true) +
      stat("You save*", money(p.overlapSavingsCents), false, false) +
      stat("Servings made", String(p.servingsProduced), false, false) +
      '</div><p class="mt-2 text-xs text-stone-400">*vs. buying each recipe’s ingredients separately — the overlap engine reuses shared ingredients across meals.' + budgetNote + "</p></div>";
  }

  function planGrid(p) {
    var cards = p.meals.map(function (m) {
      var img = m.imageUrl ? '<img src="' + esc(m.imageUrl) + '" alt="' + esc(m.title) + '" class="h-40 w-full object-cover" loading="lazy" />' : "";
      var shares = m.sharedIngredients.length ? '<p class="mt-3 text-xs text-stone-500"><span class="font-medium text-brand-dark">Shares:</span> ' + esc(m.sharedIngredients.slice(0, 5).join(", ")) + "</p>" : "";
      var area = m.area ? '<span class="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">' + esc(m.area) + "</span>" : "";
      return '<div class="flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">' + img +
        '<div class="flex flex-1 flex-col p-4"><h3 class="font-semibold leading-snug text-stone-800">' + esc(m.title) + '</h3>' +
        '<div class="mt-1.5 flex flex-wrap gap-1.5"><span class="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand-dark">' + esc(m.protein) + "</span>" + area + "</div>" + shares +
        '<button data-meal="' + esc(m.id) + '" class="mt-3 self-start rounded-full border border-brand/30 bg-brand/5 px-3 py-1 text-xs font-semibold text-brand-dark transition hover:bg-brand/10">View full recipe →</button></div></div>';
    }).join("");
    return '<div class="grid gap-4 sm:grid-cols-2">' + cards + "</div>";
  }

  function groceryCard(p) {
    var aisles = p.groceryAisles.map(function (a) {
      var items = a.items.map(function (i) {
        var note = i.packsNeeded > 1 ? i.packsNeeded + " × " + i.packLabel : i.packLabel;
        var badge = i.shared ? '<span class="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand-dark">in ' + i.usedByCount + " meals</span>" : "";
        return '<li class="flex items-center justify-between px-4 py-2 text-sm"><span class="flex items-center gap-2"><span class="text-stone-800">' + esc(i.displayName) + '</span><span class="text-xs text-stone-400">' + esc(note) + "</span>" + badge + '</span><span class="tabular-nums text-stone-600">' + money(i.lineCents) + "</span></li>";
      }).join("");
      return '<div class="border-b border-stone-100 last:border-0"><div class="flex items-center justify-between bg-stone-50/70 px-4 py-2"><span class="text-xs font-semibold uppercase tracking-wide text-stone-500">' + esc(a.aisle) + '</span><span class="text-xs text-stone-400">' + money(a.subtotalCents) + "</span></div><ul>" + items + "</ul></div>";
    }).join("");
    var staples = p.pantryStaples.length ? '<p class="mt-3 text-xs text-stone-500"><span class="font-medium text-stone-600">Pantry staples you likely have</span> (not counted): ' + esc(p.pantryStaples.join(", ")) + ".</p>" : "";
    return '<div class="rounded-2xl border border-stone-200 bg-white shadow-sm">' + aisles +
      '<div class="flex items-center justify-between px-4 py-3"><span class="font-semibold text-stone-800">Estimated total</span><span class="font-display text-2xl font-black tabular-nums text-brand-dark">' + money(p.totalCents) + "</span></div></div>" + staples;
  }

  function prepCard(p) {
    var blocks = p.prep.map(function (b, idx) {
      var line = idx < p.prep.length - 1 ? '<span class="mt-1 w-px flex-1 bg-stone-200"></span>' : "";
      var tasks = b.tasks.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("");
      return '<li class="flex gap-4"><div class="flex w-14 shrink-0 flex-col items-center"><span class="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand-dark">' + b.minutes + "m</span>" + line + '</div><div class="pb-1"><h4 class="font-semibold text-stone-800">' + esc(b.label) + '</h4><ul class="mt-1 list-disc space-y-0.5 pl-4 text-sm text-stone-600">' + tasks + "</ul></div></li>";
    }).join("");
    var nights = p.weeknightAssembly.map(function (w) { return '<li class="flex gap-2"><span class="font-medium text-stone-800">' + esc(w.title) + ':</span><span class="text-stone-600">' + esc(w.note) + "</span></li>"; }).join("");
    return '<div class="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"><ol class="space-y-4">' + blocks + "</ol>" +
      '<div class="mt-5 border-t border-stone-100 pt-4"><h4 class="text-sm font-semibold uppercase tracking-wide text-stone-500">Then weeknights are easy</h4><ul class="mt-2 space-y-1.5 text-sm">' + nights + "</ul></div></div>";
  }

  /* ----- cheapest store ----- */
  function renderStores() {
    var slot = $("#stores-slot"); if (!slot || !state.plan) return;
    var sub = {}; state.plan.groceryAisles.forEach(function (a) { sub[a.aisle] = a.subtotalCents; });
    var r = FC.rankStores(state.location, sub);
    if (!r || !r.cheapest) { slot.innerHTML = ""; return; }
    var rows = r.ranked.map(function (s, i) {
      var best = i === 0;
      var over = s.totalCents - r.cheapest.totalCents;
      var num = '<span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ' + (best ? "bg-brand text-white" : "bg-stone-100 text-stone-500") + '">' + (i + 1) + "</span>";
      var right = (best ? "" : '<span class="text-xs text-stone-400">+' + money(over) + "</span>") + '<span class="font-medium ' + (best ? "text-brand-dark" : "text-stone-600") + '">' + money(s.totalCents) + "</span>";
      return '<li class="flex items-center justify-between gap-3 px-5 py-2.5 text-sm ' + (i < r.ranked.length - 1 ? "border-b border-stone-100" : "") + '"><span class="flex min-w-0 items-center gap-2">' + num + '<span class="truncate font-medium text-stone-800">' + esc(s.chain) + '</span><span class="hidden truncate text-xs text-stone-400 sm:inline">' + esc(s.tag) + " · " + s.distanceMi + ' mi</span></span><span class="flex shrink-0 items-center gap-2 tabular-nums">' + right + "</span></li>";
    }).join("");
    var save = (r.saveCents > 0 && r.priciest) ? '<div class="mt-0.5 text-xs font-medium text-accent">save ' + money(r.saveCents) + " vs " + esc(r.priciest.chain) + "</div>" : "";
    var bestAisle = r.cheapest.bestAisle ? '<span aria-hidden="true">·</span><span class="text-brand-dark">great on ' + esc(r.cheapest.bestAisle.toLowerCase()) + "</span>" : "";
    slot.innerHTML = section("Where to buy it cheapest", r.withinCount + " stores within " + r.radiusMi + " mi",
      '<div class="overflow-hidden rounded-2xl border border-brand/30 bg-gradient-to-br from-brand/5 to-accent/5 shadow-sm">' +
        '<div class="flex flex-wrap items-end justify-between gap-3 p-5"><div><div class="text-[11px] font-semibold uppercase tracking-wide text-brand-dark">Cheapest near ' + esc(r.locationLabel) + '</div><div class="mt-1 font-display text-2xl font-black tracking-tight text-stone-800">' + esc(r.cheapest.name) + '</div><div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-stone-500"><span>' + esc(r.cheapest.tag) + '</span><span aria-hidden="true">·</span><span>' + r.cheapest.distanceMi + ' mi away</span>' + bestAisle + '</div></div>' +
        '<div class="text-right"><div class="font-display text-3xl font-black tabular-nums text-brand-dark">' + money(r.cheapest.totalCents) + "</div>" + save + "</div></div>" +
        '<ul class="border-t border-brand/15 bg-white/60">' + rows + "</ul></div>" +
        '<p class="mt-2 text-xs text-stone-400">Estimated from each store’s typical pricing for this exact haul' + (r.excludedCount > 0 ? " · " + r.excludedCount + " more just outside " + r.radiusMi + " mi" : "") + ".</p>");
  }

  /* ----- recipe modal ----- */
  function openModal(m) {
    var d = m.detail;
    var img = m.imageUrl ? '<img src="' + esc(m.imageUrl) + '" alt="' + esc(m.title) + '" class="h-44 w-full object-cover" />' : "";
    var pills = '<span class="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand-dark">' + esc(m.protein) + "</span>" +
      (m.area ? '<span class="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">' + esc(m.area) + "</span>" : "") +
      '<span class="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">Serves ' + d.servings + "</span>" +
      (d.totalTimeMinutes ? '<span class="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">~' + d.totalTimeMinutes + " min</span>" : "");
    var equip = d.equipment.map(function (e) { return '<span class="rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700">' + esc(e) + "</span>"; }).join("");
    var ings = d.ingredients.map(function (i) { return '<li class="flex gap-2"><span class="min-w-[72px] shrink-0 font-medium tabular-nums text-brand-dark">' + esc(i.measure) + '</span><span class="text-stone-700">' + esc(i.name) + "</span></li>"; }).join("");
    var steps = d.steps.map(function (s, idx) {
      var uses = s.uses.length ? '<div class="mt-1.5 flex flex-wrap gap-1">' + s.uses.map(function (u) { return '<span class="rounded-md bg-accent/10 px-1.5 py-0.5 text-[11px] font-medium text-accent">' + esc(u.name) + " · " + esc(u.measure) + "</span>"; }).join("") + "</div>" : "";
      return '<li class="flex gap-3"><span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">' + (idx + 1) + '</span><div><p class="text-sm leading-relaxed text-stone-700">' + esc(s.text) + "</p>" + uses + "</div></li>";
    }).join("");
    var root = $("#modal-root");
    root.innerHTML = '<div id="modal-bg" class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/50 p-4 sm:p-8">' +
      '<div class="my-auto w-full max-w-2xl overflow-hidden rounded-2xl bg-oat shadow-xl" id="modal-card">' + img +
      '<div class="max-h-[70vh] overflow-y-auto p-6"><div class="flex items-start justify-between gap-4"><div><h2 class="font-display text-2xl font-black tracking-tight text-stone-800">' + esc(m.title) + '</h2><div class="mt-1.5 flex flex-wrap gap-1.5">' + pills + '</div></div><button id="modal-close" aria-label="Close" class="shrink-0 rounded-full border border-stone-300 px-2.5 py-1 text-sm text-stone-500 hover:bg-stone-100">✕</button></div>' +
      '<div class="mt-5"><h3 class="text-xs font-semibold uppercase tracking-wide text-stone-500">You’ll need</h3><div class="mt-2 flex flex-wrap gap-1.5">' + equip + "</div></div>" +
      '<div class="mt-5 grid gap-6 sm:grid-cols-[200px_1fr]"><div><h3 class="text-xs font-semibold uppercase tracking-wide text-stone-500">Ingredients</h3><ul class="mt-2 space-y-1.5 text-sm">' + ings + '</ul></div><div><h3 class="text-xs font-semibold uppercase tracking-wide text-stone-500">Method</h3><ol class="mt-2 space-y-4">' + steps + "</ol></div></div></div></div></div>";
    function close() { root.innerHTML = ""; document.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape") close(); }
    $("#modal-bg").addEventListener("click", function (e) { if (e.target.id === "modal-bg") close(); });
    $("#modal-close").addEventListener("click", close);
    document.addEventListener("keydown", onKey);
  }
})();
