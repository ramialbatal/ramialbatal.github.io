# Notes for AI assistants working in this repository

- This repository is Rami Albatal's personal website only (`index.html`, `images/`, `llms.txt`).
- The clocks are separate open projects, each in its own repository and served at the same addresses:
  `ramialbatal/emissions-clock`, `ramialbatal/renewables-clock`, `ramialbatal/jobs-clock`, with shared code in
  `ramialbatal/clock-core` (developer notes in its `docs/` folder). Don't add clock code here.
- Writing style: no em dashes or en dashes anywhere (text, comments, images). Professional but approachable.
- Don't add an email address to any page.
- Keep the `google-site-verification` meta tag in `index.html`: it verifies the Google Search Console property for the
  whole site (homepage and all clocks). Keep `robots.txt` and `sitemap.xml`, and add any new clock's sitemap to `robots.txt`.
- GitHub Pages serves `main`; work on a branch and merge with a pull request.
- `index.html` carries a schema.org `ProfilePage` / `Person` block and share-card tags, and `llms.txt` is a plain
  summary for AI tools. Keep both in step with the page text when it changes (role, profiles, projects).
