(function () {
  "use strict";

  const CFG = window.JOBS_CONFIG;
  const C = window.ClockCore;
  const { YEAR, fmt, signed, setText } = C;
  const $ = (id) => document.getElementById(id);

  // ---- Data (ILOSTAT, ILO modelled estimates) --------------------------------
  const codes = [CFG.world, ...CFG.countries.map((c) => c.code)];
  function url(indicator) {
    const q = new URLSearchParams({
      id: indicator, sex: "SEX_T", classif1: "AGE_YTHADULT_YGE15",
      timefrom: String(CFG.historyFrom), format: ".csv"
    });
    // ILOSTAT takes several areas joined by "+"; added by hand so it isn't encoded as a space.
    return `${CFG.apiBase}?${q}&ref_area=${codes.join("+")}`;
  }
  // -> { CODE: { year: value } }
  function index(rows, scale) {
    const out = {};
    for (const r of rows) {
      const v = parseFloat(r.obs_value);
      if (r.ref_area && isFinite(v)) (out[r.ref_area] ||= {})[+r.time] = v * scale;
    }
    return out;
  }
  const loadData = C.once(async () => {
    const I = CFG.indicators;
    const [e, u, r] = await Promise.all([I.employed, I.unemployed, I.rate].map((id) => C.fetchCsv(url(id))));
    const data = { employed: index(e, 1000), unemployed: index(u, 1000), rate: index(r, 1) };
    if (!data.employed[CFG.world] || !data.unemployed[CFG.world]) throw new Error("World figures missing from response");
    return { data, fetchedAt: new Date() };
  });

  // ---- Model ---------------------------------------------------------------
  // The ILO gives annual averages. Each is placed at the middle of its year and the
  // level at any moment is a straight line between neighbouring mid-years
  // (extended along the nearest segment at the ends).
  function levelAt(series, t) {
    const pts = Object.keys(series).map(Number).sort((a, b) => a - b).map((y) => [y + 0.5, series[y]]);
    if (pts.length === 1) return pts[0][1];
    let i = pts.findIndex(([x]) => x > t);
    if (i <= 0) i = i === 0 ? 1 : pts.length - 1;
    const [x0, v0] = pts[i - 1], [x1, v1] = pts[i];
    return v0 + ((v1 - v0) / (x1 - x0)) * (t - x0);
  }

  function buildEntry(emp, une, rate) {
    const e0 = levelAt(emp, YEAR), u0 = levelAt(une, YEAR);          // 1 January
    const yearNet = levelAt(emp, YEAR + 1) - e0;                      // net new jobs, whole calendar year
    const yearUne = levelAt(une, YEAR + 1) - u0;                      // change in unemployed, whole year
    const newWorkers = yearNet + yearUne;                             // growth of the labour force
    const years = Object.keys(emp).map(Number).filter((y) => y <= YEAR).sort((a, b) => a - b);
    const rateOf = (y) => rate[y] ?? (une[y] / (une[y] + emp[y])) * 100;
    return {
      emp, une, rate, e0, u0, yearNet, yearUne, newWorkers, years,
      empY: emp[YEAR], uneY: une[YEAR], uneDelta: une[YEAR] - une[YEAR - 1],
      rateY: rateOf(YEAR), ratePrev: rateOf(YEAR - 1),
      // share of this year's new workers covered by net new jobs (null if the workforce is shrinking)
      keepUp: newWorkers > 0 ? yearNet / newWorkers : null,
      jobsAt: (t) => levelAt(emp, t) - e0,
      unemployedAt: (t) => levelAt(une, t),
      workersAt: (t) => levelAt(emp, t) + levelAt(une, t) - e0 - u0
    };
  }

  // Keeping-up verdict: are net new jobs at least matching the growth of the workforce?
  function keepUpVerdict(e) {
    if (e.keepUp == null) return e.yearUne <= 0
      ? { cls: "ok", text: "Unemployment falling" } : { cls: "bad", text: "Unemployment rising" };
    if (e.keepUp >= 1) return { cls: "ok", text: "Keeping up" };
    if (e.keepUp >= 0.9) return { cls: "near", text: "Close" };
    return { cls: "bad", text: "Falling behind" };
  }

  // ---- Rendering -----------------------------------------------------------
  function people(n) {
    const a = Math.abs(n), s = n < 0 ? "-" : "";
    if (a >= 1e9) return s + fmt[2].format(a / 1e9) + " billion";
    if (a >= 1e6) return s + fmt[1].format(a / 1e6) + " million";
    if (a >= 1e3) return s + fmt[0].format(a / 1e3) + " thousand";
    return s + fmt[0].format(a);
  }

  function sparkFor(e) {
    const ys = Object.keys(e.rate).map(Number).filter((y) => y <= YEAR).sort((a, b) => a - b);
    const vals = ys.map((y) => e.rate[y]);
    const ch = vals[vals.length - 1] - vals[0];
    return C.sparkline(ys, vals, {
      caption: `rate ${ys[0]}-${String(ys[ys.length - 1]).slice(2)}`, change: ch,
      changeText: signed(ch, fmt[1]) + " pts", good: "down",
      title: `Unemployment rate, ${ys[0]} to ${ys[ys.length - 1]}. Show yearly values`
    });
  }

  function historyTable(e) {
    const rows = e.years.slice().reverse().map((y) => {
      const d = e.emp[y - 1] != null ? e.emp[y] - e.emp[y - 1] : null;
      return `<tr><th>${y}${y >= YEAR - 1 ? "*" : ""}</th><td>${people(e.emp[y])}</td><td class="${d > 0 ? "good" : d < 0 ? "bad" : ""}">${
        d == null ? "" : signed(d / 1e6, fmt[1]) + " M"}</td><td>${e.rate[y] != null ? fmt[1].format(e.rate[y]) + "%" : ""}</td></tr>`;
    }).join("");
    return `<div class="history" hidden><table><caption>Employed · yearly change · unemployment rate (* ILO estimate or projection)</caption>${rows}</table></div>`;
  }

  function cardGoal(e) {
    const v = keepUpVerdict(e);
    const label = e.keepUp == null
      ? `Workforce shrinking · unemployed ${signed(e.yearUne / 1e3)} k this year`
      : `${fmt[0].format(Math.min(e.keepUp, 9.99) * 100)} jobs per 100 new workers`;
    return `<div class="card-goal">
        ${e.keepUp == null ? "" : `<div class="goal-bar" title="Net new jobs this year as a share of new workers (the marker is 100: enough jobs for all of them)">
          <i style="width:${Math.min(e.keepUp, 1) * 100}%"></i><span style="left:100%"></span></div>`}
        <p><span>${label}</span><span class="verdict ${v.cls}">${v.text}</span></p>
      </div>`;
  }

  function renderGoal(world) {
    const v = keepUpVerdict(world);
    $("goal-verdict").textContent = v.text;
    $("goal-verdict").className = "verdict " + v.cls;
    $("g-newworkers-year").textContent = people(world.newWorkers);
    $("g-jobs-year").textContent = people(world.yearNet);
    $("g-per100").textContent = fmt[0].format(world.keepUp * 100);
    // Direction toward the UN 2030 goal: compare the ILO estimate for next year with this year.
    const next = world.une[YEAR + 1], base = world.une[CFG.historyFrom];
    const improving = next != null && next < world.uneY;
    $("sdg-verdict").textContent = next == null ? "No projection" : improving ? "Improving" : "Getting worse";
    $("sdg-verdict").className = "verdict " + (next == null ? "" : improving ? "ok" : "bad");
    $("sdg-base").textContent = people(base);
    $("sdg-now").textContent = people(world.uneY);
    $("sdg-change").textContent = signed(((world.uneY / base) - 1) * 100, fmt[0]) + "%";
    $("sdg-next").textContent = next != null ? people(next) : "n/a";
    return (t) => {
      const jobs = world.jobsAt(t), workers = world.workersAt(t);
      setText($("g-jobs"), fmt[0].format(jobs));
      setText($("g-workers"), fmt[0].format(workers));
      $("g-bar").style.width = Math.min(jobs / workers, 1) * 100 + "%";
    };
  }

  const T0 = Date.now();

  function render(data) {
    const W = CFG.world;
    const world = buildEntry(data.employed[W], data.unemployed[W], data.rate[W] || {});

    const entries = CFG.countries
      .filter((c) => data.employed[c.code] && data.unemployed[c.code])
      .map((c) => ({ ...c, ...buildEntry(data.employed[c.code], data.unemployed[c.code], data.rate[c.code] || {}) }));
    const missing = CFG.countries.filter((c) => !data.employed[c.code]).map((c) => c.code);
    if (missing.length) console.warn("No data returned for:", missing.join(", "));

    // Rest of world = world minus listed (top-level) countries, year by year.
    const top = entries.filter((e) => !e.partOf);
    const rest = (key, field) => {
      const s = {};
      for (const y of Object.keys(data[key][W])) s[y] = data[key][W][y] - top.reduce((a, e) => a + (e[field][y] || 0), 0);
      return s;
    };
    const rEmp = rest("employed", "emp"), rUne = rest("unemployed", "une"), rRate = {};
    for (const y of Object.keys(rEmp)) rRate[y] = (rUne[y] / (rUne[y] + rEmp[y])) * 100;
    entries.push({ code: "ROW", flag: "🌐", name: "Rest of world", rest: true, ...buildEntry(rEmp, rUne, rRate) });

    // Header fill-ins
    C.fill("first", CFG.historyFrom);
    C.fill("prev", YEAR - 1);
    C.fill("next", YEAR + 1);
    $("w-yearnet").textContent = people(world.yearNet);
    $("w-emp").textContent = people(world.empY);
    $("w-emp-prev").textContent = people(world.emp[YEAR - 1]);
    $("w-rate").textContent = fmt[1].format(world.rateY) + "%";
    $("w-rate-prev").textContent = fmt[1].format(world.ratePrev) + "%";
    $("w-years").textContent = fmt[1].format(world.uneY / world.yearNet);
    $("w-une-year").textContent = people(world.uneY);
    $("w-net-year").textContent = people(world.yearNet);
    const goalTick = renderGoal(world);

    const grid = $("grid");
    grid.innerHTML = "";
    const cards = entries.map((e) => {
      const el = document.createElement("article");
      el.className = "card" + (e.rest ? " rest" : "");
      const r1 = Math.round(e.rateY * 10), r0 = Math.round(e.ratePrev * 10);   // compare as displayed
      const rateCls = r1 > r0 ? "bad" : r1 < r0 ? "good" : "";
      const lost = e.yearNet < 0;
      el.innerHTML = `
        <header>
          <span class="flag" aria-hidden="true">${e.flag}</span>
          <h3>${e.name}</h3>
          ${e.partOf ? `<span class="tag">part of ${e.partOf}</span>` : ""}
          ${e.rest ? "" : sparkFor(e)}
        </header>
        <div class="ytd jobs${lost ? " neg" : ""}"><span class="num">0</span> <small>net jobs ${lost ? "lost" : "added"} in ${YEAR}</small></div>
        <p class="unemp-line"><span class="une">0</span> <small>unemployed now</small></p>
        <div class="bar" title="Unemployment rate ${fmt[1].format(e.rateY)}%"><i class="u" style="width:${Math.min(e.rateY * 4, 100)}%"></i></div>
        <dl>
          <div><dt>Unemployment rate ${YEAR}</dt><dd class="${rateCls}">${fmt[1].format(e.rateY)}% <small>(${fmt[1].format(e.ratePrev)}%)</small></dd></div>
          <div><dt>Employed ${YEAR}</dt><dd>${people(e.empY)}</dd></div>
          <div><dt>Net new jobs, all of ${YEAR}</dt><dd class="${e.yearNet >= 0 ? "good" : "bad"}">${signed(e.yearNet / 1e6, fmt[2])} M</dd></div>
          <div><dt>Unemployed vs ${YEAR - 1}</dt><dd class="${e.uneDelta > 0 ? "bad" : e.uneDelta < 0 ? "good" : ""}">${signed(e.uneDelta / 1e3)} k</dd></div>
          <div class="wide"><dt>Net jobs since you opened this page</dt><dd class="since">0</dd></div>
        </dl>
        ${cardGoal(e)}
        ${e.rest ? "" : `<button type="button" class="more" aria-expanded="false">Yearly data <span aria-hidden="true">▾</span></button>${historyTable(e)}`}`;
      C.wireHistory(el);
      grid.appendChild(el);
      return { e, el, num: el.querySelector(".num"), une: el.querySelector(".une"), since: el.querySelector(".since") };
    });

    // Sorting
    const sortSel = $("sort");
    const keys = {
      jobs: (c) => c.e.yearNet,
      keepup: (c) => c.e.keepUp ?? (c.e.yearUne <= 0 ? 1 : -1),   // shrinking workforce: rank by whether unemployment falls
      rate: (c) => c.e.rateY,
      unemployed: (c) => c.e.uneY,
      name: (c) => c.e.name
    };
    const sortCards = () => C.sortInto(grid, cards, keys[sortSel.value]);
    sortSel.onchange = sortCards;
    sortCards();

    // Clock
    const opened = C.tYears(T0);
    const openedJobs = new Map(cards.map((c) => [c, c.e.jobsAt(opened)]));
    const worldOpened = world.jobsAt(opened);
    C.startTicker((now) => {
      const t = C.tYears(now), frac = C.yearFraction(now);
      const jobs = world.jobsAt(t);
      setText($("w-jobs"), (jobs < 0 ? "-" : "") + C.digits(fmt[0].format(Math.abs(jobs))), true);
      setText($("w-une"), C.digits(fmt[0].format(world.unemployedAt(t))), true);
      setText($("w-jobs-sec"), fmt[2].format(world.yearNet / C.SEC_PER_YEAR));
      setText($("w-jobs-since"), signed(jobs - worldOpened));
      setText($("w-une-since"), signed(world.unemployedAt(t) - world.u0));
      setText($("w-pct"), fmt[2].format(frac * 100));
      $("w-bar").style.width = frac * 100 + "%";
      for (const c of cards) {
        setText(c.num, fmt[0].format(Math.abs(c.e.jobsAt(t))));
        setText(c.une, fmt[0].format(c.e.unemployedAt(t)));
        setText(c.since, signed(c.e.jobsAt(t) - openedJobs.get(c)));
      }
      goalTick(t);
    });
  }

  // ---- Boot ------------------------------------------------------------------
  async function show() {
    try {
      const { data, fetchedAt } = await loadData();
      render(data);
      $("fetched-at").textContent = fetchedAt.toLocaleString();
      C.setState("ready");
    } catch (err) {
      console.error(err);
      C.stopTicker();
      C.setState("error", err.message || String(err));
    }
  }

  C.wireHelp();
  C.fill("year", YEAR);
  C.fill("source", CFG.source);
  $("retry").addEventListener("click", () => { C.setState("loading"); show(); });
  show();
})();
