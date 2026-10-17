// docs.smithable.ai's search box (scripts/build-docs.mjs serves it as /search.js). The box is
// hidden without script; on first use it loads search.json and lists the parts whose heading and
// words hold every word typed, those with the words in the heading first. Arrows choose, Enter
// opens, Escape clears, "/" anywhere goes to the box. For a screen reader the box is a combobox
// and the results its listbox.
(() => {
  const form = document.querySelector("form.search");
  const input = form.querySelector("input");
  const list = form.querySelector("ol");
  let index;
  let chosen = 0;
  form.hidden = false;
  list.id = "search-results";
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", "Search results");
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-controls", list.id);
  input.setAttribute("aria-expanded", "false");

  const words = (q) => q.toLowerCase().split(/\s+/).filter(Boolean);
  /** Appends `text` to `el` with each of `ws` marked, the longest first where they overlap. */
  const mark = (el, text, ws) => {
    const alternatives = [...ws]
      .sort((a, b) => b.length - a.length)
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    text.split(new RegExp(`(${alternatives.join("|")})`, "gi")).forEach((s, i) => {
      el.append(i % 2 ? Object.assign(document.createElement("mark"), { textContent: s }) : s);
    });
  };
  const select = (links) => {
    links.forEach((a, j) => {
      a.setAttribute("aria-selected", String(j === chosen));
    });
    if (links.length) input.setAttribute("aria-activedescendant", links[chosen].id);
    else input.removeAttribute("aria-activedescendant");
  };

  const show = () => {
    const ws = words(input.value);
    list.replaceChildren();
    chosen = 0;
    input.setAttribute("aria-expanded", "false");
    select([]);
    if (!ws.length || !index?.parts) return;
    const hits = [];
    for (const [p, h, id, t] of index.parts) {
      const head = h.toLowerCase();
      const body = t.toLowerCase();
      if (!ws.every((w) => head.includes(w) || body.includes(w))) continue;
      hits.push({
        p,
        h,
        id,
        t,
        score: ws.filter((w) => head.includes(w)).length * 10 - (id ? 0 : 1),
      });
    }
    hits.sort((a, b) => b.score - a.score);
    input.setAttribute("aria-expanded", "true");
    if (!hits.length) {
      list.append(
        Object.assign(document.createElement("li"), {
          className: "none",
          textContent: "Nothing found",
        }),
      );
      return;
    }
    for (const [i, hit] of hits.slice(0, 12).entries()) {
      const [url, page] = index.pages[hit.p];
      const a = Object.assign(document.createElement("a"), {
        href: `/${url}${hit.id ? `#${hit.id}` : ""}`,
        id: `search-hit-${i}`,
      });
      a.setAttribute("role", "option");
      const title = document.createElement("b");
      mark(title, page === hit.h ? page : `${page} › ${hit.h}`, ws);
      // The line around the first word found in the part's text, starting at a word when one
      // starts shortly before the match.
      const lower = hit.t.toLowerCase();
      const found = lower.indexOf(ws.find((w) => lower.includes(w)) ?? "");
      const at = Math.max(0, found - 40);
      const space = hit.t.indexOf(" ", at);
      const from = at && space >= 0 && space < found ? space + 1 : at;
      const line = document.createElement("span");
      mark(
        line,
        `${from ? "…" : ""}${hit.t.slice(from, from + 140)}${hit.t.length > from + 140 ? "…" : ""}`,
        ws,
      );
      a.append(title, line);
      const li = document.createElement("li");
      li.setAttribute("role", "presentation");
      li.append(a);
      list.append(li);
    }
    select(list.querySelectorAll("a"));
  };

  const choose = (i) => {
    const links = list.querySelectorAll("a");
    if (!links.length) return;
    chosen = (i + links.length) % links.length;
    select(links);
    links[chosen].scrollIntoView({ block: "nearest" });
  };

  input.addEventListener("focus", () => {
    if (index?.parts) return show();
    // A failed load leaves the index unset, so the next focus tries again.
    index ??= fetch("/search.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`search.json: ${r.status}`))))
      .then((data) => {
        index = data;
        show();
      })
      .catch(() => {
        index = undefined;
      });
  });
  input.addEventListener("input", show);
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      choose(chosen + (e.key === "ArrowDown" ? 1 : -1));
    }
    if (e.key === "Escape") {
      input.value = "";
      show();
      input.blur();
    }
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const a = list.querySelectorAll("a")[chosen];
    if (a) location.href = a.href;
  });
  document.addEventListener("keydown", (e) => {
    const active = document.activeElement;
    if (
      e.key === "/" &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      !active?.isContentEditable &&
      !/^(INPUT|TEXTAREA|SELECT)$/.test(active?.tagName ?? "")
    ) {
      e.preventDefault();
      input.focus();
    }
  });
  document.addEventListener("click", (e) => {
    if (!form.contains(e.target)) {
      list.replaceChildren();
      input.setAttribute("aria-expanded", "false");
      select([]);
    }
  });
})();
