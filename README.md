# Personal website — static source

This is the full source of the static site. The JSON files in `data/` are the
site's database; `build.py` renders them into the deployable site in `docs/`.

## Layout

```
.
├── README.md            this file
├── build.py             the static site generator (logic + config only, no content)
├── requirements.txt     Python dependencies for build.py
├── data/                the content — the site's "database" as JSON
│   ├── posts.json       blog posts (title, url, tags, posted date, content, images…)
│   ├── films.json       films for the "Film of the Hour" quote box
│   ├── quotes.json      one quote per film (the Wikiquote API the old site used
│                        is dead, so quotes are baked in at build time)
│   └── events.json      upcoming events for the sidebar card. One-time events use
│                        "scheduled": "YYYY-MM-DD HH:MM:SS"; recurring yearly
│                        events use "recurring": "yearly" with "month"/"day".
│                        The card is rendered client-side from these, so past
│                        events disappear on their own — rebuild only to add
│                        or change events.
├── assets/              third-party files vendored locally so the site has no
│   ├── fonts/           CDN dependencies: Font Awesome fonts, Open Sans,
│   │                    Bricolage Grotesque (display type)
│   ├── js/              highlight.js (used by the VisualsAplenty subsite)
│   └── css/             highlight.js theme
├── source/
│   ├── templates/       Jinja2 page templates (the "bold & personal" redesign)
│   └── static/
│       ├── styling/css/ bold.css — the site's stylesheet (no frameworks)
│       ├── js/          site.js — filters, sort, galleries, quote/event rotation
│       └── images/      photos, avatar, Vimeo thumbnail posters
└── docs/                the generated output — this is what GitHub Pages serves
    ├── index.html
    ├── old.html
    ├── 404.html
    ├── .nojekyll
    ├── about/
    ├── post/
    ├── static/
    └── visualsaplenty/
```

## Workflow

1. Edit the JSON files in `data/` to update content.
2. Install dependencies once: `pip install -r requirements.txt`
3. Rebuild: `python3 build.py` (regenerates `docs/`)
4. Commit and push — the live site updates.

Config (canonical site URL used by the share buttons, LinkedIn URL, tag
colours) lives at the top of `build.py`.

## Deploying to GitHub Pages

1. Create a new public repository and push this whole project to it.
2. In the repo's Settings → Pages: Deploy from branch → `main`, folder
   → `/ (docs)`.
3. Done — the site works under any repo name because all URLs are relative.

Note: `build.py`, `data/`, etc. are publicly readable in the repo, which is
fine — it's all public blog content anyway.

## Custom domain (ryanbgreen.ca)

The build already prepares everything for the custom domain:

- `docs/CNAME` is generated from the repo-root `CNAME` file (currently
  `www.ryanbgreen.ca`) — GitHub Pages picks it up automatically.
- `SITE_URL` in `build.py` is the canonical URL used for share links.

DNS setup (in Cloudflare's DNS panel — not the registrar):

- `www` → CNAME → `AlmostGreenz.github.io`
- apex (`@`) → A records → `185.199.108.153`, `185.199.109.153`,
  `185.199.110.153`, `185.199.111.153` (GitHub redirects apex → www)

Keep both records **DNS only (gray cloud), not proxied**: GitHub Pages
provisions and auto-renews the HTTPS certificate itself, and the orange
cloud breaks its renewal checks (the site works until the cert expires,
then HTTPS silently breaks). With DNS-only records, Cloudflare is purely
your DNS provider and GitHub handles HTTPS end to end. Nothing to change
at WHC as long as the nameservers already point at Cloudflare.

Then: repo Settings → Pages → Custom domain → `www.ryanbgreen.ca`,
wait for the certificate (~15 min), and tick Enforce HTTPS.

To make the apex canonical instead, change the repo-root `CNAME` and
`SITE_URL` to the bare domain and rebuild.
