(function () {
  "use strict";

  const CFG = window.JOBS_CONFIG;
  const $ = (id) => document.getElementById(id);
  const YEAR = new Date().getUTCFullYear();
  const yearStart = (y) => Date.UTC(y, 0, 1);
  const MS_PER_YEAR = (y) => yearStart(y + 1) - yearStart(y);
  const SEC_PER_YEAR = MS_PER_YEAR(YEAR) / 1000;

  const fmt0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
  const fmt1 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const fmt2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const signed = (x, f = fmt0) => (x > 0 ? "+" : x < 0 ? "-" : "") + f.format(Math.abs(x));

  // ---- Fetching ------------------------------------------------------------
  function url(indicator, codes) {
    const q = new URLSearchParams({
      id: indicator, sex: "SEX_T", classif1: "AGE_YTHADULT_YGE15",
      timefrom: String(CFG.historyFrom), format: ".csv"
    });
    // ILOSTAT takes several areas joined by "+"; added by hand so it isn't encoded as a space.
    return `${CFG.apiBase}?${q}&ref_area=${codes.join("+")}`;
  }

  function parseCsv(text) {
    const rows = [];
    for (const line of text.replace(/^﻿/, "").trim().split(/\r?\n/)) {
      const cells = [];
      let cur = "", q = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (q) {
          if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
          else if (ch === '"') q = false;
          else cur += ch;
        } else if (ch === '"') q = true;
        else if (ch === ",") { cells.push(cur); cur = ""; }
        else cur += ch;
      }
      cells.push(cur);
      rows.push(cells);
    }
    const [head, ...body] = rows;
    return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
  }

  // -> { CODE: { year: value } }
  function index(rows, scale) {
    const out = {};
    for (const r of rows) {
      const v = parseFloat(r.obs_value);
      if (!r.ref_area || !isFinite(v)) continue;
      (out[r.ref_area] ||= {})[+r.time] = v * scale;
    }
    return out;
  }

  async function fetchCsv(u) {
    const res = await fetch(u);
    if (!res.ok) throw new Error(`HTTP ${res.status} from ILOSTAT`);
    return parseCsv(await res.text());
  }

  let dataPromise = null;
  function loadData() {
    if (dataPromise) return dataPromise;
    const codes = [CFG.world, ...CFG.countries.map((c) => c.code)];
    const I = CFG.indicators;
    dataPromise = Promise.all([
      fetchCsv(url(I.employed, codes)), fetchCsv(url(I.unemployed, codes)), fetchCsv(url(I.rate, codes))
    ]).then(([e, u, r]) => {
      const data = { employed: index(e, 1000), unemployed: index(u, 1000), rate: index(r, 1) };
      if (!data.employed[CFG.world] || !data.unemployed[CFG.world]) throw new Error("World figures missing from response");
      return { data, fetchedAt: new Date() };
    }).catch((err) => { dataPromise = null; throw err; });
    return dataPromise;
  }

  // ---- Model ---------------------------------------------------------------
  // The ILO gives annual averages. Each is placed at the middle of its year and the
  // level at any moment is a straight line between neighbouring mid-years
  // (extended along the nearest segment at the ends). Net new jobs so far this year
  // = employment now - employment on 1 January.
  const tYears = (ms) => {
    const y = new Date(ms).getUTCFullYear();
    return y + (ms - yearStart(y)) / MS_PER_YEAR(y);
  };
  function levelAt(series, t) {
    const ys = Object.keys(series).map(Number).sort((a, b) => a - b);
    const pts = ys.map((y) => [y + 0.5, series[y]]);
    if (pts.length === 1) return { v: pts[0][1], slope: 0 };
    let i = pts.findIndex(([x]) => x > t);
    if (i <= 0) i = i === 0 ? 1 : pts.length - 1;
    const [x0, v0] = pts[i - 1], [x1, v1] = pts[i];
    const slope = (v1 - v0) / (x1 - x0);   // per year
    return { v: v0 + slope * (t - x0), slope };
  }

  function buildEntry(emp, une, rate) {
    const t0 = YEAR;                       // 1 January, in fractional years
    const e0 = levelAt(emp, t0).v, u0 = levelAt(une, t0).v;
    const yearNet = levelAt(emp, YEAR + 1).v - e0;   // net new jobs over the whole calendar year
    const years = Object.keys(emp).map(Number).filter((y) => y <= YEAR).sort((a, b) => a - b);
    return {
      emp, une, rate, e0, u0, yearNet, years,
      empY: emp[YEAR], uneY: une[YEAR], uneDelta: une[YEAR] - une[YEAR - 1],
      rateY: rate[YEAR] ?? (une[YEAR] / (une[YEAR] + emp[YEAR])) * 100,
      ratePrev: rate[YEAR - 1] ?? (une[YEAR - 1] / (une[YEAR - 1] + emp[YEAR - 1])) * 100,
      now(t) {
        const E = levelAt(emp, t), U = levelAt(une, t);
        return { jobs: E.v - e0, jobsPerSec: E.slope / SEC_PER_YEAR, unemployed: U.v, uneSince: U.v - u0, unePerSec: U.slope / SEC_PER_YEAR };
      }
    };
  }

  // ---- Rendering -----------------------------------------------------------
  function people(n) {
    const a = Math.abs(n), s = n < 0 ? "-" : "";
    if (a >= 1e9) return s + fmt2.format(a / 1e9) + " billion";
    if (a >= 1e6) return s + fmt1.format(a / 1e6) + " million";
    if (a >= 1e3) return s + fmt0.format(a / 1e3) + " thousand";
    return s + fmt0.format(a);
  }
  const digits = (s) => s.replace(/[0-9]/g, (d) => `<span class="d">${d}</span>`);

  function sparkline(e) {
    const ys = Object.keys(e.rate).map(Number).filter((y) => y <= YEAR).sort((a, b) => a - b);
    if (ys.length < 2) return "";
    const vals = ys.map((y) => e.rate[y]);
    const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
    const W = 120, H = 28;
    const xy = vals.map((v, i) => [(i / (vals.length - 1)) * W, H - 3 - ((v - min) / span) * (H - 6)]);
    const pts = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    const [lx, ly] = xy[xy.length - 1];
    const ch = vals[vals.length - 1] - vals[0];
    return `<figure class="spark-wrap" title="Unemployment rate, ${ys[0]} to ${ys[ys.length - 1]}. Show yearly values">
      <svg class="spark" viewBox="-2 0 ${W + 4} ${H}" preserveAspectRatio="none" aria-hidden="true">
        <polyline points="${pts}"/><circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="2.2"/>
      </svg>
      <figcaption>rate ${ys[0]}-${String(ys[ys.length - 1]).slice(2)} <b class="${ch > 0 ? "down" : ch < 0 ? "up" : ""}">${signed(ch, fmt1)} pts</b></figcaption>
      <span class="sr-only">Unemployment rate ${ys[0]} to ${ys[ys.length - 1]}</span>
    </figure>`;
  }

  function historyTable(e) {
    const rows = e.years.slice().reverse().map((y) => {
      const d = e.emp[y - 1] != null ? e.emp[y] - e.emp[y - 1] : null;
      return `<tr><th>${y}${y >= YEAR - 1 ? "*" : ""}</th><td>${people(e.emp[y])}</td><td class="${d > 0 ? "good" : d < 0 ? "bad" : ""}">${
        d == null ? "" : signed(d / 1e6, fmt1) + " M"}</td><td>${e.rate[y] != null ? fmt1.format(e.rate[y]) + "%" : ""}</td></tr>`;
    }).join("");
    return `<div class="history" hidden><table><caption>Employed · yearly change · unemployment rate (* ILO estimate or projection)</caption>${rows}</table></div>`;
  }

  const T0 = Date.now();
  let loopId = 0;

  function render(data) {
    const myLoop = ++loopId;
    const W = CFG.world;
    const world = buildEntry(data.employed[W], data.unemployed[W], data.rate[W] || {});

    const entries = CFG.countries
      .filter((c) => data.employed[c.code] && data.unemployed[c.code])
      .map((c) => ({ ...c, ...buildEntry(data.employed[c.code], data.unemployed[c.code], data.rate[c.code] || {}) }));
    const missing = CFG.countries.filter((c) => !data.employed[c.code]).map((c) => c.code);
    if (missing.length) console.warn("No data returned for:", missing.join(", "));

    // Rest of world = world minus listed (top-level) countries, year by year.
    const top = entries.filter((e) => !e.partOf);
    const restSeries = (key) => {
      const s = {};
      for (const y of Object.keys(data[key][W])) {
        s[y] = data[key][W][y] - top.reduce((a, e) => a + (e[key === "employed" ? "emp" : "une"][y] || 0), 0);
      }
      return s;
    };
    const rEmp = restSeries("employed"), rUne = restSeries("unemployed"), rRate = {};
    for (const y of Object.keys(rEmp)) rRate[y] = (rUne[y] / (rUne[y] + rEmp[y])) * 100;
    entries.push({ code: "ROW", flag: "🌐", name: "Rest of world", rest: true, ...buildEntry(rEmp, rUne, rRate) });

    // Header fill-ins
    document.querySelectorAll("[data-first]").forEach((el) => (el.textContent = CFG.historyFrom));
    document.querySelectorAll("[data-prev]").forEach((el) => (el.textContent = YEAR - 1));
    document.querySelectorAll("[data-next]").forEach((el) => (el.textContent = YEAR + 1));
    $("w-yearnet").textContent = people(world.yearNet);
    $("w-emp").textContent = people(world.empY);
    $("w-emp-prev").textContent = people(world.emp[YEAR - 1]);
    $("w-rate").textContent = fmt1.format(world.rateY) + "%";
    $("w-rate-prev").textContent = fmt1.format(world.ratePrev) + "%";
    $("w-years").textContent = fmt1.format(world.uneY / world.yearNet);
    $("w-une-year").textContent = people(world.uneY);
    $("w-net-year").textContent = people(world.yearNet);

    const grid = $("grid");
    grid.innerHTML = "";
    const cards = entries.map((e) => {
      const el = document.createElement("article");
      el.className = "card" + (e.rest ? " rest" : "");
      const r1 = Math.round(e.rateY * 10), r0 = Math.round(e.ratePrev * 10);   // compare as displayed
      const rateCls = r1 > r0 ? "bad" : r1 < r0 ? "good" : "";
      el.innerHTML = `
        <header>
          <span class="flag" aria-hidden="true">${e.flag}</span>
          <h3>${e.name}</h3>
          ${e.partOf ? `<span class="tag">part of ${e.partOf}</span>` : ""}
          ${e.rest ? "" : sparkline(e)}
        </header>
        <div class="ytd jobs"><span class="num">0</span> <small class="num-label">net new jobs in ${YEAR}</small></div>
        <p class="unemp-line"><span class="une">0</span> <small>unemployed now</small></p>
        <div class="bar" title="Unemployment rate ${fmt1.format(e.rateY)}%"><i class="u" style="width:${Math.min(e.rateY * 4, 100)}%"></i></div>
        <dl>
          <div><dt>Unemployment rate ${YEAR}</dt><dd class="${rateCls}">${fmt1.format(e.rateY)}% <small>(${fmt1.format(e.ratePrev)}%)</small></dd></div>
          <div><dt>Employed ${YEAR}</dt><dd>${people(e.empY)}</dd></div>
          <div><dt>Net new jobs, all of ${YEAR}</dt><dd class="${e.yearNet >= 0 ? "good" : "bad"}">${signed(e.yearNet / 1e6, fmt2)} M</dd></div>
          <div><dt>Unemployed vs ${YEAR - 1}</dt><dd class="${e.uneDelta > 0 ? "bad" : e.uneDelta < 0 ? "good" : ""}">${signed(e.uneDelta / 1e3)} k</dd></div>
          <div class="wide"><dt>Net jobs since you opened this page</dt><dd class="since">0</dd></div>
        </dl>
        ${e.rest ? "" : `<button type="button" class="more" aria-expanded="false">Yearly data <span aria-hidden="true">▾</span></button>${historyTable(e)}`}`;
      const btn = el.querySelector(".more");
      if (btn) {
        const h = el.querySelector(".history");
        const toggle = () => {
          h.hidden = !h.hidden;
          btn.setAttribute("aria-expanded", String(!h.hidden));
          btn.firstChild.textContent = h.hidden ? "Yearly data " : "Hide yearly data ";
          btn.classList.toggle("open", !h.hidden);
        };
        btn.addEventListener("click", toggle);
        el.querySelector(".spark-wrap")?.addEventListener("click", toggle);
      }
      if (e.yearNet < 0) {
        el.querySelector(".ytd").classList.add("neg");
        el.querySelector(".num-label").textContent = `net jobs lost in ${YEAR}`;
      }
      grid.appendChild(el);
      return { e, el, num: el.querySelector(".num"), une: el.querySelector(".une"), since: el.querySelector(".since") };
    });

    // Sorting
    const sortSel = $("sort");
    const keys = {
      jobs: (c) => c.e.yearNet,
      rate: (c) => c.e.rateY,
      unemployed: (c) => c.e.uneY,
      name: (c) => c.e.name
    };
    function sortCards() {
      const k = keys[sortSel.value];
      cards.slice()
        .sort((a, b) => (!!a.e.rest - !!b.e.rest) ||
          (typeof k(a) === "string" ? k(a).localeCompare(k(b)) : k(b) - k(a)))
        .forEach((c) => grid.appendChild(c.el));
    }
    sortSel.onchange = sortCards;
    sortCards();

    // Clock loop
    let lastJobs = "", lastUne = "";
    (function tick() {
      if (myLoop !== loopId) return;
      const nowMs = Date.now(), t = tYears(nowMs);
      const frac = t - YEAR;
      const opened = tYears(T0);
      const w = world.now(t);
      const js = fmt0.format(Math.abs(w.jobs));
      if (js !== lastJobs) { $("w-jobs").innerHTML = (w.jobs < 0 ? "-" : "") + digits(js); lastJobs = js; }
      const us = fmt0.format(w.unemployed);
      if (us !== lastUne) { $("w-une").innerHTML = digits(us); lastUne = us; }
      $("w-jobs-sec").textContent = fmt2.format(w.jobsPerSec);
      $("w-jobs-since").textContent = signed(w.jobs - world.now(opened).jobs);
      $("w-une-since").textContent = signed(w.uneSince);
      $("w-pct").textContent = fmt2.format(frac * 100);
      $("w-bar").style.width = frac * 100 + "%";
      for (const c of cards) {
        const n = c.e.now(t);
        c.num.textContent = fmt0.format(Math.abs(n.jobs));
        c.une.textContent = fmt0.format(n.unemployed);
        c.since.textContent = signed(n.jobs - c.e.now(opened).jobs);
      }
      requestAnimationFrame(tick);
    })();
  }

  // ---- Boot ------------------------------------------------------------------
  function setState(state, msg) {
    document.body.dataset.state = state;
    if (msg) $("error-msg").textContent = msg;
  }

  async function show() {
    try {
      const { data, fetchedAt } = await loadData();
      render(data);
      $("fetched-at").textContent = fetchedAt.toLocaleString();
      setState("ready");
    } catch (err) {
      console.error(err);
      setState("error", err.message || String(err));
    }
  }

  // Help pop-up
  const help = $("help");
  document.querySelectorAll("[data-open-help]").forEach((b) => b.addEventListener("click", () => {
    if (help.showModal) help.showModal(); else help.setAttribute("open", "");
    help.querySelector(".sheet").scrollTop = 0;
    help.querySelector(".close").focus({ preventScroll: true });
  }));
  const closeHelp = () => (help.close ? help.close() : help.removeAttribute("open"));
  document.querySelectorAll("[data-close-help]").forEach((b) => b.addEventListener("click", closeHelp));
  help.addEventListener("click", (e) => { if (e.target === help) closeHelp(); });

  document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = YEAR));
  document.querySelectorAll("[data-source]").forEach((el) => (el.textContent = CFG.source));
  $("retry").addEventListener("click", () => { setState("loading"); show(); });
  show();
})();
