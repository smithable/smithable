// docs.smithable.ai's search box (scripts/build-docs.mjs serves it as /search.js). The box is
// hidden without script; on first use it loads search.json and lists the parts whose heading and
// words hold every word typed, those with the words in the heading first. Arrows choose, Enter
// opens, Escape clears, "/" anywhere goes to the box.
(() => {
  const form = document.querySelector("form.search");
  const input = form.querySelector("input");
  const list = form.querySelector("ol");
  let index;
  let chosen = 0;
  form.hidden = false;

  const words = (q) => q.toLowerCase().split(/\s+/).filter(Boolean);
  /** Appends `text` to `el` with each of `ws` marked. */
  const mark = (el, text, ws) => {
    const re = new RegExp(
      `(${ws.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
      "gi",
    );
    text.split(re).forEach((s, i) => {
      el.append(i % 2 ? Object.assign(document.createElement("mark"), { textContent: s }) : s);
    });
  };

  const show = () => {
    const ws = words(input.value);
    list.replaceChildren();
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
    chosen = 0;
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
      });
      const title = document.createElement("b");
      mark(title, page === hit.h ? page : `${page} › ${hit.h}`, ws);
      // The line around the first word found in the part's text.
      const lower = hit.t.toLowerCase();
      const at = Math.max(0, lower.indexOf(ws.find((w) => lower.includes(w)) ?? "") - 40);
      const from = at && hit.t.indexOf(" ", at) + 1;
      const line = document.createElement("span");
      mark(
        line,
        `${from ? "…" : ""}${hit.t.slice(from, from + 140)}${hit.t.length > from + 140 ? "…" : ""}`,
        ws,
      );
      a.append(title, line);
      a.setAttribute("aria-selected", String(i === chosen));
      const li = document.createElement("li");
      li.append(a);
      list.append(li);
    }
  };

  const choose = (i) => {
    const links = list.querySelectorAll("a");
    if (!links.length) return;
    chosen = (i + links.length) % links.length;
    links.forEach((a, j) => {
      a.setAttribute("aria-selected", String(j === chosen));
    });
    links[chosen].scrollIntoView({ block: "nearest" });
  };

  input.addEventListener("focus", () => {
    index ??= fetch("/search.json")
      .then((r) => r.json())
      .then((data) => {
        index = data;
        show();
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
    if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? "")) {
      e.preventDefault();
      input.focus();
    }
  });
  document.addEventListener("click", (e) => {
    if (!form.contains(e.target)) list.replaceChildren();
  });
})();
