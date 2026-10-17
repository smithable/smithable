// The visit counter (counted on smithable.ai without cookies): this page's path, and the site the
// visitor came from (its host only, not the address). scripts/build-docs.mjs serves it as
// /count.js on every page of docs.smithable.ai.
(() => {
  let from = "";
  try {
    const u = new URL(document.referrer);
    if (u.hostname !== location.hostname) from = u.hostname;
  } catch {}
  new Image().src = `https://smithable.ai/v?site=docs&p=${encodeURIComponent(location.pathname)}${from ? `&r=${encodeURIComponent(from)}` : ""}`;
})();
