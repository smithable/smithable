// The two optional setup questions, kept in App so folding or moving Smith loses no answer.
import { useState } from "react";
import { ownerAskedKey, zoneAskedKey } from "./guide";
import { adminsOf } from "./OwnerCheck";
import { sameClock, zoneOf } from "./TimeZoneCheck";

export interface StudioQuestion {
  id: string;
  text: string;
  choices: { label: string; act: () => void; disabled?: boolean; voice?: false }[];
  close: () => void;
  /** Smith's word back after an answer that changed nothing, shown briefly in place of the card. */
  acknowledged?: true;
  answer: (text: string) => boolean;
  spoken: boolean;
  markSpoken: () => void;
  email?: {
    value: string;
    change: (value: string, valid: boolean) => void;
    alongside: boolean;
    setAlongside: (value: boolean) => void;
    hasAdmins: boolean;
  };
}

const asked = (key: string) => {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return true;
  }
};
const normalized = (text: string) =>
  text
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/, "");

export function useStudioQuestion({
  app,
  spec,
  auth,
  ready,
  onUseZone,
  onChooseZone,
  onSetAdmins,
}: {
  app?: string;
  spec?: string;
  auth?: string;
  ready: boolean;
  onUseZone: (zone: string) => Promise<boolean>;
  onChooseZone: () => void;
  onSetAdmins: (admins: string[]) => Promise<boolean>;
}): StudioQuestion | undefined {
  const [settled, setSettled] = useState<string[]>([]);
  const [spoken, setSpoken] = useState<string[]>([]);
  const [working, setWorking] = useState(false);
  const [ack, setAck] = useState<{ id: string; text: string; app?: string }>();
  const [owner, setOwner] = useState({
    app,
    other: false,
    email: "",
    emailValid: false,
    alongside: true,
  });
  const draft =
    owner.app === app
      ? owner
      : { app, other: false, email: "", emailValid: false, alongside: true };
  const changeOwner = (patch: Partial<typeof owner>) => setOwner({ ...draft, ...patch });
  const done = (key: string) => settled.includes(key) || asked(key);
  const settle = (key: string) => {
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* Remember it for this session too. */
    }
    setSettled((keys) => (keys.includes(key) ? keys : [...keys, key]));
  };
  // An answer that keeps things as they are closes with a word back, not in silence (T1670).
  const acknowledge = (key: string, text: string) => {
    settle(key);
    setAck({ id: key, text, app });
    setTimeout(() => setAck((now) => (now?.id === key ? undefined : now)), 2500);
  };
  const write = async (key: string, action: () => Promise<boolean>) => {
    if (working) return;
    setWorking(true);
    try {
      if (await action()) settle(key);
    } finally {
      setWorking(false);
    }
  };
  if (!ready || !app || !spec) return undefined;
  // Said in the app it answers for: another app opened meanwhile shows its own question.
  if (ack?.app === app)
    return {
      id: `${ack.id}:ack`,
      text: ack.text,
      acknowledged: true,
      choices: [],
      close: () => setAck(undefined),
      answer: () => false,
      // Heard as well as shown when sound is on, like the question it answers.
      spoken: false,
      markSpoken: () => {},
    };
  const zoneKey = zoneAskedKey(app);
  let question: Omit<StudioQuestion, "answer" | "spoken" | "markSpoken">;
  if (!done(zoneKey)) {
    const browser = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const zone = zoneOf(spec);
    const same = zone !== undefined && sameClock(zone, browser);
    question = {
      id: zoneKey,
      text: !zone
        ? `This app has no time zone yet, so its times run on UTC. Yours looks like ${browser}.`
        : same
          ? `Times in this app are in ${zone}, the same clock as your browser's.`
          : `Times in this app are in ${zone}. Your browser says ${browser}.`,
      close: () => settle(zoneKey),
      choices: [
        ...(!same
          ? [
              {
                label: `Use ${browser}`,
                act: () => void write(zoneKey, () => onUseZone(browser)),
                disabled: working,
              },
            ]
          : []),
        {
          label: zone ? `Keep ${zone}` : "Not now",
          act: () => (zone ? acknowledge(zoneKey, `Times stay in ${zone}.`) : settle(zoneKey)),
          disabled: working,
        },
        {
          label: "Choose another",
          act: () => {
            onChooseZone();
            settle(zoneKey);
          },
          disabled: working,
        },
      ],
    };
  } else {
    const key = ownerAskedKey(app);
    if (!auth || done(key)) return undefined;
    const mine = adminsOf(auth);
    const valid = draft.emailValid && Boolean(draft.email.trim());
    question = {
      id: `${key}:${draft.other ? "email" : "who"}`,
      text: draft.other
        ? "What is the owner's email address?"
        : "Who will run this app day to day?",
      close: () => settle(key),
      choices: draft.other
        ? [
            {
              label: "Make them the administrator",
              voice: false,
              disabled: working || !valid,
              act: () => {
                const address = draft.email.trim();
                if (!valid) return;
                void write(key, () =>
                  onSetAdmins([
                    address,
                    ...(draft.alongside
                      ? mine.filter((a) => a.toLowerCase() !== address.toLowerCase())
                      : []),
                  ]),
                );
              },
            },
            { label: "Back", disabled: working, act: () => changeOwner({ other: false }) },
          ]
        : [
            {
              label: "I will",
              act: () => acknowledge(key, "Then it is yours to run."),
              voice: false,
            },
            { label: "Someone else", act: () => changeOwner({ other: true }) },
          ],
      ...(draft.other
        ? {
            email: {
              value: draft.email,
              change: (email: string, emailValid: boolean) => changeOwner({ email, emailValid }),
              alongside: draft.alongside,
              setAlongside: (alongside: boolean) => changeOwner({ alongside }),
              hasAdmins: mine.length > 0,
            },
          }
        : {}),
    };
  }
  return {
    ...question,
    spoken: spoken.includes(question.id),
    markSpoken: () => setSpoken((ids) => (ids.includes(question.id) ? ids : [...ids, question.id])),
    answer: (text) => {
      const choice = question.choices.find((c) => normalized(c.label) === normalized(text));
      // These words must never fall through to a model or Auto-send an administrator change.
      if (choice?.voice === false) return true;
      if (!choice || choice.disabled) return false;
      choice.act();
      return true;
    },
  };
}
