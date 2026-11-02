(() => {
  // A dialog saved while open is a modal again (the saved page keeps only its open attribute).
  for (const dialog of document.querySelectorAll("dialog[open]")) {
    dialog.removeAttribute("open");
    dialog.showModal();
  }
  if (window.parent === window) return;
  // A folder opened from a file has the origin "null", which postMessage refuses as a target.
  const origin = location.origin === "null" ? "*" : location.origin;
  const designOnly=new URLSearchParams(location.search).has("__sm_look");
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
    if (designOnly || event.source !== window.parent || event.origin !== location.origin) return;
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

if (new URLSearchParams(location.search).has("__sm_look") && /^https?:$/.test(location.protocol)) {
  const lookConfig={static:true,project:"public-export",parentOrigins:[location.origin],generation:"static-v1"};
  const LOOK_PROTOCOL=1, LOOK_CSS_LIMIT=262144;
const record=(v) => !!v && typeof v === "object" && !Array.isArray(v);
const id=(v) => typeof v === "string" && /^[\w-]{8,100}$/.test(v);
const page=(v) => typeof v === "string" &&
    v.length <= 2048 &&
    v.startsWith("/") &&
    !v.startsWith("//") &&
    ![...v].some((c) => c.charCodeAt(0) < 32);
const generation=(v) => typeof v === "string" && /^[\w.:-]{1,128}$/.test(v);
const revision=(v) => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
function identity(v) {
    return (id(v.session) && id(v.project) && id(v.document) && page(v.page) && generation(v.generation));
}
function base(v) {
    return (record(v) &&
        v.version === LOOK_PROTOCOL &&
        typeof v.type === "string" &&
        Object.keys(v).length <= 16);
}
function parseLookCommand(value) {
    if (!base(value) || !identity(value) || !revision(value.revision))
        return;
    if (value.type === "look-style") {
        if (typeof value.css !== "string" ||
            value.css.length > LOOK_CSS_LIMIT ||
            !["light", "dark"].includes(String(value.mode)))
            return;
    }
    else if (value.type === "look-reset") {
        if (!["apply", "discard"].includes(String(value.reason)))
            return;
    }
    else if (value.type === "look-discover") {
        if (!page(value.base))
            return;
    }
    else if (value.type !== "look-tour")
        return;
    return value;
}
  const applyFonts=(css) => {
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
  };
  const probeRecord=()=>undefined;
  (() => {
  if (window.parent === window || !lookConfig.parentOrigins.length) return;
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2,"0")).join("");
  const chosen = new URL(location.href).searchParams.get("__sm_parent");
  const targets = lookConfig.parentOrigins.includes(chosen) ? [chosen] : lookConfig.parentOrigins;
  let challenge="",navigation=0;
  let binding = null, ticket = null, generation = "unavailable", epoch = 0, work = 0;
  let deadline = 0;
  let inputRevision=0;
  let highest = -1, lastCommand = "", applied = null, previous = null, variables = [];
  const path = () => {
    const url = new URL(location.href);
    url.searchParams.delete("__sm_look"); url.searchParams.delete("__sm_parent"); url.searchParams.delete("__sm_reload");
    return url.pathname + url.search;
  };
  const status = () => location.pathname === "/sign-in" ? "sign-in" :
    document.querySelector('[data-kit="denied"]') ? "denied" :
    document.querySelector('[data-kit="not-found"]') ? "unavailable" :
    document.querySelector('[data-kit="error"]') ? "error" : "ready";
  const tell = (type, revision, extra = {}) => {
    if (!binding) return;
    window.parent.postMessage({source:"smithable-preview",version:1,type,
      session:binding.session,project:lookConfig.project,document:nonce,
      page:path(),generation,revision,...extra},binding.parentOrigin);
  };
  const ready = async () => {
    const mine = ++epoch, turn=++navigation;
    binding = null; ticket = null; ++work;
    const until = Date.now()+20000;
    while (document.body?.dataset.hydrated !== "true" && !lookConfig.static && Date.now()<until)
      await new Promise(resolve=>setTimeout(resolve,50));
    if (mine !== epoch) return;
    let state = status();
    if (!lookConfig.static && document.body?.dataset.hydrated !== "true") state="error";
    try {
      if (lookConfig.static) generation=lookConfig.generation || "static";
      else {
        const answer=await fetch("/__smithable/look/generation",{cache:"no-store",credentials:"same-origin"});
        if (!answer.ok) throw new Error("generation unavailable");
        const value=await answer.json();
        const rendered=getComputedStyle(document.documentElement).getPropertyValue("--sm-look-generation").trim().replace(/^"|"$/g, "");
        if (value.project !== lookConfig.project || !value.generation.startsWith(lookConfig.boot+":") || rendered !== value.generation) throw new Error("The rendered CSS generation is stale.");
        generation=rendered;
      }
    } catch {state="error";generation="unavailable";}
    if (mine !== epoch) return;
    for (const target of targets) window.parent.postMessage({source:"smithable-preview",version:1,
      type:"look-ready",challenge,navigation:turn,project:lookConfig.project,document:nonce,page:path(),generation,status:state},target);
  };
  const forceMode = mode => {
    if (!previous) previous={appearance:document.documentElement.dataset.appearance,
      colorScheme:document.documentElement.style.colorScheme, rules:[]};
    const walk = rules => {
      for (const rule of rules) {
        if (rule.media && rule.media.mediaText.includes("prefers-color-scheme: dark")) {
          if (!previous.rules.some(([saved])=>saved===rule)) previous.rules.push([rule,rule.media.mediaText]);
          rule.media.mediaText=mode === "dark" ? "all" : "not all";
        } else if (rule.media && previous.rules.some(([saved])=>saved===rule)) rule.media.mediaText=mode === "dark" ? "all" : "not all";
        if (rule.cssRules) walk(rule.cssRules);
      }
    };
    for (const sheet of document.styleSheets) {try {walk(sheet.cssRules);} catch {}}
    document.documentElement.dataset.appearance=mode;
    document.documentElement.style.colorScheme=mode;
  };
  const restore = () => {
    if (!previous) return;
    for (const [rule,text] of previous.rules) rule.media.mediaText=text;
    if (previous.appearance === undefined) delete document.documentElement.dataset.appearance;
    else document.documentElement.dataset.appearance=previous.appearance;
    document.documentElement.style.colorScheme=previous.colorScheme;
    previous=null;
  };
  const values = () => {
    const style=getComputedStyle(document.querySelector("[data-page]") || document.body);
    const canvas=document.createElement("canvas"); canvas.width=canvas.height=1;
    const context=canvas.getContext("2d",{willReadFrequently:true});
    return Object.fromEntries(variables.map(name=> {
      const value=style.getPropertyValue(name).trim().replace(/\s+/g," ");
      if (!CSS.supports("color",value)) return [name,value];
      context.clearRect(0,0,1,1);context.fillStyle=value;context.fillRect(0,0,1,1);
      return [name,Array.from(context.getImageData(0,0,1,1).data).join(",")];
    }));
  };
  const fontsReady = async () => {
    await Promise.all(Array.from(document.querySelectorAll('link[id^="sm-font:"]')).map(link=>link.sheet ? undefined :
      new Promise((resolve,reject)=> {
        link.addEventListener("load",resolve,{once:true});link.addEventListener("error",()=>reject(new Error("A font stylesheet did not load.")),{once:true});
      })));
    for (const element of [document.body,...document.querySelectorAll("h1,h2,button")].slice(0,5)) {
      const style=getComputedStyle(element);
      await document.fonts.load(style.font || (style.fontWeight+" "+style.fontSize+" "+style.fontFamily),"ÅÄÖ");
    }
    await document.fonts.ready;
  };
  window.addEventListener("message",async event=> {
    if (event.source !== window.parent || !lookConfig.parentOrigins.includes(event.origin)) return;
    const m=event.data;
    if (m?.type === "look-hello" && m.version === 1 && typeof m.challenge === "string" && /^[\w-]{8,100}$/.test(m.challenge)) {challenge=m.challenge;void ready();return;}
    if (m?.type === "look-bind") {
      if (m.version !== 1 || m.document !== nonce || m.project !== lookConfig.project || typeof m.ticket !== "string" || m.ticket.length>4096 || typeof m.session !== "string" || !Number.isSafeInteger(m.revision) || m.revision<0) return;
      if (binding?.session === m.session && ticket === m.ticket && deadline>performance.now()) {tell("look-bound",m.revision);return;}
      const mine=++epoch, verificationStarted=performance.now();
      try {
        let checked;
        if (lookConfig.static) checked={version:1,session:m.session,project:lookConfig.project,document:nonce,parentOrigin:event.origin,generation,ttl:120000};
        else {
          const answer=await fetch("/__smithable/look/verify",{method:"POST",headers:{"content-type":"application/json"},credentials:"same-origin",body:JSON.stringify({ticket:m.ticket,document:nonce,generation})});
          if (!answer.ok) throw new Error("The preview session was refused. Refresh its connection.");
          checked=await answer.json();
        }
        if (mine !== epoch || checked.version !== 1 || checked.session !== m.session || checked.project !== lookConfig.project || checked.document !== nonce || checked.parentOrigin !== event.origin || typeof checked.ttl !== "number" || checked.ttl<=0 || checked.ttl>120000 || checked.generation !== generation) return;
        binding=checked;deadline=verificationStarted+checked.ttl;ticket=m.ticket;highest=-1;inputRevision=0;lastCommand="";applied=null;
        tell("look-bound",m.revision);
      } catch {for(const target of targets) window.parent.postMessage({source:"smithable-preview",version:1,type:"look-ready",challenge,navigation:++navigation,project:lookConfig.project,document:nonce,page:path(),generation,status:"error"},target);}
      return;
    }
    const command=parseLookCommand(m);
    if (!command || !binding || deadline<=performance.now() || command.session !== binding.session || command.project !== lookConfig.project || command.document !== nonce || command.page !== path() || command.generation !== generation) return;
    const key=JSON.stringify(command);
    if (command.revision<highest) return;
    if (command.revision===highest) {
      if (key !== lastCommand) return tell("look-failed",command.revision,{error:"A preview revision was reused."});
      if (applied) tell(applied.type,command.revision,applied.extra);
      return;
    }
    highest=command.revision;lastCommand=key;applied=null;
    const mine=++work, session=binding.session;
    const current=()=>mine===work && binding?.session===session && deadline>performance.now() && command.page===path();
    const done=(type,extra={})=>{if (!current()) return;applied={type,extra};tell(type,command.revision,extra);};
    try {
      if (command.type === "look-style") {
        let sheet=document.getElementById("sm-theme");
        if (!sheet) {sheet=document.createElement("style");sheet.id="sm-theme";}
        sheet.textContent=applyFonts(command.css)+'\n[data-part="appearance"] {display:none!important}';
        document.head.append(sheet);forceMode(command.mode);
        variables=Array.from(new Set(Array.from(command.css.matchAll(/(--[\w-]+)\s*:/g),m=>m[1]))).slice(0,512);
        await Promise.race([fontsReady(),new Promise((_,reject)=>setTimeout(()=>reject(new Error("Fonts timed out.")),15000))]);done("look-applied");
      } else if (command.type === "look-reset") {
        const sheet=document.getElementById("sm-theme"), before=values();
        sheet?.remove();
        if (command.reason === "discard") restore();
        await fontsReady();
        if (!current()) return;
        if (command.reason === "apply") {
          const after=values();
          const different=variables.filter(name=>before[name] !== after[name]);
          if (different.length) {
            if (sheet) document.head.append(sheet);
            return done("look-failed",{error:"Saved preview differs in "+different.slice(0,5).join(", ")+". The draft preview is kept."});
          }
        }
        done("look-reset-done");
      } else if (command.type === "look-tour") {
        if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
          const end=document.documentElement.scrollHeight-window.innerHeight,started=performance.now();
          const step=()=> {if (!current()) return;const progress=Math.min((performance.now()-started)/5000,1);window.scrollTo(0,end*progress);if(progress<1)requestAnimationFrame(step);else setTimeout(()=>{if(current())window.scrollTo(0,0);},1500);};
          requestAnimationFrame(step);
        }
        done("look-applied");
      } else if (command.type === "look-discover") {
        const found=command.base===location.pathname && status()==="ready" ? probeRecord(command.base) : undefined;
        done("look-record",{path:found,status:found ? "found" : status()==="ready" ? "empty" : status()});
      }
    } catch {done("look-failed",{error:"The preview could not finish loading its styles or fonts. Retry its connection."});}
  });
  window.addEventListener("keydown",event=> {
    const target=event.target;
    if (!binding || deadline<=performance.now() || !(event.ctrlKey || event.metaKey) || event.altKey || !["z","y"].includes(event.key.toLowerCase()) || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable) return;
    event.preventDefault();event.stopImmediatePropagation();
    tell("look-history",Math.max(0,highest),{input:++inputRevision,direction:event.key.toLowerCase()==="y" || event.shiftKey ? "redo" : "undo"});
  },true);
  for (const method of ["pushState","replaceState"]) {
    const original=history[method];history[method]=function(...args){const result=original.apply(this,args);void ready();return result;};
  }
  window.addEventListener("popstate",()=>void ready());
  let fingerprint=path()+":"+status()+":"+document.body?.dataset.page;
  const observe = () => new MutationObserver(()=> {
    const next=path()+":"+status()+":"+document.body?.dataset.page;
    if (next!==fingerprint) {fingerprint=next;void ready();}
  }).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:["data-page"]});
  if (document.body) observe();
  else window.addEventListener("DOMContentLoaded",observe,{once:true});
  for(const target of targets) window.parent.postMessage({source:"smithable-preview",type:"look-awake",version:1,project:lookConfig.project},target);
  void ready();
})();
}