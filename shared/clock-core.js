/*
 * Shared helpers for the clocks on ramialbatal.github.io (Renewables Clock, Jobs Clock).
 * Loaded before each clock's own js/app.js and exposed as window.ClockCore.
 */
(function () {
  "use strict";

  // ---- Time ------------------------------------------------------------------
  const YEAR = new Date().getUTCFullYear();
  const yearStart = (y) => Date.UTC(y, 0, 1);
  const msPerYear = (y) => yearStart(y + 1) - yearStart(y);
  const SEC_PER_YEAR = msPerYear(YEAR) / 1000;
  /** Fraction of the current year elapsed (UTC), 0..1. */
  const yearFraction = (ms = Date.now()) => (ms - yearStart(YEAR)) / msPerYear(YEAR);
  /** A moment as fractional years, e.g. 2026.89. */
  const tYears = (ms = Date.now()) => {
    const y = new Date(ms).getUTCFullYear();
    return y + (ms - yearStart(y)) / msPerYear(y);
  };

  // ---- Number formatting ---------------------------------------------------
  const nf = (d) => new Intl.NumberFormat("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  const fmt = { 0: nf(0), 1: nf(1), 2: nf(2), 3: nf(3) };
  /** "+1,234" / "-1,234" (plain hyphen, never a dash character). */
  const signed = (x, f = fmt[0]) => {
    const s = f.format(Math.abs(x));
    return (/^[0.,]+$/.test(s) ? "" : x > 0 ? "+" : x < 0 ? "-" : "") + s;   // no sign on a rounded zero
  };
  const pct = (x, d = 1) => fmt[d].format(x) + "%";
  /** Wrap each digit so the big counters don't jitter as digits change width. */
  const digits = (s) => s.replace(/[0-9]/g, (d) => `<span class="d">${d}</span>`);

  // ---- Fetching ------------------------------------------------------------
  /** Minimal CSV parser (handles quoted cells and a leading BOM). Returns objects keyed by header. */
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

  async function fetchText(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).hostname}`);
    return res.text();
  }
  const fetchCsv = async (url) => parseCsv(await fetchText(url));
  const fetchJson = async (url) => JSON.parse(await fetchText(url));

  /** Memoise an async loader; a failure clears the cache so "Try again" refetches. */
  function once(loader) {
    let p = null;
    return () => (p ||= loader().catch((err) => { p = null; throw err; }));
  }

  // ---- Model helpers -------------------------------------------------------
  /**
   * Latest-year projection used by the energy clocks: growth g = average yearly change
   * over the last n years, capped at maxGrowth; annual(Y) = value(last) * (1 + g)^(Y - last).
   */
  function project(series, n = 1, maxGrowth = Infinity) {
    const years = Object.keys(series).map(Number).sort((a, b) => a - b);
    const last = years[years.length - 1];
    const first = years.includes(last - n) ? last - n : years[0];
    const growth = last > first && series[first] > 0
      ? Math.pow(series[last] / series[first], 1 / (last - first)) - 1 : 0;
    const gUsed = Math.min(growth, maxGrowth);
    const at = (y) => series[y] ?? series[last] * Math.pow(1 + gUsed, y - last);
    return { years, lastYear: last, lastValue: series[last], trendFrom: first, growth, gUsed, annual: at(YEAR), at, series };
  }

  /** Growth per year needed to go from `from` to `to` in `years` years. */
  const neededGrowth = (from, to, years) => (years > 0 ? Math.pow(to / from, 1 / years) - 1 : Infinity);

  /** Verdict from how actual growth compares with the growth needed. */
  function verdict(actual, needed, nearBand = 0.85) {
    if (actual >= needed) return { cls: "ok", text: "On track" };
    if (actual >= needed * nearBand && actual > 0) return { cls: "near", text: "Close" };
    if (actual > 0) return { cls: "bad", text: "Off track" };
    return { cls: "bad", text: "Going backwards" };
  }

  // ---- Rendering -----------------------------------------------------------
  /**
   * Small line chart. `opts.good` says which direction is good ("up" or "down"); the
   * caption's colour class follows it. Returns HTML.
   */
  function sparkline(years, values, { caption = "", change = null, changeText = "", good = "up", title = "Show yearly values" } = {}) {
    if (values.length < 2) return "";
    const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
    const W = 120, H = 28;
    const xy = values.map((v, i) => [(i / (values.length - 1)) * W, H - 3 - ((v - min) / span) * (H - 6)]);
    const pts = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    const [lx, ly] = xy[xy.length - 1];
    const isGood = change == null || change === 0 ? null : (change > 0) === (good === "up");
    return `<figure class="spark-wrap" title="${title}">
      <svg class="spark" viewBox="-2 0 ${W + 4} ${H}" preserveAspectRatio="none" aria-hidden="true">
        <polyline points="${pts}"/><circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="2.2"/>
      </svg>
      <figcaption>${caption} <b class="${isGood == null ? "" : isGood ? "up" : "down"}">${changeText}</b></figcaption>
      <span class="sr-only">${caption}</span>
    </figure>`;
  }

  /** Wire a card's "Yearly data" button (and its line chart) to show/hide the table. */
  function wireHistory(card) {
    const btn = card.querySelector(".more"), h = card.querySelector(".history");
    if (!btn || !h) return;
    const toggle = () => {
      h.hidden = !h.hidden;
      btn.setAttribute("aria-expanded", String(!h.hidden));
      btn.firstChild.textContent = h.hidden ? "Yearly data " : "Hide yearly data ";
      btn.classList.toggle("open", !h.hidden);
    };
    btn.addEventListener("click", toggle);
    card.querySelector(".spark-wrap")?.addEventListener("click", toggle);
  }

  /** Sort cards by a key; "rest of world" always stays last. */
  function sortInto(grid, cards, key) {
    cards.slice()
      .sort((a, b) => (!!a.e.rest - !!b.e.rest) ||
        (typeof key(a) === "string" ? key(a).localeCompare(key(b)) : key(b) - key(a)))
      .forEach((c) => grid.appendChild(c.el));
  }

  // ---- Ticker --------------------------------------------------------------
  /**
   * Runs `fn(nowMs)` about `fps` times a second while the tab is visible. Text is only
   * written when it changes (see `setText`). Reloads the page when the year rolls over,
   * so a tab left open on 31 December starts counting the new year.
   */
  let tickId = 0;
  function startTicker(fn, fps = 10) {
    const my = ++tickId, every = 1000 / fps;
    let last = 0;
    (function loop(ts) {
      if (my !== tickId) return;
      if (!last || ts - last >= every) {
        last = ts || 1;
        const now = Date.now();
        if (new Date(now).getUTCFullYear() !== YEAR) { location.reload(); return; }
        fn(now);
      }
      requestAnimationFrame(loop);
    })(0);
  }
  /** Stop the current ticker (e.g. before re-rendering with other data). */
  const stopTicker = () => { tickId++; };

  const lastText = new WeakMap();
  /** Set textContent (or innerHTML when html=true) only if the value changed. */
  function setText(el, s, html = false) {
    if (!el || lastText.get(el) === s) return;
    lastText.set(el, s);
    if (html) el.innerHTML = s; else el.textContent = s;
  }

  // ---- Page chrome ---------------------------------------------------------
  function setState(state, msg) {
    document.body.dataset.state = state;
    if (msg) document.getElementById("error-msg").textContent = msg;
  }

  function wireHelp() {
    const help = document.getElementById("help");
    if (!help) return;
    document.querySelectorAll("[data-open-help]").forEach((b) => b.addEventListener("click", () => {
      if (help.showModal) help.showModal(); else help.setAttribute("open", "");
      help.querySelector(".sheet").scrollTop = 0;
      help.querySelector(".close").focus({ preventScroll: true });
    }));
    const close = () => (help.close ? help.close() : help.removeAttribute("open"));
    document.querySelectorAll("[data-close-help]").forEach((b) => b.addEventListener("click", close));
    help.addEventListener("click", (e) => { if (e.target === help) close(); });   // tap outside
  }

  /** Fill every element carrying `data-<name>` with a value. */
  const fill = (name, value) => document.querySelectorAll(`[data-${name}]`).forEach((el) => (el.textContent = value));

  window.ClockCore = {
    YEAR, yearStart, msPerYear, SEC_PER_YEAR, yearFraction, tYears,
    fmt, signed, pct, digits,
    parseCsv, fetchText, fetchCsv, fetchJson, once,
    project, neededGrowth, verdict,
    sparkline, wireHistory, sortInto,
    startTicker, stopTicker, setText,
    setState, wireHelp, fill
  };
})();
