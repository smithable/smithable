import { useEffect, useRef, useState } from "react";
import { checkName, type NameOffer, readOffer, saveName, splitAddress } from "./app-name";
import { Button, Input, Select } from "./ui";

/**
 * The app's address on a shared domain, on hosted Studio's Publish card (app-names.md §2; T771):
 * a name, a domain from the service's offer, the service's check as the owner types, and set,
 * change or remove. Nothing shows until the service answers with an offer.
 */
export function AppName() {
  const [offer, setOffer] = useState<NameOffer>();
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [line, setLine] = useState<{ text: string; ok?: boolean }>();
  const [busy, setBusy] = useState(false);
  const typed = useRef(0);

  useEffect(() => {
    let live = true;
    void readOffer().then((o) => {
      if (!live || !o) return;
      const inUse = splitAddress(o.current, o.offer);
      setOffer(o);
      setName(inUse?.name ?? "");
      setDomain(inUse?.domain ?? o.default);
    });
    return () => {
      live = false;
    };
  }, []);

  const wanted = name.trim().toLowerCase();
  const inUse = offer && splitAddress(offer.current, offer.offer);
  const unchanged = Boolean(inUse && inUse.name === wanted && inUse.domain === domain);

  // The one check call, a moment after the owner stops typing; an older answer never wins. Typing
  // clears the line, so a save's own sentence stays until the owner types again.
  useEffect(() => {
    const mine = ++typed.current;
    if (!offer || !wanted || unchanged) return;
    const timer = setTimeout(() => {
      void checkName(wanted, domain).then((r) => {
        if (mine !== typed.current) return;
        setLine("free" in r ? { text: `${r.address} is free.`, ok: true } : { text: r.why });
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [offer, wanted, domain, unchanged]);

  if (!offer) return null;

  const save = async (change: Parameters<typeof saveName>[0]) => {
    setBusy(true);
    typed.current++;
    const r = await saveName(change);
    setBusy(false);
    if ("why" in r) return setLine({ text: r.why });
    const current = "address" in r ? r.address : null;
    setOffer({ ...offer, current });
    if (!current) setName("");
    setLine({
      text: current ? `The app answers at ${current}.` : "The name is removed.",
      ok: true,
    });
  };

  return (
    <form
      aria-labelledby="studio-app-name"
      className="my-3 grid gap-2 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        if (wanted && !unchanged && !busy) void save({ name: wanted, domain });
      }}
    >
      <span id="studio-app-name" className="font-medium">
        Address
      </span>
      <div className="flex items-center gap-1">
        <Input
          aria-label="Name"
          value={name}
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="none"
          disabled={busy}
          onChange={(e) => {
            setLine(undefined);
            setName(e.target.value);
          }}
        />
        <span aria-hidden="true">.</span>
        {offer.offer.length > 1 ? (
          <Select
            aria-label="Domain"
            value={domain}
            options={offer.offer}
            disabled={busy}
            onChange={(e) => {
              setLine(undefined);
              setDomain(e.target.value);
            }}
            className="w-auto"
          />
        ) : (
          <span className="whitespace-nowrap">{domain}</span>
        )}
      </div>
      <p aria-live="polite" className={line && !line.ok ? "text-danger" : "text-muted"}>
        {line?.text ?? (offer.current ? `The app answers at ${offer.current}.` : "")}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || !wanted || unchanged}>
          {offer.current ? "Change" : "Save"}
        </Button>
        {offer.current && (
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => void save({ remove: true })}
          >
            Remove
          </Button>
        )}
      </div>
    </form>
  );
}
