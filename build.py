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
from datetime import datetime

from jinja2 import Environment, FileSystemLoader
from markupsafe import Markup
from better_profanity import profanity

# ---------------------------------------------------------------- config ---
SITE_URL = "https://almostgreenz.github.io"   # canonical URL of the Pages site
# Outbound contact link (no contact form on the static site).
LINKEDIN_URL = "https://www.linkedin.com/in/ryan-b-green/"

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
    """Mirror application.py's get_event(): the next scheduled event whose
    date hasn't passed yet, or None when there are no upcoming events."""
    today = datetime.now().date()
    upcoming = []
    for e in events:
        try:
            when = datetime.strptime(e["scheduled"][:19], "%Y-%m-%d %H:%M:%S").date()
        except (KeyError, TypeError, ValueError):
            continue
        if when >= today:
            upcoming.append((when, e))
    upcoming.sort(key=lambda t: t[0])
    return upcoming[0][1] if upcoming else None


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
    content = (post["content"] or "").replace("\n", "<br>")
    html_in = "<" in post["posted"]
    if (len(content) > 620 and len(content[619:]) > 15) and not (
        html_in and content.count("<br>") > 6
    ):
        post["cutoff"] = True
        post["short"] = Markup(content[:620])
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
    event = get_event(load("events"))
    posts_nav = [{"title": p["title"], "url": p["url"]} for p in posts]  # newest first

    film = random.choice(films)
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
            "quote": quote,
            "film": film["name"],
            "year": film["year"],
            "request": FakeRequest(path, SITE_URL + path),
        }

    def write(rel_path, html):
        # Templates use "../static/..." in a few spots; normalize to absolute
        # first so the relativize pass below sees a uniform shape.
        html = html.replace("../static/", "/static/")
        # The feedback route was dropped (contact form only): remove its nav
        # link and repoint the sidebar invite at the contact page.
        html = html.replace(
            '  <a href="/feedback" class="w3-bar-item w3-button w3-padding-large">'
            '<i class="fa fa-sticky-note"></i> &nbsp; Feedback</a>\n',
            "",
        )
        html = html.replace(
            "<a href='/feedback'>Click here if you would like to give feedback!</a>",
            "<a href='/contact'>Click here if you would like to get in touch!</a>",
        )
        # No contact form on the static site, and per Ryan's request the LinkedIn
        # navbar button is gone too: strip both the desktop icon and the mobile
        # menu entry. (The sidebar "connect on LinkedIn" invite stays.)
        html = html.replace(
            '<a href="/contact" class="w3-bar-item w3-button w3-hide-small '
            'w3-padding-large w3-hover-white" title="Contact">'
            '<i class="fa fa-envelope"></i></a>',
            "",
        )
        html = html.replace(
            '<a href="/contact" class="w3-bar-item w3-button w3-padding-large">'
            '<i class="fa fa-envelope"></i> &nbsp; Contact</a>',
            "",
        )
        html = html.replace(
            "<a href='/contact'>Click here if you would like to get in touch!</a>",
            "<a href='%(url)s' target='_blank' rel='noopener'>"
            "Click here to connect on LinkedIn!</a>" % {"url": LINKEDIN_URL},
        )
        # No CDN dependencies: vendor jQuery, Font Awesome 5, and highlight.js
        # locally so the site works offline and from file://. (Inserted as
        # root-absolute paths so the relativize pass below makes them
        # page-relative like everything else.)
        html = html.replace(
            "https://ajax.googleapis.com/ajax/libs/jquery/3.1.1/jquery.min.js",
            "/static/js/jquery.min.js",
        )
        html = html.replace(
            "https://use.fontawesome.com/releases/v5.15.4/js/all.js",
            "/static/js/fa5-all.js",
        )
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
    html = html.replace("href='/?sort=old'", "href='old.html'")
    write("index.html", html)

    # -- homepage, oldest first -------------------------------------------
    ctx = base_ctx("/old.html")
    ctx.update(posts=list(reversed(posts)), sorted_new=False)
    html = env.get_template("index.html").render(ctx)
    html = html.replace(
        """<a href='/' class="w3-button w3-block w3-theme-l1 w3-left-align w3-round" """
        """style="text-decoration: none"><i class="fa fa-sort-amount-desc fa-fw """
        """w3-margin-right"></i> Sort</a>""",
        """<a href='index.html' class="w3-button w3-block w3-theme-l1 w3-left-align w3-round" """
        """style="text-decoration: none"><i class="fa fa-sort-amount-desc fa-fw """
        """w3-margin-right"></i> Sort</a>""",
    )
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
        html = html.replace("/about?choice=doing", "/about/doing/")
        html = html.replace("/about?choice=like", "/about/like/")
        html = html.replace("/about?choice=going", "/about/going/")
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
    # Bake every film+quote into a JS file so each page load can pick a new
    # "Film of the Hour" client-side (the old Wikiquote API is dead, and the
    # static pages can't rotate it at serve time).
    film_quotes = [
        {"name": f["name"], "year": f["year"], "quote": quotes[f["name"]]}
        for f in films
        if f["name"] in quotes
    ]
    with open(os.path.join(OUT, "static", "js", "film-quotes.js"), "w") as f:
        f.write("var FILM_QUOTES = " + json.dumps(film_quotes) + ";\n")
    css_path = os.path.join(OUT, "static", "styling", "css", "styles.pure.css")
    with open(css_path) as f:
        css = f.read()
    css = css.replace(
        "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/fonts/",
        "../../fonts/",
    )
    css = css.replace(
        "https://fonts.gstatic.com/s/opensans/v17/mem8YaGs126MiZpBA-UFVZ0e.ttf",
        "../../fonts/opensans-regular.ttf",
    )
    with open(css_path, "w") as f:
        f.write(css)
    for name in ROOT_FILES:
        src = os.path.join(STATIC_DIR, name)
        if os.path.exists(src):
            shutil.copy2(src, os.path.join(OUT, name))
    # Tell GitHub Pages to skip Jekyll processing
    open(os.path.join(OUT, ".nojekyll"), "w").close()

    n_files = sum(len(fs) for _, _, fs in os.walk(OUT))
    print("\ndone: %d files in %s" % (n_files, OUT))
    print("film of the hour: %s (%s)" % (film["name"], film["year"]))


if __name__ == "__main__":
    main()
