/* R.B.G. site interactions — no dependencies. Every block guards for its elements. */
(function () {
  "use strict";

  /* ---------- Mobile nav toggle ---------- */
  var navToggle = document.getElementById("navToggle");
  var navLinks = document.getElementById("navLinks");
  if (navToggle && navLinks) {
    navToggle.addEventListener("click", function () {
      navLinks.classList.toggle("open");
    });
  }

  /* ---------- Dark mode toggle (persisted; defaults to OS preference) ---------- */
  var themeToggle = document.getElementById("themeToggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      var el = document.documentElement;
      var next = el.getAttribute("data-theme") === "dark" ? "light" : "dark";
      el.setAttribute("data-theme", next);
      try { localStorage.setItem("rbg-theme", next); } catch (e) {}
    });
  }

  /* ---------- "Film of the Hour": one film per hour, same for every visitor ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    var q = document.getElementById("film-quote");
    var cite = document.getElementById("film-cite");
    if (q && cite && typeof FILM_QUOTES !== "undefined" && FILM_QUOTES.length) {
      var hour = Math.floor(Date.now() / 3600000);
      var pick = FILM_QUOTES[(hour * 2654435761) % FILM_QUOTES.length];
      q.textContent = "\u201C" + pick.quote + "\u201D";
      cite.innerHTML =
        "\u2014 <em>" + pick.name + "</em>, " + pick.year + " \u00B7 rotates every hour";
    }
  });

  /* ---------- Upcoming event: next one-time or yearly-recurring event ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    var box = document.getElementById("event-box");
    if (!box || typeof SITE_EVENTS === "undefined") return;
    function esc(s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    }
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var best = null, bestDate = null;
    SITE_EVENTS.forEach(function (e) {
      var d = null;
      if (e.recurring === "yearly" && e.month && e.day) {
        d = new Date(today.getFullYear(), e.month - 1, e.day);
        if (d < today) d = new Date(today.getFullYear() + 1, e.month - 1, e.day);
      } else if (e.scheduled) {
        d = new Date(e.scheduled.slice(0, 10) + "T00:00:00");
        if (d < today) return;
      } else {
        return;
      }
      if (!bestDate || d < bestDate) { bestDate = d; best = e; }
    });
    if (!best) {
      box.innerHTML = '<div class="big">No Events Scheduled</div>';
      return;
    }
    var months = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];
    var html = '<div class="big">' + esc(best.name) + "</div>";
    html += "<p>" + months[bestDate.getMonth()] + " " + bestDate.getDate() +
      ", " + bestDate.getFullYear() + "</p>";
    if (best.info) {
      html += '<a class="btn" target="_blank" rel="noopener" href="' + esc(best.info) + '">Info</a>';
    }
    box.innerHTML = html;
  });

  /* ---------- Newspaper icon: click scrolls to the posts; the dropdown
     opens on hover (CSS). On touch devices (no hover) a tap toggles it. ---------- */
  var newsToggleEl = document.getElementById("newsToggle");
  var newsWrapEl = newsToggleEl && newsToggleEl.closest(".nav-news");
  var isTouch = "ontouchstart" in window || (navigator.maxTouchPoints > 0);
  document.querySelectorAll("a.posts-link").forEach(function (a) {
    a.addEventListener("click", function (e) {
      if (a === newsToggleEl && isTouch && newsWrapEl) {
        e.preventDefault();
        var open = newsWrapEl.classList.toggle("open");
        newsToggleEl.setAttribute("aria-expanded", open ? "true" : "false");
        return;
      }
      var target = document.getElementById("posts");
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      /* otherwise follow the href to /#posts */
    });
  });

  /* ---------- Newspaper dropdown: close the tap-opened menu ---------- */
  if (newsToggleEl && newsWrapEl) {
    var newsFoot = document.querySelector("#newsDropdown .news-dropdown-foot");
    if (newsFoot) newsFoot.addEventListener("click", closeNews);
    document.addEventListener("click", function (e) {
      if (!newsWrapEl.contains(e.target)) closeNews();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeNews();
    });
    function closeNews() {
      newsWrapEl.classList.remove("open");
      newsToggleEl.setAttribute("aria-expanded", "false");
    }
  }

  /* ---------- Tag filtering (index pages) ---------- */
  var tagColor = { all: "r", Software: "r", Python: "b", Games: "g", Arduino: "v", "Misc.": "o" };
  var pills = Array.prototype.slice.call(document.querySelectorAll("#pills .pill"));
  var topTags = Array.prototype.slice.call(document.querySelectorAll(".top-tags .tag"));
  function currentFilter() {
    var active = document.querySelector(
      "#pills .pill.active-r, #pills .pill.active-b, #pills .pill.active-g, #pills .pill.active-v, #pills .pill.active-o");
    return active ? active.getAttribute("data-f") : "all";
  }
  function applyFilter(f) {
    if (f !== "all" && f === currentFilter()) f = "all"; /* second click resets to All */
    pills.forEach(function (p) {
      p.classList.remove("active-r", "active-b", "active-g", "active-v", "active-o");
      if (p.getAttribute("data-f") === f) p.classList.add("active-" + (tagColor[f] || "r"));
    });
    topTags.forEach(function (t) {
      t.classList.toggle("sel", t.getAttribute("data-f") === f);
    });
    document.querySelectorAll("main .post").forEach(function (post) {
      var tags = post.getAttribute("data-tags") || "";
      post.classList.toggle("hidden", f !== "all" && tags.indexOf(f) === -1);
    });
  }
  if (pills.length) {
    pills.forEach(function (pill) {
      pill.addEventListener("click", function () { applyFilter(pill.getAttribute("data-f")); });
    });
    topTags.forEach(function (t) {
      t.addEventListener("click", function () {
        applyFilter(t.getAttribute("data-f"));
        document.getElementById("pills").scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
  }

  /* ---------- Newest/oldest sort toggle (index pages) ---------- */
  var sortBtn = document.getElementById("sortBtn");
  if (sortBtn) {
    var sortLabel = sortBtn.querySelector("span");
    var sortIcon = sortBtn.querySelector("i");
    var newestFirst = sortBtn.getAttribute("data-newest") === "1";
    sortBtn.addEventListener("click", function () {
      var posts = Array.prototype.slice.call(document.querySelectorAll("main .post"));
      if (!posts.length) return;
      var parent = posts[0].parentNode;
      posts.reverse().forEach(function (p) { parent.appendChild(p); });
      newestFirst = !newestFirst;
      sortLabel.textContent = newestFirst ? "Newest first" : "Oldest first";
      sortIcon.className = newestFirst ? "fa fa-sort-amount-desc" : "fa fa-sort-amount-asc";
    });
  }

  /* ---------- Galleries: click a thumbnail to swap the lead image ---------- */
  document.querySelectorAll(".gallery").forEach(function (gal) {
    var lead = gal.querySelector(".gallery-lead");
    if (!lead) return;
    var thumbs = gal.querySelectorAll(".gallery-thumbs img");
    function checkFit() {
      if (!lead.naturalWidth) return;
      var ar = lead.naturalWidth / lead.naturalHeight;
      /* Contain anything that isn't close to 16:9 — wide AND tall images. */
      lead.classList.toggle("fit-contain", Math.abs(ar - 16 / 9) > 0.2);
    }
    if (lead.complete) checkFit();
    else lead.addEventListener("load", checkFit);
    thumbs.forEach(function (t) {
      t.addEventListener("click", function () {
        lead.src = t.getAttribute("data-full");
        /* The lead sits inside a <picture> with a WebP <source>: keep the
           source in sync or the swap silently keeps showing the old image. */
        var src = gal.querySelector("source");
        if (src && t.getAttribute("data-full-webp")) src.srcset = t.getAttribute("data-full-webp");
        thumbs.forEach(function (o) { o.classList.remove("active"); });
        t.classList.add("active");
        lead.addEventListener("load", checkFit, { once: true });
      });
    });
  });

  /* ---------- Avatar: barely-there 2-degree lean toward the cursor ---------- */
  var ring = document.querySelector(".avatar-ring");
  if (ring) {
    var MAX = 2;
    ring.addEventListener("mouseenter", function () {
      ring.style.transition = "transform .12s ease-out";
    });
    ring.addEventListener("mousemove", function (e) {
      var r = ring.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width - 0.5;
      var py = (e.clientY - r.top) / r.height - 0.5;
      ring.style.transform =
        "scale(1.08) rotateX(" + (-py * MAX).toFixed(2) + "deg) rotateY(" + (px * MAX).toFixed(2) + "deg)";
    });
    ring.addEventListener("mouseleave", function () {
      ring.style.transition = "transform .5s cubic-bezier(.2,.8,.25,1.15)";
      ring.style.transform = "";
    });
  }

  /* Click-to-play Vimeo embeds: swap the thumbnail link for the player inline.
     No-JS fallback: the link still opens the video on vimeo.com. */
  document.addEventListener("click", function (e) {
    var link = e.target.closest ? e.target.closest("a.video-link[data-vimeo-id]") : null;
    if (!link) return;
    e.preventDefault();
    var frame = document.createElement("iframe");
    frame.className = "video-embed";
    frame.src = "https://player.vimeo.com/video/" + link.getAttribute("data-vimeo-id") + "?autoplay=1";
    frame.setAttribute("allow", "autoplay; fullscreen; picture-in-picture");
    frame.setAttribute("allowfullscreen", "");
    frame.setAttribute("title", "Embedded video player");
    link.replaceWith(frame);
  });
})();
