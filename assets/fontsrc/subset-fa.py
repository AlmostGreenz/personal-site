#!/usr/bin/env python3
"""Re-subset Font Awesome to only the icons the site actually uses.

When you want a new FA icon (4.7 set):
  1. Use class="fa fa-<name>" in a template, and add the glyph definition to
     source/static/styling/css/bold.css:
         .fa-<name>:before { content: "\\fXXX"; }      (code from the FA 4.7 cheatsheet)
  2. Run this script:  python3 assets/fontsrc/subset-fa.py
  3. Rebuild:  python3 build.py

The script audits every fa-* class in the templates/JS, fails loudly if one
has no CSS glyph definition, and writes the subset to
assets/fonts/fontawesome-webfont.woff2 (the full 704-glyph source lives next
to this script and is never deployed).

Requires: pip install fonttools brotli
"""

import os
import re
import sys

BASE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC_FONT = os.path.join(BASE, "assets", "fontsrc", "fontawesome-webfont.woff2")
DST_FONT = os.path.join(BASE, "assets", "fonts", "fontawesome-webfont.woff2")
CSS = os.path.join(BASE, "source", "static", "styling", "css", "bold.css")
SCAN_DIRS = [
    os.path.join(BASE, "source", "templates"),
    os.path.join(BASE, "source", "static", "js"),
]
NON_GLYPH = {"fa-fw", "fa-lg"}  # sizing utilities, not icons


def main():
    try:
        from fontTools import subset
        from fontTools.ttLib import TTFont
    except ImportError:
        sys.exit("need fonttools+brotli: pip install fonttools brotli")

    css = open(CSS).read()

    # 1. every fa-* class used in templates/JS ...
    used = set()
    for d in SCAN_DIRS:
        for root, _, files in os.walk(d):
            for fn in files:
                text = open(os.path.join(root, fn), errors="ignore").read()
                used.update(re.findall(r"fa-[a-z0-9-]+", text))
    used = {c for c in used if c not in NON_GLYPH and c != "fa"}
    if not used:
        sys.exit("no fa-* classes found -- nothing to subset")

    # 2. ... must have a glyph definition in the CSS
    codes = {}
    missing = []
    for cls in sorted(used):
        m = re.search(
            r"\.%s:before\s*\{\s*content:\s*\"\\([0-9a-fA-F]+)\"" % re.escape(cls), css
        )
        if m:
            codes[cls] = int(m.group(1), 16)
        else:
            missing.append(cls)
    if missing:
        sys.exit(
            "these icons are used but have no .fa-*:before glyph in bold.css: "
            + ", ".join(missing)
            + "\nAdd the rule (code from the FA 4.7 cheatsheet), then re-run."
        )

    # 3. subset the full font
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = []
    font = subset.load_font(SRC_FONT, opts)
    ss = subset.Subsetter(opts)
    ss.populate(unicodes=sorted(codes.values()))
    ss.subset(font)
    font.save(DST_FONT)

    # 4. verify every needed codepoint survived
    cmap = TTFont(DST_FONT).getBestCmap()
    lost = [c for c, cp in codes.items() if cp not in cmap]
    if lost:
        sys.exit("subset lost glyphs: " + ", ".join(lost))

    old = os.path.getsize(SRC_FONT) // 1024
    new = os.path.getsize(DST_FONT) // 1024
    print("icons: %d (%s)" % (len(codes), ", ".join(sorted(codes))))
    print("fontawesome-webfont.woff2: %d KiB -> %d KiB" % (old, new))


if __name__ == "__main__":
    main()
