/*
 * Which countries to show, and where the official data comes from.
 *
 * Data is fetched live in the browser from the ILOSTAT API (International Labour
 * Organization), which sends `Access-Control-Allow-Origin: *`, so no server is needed.
 * The series are the ILO modelled estimates (ILOEST): comparable figures for every
 * country, including the ILO's own estimates for the current and next year.
 * Values are in thousands of people, ages 15+.
 *
 * To add a country, add its ISO 3166-1 alpha-3 code (ILO uses X01 for the world, X92 for the EU-27).
 */
window.JOBS_CONFIG = {
  apiBase: "https://rplumber.ilo.org/data/indicator/",
  indicators: {
    employed: "EMP_2EMP_SEX_AGE_NB_A",    // employment, thousands
    unemployed: "UNE_2UNE_SEX_AGE_NB_A",  // unemployment, thousands
    rate: "UNE_2EAP_SEX_AGE_RT_A"         // unemployment rate, %
  },
  source: "International Labour Organization, ILO modelled estimates",
  sourceUrl: "https://ilostat.ilo.org/data/",
  historyFrom: 2015,
  world: "X01",
  // Same countries as the Emissions and Renewables clocks, so the pages can be compared.
  countries: [
    { code: "CHN", flag: "🇨🇳", name: "China" },
    { code: "USA", flag: "🇺🇸", name: "United States" },
    { code: "IND", flag: "🇮🇳", name: "India" },
    { code: "X92", flag: "🇪🇺", name: "European Union" },
    { code: "RUS", flag: "🇷🇺", name: "Russia" },
    { code: "JPN", flag: "🇯🇵", name: "Japan" },
    { code: "IRN", flag: "🇮🇷", name: "Iran" },
    { code: "IDN", flag: "🇮🇩", name: "Indonesia" },
    { code: "SAU", flag: "🇸🇦", name: "Saudi Arabia" },
    { code: "KOR", flag: "🇰🇷", name: "South Korea" },
    { code: "DEU", flag: "🇩🇪", name: "Germany", partOf: "EU" },
    { code: "CAN", flag: "🇨🇦", name: "Canada" },
    { code: "MEX", flag: "🇲🇽", name: "Mexico" },
    { code: "BRA", flag: "🇧🇷", name: "Brazil" },
    { code: "TUR", flag: "🇹🇷", name: "Türkiye" },
    { code: "ZAF", flag: "🇿🇦", name: "South Africa" },
    { code: "AUS", flag: "🇦🇺", name: "Australia" },
    { code: "GBR", flag: "🇬🇧", name: "United Kingdom" }
  ]
};
