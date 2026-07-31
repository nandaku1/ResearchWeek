# Research Culture Week 2026 — Lancaster University

A static site for Lancaster University's Research Culture Week programme: browse,
search, and filter the full session schedule, register for each session via LibCal,
and (for admins) add, edit, or delete sessions.

No backend, no database. Five files drive the whole site:

```
index.html    page structure
tokens.css    design tokens (colours, fonts, spacing)
styles.css    all visual styling
app.js        rendering, filtering, admin login, add/edit/delete, export
events.json   the session records — the site's only data source
```

This repo packages the site as a plain Nginx Docker container.

## Running it locally

### With Docker

```bash
docker build -t rcw-site .
docker run --rm -p 8080:80 rcw-site
```

Then visit [http://localhost:8080](http://localhost:8080).

### Without Docker

Double-clicking `index.html` works straight from disk — `app.js` tries to `fetch()`
the live `events.json` first, and falls back to a snapshot baked into an inline
`<script id="events-data">` tag in `index.html` for cases where the browser blocks
local file fetches. That fallback is a point-in-time copy: if `events.json` changes
and the local file:// view should reflect it too, regenerate the inline block with:

```bash
python3 -c "
import json, re
with open('events.json') as f: data = f.read()
with open('index.html') as f: html = f.read()
html = re.sub(r'<script type=\"application/json\" id=\"events-data\">.*?</script>',
              '<script type=\"application/json\" id=\"events-data\">\n' + data.rstrip() + '\n</script>',
              html, flags=re.S)
with open('index.html', 'w') as f: f.write(html)
"
```

Or serve the folder so the live `events.json` is always used:

```bash
python3 -m http.server 8000
```

## Deploying

The image is a plain Nginx container and runs anywhere Docker containers run — a VPS,
Fly.io, Google Cloud Run, AWS ECS, Kubernetes, etc. A GitHub Actions workflow
(`.github/workflows/build.yml`) builds a multi-arch image and publishes it to GitHub
Container Registry on every push to `main` and on releases — point a host at
`ghcr.io/<owner>/<repo>:latest` once that's run.

## Publishing a content change

The site is fully static, so admin edits only exist in the browser until exported and
republished:

1. Log in as admin (the link under the masthead, or in the footer) and make changes —
   add, edit, or delete sessions. Each change is saved to that browser's local storage
   automatically, so an accidental refresh won't lose the work in progress.
2. Click **Download events.json** in the admin bar to save an updated `events.json`.
3. Replace `events.json` in this repo (or wherever it's hosted) with the downloaded
   one, then rebuild/redeploy the container. No other files change.

If two admins edit at the same time in different browsers, the last one to publish
wins — there's no merging. For a small editorial team this is rarely an issue in
practice.

## Admin access

Credentials are hardcoded in `app.js` (`ADMIN_USERNAME`, `ADMIN_PASSWORD`). **This is a
content gate, not real authentication** — the credentials are visible to anyone who
views the page source, since there's no server to keep a secret from. It stops casual
visitors from finding the edit controls; it does not stop a determined person from
reading the password or posting a fabricated `events.json` elsewhere. Do not rely on
this pattern for anything where the data or the site's integrity needs real protection.
Change the two constants in `app.js` before publishing if the defaults need rotating.

## LibCal registration links

Each session's "Register" button uses its `libcalUrl` field. Until a LibCal event page
exists, leave that field blank in the admin edit form — the card shows a disabled
"Registration opening soon" button instead of a dead link. Add the real
`https://lancaster-uk.libcal.com/event/…` URL once it's published, then re-export and
republish `events.json`.

## Fonts and colours

Site chrome uses Lancaster University's official brand colours (Red, Dark Grey,
Orange), taken from the university's public brand guidelines. The display/body font
pairing (Bitter + Switzer) stands in for Lancaster's licensed brand typefaces (Lexia +
Aktiv Grotesk); swap the `--font-display` / `--font-body` values in `tokens.css` and
the corresponding `<link>` tags in `index.html` if a licensed webfont kit becomes
available.

Each session can belong to more than one Research Culture pillar (theme), shown as
small coloured pills on its card and filterable via the theme checkboxes above the
programme grid. Internal colour keys (`gold`/`plum`/`teal`/`lightblue`/`coral`) map to
pillar names in `THEME_LABELS` in `app.js`.

## Accessibility

Built to WCAG 2.1 AA: full keyboard operability, visible focus indicators throughout
(including a masthead-specific focus ring colour, since the site-wide default is too
close in hue to the red masthead background to be visible there), semantic landmarks
and heading order (H1 → H2 → H3 with no skipped level), an accessible name on every
register link that includes the session title, and colour-independent signalling
throughout (theme pills always carry their name as text, form errors show an icon plus
message). Text/background colour pairs are verified against WCAG contrast thresholds —
notably, each theme pill's text colour (dark or light) is chosen per-colour rather than
assumed, since not every fill contrasts the same way with the same text colour.
Responsive down to a 320px viewport width; touch targets are at least 44×44px
throughout.

## Data model (`events.json`)

```json
{
  "id": "monday-s1",
  "day": "monday",
  "dayLabel": "Monday 28th September",
  "slot": "Session One",
  "time": "09:30–11:00",
  "title": "…",
  "themes": ["gold"],
  "chair": "…",
  "speakers": "…",
  "location": "…",
  "libcalUrl": "https://lancaster-uk.libcal.com/event/…"
}
```

`themes` is an array of one or more of `gold | plum | teal | lightblue | coral` — a
session can address more than one pillar. The admin form requires at least one.
`libcalUrl` is `null` when no registration link exists yet. Empty fields (`chair`,
`speakers`, `location`) are allowed and simply omitted from the card display.

## License

The original Nginx/Docker container scaffolding this repo is built on is released into
the public domain under the [Unlicense](UNLICENSE). The site content itself — Lancaster
University's branding, the Research Culture Week programme data, and associated copy —
belongs to Lancaster University and is not covered by that license.
