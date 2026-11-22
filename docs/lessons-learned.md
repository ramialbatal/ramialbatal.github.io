# Lessons learned

Things that didn't work the first time, why, and what we do now. Most of them were silent: the page loaded, but the
numbers were wrong or a country was missing. Check this list before adding a data source.

## Data sources

### A redirect broke cross-origin loading
- **What happened:** the Renewables Clock first used OWID's `electricity-prod-source-stacked` chart. The browser
  refused to load it ("blocked by CORS policy"), although the same URL worked with `curl`.
- **Why:** that slug now answers with a 301 redirect to `electricity-mix?...`, and the redirect response has no
  `Access-Control-Allow-Origin` header. Browsers check the header on every hop.
- **Now:** use the final URL directly. When adding a source, run
  `curl -sI "<url>" | grep -iE '^(HTTP|location|access-control)'` and make sure there is no redirect and the CORS
  header is there.

### The "filtered" CSV silently dropped a country
- **What happened:** Saudi Arabia was missing from the Renewables Clock, with no error.
- **Why:** OWID's `csvType=filtered` drops every year that has any blank cell. Saudi Arabia has no hydro figure, so all
  its recent years disappeared. A `time=` filter made it worse.
- **Now:** for multi-column data, download `csvType=full` (about 150 KB compressed here) and filter rows in the browser.
  After loading, the code logs any configured country with no data (`console.warn("No data returned for: …")`). Keep
  that check in new clocks.

### Multi-dimension charts ignore the country filter after a redirect
- **What happened:** some redirected chart URLs returned every country even with `country=~CHN~USA`.
- **Now:** always filter by code in code, even when you also filter in the URL.

### Carried-forward values
- **What happened:** some OWID charts (for example the electricity share charts) add an `…__original_year` column.
  A "2025" row can really be the 2024 value repeated.
- **Now:** prefer charts without that column. If you must use one, treat a row whose `original_year` differs from its
  year as missing, or trends will be wrong.

### Capacity vs generation
- The COP28 goal is about **installed capacity** (GW), but the Renewables Clock counts **generation** (TWh). Tracking
  the goal needed a second source (IRENA via OWID's indicator API). Check that a goal and the data use the same measure.

### Units and scales differ between sources
- ILO figures are in **thousands** of people; OWID CO₂ is in **tonnes**; electricity is in **TWh**; capacity is in
  **GW**. Convert once, right after loading, and name the unit in variable names or comments.

### Some figures are not in any API
- The remaining carbon budgets are only published in the Global Carbon Budget key messages (a PDF), and the PDF does
  not say which date they count from. We followed the convention of each edition (counting from 1 January of the next
  year) and said so on the page. **Hand-entered figures need a comment saying where they came from and when to update
  them.**

### Gross job flows don't exist globally
- "Jobs created vs jobs lost" isn't measured for the world. We used net change and said so on the page, instead of
  presenting net change as if it were gross hiring.

## Models

### Compounding from a tiny base explodes
- **What happened:** Saudi solar grew 163% in its latest year. Projected two years ahead, that tripled the estimate.
- **Now:** the Renewables Clock caps projection growth at 50% a year (`maxGrowth`), while the card still shows the real
  trend. Any clock that compounds growth over more than one year needs a cap.

### Ratios break when the denominator changes sign
- Jobs per new worker is meaningless when the workforce shrinks (EU, Japan, China). Those countries are judged on
  whether unemployment falls instead, and sorting places them sensibly.

### Per-country versions of global goals can mislead
- Tripling each country's own capacity isn't what COP28 asked for: hydro-rich countries like Canada or Brazil aren't
  expected to triple. We show it as a rough guide and say so.

## Display

### Numbers that never move
- The carbon budget "Gt left" with three decimals changed once every 12 minutes. Now it's in tonnes. **Pick the unit
  from the rate:** the last displayed digit should change at least about once a second.

### Colours that contradict the numbers
- India showed "4.2% (4.2%)" in red, because the unrounded rates differed by 0.03. Compare values as displayed.
- The "since you opened this page" counter showed "-0". `ClockCore.signed()` now drops the sign on a rounded zero.

### Bars that measure nothing
- A full-width bar under "unemployed now" looked meaningful but wasn't. Every bar must answer "how full, out of what?".
  Remove decoration that looks like data.

### Dashes
- The house style forbids em and en dashes. They also hide in **images** (the old Emissions Clock preview image had
  one) and in **JavaScript strings** used as placeholders. Search with
  `grep -rn $'\xe2\x80\x94\|\xe2\x80\x93' .` and check images by eye.

## Code

### Copy-paste clocks
- The second and third clocks started as copies of the first. Within a day, a fix had to be made three times. Shared
  code now lives in `shared/`.

### Redrawing every frame
- The first versions rewrote every number about 60 times a second. Now the ticker runs about 10 times a second and
  `setText` skips unchanged values.

### Year rollover
- `YEAR` is read once at page load. A tab open across New Year kept counting the old year. The ticker now reloads the
  page when the year changes.

## Tooling

- **Test in a real browser through a local server** (`python3 -m http.server`), not by opening the file: CORS and
  relative paths behave differently on `file://`.
- **Check phone width** (375 to 390 px) for horizontal scrolling (`document.documentElement.scrollWidth`).
- **Check the ticker actually ticks:** read a counter, wait two seconds, read it again.
- GitHub Pages only serves `main`. Changes on a branch are invisible until merged.
