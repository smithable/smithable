(() => {
  // A dialog saved while open is a modal again (the saved page keeps only its open attribute).
  for (const dialog of document.querySelectorAll("dialog[open]")) {
    dialog.removeAttribute("open");
    dialog.showModal();
  }
  if (window.parent === window) return;
  // A folder opened from a file has the origin "null", which postMessage refuses as a target.
  const origin = location.origin === "null" ? "*" : location.origin;
  const post = (message) =>
    window.parent.postMessage({ source: "smithable-preview", ...message }, origin);
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
    // A page saved from an app of this version shows dark by its <html data-appearance>.
    document.documentElement.dataset.appearance = scheme;
    document.documentElement.style.colorScheme = scheme;
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
      // The fonts' bare imports become the lab's copies. The lab's Light and Dark choose the
      // frame's mode, so the app's own appearance picker is not offered beside them.
      sheet.textContent = ((css) => {
    const urls = {"@fontsource-variable/inter":"../fonts/@fontsource-variable/inter/index.css","@fontsource-variable/inter/wght-italic.css":"../fonts/@fontsource-variable/inter/wght-italic.css","@fontsource-variable/nunito-sans":"../fonts/@fontsource-variable/nunito-sans/index.css","@fontsource-variable/nunito-sans/wght-italic.css":"../fonts/@fontsource-variable/nunito-sans/wght-italic.css","@fontsource-variable/source-sans-3":"../fonts/@fontsource-variable/source-sans-3/index.css","@fontsource-variable/source-sans-3/wght-italic.css":"../fonts/@fontsource-variable/source-sans-3/wght-italic.css","@fontsource-variable/source-serif-4":"../fonts/@fontsource-variable/source-serif-4/index.css","@fontsource-variable/source-serif-4/wght-italic.css":"../fonts/@fontsource-variable/source-serif-4/wght-italic.css","@fontsource-variable/fraunces":"../fonts/@fontsource-variable/fraunces/index.css","@fontsource-variable/fraunces/wght-italic.css":"../fonts/@fontsource-variable/fraunces/wght-italic.css","@fontsource-variable/archivo-narrow":"../fonts/@fontsource-variable/archivo-narrow/index.css","@fontsource-variable/archivo-narrow/wght-italic.css":"../fonts/@fontsource-variable/archivo-narrow/wght-italic.css","@fontsource-variable/dm-sans":"../fonts/@fontsource-variable/dm-sans/index.css","@fontsource-variable/dm-sans/wght-italic.css":"../fonts/@fontsource-variable/dm-sans/wght-italic.css","@fontsource-variable/outfit":"../fonts/@fontsource-variable/outfit/index.css","@fontsource-variable/hanken-grotesk":"../fonts/@fontsource-variable/hanken-grotesk/index.css","@fontsource-variable/hanken-grotesk/wght-italic.css":"../fonts/@fontsource-variable/hanken-grotesk/wght-italic.css","@fontsource-variable/instrument-sans":"../fonts/@fontsource-variable/instrument-sans/index.css","@fontsource-variable/instrument-sans/wght-italic.css":"../fonts/@fontsource-variable/instrument-sans/wght-italic.css","@fontsource-variable/mona-sans":"../fonts/@fontsource-variable/mona-sans/index.css","@fontsource-variable/mona-sans/wght-italic.css":"../fonts/@fontsource-variable/mona-sans/wght-italic.css","@fontsource-variable/bricolage-grotesque":"../fonts/@fontsource-variable/bricolage-grotesque/index.css","@fontsource-variable/oswald":"../fonts/@fontsource-variable/oswald/index.css","@fontsource-variable/big-shoulders-display":"../fonts/@fontsource-variable/big-shoulders-display/index.css","@fontsource/instrument-serif":"../fonts/@fontsource/instrument-serif/index.css","@fontsource/instrument-serif/400-italic.css":"../fonts/@fontsource/instrument-serif/400-italic.css","@fontsource/young-serif":"../fonts/@fontsource/young-serif/index.css","@fontsource-variable/newsreader":"../fonts/@fontsource-variable/newsreader/index.css","@fontsource-variable/newsreader/wght-italic.css":"../fonts/@fontsource-variable/newsreader/wght-italic.css","@fontsource-variable/bodoni-moda":"../fonts/@fontsource-variable/bodoni-moda/index.css","@fontsource-variable/bodoni-moda/wght-italic.css":"../fonts/@fontsource-variable/bodoni-moda/wght-italic.css","@fontsource/zilla-slab":"../fonts/@fontsource/zilla-slab/index.css","@fontsource/zilla-slab/400-italic.css":"../fonts/@fontsource/zilla-slab/400-italic.css","@fontsource/zilla-slab/300.css":"../fonts/@fontsource/zilla-slab/300.css","@fontsource/zilla-slab/300-italic.css":"../fonts/@fontsource/zilla-slab/300-italic.css","@fontsource/zilla-slab/500.css":"../fonts/@fontsource/zilla-slab/500.css","@fontsource/zilla-slab/500-italic.css":"../fonts/@fontsource/zilla-slab/500-italic.css","@fontsource/zilla-slab/600.css":"../fonts/@fontsource/zilla-slab/600.css","@fontsource/zilla-slab/600-italic.css":"../fonts/@fontsource/zilla-slab/600-italic.css","@fontsource/zilla-slab/700.css":"../fonts/@fontsource/zilla-slab/700.css","@fontsource/zilla-slab/700-italic.css":"../fonts/@fontsource/zilla-slab/700-italic.css","@fontsource-variable/jetbrains-mono":"../fonts/@fontsource-variable/jetbrains-mono/index.css","@fontsource-variable/jetbrains-mono/wght-italic.css":"../fonts/@fontsource-variable/jetbrains-mono/wght-italic.css"};
    return css.replace(/@import\s+(?:"([^"]+)"|'([^']+)'|url\([^)]*\))[^;]*;/gi, (_, quoted, single) => {
      const name = quoted ?? single;
      const url = Object.hasOwn(urls, name) ? urls[name] : undefined;
      if (url) {
        const id = "sm-font:" + name;
        if (!document.getElementById(id)) {
          const link = document.createElement("link");
          link.id = id;
          link.rel = "stylesheet";
          link.href = url;
          document.head.append(link);
        }
      }
      return "";
    });
  })(css)
        + '\n[data-part="appearance"] { display: none !important; }';
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
