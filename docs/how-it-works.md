# How it works

## Files

```
ramialbatal.github.io/
├── index.html                  personal site (links to the clocks)
├── shared/
│   ├── clock-core.js           window.ClockCore: fetching, formats, models, ticker, page chrome
│   ├── clock-base.css          shared layout, cards, pop-up, goal bars
│   └── README.md
├── renewables-clock/
│   ├── index.html              page markup (goal section, cards grid, method, pop-up)
│   ├── css/theme.css           colours + Renewables-only styles (per-source colours, mix bars)
│   ├── js/config.js            window.RE_CONFIG: data sources, columns, countries, goal settings
│   ├── js/app.js               loading, models, rendering, ticker callback
│   └── img/                    icon.svg, og-image.png (link preview, 1200×630)
├── jobs-clock/                 same layout; window.JOBS_CONFIG
└── docs/                       these notes

ramialbatal/emissions-clock     separate repository, same layout with css/style.css and window.CO2_CONFIG
```

Each page loads, in order: `../shared/clock-base.css`, `css/theme.css`, `../shared/clock-core.js`, `js/config.js`,
`js/app.js`. All scripts are plain browser JavaScript (no modules, no build). Files are referenced with a `?v=YYYYMMDDx`
query so a change reaches visitors despite caching: **bump it in `index.html` whenever you change a file.**

## Page lifecycle

1. The body starts with `data-state="loading"`. CSS shows only `.loading-only` content (a spinner).
2. `app.js` starts the fetches. Each loader is wrapped in `ClockCore.once()`, so it runs once and is reused; if it
   fails, the cache is cleared so "Try again" refetches.
3. When data arrives, `render()` builds the world figures, goal section and cards, then calls
   `ClockCore.startTicker(fn)`.
4. `setState("ready")` reveals `.ready-only` content. On failure, `setState("error", message)` shows the error box.
5. The ticker calls `fn(nowMs)` about 10 times a second until the next `render()` or `stopTicker()`.

Optional data (for example renewable capacity) is loaded in parallel and allowed to fail: the goal section stays
hidden and the rest of the page still works.

## Shared core (`shared/clock-core.js`)

| Group | Functions | Notes |
|---|---|---|
| Time | `YEAR`, `yearFraction(ms)`, `tYears(ms)`, `SEC_PER_YEAR`, `msPerYear(y)` | All in UTC. `tYears` gives fractional years (2026.89). |
| Formats | `fmt[0..3]`, `signed(x, f)`, `pct(x, d)`, `digits(s)` | `signed` never shows "-0". `digits` wraps digits so the big counter doesn't jitter. |
| Fetching | `fetchCsv`, `fetchJson`, `fetchText`, `parseCsv`, `once(loader)` | Errors name the host. |
| Models | `project(series, n, maxGrowth)`, `neededGrowth(from, to, years)`, `verdict(actual, needed)` | See below. |
| Rendering | `sparkline(years, values, opts)`, `wireHistory(card)`, `sortInto(grid, cards, key)` | Sparkline colours follow `opts.good` ("up" or "down"). |
| Ticker | `startTicker(fn, fps)`, `stopTicker()`, `setText(el, s, html)` | Reloads the page when the year changes. |
| Chrome | `setState`, `wireHelp`, `fill(name, value)` | `fill("year", 2026)` fills every `[data-year]`. |

Styling: `clock-base.css` reads five colour variables that each clock sets in `theme.css`: `--accent`, `--accent-2`,
`--tint` (background glow), `--glow` (counter text shadow) and `--on-accent` (text on accent buttons).

## Data sources

| Clock | What | Endpoint | Notes |
|---|---|---|---|
| Emissions | CO₂ by country | OWID grapher `annual-co2-emissions-per-country.csv` (filtered) | Global Carbon Project |
| Emissions | Methane by country | OWID grapher `methane-emissions.csv` | Jones et al. |
| Emissions | World total CO₂ incl. land use | OWID grapher `annual-co2-including-land-use.csv` | For the carbon budget bars |
| Emissions | Remaining carbon budgets | typed into `js/config.js` | **Update every November** from the new Global Carbon Budget |
| Renewables | Generation by source, all countries | OWID grapher `electricity-mix.csv?frequency=annual&metric=by_source&source=total&csvType=full` | Ember + Energy Institute. Full CSV on purpose (about 150 KB compressed). |
| Renewables | Installed renewable capacity | `api.ourworldindata.org/v1/indicators/1305907.data.json` + `.metadata.json` | IRENA. End-of-year GW. Metadata maps entity ids to country codes. |
| Jobs | Employed, unemployed, rate | `rplumber.ilo.org/data/indicator/?id=…&ref_area=X01+CHN+…&format=.csv` | ILO modelled estimates, thousands of people, ages 15+. `X01` = world, `X92` = EU-27. |

All of these send `Access-Control-Allow-Origin: *`, which is why the pages need no server.

## Models

### Projecting a yearly figure (Emissions, Renewables generation)

`ClockCore.project(series, n, maxGrowth)`:

```
growth  = (value[last] / value[last - n])^(1/n) - 1        n = trendYears (1 = latest year-on-year change)
used    = min(growth, maxGrowth)                           Renewables caps at 50% a year
annual  = value[last] × (1 + used)^(this year - last)
so far  = annual × fraction of the year elapsed (UTC)
```

### Carbon budget (Emissions)

- `used(t)` = total CO₂ since 1 January 2016 (Paris Agreement), using official years and the projection for this year.
- The published budget counts from 1 January of `budget.from` (2027 for the 2026 edition), so remaining today =
  budget + emissions still to come before that date.
- Bar total = used up to `from` + budget. "Runs out" = remaining ÷ this year's rate.
- Pace check: straight line from 2019 to a 48% cut in 2030; compare this year's emissions with where that line is now.

### Capacity goal (Renewables)

- IRENA values are end-of-year, so the 2025 value sits at 2026.0.
- Capacity now = latest value grown at its latest yearly growth.
- On-track path = compound growth from the 2022 value to 11,000 GW at the end of 2030. The bar marker shows it.
- Verdict compares latest growth with the growth needed from the latest value to the target.
- Cards apply the same test to tripling each country's own 2022 capacity (a rough guide; the pledge is global).

### Levels between yearly averages (Jobs)

- Each ILO yearly average is placed at mid-year (2026 → 2026.5); the level at any moment is a straight line between
  neighbouring mid-years.
- Net new jobs so far = employed now - employed on 1 January. New workers = growth of (employed + unemployed).
- Keeping-up ratio = net new jobs ÷ new workers over the calendar year. If the workforce shrinks, the ratio is
  meaningless, so the verdict uses whether unemployment falls.

## Displaying numbers

- The ticker runs about 10 times a second. `setText` writes to the DOM only when the formatted string changes.
- Choose units so the main numbers visibly move (MWh not TWh, tonnes not gigatonnes, MW not GW).
- Colours follow meaning, not direction: for emissions, up is bad; for renewables and jobs, up is good.
- Compare values **as displayed** when choosing a colour, so "4.2% (4.2%)" is never shown in red.

## The Emissions Clock is separate

It lives in `ramialbatal/emissions-clock` and is served from the same domain under `/emissions-clock/`. It has its own
copies of the CSV parser, formats and ticker (`every()` / `setText()` in its `app.js`). We chose not to load
`../shared/` across repositories, because a change in one repository could then silently break the other. If you fix
something in `shared/`, check whether the Emissions Clock needs the same fix.

## Publishing

GitHub Pages serves the `main` branch of each repository. Work happens on a branch, then gets merged with a pull
request; the live site updates a minute or two after the merge.
