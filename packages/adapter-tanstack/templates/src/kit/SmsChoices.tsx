// Smithable app kit: Texts under the person's name (docs/design/notifications.md §5). The person
// gives their own number, types back the code texted to it, and turns on each text they want;
// nobody sets a number or turns a text on for someone else. Removing the number ends them all.
import { useEffect, useState } from "react";
import { w } from "./words";

export interface SmsApi {
  list: () => Promise<{
    phone: string | null;
    confirmed: boolean;
    entries: { entry: string; label: string; on: boolean }[];
  }>;
  sendCode: (data: { phone: string }) => Promise<void>;
  confirm: (data: { code: string }) => Promise<boolean>;
  remove: () => Promise<void>;
  set: (data: { entry: string; on: boolean }) => Promise<{ on: string[] }>;
}

export function SmsChoices({ api }: { api: SmsApi }) {
  const [list, setList] = useState<Awaited<ReturnType<SmsApi["list"]>>>();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [problem, setProblem] = useState<string>();
  const load = () =>
    api.list().then((l) => {
      setList(l);
      setPhone(l.phone ?? "");
    });
  useEffect(() => {
    void load().catch(() => undefined);
    // biome-ignore lint/correctness/useExhaustiveDependencies: once, with the person's own
  }, []);
  if (!list?.entries.length) return null;
  const step = async (work: () => Promise<void>) => {
    setProblem(undefined);
    try {
      await work();
    } catch (error) {
      setProblem((error as Error).message);
    }
  };
  return (
    <fieldset data-kit="sms-choices" className="space-y-1.5">
      <legend className="text-sm font-medium">{w.smsTitle}</legend>
      <p className="text-xs text-muted-foreground">{w.smsHelp}</p>
      {!list.confirmed ? (
        <div className="space-y-1.5">
          <label className="block text-sm">
            {w.smsPhone}
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+358 40 123 4567"
              className="mt-1 block h-control w-full rounded-md border border-input bg-background px-2 text-sm"
            />
          </label>
          <button
            type="button"
            className="text-sm underline"
            onClick={() =>
              void step(async () => {
                await api.sendCode({ phone });
                setSent(true);
              })
            }
          >
            {w.smsSendCode}
          </button>
          {sent && (
            <div className="space-y-1">
              <p className="text-xs">{w.smsCodeSent}</p>
              <label className="block text-sm">
                {w.smsCodeLabel}
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="mt-1 block h-control w-full rounded-md border border-input bg-background px-2 text-sm"
                />
              </label>
              <button
                type="button"
                className="text-sm underline"
                onClick={() =>
                  void step(async () => {
                    if (!(await api.confirm({ code }))) return setProblem(w.smsWrongCode);
                    setSent(false);
                    setCode("");
                    await load();
                  })
                }
              >
                {w.smsConfirm}
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          <p className="text-sm">{list.phone}</p>
          {list.entries.map((e) => (
            <label key={e.entry} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={e.on}
                onChange={(ev) =>
                  void step(async () => {
                    const { on } = await api.set({ entry: e.entry, on: ev.target.checked });
                    setList({
                      ...list,
                      entries: list.entries.map((x) => ({ ...x, on: on.includes(x.entry) })),
                    });
                  })
                }
              />
              {e.label}
            </label>
          ))}
          <button
            type="button"
            className="text-xs underline"
            onClick={() =>
              void step(async () => {
                await api.remove();
                await load();
              })
            }
          >
            {w.smsRemove}
          </button>
        </>
      )}
      {problem && (
        <p role="alert" className="text-xs text-destructive">
          {problem}
        </p>
      )}
    </fieldset>
  );
}
