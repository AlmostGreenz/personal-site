#!/usr/bin/env python3
"""
Static site generator: freezes the Flask personal website into plain HTML/CSS/JS
for GitHub Pages hosting.

Usage: python3 build.py
Output: site/  (deploy this directory to GitHub Pages)

Config is at the top of this file.
"""
import json
import os
import random
import re
import shutil
from datetime import date, datetime

from jinja2 import Environment, FileSystemLoader
from markupsafe import Markup
from better_profanity import profanity

# ---------------------------------------------------------------- config ---
SITE_URL = "https://www.ryanbgreen.ca/"   # canonical URL of the Pages site
# Outbound contact link (no contact form on the static site).
LINKEDIN_URL = "https://www.linkedin.com/in/ryan-b-green/"
# The featured film quote is fixed: one quote baked in at build time, never
# changes between builds or page loads. Set to any name in data/films.json.
FEATURED_FILM_NAME = "WarGames"

BASE = os.path.dirname(os.path.abspath(__file__))
# Portable: templates and static assets live in ./source/ next to this script.
SRC = os.path.join(BASE, "source")
TEMPLATE_DIR = os.path.join(SRC, "templates")
STATIC_DIR = os.path.join(SRC, "static")
# The built site goes in docs/ so GitHub Pages can serve it directly
# (repo Settings → Pages → Deploy from branch → /(docs)).
OUT = os.path.join(BASE, "docs")

TAG_COLOUR = {
    "Python": "d2",
    "Arduino": "d1",
    "Software": "l2",
    "Games": "l3",
    "Misc.": "l4",
}

# All content lives in data/*.json (the JSON files are the site's database).
# build.py contains only logic and config -- no content is hardcoded here.

# Files the Flask app served from the site root (/<name>.<filetype>); copy them
# to the output root too so /favicon.ico, /robots.txt etc. keep working.
ROOT_FILES = [
    "robots.txt",
    "favicon.ico",
    "favicon-16x16.png",
    "favicon-32x32.png",
    "apple-touch-icon.png",
    "android-chrome-192x192.png",
    "android-chrome-256x256.png",
    "mstile-150x150.png",
    "safari-pinned-tab.svg",
    "site.webmanifest",
    "browserconfig.xml",
]


# ------------------------------------------------------------- helpers ---
class FakeRequest:
    """Minimal stand-in for Flask's request, for the bits templates use."""

    def __init__(self, path, base_url):
        self.path = path
        self.base_url = base_url


def relativize(html, depth):
    """Rewrite root-absolute URLs to page-relative ones.

    The original templates use /static/..., /about, /post/... which only work
    when served over HTTP from a domain root. Page-relative URLs work from
    file://, localhost, and GitHub Pages under any repo path.

    The final regex runs in a single pass so replacements are never
    re-scanned (which is what naive sequential str.replace gets wrong).
    """
    p = "./" if depth == 0 else "../" * depth
    # 1. normalize extensionless directory routes to trailing-slash form
    html = re.sub(r'"/post/([^"/]+)"', r'"/post/\1/"', html)
    html = html.replace('"/about"', '"/about/"')
    html = html.replace('"/visualsaplenty/documentation"', '"/visualsaplenty/documentation/"')
    html = html.replace('"/visualsaplenty/examples"', '"/visualsaplenty/examples/"')
    # 2. one pass: every remaining "/..." becomes page-relative
    return re.sub(r'"/(?!/)', '"%s' % p, html)


def load(name):
    with open(os.path.join(BASE, "data", name + ".json")) as f:
        return json.load(f) or []


def get_event(events):
    """Mirror application.py's get_event(): the next upcoming event, or None
    when there are no upcoming events. Supports one-time events
    (scheduled: 'YYYY-MM-DD HH:MM:SS') and yearly recurring events
    (recurring: 'yearly', month, day). The returned dict carries a 'display'
    date string for the template."""
    today = datetime.now().date()
    best = None
    for e in events:
        when = None
        if e.get("recurring") == "yearly" and e.get("month") and e.get("day"):
            try:
                when = date(today.year, e["month"], e["day"])
            except ValueError:
                continue
            if when < today:
                when = date(today.year + 1, e["month"], e["day"])
        elif e.get("scheduled"):
            try:
                when = datetime.strptime(
                    e["scheduled"][:19], "%Y-%m-%d %H:%M:%S"
                ).date()
            except (TypeError, ValueError):
                continue
            if when < today:
                continue
        if when is None:
            continue
        e = dict(e)
        e["display"] = "%s %d, %d" % (when.strftime("%B"), when.day, when.year)
        if best is None or when < best[0]:
            best = (when, e)
    return best[1] if best else None


def close_dangling_tags(html):
    """Close any inline tags left open when an excerpt was cut mid-tag, so a
    truncated card excerpt can't swallow the rest of the page's markup."""
    stack = []
    for m in re.finditer(r"</?([a-zA-Z][a-zA-Z0-9]*)[^>]*>", html):
        tag = m.group(0)
        name = m.group(1).lower()
        if tag.startswith("</"):
            while stack and stack[-1] != name:
                html += "</%s>" % stack.pop()
            if stack:
                stack.pop()
        elif not tag.endswith("/>") and name not in ("br", "hr", "img", "input"):
            stack.append(name)
    for name in reversed(stack):
        html += "</%s>" % name
    return html


def process_post(raw):
    """Mirror the post-processing in application.py's index() route."""
    post = dict(raw)
    post["images"] = (post["images"] or "").split()
    tags = post["tags"] or ""
    post["tags"] = tags.split() + [tags] if tags else []
    posted = post["posted"] or ""
    if len(posted) > 19:
        posted = posted[: posted.index(".")]
    post["posted"] = posted
    # "Nov 16, 2024" for the card date line.
    try:
        dt = datetime.strptime(posted[:19], "%Y-%m-%d %H:%M:%S")
        post["posted_display"] = "%s %d, %d" % (dt.strftime("%b"), dt.day, dt.year)
    except (TypeError, ValueError):
        post["posted_display"] = posted
    # Vimeo id for the thumbnail poster + watch link.
    m = re.search(r"vimeo\.com/video/(\d+)", post.get("video") or "")
    post["video_id"] = m.group(1) if m else ""
    content = (post["content"] or "").replace("\n", "<br>")
    html_in = "<" in post["posted"]
    if (len(content) > 620 and len(content[619:]) > 15) and not (
        html_in and content.count("<br>") > 6
    ):
        post["cutoff"] = True
        excerpt = content[:620]
        # don't end mid-word: cut back to the last space (if one is near)
        sp = excerpt.rfind(" ")
        if sp > 560:
            excerpt = excerpt[:sp]
        post["short"] = Markup(close_dangling_tags(excerpt))
    elif content.count("<br>") > 6:
        post["cutoff"] = True
        post["short"] = Markup("<br>".join(content.split("<br>")[:5]))
    else:
        post["cutoff"] = False
    post["content"] = Markup(content)
    return post


# ------------------------------------------------------------------ build ---
def main():
    random.seed()
    profanity.load_censor_words()

    posts = [process_post(p) for p in load("posts")]
    films = load("films")
    quotes = load("quotes")
    events = load("events")
    event = get_event(events)
    posts_nav = [{"title": p["title"], "url": p["url"]} for p in posts]  # newest first
    tag_counts = {}
    for p in posts:
        for t in p["tags"][:-1]:
            tag_counts[t] = tag_counts.get(t, 0) + 1

    # Featured film quote: fixed, baked in at build time as the no-JS fallback.
    # Visitors with JS see the hourly "Film of the Hour" rotation instead.
    film = next((f for f in films if f["name"] == FEATURED_FILM_NAME), films[0])
    quote = profanity.censor(quotes.get(film["name"], ""))

    if os.path.exists(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)

    env = Environment(loader=FileSystemLoader(TEMPLATE_DIR), autoescape=False)

    def base_ctx(path):
        return {
            "logged_in": False,
            "event": event,
            "posts": posts_nav,
            "colours": TAG_COLOUR,
            "tag_counts": tag_counts,
            "quote": quote,
            "film": film["name"],
            "year": film["year"],
            "request": FakeRequest(path, SITE_URL + path),
        }

    def write(rel_path, html):
        # Templates use "../static/..." in a few spots; normalize to absolute
        # first so the relativize pass below sees a uniform shape.
        html = html.replace("../static/", "/static/")
        # VisualsAplenty ships its own highlight.js from a CDN; vendor it
        # locally so the site works offline and from file://. (Inserted as
        # root-absolute paths so the relativize pass below makes them
        # page-relative like everything else.)
        html = html.replace(
            "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.3.1/highlight.min.js",
            "/static/js/highlight.min.js",
        )
        html = html.replace(
            "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.3.1/styles/github.min.css",
            "/static/css/github.min.css",
        )
        # Page-relative URLs so the site works from file://, localhost, and
        # GitHub Pages under any repo path.
        html = relativize(html, rel_path.count("/"))
        dest = os.path.join(OUT, rel_path)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, "w") as f:
            f.write(html)
        print("wrote", rel_path)

    # -- homepage, newest first -------------------------------------------
    ctx = base_ctx("/")
    ctx.update(posts=posts, sorted_new=True)
    html = env.get_template("index.html").render(ctx)
    write("index.html", html)

    # -- homepage, oldest first -------------------------------------------
    # Same index template, posts reversed; the client-side sort toggle starts
    # in the "Oldest first" state via sorted_new=False.
    ctx = base_ctx("/old.html")
    ctx.update(posts=list(reversed(posts)), sorted_new=False)
    html = env.get_template("index.html").render(ctx)
    write("old.html", html)

    # -- about pages (the ?choice= variants become static subpages) --------
    for choice, rel in [
        ("start", "about/index.html"),
        ("doing", "about/doing/index.html"),
        ("like", "about/like/index.html"),
        ("going", "about/going/index.html"),
    ]:
        ctx = base_ctx("/" + rel.replace("/index.html", ""))
        ctx.update(choice=choice)
        html = env.get_template("about.html").render(ctx)
        write(rel, html)

    # -- individual post pages --------------------------------------------
    for post in posts:
        ctx = base_ctx("/post/" + post["url"])
        ctx.update(post=post)
        html = env.get_template("view_post.html").render(ctx)
        write("post/%s/index.html" % post["url"], html)

    # -- VisualsAplenty subsite (standalone templates, no context needed) --
    for name in ["index", "documentation", "examples"]:
        html = env.get_template("visualsaplenty/%s.html" % name).render()
        html = html.replace("../static/", "/static/")
        if name == "index":
            write("visualsaplenty/index.html", html)
        else:
            write("visualsaplenty/%s/index.html" % name, html)

    # -- 404 page (GitHub Pages serves 404.html automatically) -------------
    ctx = base_ctx("/404.html")
    ctx.update(code=404, message="Not Found")
    write("404.html", env.get_template("error.html").render(ctx))

    # -- static assets ------------------------------------------------------
    shutil.copytree(STATIC_DIR, os.path.join(OUT, "static"))
    # Vendor the Font Awesome webfonts locally and point the CSS at them.
    # The original CSS pulled them from a CDN, which broke icons whenever the
    # CDN was unreachable (and adds a runtime dependency the static site
    # shouldn't have). Relative URLs keep them working from file:// too.
    shutil.copytree(
        os.path.join(BASE, "assets", "fonts"), os.path.join(OUT, "static", "fonts")
    )
    for sub in ("js", "css"):
        src = os.path.join(BASE, "assets", sub)
        if os.path.isdir(src):
            shutil.copytree(src, os.path.join(OUT, "static", sub), dirs_exist_ok=True)
    # Bake every film+quote into a JS file so the "Film of the Hour" rotates
    # hourly client-side (the old Wikiquote API is dead, and the static
    # pages can't rotate it at serve time).
    film_quotes = [
        {"name": f["name"], "year": f["year"], "quote": quotes[f["name"]]}
        for f in films
        if f["name"] in quotes
    ]
    with open(os.path.join(OUT, "static", "js", "film-quotes.js"), "w") as f:
        f.write("var FILM_QUOTES = " + json.dumps(film_quotes) + ";\n")
    # Bake events for client-side rendering: the upcoming-event card picks the
    # next event at page-load time so past events expire without a rebuild.
    with open(os.path.join(OUT, "static", "js", "site-events.js"), "w") as f:
        f.write("var SITE_EVENTS = " + json.dumps(events) + ";\n")
    for name in ROOT_FILES:
        src = os.path.join(STATIC_DIR, name)
        if os.path.exists(src):
            shutil.copy2(src, os.path.join(OUT, name))
    # Tell GitHub Pages to skip Jekyll processing
    open(os.path.join(OUT, ".nojekyll"), "w").close()
    # Custom domain: GitHub Pages reads the CNAME from the publish root.
    cname_src = os.path.join(BASE, "CNAME")
    if os.path.exists(cname_src):
        shutil.copy2(cname_src, os.path.join(OUT, "CNAME"))

    n_files = sum(len(fs) for _, _, fs in os.walk(OUT))
    print("\ndone: %d files in %s" % (n_files, OUT))
    print("featured film: %s (%s)" % (film["name"], film["year"]))


if __name__ == "__main__":
    main()
