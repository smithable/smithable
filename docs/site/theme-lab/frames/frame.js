// The runtime of a page the theme lab's public mode frames (scripts/theme-lab-export.mjs): what
// the preview editor's runtime does for the local lab (packages/cli/src/preview-editor.ts), for
// a static page on the lab's own origin. It takes a theme's CSS, shows one color scheme, plays
// the landing page's motion, and keeps the page where it is (its links and forms lead nowhere).
(() => {
  if (window.parent === window) return;
  const post = (message) =>
    window.parent.postMessage({ source: "smithable-preview", ...message }, location.origin);
  let scheme = "";
  const applyScheme = () => {
    const walk = (rules) => {
      for (const rule of rules) {
        if (rule.media) {
          if (
            rule.smScheme === undefined &&
            rule.media.mediaText.includes("prefers-color-scheme: dark")
          )
            rule.smScheme = rule.media.mediaText;
          if (rule.smScheme !== undefined)
            rule.media.mediaText = scheme === "dark" ? "all" : "not all";
        }
        if (rule.cssRules) walk(rule.cssRules);
      }
    };
    for (const sheet of document.styleSheets) walk(sheet.cssRules);
  };
  window.addEventListener("message", (event) => {
    if (event.source !== window.parent || event.origin !== location.origin) return;
    const { type, css, mode } = event.data ?? {};
    if (type === "smithable:theme-css" && typeof css === "string") {
      let sheet = document.getElementById("sm-theme");
      if (!sheet) {
        sheet = document.createElement("style");
        sheet.id = "sm-theme";
      }
      // The fonts' bare imports become the lab's copies.
      sheet.textContent = css.replace(
        /@import "@fontsource-variable\/([a-z0-9-]+)";/g,
        '@import "../fonts/$1/index.css";',
      );
      document.head.append(sheet);
      if (mode === "light" || mode === "dark") scheme = mode;
      if (scheme) applyScheme();
    }
    if (type === "smithable:motion-tour") {
      const end = document.documentElement.scrollHeight - window.innerHeight;
      const started = Date.now();
      const step = () => {
        const done = Math.min((Date.now() - started) / 5000, 1);
        window.scrollTo(0, end * done);
        if (done < 1) setTimeout(step, 16);
        else setTimeout(() => window.scrollTo(0, 0), 1500);
      };
      step();
    }
  });
  document.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("a, button[type=submit]"))
      event.preventDefault();
  });
  document.addEventListener("submit", (event) => event.preventDefault());
  post({ type: "ready" });
})();
