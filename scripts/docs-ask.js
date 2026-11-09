// docs.smithable.ai's Ask Smith panel (docs/design/site-assistant.md §2, §4.3, §6; served as
// /ask.js). The header's "Ask Smith" opens it; without script the button stays hidden, as the
// search box does. A question goes to the site's endpoint (POST /site-assistant, JSON in,
// NDJSON out: first the parts the docs' search found, then the answer), on smithable.eu when the
// tab came from there, so a .eu visitor stays on the EU route. The answer is shown as text; a
// link is made only for an https address with no user part on smithable.ai, smithable.eu or
// docs.smithable.ai, and anything else stays words. Nothing is stored but the tab's route.
(() => {
  const button = document.querySelector("header button.ask");
  if (!button || !window.fetch || !window.TextDecoder || !window.ReadableStream) return;

  const SITES = ["smithable.ai", "smithable.eu", "docs.smithable.ai"];
  const TURNS = 4;
  const PROMPTS = ["What is Smithable?", "How do I start?", "Can I host it myself?"];

  // The tab came from smithable.eu (or was opened with ?from=eu): its questions take the EU route.
  let eu = false;
  try {
    const from = document.referrer ? new URL(document.referrer).hostname : "";
    if (
      from === "smithable.eu" ||
      from.endsWith(".smithable.eu") ||
      /[?&]from=eu\b/.test(location.search)
    )
      sessionStorage.setItem("smithable-ask-route", "eu");
    eu = sessionStorage.getItem("smithable-ask-route") === "eu";
  } catch {}
  const host = eu ? "smithable.eu" : "smithable.ai";
  const endpoint = `https://${host}/site-assistant`;
  const KINDS = ["answer", "none", "fallback", "no-index"];
  const provider = eu
    ? "an AI model in the EU (Claude on Amazon Bedrock, or Mistral)"
    : "Anthropic (Claude)";

  /** The address as a link's href, or nothing when it is not one of the three sites over https. */
  const safe = (address) => {
    try {
      const u = new URL(address);
      return u.protocol === "https:" &&
        !u.username &&
        !u.password &&
        !u.port &&
        SITES.includes(u.hostname)
        ? u.href
        : undefined;
    } catch {
      return undefined;
    }
  };
  const el = (tag, props = {}, ...children) => {
    const e = Object.assign(document.createElement(tag), props);
    e.append(...children);
    return e;
  };
  /** Text with the safe addresses in it made links; every other character stays text. */
  const words = (text) => {
    const p = el("p");
    for (const piece of String(text).split(/(https?:\/\/[^\s<>"'`]+)/)) {
      const m = /^(https?:\/\/[^\s<>"'`]*?)([.,;:!?)\]]*)$/.exec(piece);
      const href = m && safe(m[1]);
      if (href) p.append(el("a", { href, textContent: m[1] }), m[2]);
      else if (piece) p.append(piece);
    }
    return p;
  };

  const notice = el("p", {
    className: "notice",
    textContent: `AI assistant — answers may be wrong; check the linked page. Your question is sent to ${provider} to answer it and is not kept. Do not include personal or sensitive information.`,
  });
  const log = el("ol", { className: "turns" });
  log.setAttribute("aria-live", "polite");
  const prompts = el("div", { className: "prompts" });
  const input = el("textarea", { rows: 2, maxLength: 1000, placeholder: "Ask about Smithable" });
  input.setAttribute("aria-label", "Your question");
  const send = el("button", { type: "submit", textContent: "Ask" });
  const form = el("form", {}, input, send);
  const again = el("button", {
    type: "button",
    className: "again",
    textContent: "Start again",
    hidden: true,
  });
  const close = el("button", { type: "button", className: "close", textContent: "×" });
  close.setAttribute("aria-label", "Close");
  const panel = el(
    "aside",
    { className: "ask-panel", hidden: true },
    el("div", { className: "top" }, el("h2", { textContent: "Ask Smith" }), close),
    notice,
    log,
    prompts,
    form,
    again,
  );
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Ask Smith");
  document.body.append(panel);
  for (const q of PROMPTS)
    prompts.append(el("button", { type: "button", textContent: q, onclick: () => ask(q) }));

  let turns = [];
  let busy = false;
  /** The question being answered, so "Start again" can stop it. */
  let asking;
  const ready = () => {
    prompts.hidden = turns.length > 0 || log.children.length > 0;
    again.hidden = log.children.length === 0;
    const full = turns.length >= TURNS;
    input.disabled = send.disabled = busy || full;
    input.placeholder = full ? "Start again to ask more" : "Ask about Smithable";
  };
  /** Where focus goes in the panel: the box, or "Start again" when the box is closed. */
  const focusIn = () => (input.disabled ? (again.hidden ? close : again) : input).focus();
  const open = (show) => {
    panel.hidden = !show;
    button.setAttribute("aria-expanded", String(show));
    if (show) focusIn();
    else button.focus();
  };
  button.hidden = false;
  button.setAttribute("aria-expanded", "false");
  button.addEventListener("click", () => open(panel.hidden));
  close.addEventListener("click", () => open(false));
  panel.addEventListener("keydown", (e) => {
    if (e.key === "Escape") open(false);
  });
  again.addEventListener("click", () => {
    asking?.abort();
    turns = [];
    log.replaceChildren();
    ready();
    focusIn();
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (q) ask(q);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  /** "Was this helpful?": counted by the site's visit counter, once an answer, nothing else sent. */
  const thumb = () => {
    const said = el("span");
    const vote = (helpful) => () => {
      new Image().src = `https://${host}/v?site=docs-ask&p=${helpful ? "/helpful" : "/not-helpful"}`;
      const thanks = el("span", { className: "thanks", textContent: "Thank you.", tabIndex: -1 });
      said.replaceWith(thanks);
      thanks.focus();
    };
    said.append(
      "Was this helpful? ",
      el("button", { type: "button", textContent: "Yes", onclick: vote(true) }),
      " ",
      el("button", { type: "button", textContent: "No", onclick: vote(false) }),
    );
    return el("div", { className: "thumb" }, said);
  };

  const parts = (list) => {
    const ul = el("ul", { className: "parts" });
    for (const part of list ?? []) {
      const href = safe(part.url);
      ul.append(
        el(
          "li",
          {},
          href
            ? el("a", { href, textContent: part.title || href })
            : el("span", { textContent: part.title || "" }),
          part.line ? el("span", { className: "line", textContent: ` ${part.line}` }) : "",
        ),
      );
    }
    return ul;
  };

  async function ask(question) {
    if (busy || turns.length >= TURNS) return;
    busy = true;
    input.value = "";
    const status = el("p", { className: "status", textContent: "Looking in the docs…" });
    const item = el("li", {}, el("p", { className: "q", textContent: question }), status);
    log.append(item);
    ready();
    let answer = "";
    let shown;
    const mine = new AbortController();
    asking = mine;
    try {
      const res = await fetch(endpoint, {
        signal: mine.signal,
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, ...(turns.length ? { turns } : {}) }),
      });
      if (!res.ok) {
        let said;
        try {
          said = await res.json();
        } catch {}
        status.replaceWith(
          words(
            said?.message ||
              "Smith could not answer just now. The search box above finds pages too.",
          ),
        );
        if (said?.reason === "start-again") turns = Array(TURNS).fill(null);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const take = (line) => {
        if (!line.trim()) return;
        let msg;
        try {
          msg = JSON.parse(line);
        } catch {
          return; // A line that is not JSON says nothing; the rest still counts.
        }
        if (!msg || typeof msg !== "object") return;
        if (Array.isArray(msg.parts)) {
          status.textContent = msg.parts.length ? "Writing an answer…" : "";
          item.append(parts(msg.parts));
        } else if (typeof msg.answer === "string") {
          answer = msg.answer;
          const text = words(answer);
          text.className = `a${KINDS.includes(msg.kind) ? ` ${msg.kind}` : ""}`;
          (shown ?? status).replaceWith(text);
          shown = text;
        }
      };
      for (;;) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) take(line);
        if (done) break;
      }
      take(buffer);
      if (mine.signal.aborted) return;
      if (answer) {
        turns.push({ question, answer });
        item.append(thumb());
      } else if (status.isConnected) status.textContent = "";
    } catch {
      if (mine.signal.aborted) return;
      if (status.isConnected)
        status.replaceWith(
          words("Smith could not be reached. The search box above finds pages too."),
        );
    } finally {
      if (asking === mine) asking = undefined;
      busy = false;
      ready();
      // Back to the box, unless the person has moved on to a link or a button in the panel.
      const there = document.activeElement;
      if (!panel.hidden && (!panel.contains(there) || there === input || there === send)) focusIn();
    }
  }
  ready();
})();
