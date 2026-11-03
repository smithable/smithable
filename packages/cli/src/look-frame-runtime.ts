// Development-only presentation runtime; config is server-owned and contains no signing key.
export const LOOK_FRAME_BODY = String.raw`
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
`;
