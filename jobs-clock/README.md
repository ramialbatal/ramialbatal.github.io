# Jobs Clock

**Live site: https://ramialbatal.github.io/jobs-clock/**

A static, real-time clock of **net new jobs** so far this year, next to the number of **unemployed people**, for the world and major economies.
It is part of the same series as the [Emissions Clock](https://ramialbatal.github.io/emissions-clock/) and the [Renewables Clock](https://ramialbatal.github.io/renewables-clock/).

## Data

On load, the page fetches three series from the [ILOSTAT API](https://ilostat.ilo.org/data/) (it allows cross-origin requests):
the ILO modelled estimates of employment, unemployment and the unemployment rate, ages 15+.
The ILO's latest edition includes its own estimates for the current and next year, so the page does not project the data itself.
Countries are configured in `js/config.js` (`X01` is the world, `X92` the EU-27).

## Method

Each yearly average is placed at the middle of its year, and the level at any moment is a straight line between neighbouring years.
Net new jobs so far = employment now minus employment on 1 January. Net means jobs gained minus jobs lost; no global source counts the gross churn.
This is a model, not a live measurement.

## Goal: are jobs keeping up?

New workers = growth in the labour force (employed plus unemployed) over the calendar year. The goal bar compares net new
jobs with new workers; at 100 or more per 100, unemployment falls. Countries with a shrinking workforce are judged on
whether unemployment is falling. A second check shows the direction of unemployment toward the UN's 2030 goal of full
employment (SDG target 8.5), which has no numeric target.
