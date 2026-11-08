// Speech for Smith, step 1 (docs/design/smith-speech.md §8): the `browser` provider (the
// browser's own recognition and voices), the person's settings, and one listening tab at a time.
// Press to talk only; the VAD, automatic mode and barge-in are step 2.
import { useCallback, useEffect, useRef, useState } from "react";
import { type Browser, browserOf, sentences, usableVoices, whereLine } from "./words";

const KEY = "smithable:speech";
const CHANNEL = "smithable:speech";

type Provider = { name: "browser" | "service"; onDeviceOnly?: true };

interface Settings {
  sound: boolean;
  voice?: string;
  /** The mic as the person left it: off, or press to talk (automatic is chosen per visit). */
  mic: "off" | "press";
  /** The line saying where the voice goes was shown, so the browser was asked once. */
  told?: true;
}

function load(): Settings {
  try {
    return { sound: true, mic: "off", ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return { sound: true, mic: "off" };
  }
}

// The Web Speech API as browsers expose it; not in TypeScript's DOM types.
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  processLocally?: boolean;
  onresult:
    | ((e: {
        resultIndex: number;
        results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
      }) => void)
    | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionClass = (new () => Recognition) & {
  available?: (o: { langs: string[]; processLocally: boolean }) => Promise<string>;
};
const recognitionClass = (): RecognitionClass | undefined =>
  (
    window as unknown as {
      SpeechRecognition?: RecognitionClass;
      webkitSpeechRecognition?: RecognitionClass;
    }
  ).SpeechRecognition ??
  (window as unknown as { webkitSpeechRecognition?: RecognitionClass }).webkitSpeechRecognition;

export interface Speech {
  /** Smith can speak here (a voice the policy allows), and can hear (recognition allowed). */
  canSpeak: boolean;
  canHear: boolean;
  /** Why one of them is off, in a line, when it is. */
  why?: string;
  sound: boolean;
  setSound: (on: boolean) => void;
  /** The browser refused to play before the person touched the page: the sound button asks. */
  blocked: boolean;
  voices: string[];
  voice?: string;
  setVoice: (name: string) => void;
  mic: "off" | "press";
  listening: boolean;
  /** Words heard so far and not final yet, shown greyed. */
  interim: string;
  /** Where the voice goes, for the line at turn-on and in the voice menu. */
  where: string;
  /** The line was shown once: the mic's first press shows it before asking the browser. */
  told: boolean;
  /** Starts listening (held, or one utterance); finals arrive through onFinal. */
  listen: (hold: boolean) => void;
  release: () => void;
  speak: (text: string) => void;
  stopSpeaking: () => void;
  speaking: boolean;
}

/** Speech for Smith in this browser, under the providers the host allows. */
export function useSpeech(
  providers: Provider[],
  onFinal: (text: string) => void,
  /** Listening ended; `heard` when anything final came in it (the moment to send it). */
  onEnd: (heard: boolean) => void,
): Speech {
  const [settings, setSettings] = useState(load);
  const save = (next: Settings) => {
    setSettings(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
  };
  const browserProvider = providers.find((p) => p.name === "browser");
  const onDeviceOnly = Boolean(browserProvider?.onDeviceOnly);
  const browser: Browser = browserOf(navigator.userAgent);
  const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;

  // The voices the policy allows; the browser lists them late (voiceschanged).
  const [allVoices, setAllVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (!synth) return;
    const read = () => setAllVoices(synth.getVoices());
    read();
    synth.addEventListener?.("voiceschanged", read);
    return () => synth.removeEventListener?.("voiceschanged", read);
  }, [synth]);
  const voices = browserProvider ? usableVoices(allVoices, onDeviceOnly) : [];
  const voice = voices.find((v) => v.name === settings.voice) ?? voices[0];

  // Recognition: where the policy keeps it on the device, only a browser that says it is.
  const Rec = browserProvider ? recognitionClass() : undefined;
  // On the device only when the browser itself says so (Chrome's `available`), asked only where
  // the policy needs it and only at the mic's first press: the call is experimental, and crashed
  // a headless Chromium page when made on every load. Unknown until asked; nothing assumed.
  const [localHearing, setLocalHearing] = useState<boolean | undefined>(undefined);
  const canHear = Boolean(Rec) && (!onDeviceOnly || localHearing !== false);
  const canSpeak = Boolean(synth) && voices.length > 0;
  const why = !providers.length
    ? "Speech is off for this project: its AI policy does not let a voice leave this computer."
    : !Rec
      ? "This browser cannot write out speech."
      : !canHear
        ? "This browser cannot write out speech on this computer, which the project's AI policy asks."
        : !canSpeak
          ? "This browser has no voice the project's AI policy allows."
          : undefined;

  // Speaking: sentence by sentence, the queue dropped on stop.
  const [speaking, setSpeaking] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const speak = useCallback(
    (text: string) => {
      if (!synth || !voice || !settings.sound) return;
      for (const piece of sentences(text)) {
        const u = new SpeechSynthesisUtterance(piece);
        u.voice = voice;
        u.lang = voice.lang;
        u.onstart = () => setSpeaking(true);
        u.onend = () => setSpeaking(synth.pending || synth.speaking);
        u.onerror = (e) => {
          // Chrome refuses before the person has touched the page: the sound button asks.
          if ((e as SpeechSynthesisErrorEvent).error === "not-allowed") setBlocked(true);
          setSpeaking(false);
        };
        synth.speak(u);
      }
    },
    [synth, voice, settings.sound],
  );
  const stopSpeaking = useCallback(() => {
    synth?.cancel();
    setSpeaking(false);
  }, [synth]);

  // Listening: one tab at a time; starting here stops it elsewhere.
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const rec = useRef<Recognition | undefined>(undefined);
  const final = useRef(onFinal);
  final.current = onFinal;
  const ended = useRef(onEnd);
  ended.current = onEnd;
  const channel = useRef<BroadcastChannel | undefined>(undefined);
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const c = new BroadcastChannel(CHANNEL);
    c.onmessage = (e) => {
      if (e.data === "listening") rec.current?.abort();
    };
    channel.current = c;
    return () => c.close();
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: settings are read as they are now
  const listen = useCallback(
    (hold: boolean) => {
      if (!Rec || !canHear || rec.current) return;
      if (onDeviceOnly && localHearing === undefined) {
        // Asked once, then listening starts if the browser hears on this computer.
        void (Rec.available?.({ langs: ["en-US"], processLocally: true }) ?? Promise.resolve("no"))
          .then(
            (state) => state === "available",
            () => false,
          )
          .then((local) => setLocalHearing(local));
        return;
      }
      stopSpeaking();
      const r = new Rec();
      r.lang = "en-US";
      r.interimResults = true;
      r.continuous = hold;
      if (onDeviceOnly && "processLocally" in r) r.processLocally = true;
      let heardAny = false;
      r.onresult = (e) => {
        let heard = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const result = e.results[i];
          const text = result?.[0]?.transcript ?? "";
          if (result?.isFinal) {
            heardAny = heardAny || Boolean(text.trim());
            final.current(text.trim());
          } else heard += text;
        }
        setInterim(heard);
      };
      r.onerror = () => undefined;
      r.onend = () => {
        rec.current = undefined;
        setListening(false);
        setInterim("");
        ended.current(heardAny);
      };
      rec.current = r;
      channel.current?.postMessage("listening");
      try {
        r.start();
      } catch {
        // A start the browser refuses leaves nothing listening, and the mic free for the next try.
        rec.current = undefined;
        return;
      }
      setListening(true);
      if (settings.mic === "off" || !settings.told) save({ ...settings, mic: "press", told: true });
    },
    [Rec, canHear, onDeviceOnly, localHearing, stopSpeaking, settings],
  );
  const release = useCallback(() => rec.current?.stop(), []);
  // A hidden tab stops listening; it keeps speaking.
  useEffect(() => {
    const hide = () => document.visibilityState === "hidden" && rec.current?.stop();
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []);

  return {
    canSpeak,
    canHear,
    ...(why ? { why } : {}),
    sound: settings.sound && canSpeak,
    setSound: (on) => {
      if (!on) stopSpeaking();
      setBlocked(false);
      save({ ...settings, sound: on });
    },
    blocked,
    voices: voices.map((v) => v.name),
    ...(voice ? { voice: voice.name } : {}),
    setVoice: (name) => save({ ...settings, voice: name }),
    mic: settings.mic,
    listening,
    interim,
    where: whereLine("browser", browser, onDeviceOnly && localHearing === true),
    told: Boolean(settings.told),
    listen,
    release,
    speak,
    stopSpeaking,
    speaking,
  };
}
