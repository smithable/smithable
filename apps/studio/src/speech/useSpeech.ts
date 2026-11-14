// Speech for Smith (docs/design/smith-speech.md §8): the `browser` provider (the browser's own
// recognition and voices), the person's settings, one listening tab at a time, press to talk
// (step 1) and automatic mode (step 2: the voice detector starts and ends each utterance while
// Smith is silent). Barge-in waits for the speaker test (§4.3); a `browser` voice never has it.
import { useCallback, useEffect, useRef, useState } from "react";
import { type Detector, type Ear, loadDetector, openEar } from "./vad";
import { framer, segmenter } from "./vad-core";
import { type Browser, browserOf, sentences, usableVoices, whereLine } from "./words";

const KEY = "smithable:speech";
const CHANNEL = "smithable:speech";

type Provider = { name: "browser" | "service"; onDeviceOnly?: true };

interface Settings {
  sound: boolean;
  rate: number;
  voice?: string;
  /** The mic as the person left it: off, or press to talk (automatic is chosen per visit). */
  mic: "off" | "press";
  /** The line saying where the voice goes was shown, so the browser was asked once. */
  told?: true;
}

function load(): Settings {
  try {
    const kept = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return {
      sound: true,
      mic: "off",
      ...kept,
      rate: [0.85, 1, 1.2].includes(kept?.rate) ? kept.rate : 1,
    };
  } catch {
    return { sound: true, mic: "off", rate: 1 };
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
  rate: number;
  setRate: (rate: number) => void;
  needsLocalCheck: boolean;
  checkingHearing: boolean;
  hearingNote: string | undefined;
  mic: "off" | "press";
  /** Automatic mode (§4.2): chosen per visit, never saved; back to press to talk by itself. */
  auto: boolean;
  setAuto: (on: boolean) => void;
  /** A line about automatic mode: starting, or why it went back to press to talk. */
  autoNote?: string;
  /** Silero's files could not be had: the simple detector runs (the controls say so). */
  simpleDetector: boolean;
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
  const [checkingHearing, setCheckingHearing] = useState(false);
  const [hearingError, setHearingError] = useState<string>();
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
        u.rate = settings.rate;
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
    [synth, voice, settings.sound, settings.rate],
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
  // Asked once, where the policy keeps hearing on the device; true when it may start now.
  const mayHear = () => {
    if (!Rec || !canHear) return false;
    if (onDeviceOnly && localHearing === undefined) {
      if (checkingHearing) return false;
      setCheckingHearing(true);
      void Promise.resolve()
        .then(() => Rec.available?.({ langs: ["en-US"], processLocally: true }) ?? "no")
        .then(
          (state) => state === "available",
          () => false,
        )
        .then((local) => {
          setLocalHearing(local);
          setCheckingHearing(false);
        });
      return false;
    }
    return true;
  };
  // Automatic mode's state, read inside the detector's callbacks as it is now.
  const [auto, setAutoOn] = useState(false);
  const [autoNote, setAutoNote] = useState<string>();
  const [simple, setSimple] = useState(false);
  const ear = useRef<Ear | undefined>(undefined);
  const detector = useRef<Detector | undefined>(undefined);
  const lastHeard = useRef(0);
  const speakingNow = useRef(false);
  speakingNow.current = speaking;
  // A recognition that failed to open beside the detector's stream (§4.1's two captures).
  const clash = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: settings are read as they are now
  const listen = useCallback(
    (hold: boolean) => {
      if (rec.current || !mayHear() || !Rec) return;
      setHearingError(undefined);
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
      r.onerror = (e) => {
        if (ear.current && e.error === "audio-capture") clash.current = true;
        if (e.error !== "aborted")
          setHearingError(
            e.error === "not-allowed" || e.error === "service-not-allowed"
              ? "Microphone access was refused. Allow the microphone for this Studio address in your browser's site settings, then try again."
              : e.error === "audio-capture"
                ? "No microphone is available. Check that it is connected and allowed by your system."
                : e.error === "network"
                  ? "The browser's speech service could not connect. Check your connection and try again."
                  : e.error === "no-speech"
                    ? "No speech was heard. Press the microphone and try again."
                    : "The browser could not recognize speech. Check its speech and language settings, then try again.",
          );
      };
      r.onend = () => {
        rec.current = undefined;
        setListening(false);
        setInterim("");
        ended.current(heardAny);
        if (clash.current) {
          clash.current = false;
          stopAuto(
            "This browser's speech recognition cannot listen beside the voice detector: press to talk instead.",
          );
        }
      };
      rec.current = r;
      channel.current?.postMessage("listening");
      try {
        r.start();
      } catch {
        // A start the browser refuses leaves nothing listening, and the mic free for the next try.
        rec.current = undefined;
        setHearingError(
          "The browser could not start speech recognition. Check microphone permission for this Studio address and try again.",
        );
        return;
      }
      setListening(true);
      if (settings.mic === "off" || !settings.told) save({ ...settings, mic: "press", told: true });
    },
    [Rec, canHear, onDeviceOnly, localHearing, checkingHearing, stopSpeaking, settings],
  );
  const release = useCallback(() => rec.current?.stop(), []);

  // Automatic mode: the detector opens its own stream; an onset starts recognition (while Smith
  // is silent), about 800 ms of silence ends it, and what was heard is sent as with a release.
  const listenNow = useRef(listen);
  listenNow.current = listen;
  // Each start gets a number; a stop (or a hidden tab, another tab, leaving) moves it on, so a
  // start still loading its files finds itself cancelled after each wait and closes what it opened.
  const generation = useRef(0);
  const starting = useRef(false);
  const stopAuto = (note?: string) => {
    generation.current++;
    starting.current = false;
    ear.current?.stop();
    ear.current = undefined;
    rec.current?.stop();
    setAutoOn(false);
    setAutoNote(note);
  };
  const startAuto = async () => {
    if (ear.current || !Rec || !canHear) return;
    const mine = ++generation.current;
    const cancelled = () => mine !== generation.current;
    starting.current = true;
    setAutoNote("Starting the voice detector…");
    if (onDeviceOnly && localHearing === undefined) {
      // The policy keeps hearing on this computer: asked here, once, before anything opens.
      const local = await (
        Rec.available?.({ langs: ["en-US"], processLocally: true }) ?? Promise.resolve("no")
      ).then(
        (state) => state === "available",
        () => false,
      );
      setLocalHearing(local);
      if (cancelled()) return;
      if (!local) {
        starting.current = false;
        return setAutoNote(undefined);
      }
    }
    const found = await loadDetector();
    if (cancelled()) return;
    detector.current = found;
    setSimple(found.kind === "simple");
    const segments = segmenter();
    let frames: ((chunk: Float32Array) => Float32Array[]) | undefined;
    let queue = Promise.resolve();
    let opened: Ear;
    try {
      opened = await openEar((chunk, rate) => {
        frames ??= framer(rate);
        for (const frame of frames(chunk))
          queue = queue
            .then(async () => {
              // Nothing is heard while Smith speaks (barge-in is off for these voices): what was
              // being heard when he started is dropped, so he is not written out as the person.
              if (speakingNow.current) {
                segments.reset();
                rec.current?.abort();
                return;
              }
              const event = segments.push(await found.detect(frame));
              if (event === "start") {
                lastHeard.current = Date.now();
                listenNow.current(true);
              } else if (event === "end") rec.current?.stop();
              else if (event === "misfire") rec.current?.abort();
            })
            // A frame the detector failed on is skipped; the next ones still run.
            .catch(() => undefined);
      });
    } catch {
      if (cancelled()) return;
      starting.current = false;
      setAutoNote("The microphone could not be opened for automatic mode.");
      return;
    }
    if (cancelled()) return opened.stop();
    starting.current = false;
    ear.current = opened;
    lastHeard.current = Date.now();
    setAutoOn(true);
    setAutoNote(undefined);
    channel.current?.postMessage("listening");
  };
  // Back to press to talk after ten minutes without the person speaking, and when the tab hides.
  // biome-ignore lint/correctness/useExhaustiveDependencies: stopAuto reads refs only
  useEffect(() => {
    if (!auto) return;
    const timer = setInterval(() => {
      if (Date.now() - lastHeard.current > 10 * 60_000)
        stopAuto("Back to press to talk: nothing was said for ten minutes.");
    }, 15_000);
    return () => clearInterval(timer);
  }, [auto]);
  // A hidden tab stops listening; it keeps speaking.
  useEffect(() => {
    const hide = () => {
      if (document.visibilityState !== "hidden") return;
      rec.current?.stop();
      // Also a start still loading: it finds itself cancelled.
      if (ear.current || starting.current) stopAuto("Back to press to talk: the tab was hidden.");
    };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  });
  // Listening in another tab stops automatic mode here too.
  useEffect(() => {
    const c = channel.current;
    if (!c) return;
    const other = (e: MessageEvent) => {
      if (e.data === "listening" && (ear.current || starting.current))
        stopAuto("Back to press to talk: another tab listens.");
    };
    c.addEventListener("message", other);
    return () => c.removeEventListener("message", other);
  });
  useEffect(
    () => () => {
      generation.current++;
      ear.current?.stop();
    },
    [],
  );

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
    rate: settings.rate,
    setRate: (rate) => {
      if ([0.85, 1, 1.2].includes(rate)) save({ ...settings, rate });
    },
    needsLocalCheck: onDeviceOnly && localHearing === undefined,
    checkingHearing,
    hearingNote:
      hearingError ??
      (onDeviceOnly
        ? checkingHearing
          ? "Checking whether this browser can recognize speech on this computer…"
          : localHearing === false
            ? "This project requires speech recognition on this computer. This browser cannot provide it, so the microphone is unavailable. You can type instead."
            : localHearing === undefined
              ? "This project requires speech recognition on this computer. Check browser support before using the microphone."
              : undefined
        : !canHear
          ? why
          : undefined),
    mic: settings.mic,
    auto,
    setAuto: (on) => (on ? void startAuto() : stopAuto()),
    ...(autoNote ? { autoNote } : {}),
    simpleDetector: simple,
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
