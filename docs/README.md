# Clocks: developer notes

This folder explains how the "AI for things that matter" clocks were built, how they work, what went wrong along the
way, and the rules to follow when adding to them.

| Clock | Live page | Code |
|---|---|---|
| Emissions Clock | https://ramialbatal.github.io/emissions-clock/ | separate repository: `ramialbatal/emissions-clock` |
| Renewables Clock | https://ramialbatal.github.io/renewables-clock/ | `renewables-clock/` in this repository |
| Jobs Clock | https://ramialbatal.github.io/jobs-clock/ | `jobs-clock/` in this repository |
| Shared code | | `shared/` in this repository (used by Renewables and Jobs) |

## Read in this order

1. [How we built it](how-we-built-it.md): the story and the main decisions, in the order they were made.
2. [How it works](how-it-works.md): files, data flow, the models behind each counter and goal bar.
3. [Lessons learned](lessons-learned.md): what didn't work, and what we changed because of it. Read this before
   touching any data source.
4. [Adding a clock](adding-a-clock.md): rules and a checklist for new clocks or new features, so we don't duplicate
   code, read data badly or show numbers that mislead.

## The short version

- **Static pages, no server, no build step.** Each clock is plain HTML, CSS and JavaScript. Data is fetched live in
  the visitor's browser from public APIs that allow cross-origin requests.
- **Official yearly data, turned into a live counter.** A yearly figure is projected to this year where needed and
  spread evenly over the year. The counters are a model, not a measurement, and every page says so.
- **Every counter needs a reference point.** A number alone doesn't tell people whether things are good or bad, so
  each clock has a goal section: a bar that fills toward an official target, a pace check, and a verdict badge.
- **One shared core.** Code used by more than one clock lives in `shared/`. Don't copy it into a clock.
- **House style:** no em dashes or en dashes anywhere (text, code comments, images). Use commas, colons, brackets or
  "to" for ranges.
