# How we built it

The clocks were built in a few short steps, each one building on the last. This is the order things happened in and
why each decision was made.

## 1. The Emissions Clock (the starting point)

The Emissions Clock already existed in its own repository (`ramialbatal/emissions-clock`) when this work started. It
set the pattern every later clock follows:

- A big world counter, a grid of country cards, a method section, and a "?" explainer pop-up.
- Data from Our World in Data's grapher API, fetched in the browser on every visit.
- A simple, explainable model: take the latest official year, grow it by the latest yearly change, spread it evenly
  over the current year.
- A switch between two views (CO₂ and methane), with the choice kept in the URL (`#methane`).

We kept this pattern on purpose. Visitors who know one clock can read the others immediately.

## 2. The Renewables Clock

Goal: show the "other side" of the emissions story, using the same technique.

- **Data choice.** We wanted generation by source (solar, wind, hydro, other) for every country in one request. Our
  World in Data's electricity mix chart, which combines Ember and the Energy Institute, has all of it, through 2025.
- **Same countries as the Emissions Clock**, so the two pages can be compared side by side.
- **Units.** Yearly data is in terawatt-hours (TWh); the counter shows megawatt-hours (MWh) so it ticks visibly.
- **Share of electricity** on each card, because a growing total means little if demand grows faster.
- **A source switch** (All, Solar, Wind, Hydro), mirroring the gas switch, with its own colour per source.

Several data problems came up while building this one; see [Lessons learned](lessons-learned.md).

## 3. The Jobs Clock

The ask was "unemployment vs new employment". There is no worldwide count of jobs created and jobs destroyed (gross
flows). The ILO publishes comparable yearly figures for employment and unemployment in every country, so we chose:

- **Net new jobs** this year (ticking up) next to **people unemployed right now**.
- **ILO modelled estimates**, which already include the ILO's own figures for the current and next year. That means
  this clock does not project anything itself, which makes it the most reliable of the three.
- Yearly averages placed at mid-year and joined with straight lines, so "net new jobs since 1 January" is well defined.

## 4. Goal bars ("a counter without a goal isn't enough")

The counters showed that things were happening, not whether that was good or bad. We added a goal section to each
clock, using official targets wherever one exists:

| Clock | Reference | Verdict today |
|---|---|---|
| Emissions | Remaining carbon budgets for 1.5°C, 1.7°C and 2°C (Global Carbon Budget 2026), plus the IPCC's 48% cut by 2030 | 1.5°C budget about 75% used; pace "Going the wrong way" |
| Renewables | COP28 pledge: triple renewable capacity to at least 11,000 GW by 2030 | "Close" (15.5% growth vs 16.4% needed) |
| Jobs | Net new jobs vs growth of the workforce; direction toward the UN's full-employment goal (SDG 8.5) | "Close" (97 jobs per 100 new workers); SDG "Getting worse" |

Design rules we settled on:

- Each goal shows **where we are**, **where we should be**, and **whether we're going fast enough**.
- Bars **fill in real time**, with a marker for where the value should be today.
- **Verdict badges** use the same words everywhere: On track, Close, Off track, Going backwards (plus a few
  clock-specific ones such as Tripled).
- Where no number exists (SDG 8.5), we say so and show the direction instead of inventing a target.
- Country cards get a small version of the goal, and the list can be sorted by it.

## 5. Refactor

Building the second and third clocks by copying the first left about 600 duplicated lines. Before adding goal bars to
two more clocks, we:

- Moved shared code into `shared/clock-core.js` and `shared/clock-base.css`.
- Replaced per-frame redraws (about 60 a second) with a 10-per-second ticker that only writes text that changed.
- Added a reload at New Year so an open tab doesn't keep counting the old year.
- Added a yearly reminder for the one hand-entered figure (the carbon budget).

The Emissions Clock lives in a separate repository, so it keeps its own copy of the core ideas rather than loading
files across repositories. See [How it works](how-it-works.md#the-emissions-clock-is-separate).
