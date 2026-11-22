# Adding a clock (or a feature)

Rules and a checklist for new work, so the clocks stay consistent, fast and honest. If a rule gets in the way, change
the rule here first rather than quietly breaking it in one clock.

## 1. Before writing code: the data

- **Find an official, comparable source** for every country you show (UN agencies, IEA/IRENA, Global Carbon Project,
  ILO, World Bank). Prefer one request that covers all countries over one request per country.
- **Check it loads in a browser:**
  ```
  curl -sI "<url>" | grep -iE '^(HTTP|location|access-control)'
  ```
  You need `HTTP 200` (no redirect) and `access-control-allow-origin: *`. If there's a redirect, use the final URL.
- **Check coverage:** every configured country, the years you need, and the world aggregate. Look for blank cells and
  carried-forward values (see [Lessons learned](lessons-learned.md#data-sources)).
- **Check size:** under about 200 KB compressed per request is fine. Measure with
  `curl -s -H 'Accept-Encoding: gzip, br' -o /dev/null -w '%{size_download}\n' "<url>"`.
- **Find the goal at the same time.** A counter without a reference point isn't enough. Prefer a target governments
  signed up to (Paris, COP, UN SDGs). Make sure the goal and the data measure the same thing (capacity vs generation,
  net vs gross). If no numeric target exists, say so and show direction instead.

## 2. Reuse, don't copy

- Start from the structure of an existing clock in this repository: `index.html`, `css/theme.css`, `js/config.js`,
  `js/app.js`, `img/`.
- Load the shared files:
  ```html
  <link rel="stylesheet" href="../shared/clock-base.css?v=YYYYMMDDa">
  <link rel="stylesheet" href="css/theme.css?v=YYYYMMDDa">
  …
  <script src="../shared/clock-core.js?v=YYYYMMDDa"></script>
  <script src="js/config.js?v=YYYYMMDDa"></script>
  <script src="js/app.js?v=YYYYMMDDa"></script>
  ```
- **Never paste a helper into `app.js` that exists in `ClockCore`** (CSV parsing, formats, sparklines, history toggle,
  sorting, ticker, help pop-up, state). If you need something new and a second clock could use it, add it to
  `shared/clock-core.js` (and its styles to `shared/clock-base.css`), with a short comment, and update the table in
  [How it works](how-it-works.md#shared-core-sharedclock-corejs).
- `theme.css` holds only colours (the five variables) and styles truly specific to that clock.
- `config.js` holds everything someone might want to change without reading the code: sources, columns, countries,
  goal numbers, caps. Hand-entered figures get a comment with their source and when to update them.
- Use the same country list as the other clocks unless there's a reason not to, so pages can be compared.

## 3. Reading data well

- Wrap each loader in `ClockCore.once()` so it runs once and "Try again" works.
- Load independent sources **in parallel** (`Promise.all`).
- Make secondary data **optional**: if it fails, hide its section and keep the clock working.
- Convert units **once**, right after parsing (thousands → people, tonnes → Gt only for display, and so on).
- Filter by country code in code, even if the URL filters too. Log configured countries that came back empty.
- Don't keep data in `localStorage` or cookies: the sources update themselves, and stale copies would show old numbers.
  If a clock ever needs to save something (a user preference, shared state), use the runtime storage the hosting
  offers, never a hidden cache of official figures.

## 4. Modelling honestly

- Use `ClockCore.project()` for "latest year grown by the latest trend". Set `maxGrowth` when the series can grow fast
  from a small base.
- If the source already publishes estimates for this year (like the ILO), use them instead of projecting.
- Make yearly figures continuous the same way across clocks: flows (emissions, generation) are spread evenly over the
  year; stocks (people employed) are interpolated between mid-year averages; end-of-year stocks (capacity) sit at
  1 January of the next year.
- Put the formula on the page in the method section, in plain words, and say "this is a model, not a measurement".
- Every verdict must be reproducible from numbers shown on the page.

## 5. Displaying data well

- One `ClockCore.startTicker()` per page; inside it, update with `setText` only. No `setInterval`, no extra
  `requestAnimationFrame` loops.
- Pick units so the last digit of each live number moves at least about once a second.
- Use the shared goal markup (`.goal`, `.goal-row`, `.goal-bar` with `<i>` fill and `<span>` marker, `.verdict` with
  `ok` / `near` / `bad`) and the same verdict words: On track, Close, Off track, Going backwards.
- Colour by meaning (good or bad), and compare values as displayed.
- Every bar must answer "how full, out of what?". No decorative bars.
- Show sources and the "fetched at" time on the page.
- Test at phone width (375 px): no horizontal scrolling, numbers wrap cleanly.

## 6. Writing style

- **No em dashes or en dashes**, in text, code comments, alt text, `<title>`, share descriptions and images. Use
  commas, colons, brackets, full stops, or "to" for ranges ("2015 to 2025"; in tight spaces "2015-25" with a hyphen).
- Professional but approachable. Explain terms the first time ("carbon budget", "net new jobs").
- Say what the numbers don't show (for example, unemployment leaves out people who stopped looking).

## 7. Checklist before merging

- [ ] Data loads in a browser through a local server (`python3 -m http.server`), with no console errors.
- [ ] Every configured country has data (no "No data returned for" warning), or the gap is explained.
- [ ] The counters tick (read, wait two seconds, read again).
- [ ] Goal section shows target, where we should be now, actual pace and a verdict, with sources.
- [ ] Desktop and 375 px phone screenshots look right; no horizontal scroll.
- [ ] `?v=` bumped on every changed CSS/JS file.
- [ ] No duplicated helpers (search `app.js` for `parseCsv`, `Intl.NumberFormat`, `requestAnimationFrame`).
- [ ] No dashes: `grep -rn $'\xe2\x80\x94\|\xe2\x80\x93' .` finds nothing; preview image checked by eye.
- [ ] Link preview image (`img/og-image.png`, 1200×630) regenerated if the header changed.
- [ ] Linked from the personal site (`index.html`, Side projects), the GitHub profile README, and the other clocks'
      footers.
- [ ] README in the clock's folder explains data, method and goal; these docs updated if anything changed.
