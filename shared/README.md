# Shared clock code

Used by the [Renewables Clock](../renewables-clock/) and the [Jobs Clock](../jobs-clock/).

- `clock-core.js` exposes `window.ClockCore`: CSV/JSON fetching, number formats, the projection and goal helpers
  (`project`, `neededGrowth`, `verdict`), line charts, card helpers, the explainer pop-up, and the ticker.
- `clock-base.css` holds the shared layout and the goal-bar styles. Each clock sets its colours in `css/theme.css`
  through five variables: `--accent`, `--accent-2`, `--tint`, `--glow`, `--on-accent`.

The ticker (`startTicker`) redraws about 10 times a second, only writes numbers that changed (`setText`), pauses with
the browser when the tab is hidden, and reloads the page when the year changes.

The Emissions Clock lives in its own repository and keeps its own copy of this code.
