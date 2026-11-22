# Notes for AI assistants working in this repository

- This repository is Rami Albatal's personal site plus the Renewables and Jobs clocks. The Emissions Clock lives in
  `ramialbatal/emissions-clock`.
- Before changing any clock, read `docs/README.md`, then `docs/lessons-learned.md` and `docs/adding-a-clock.md`.
- Reuse `shared/clock-core.js` and `shared/clock-base.css`; never copy their helpers into a clock.
- Writing style: no em dashes or en dashes anywhere (text, comments, images). Professional but approachable.
- Don't add an email address to any page.
- Test in a browser through `python3 -m http.server`, at desktop and 375 px phone width, and check counters tick.
- Bump the `?v=` query on every changed CSS/JS file.
- GitHub Pages serves `main`; work on a branch and merge with a pull request.
