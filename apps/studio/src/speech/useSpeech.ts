// Speech for Smith (docs/design/smith-speech.md §8): the `browser` provider (the browser's own
// recognition and voices), the person's settings, one listening tab at a time, manual dictation
// and calls (the voice detector starts and ends each utterance while Smith is silent). Barge-in waits for the speaker test (§4.3); a `browser` voice never has it.
import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { playback } from "./playback";
import { type Ear, loadDetector, openEar } from "./vad";
import { framer, segmenter } from "./vad-core";
import { type Browser, browserOf, usableVoices, whereLine } from "./words";

const KEY = "smithable:speech";
const CHANNEL = "smithable:speech";

type Provider = { name: "browser" | "service"; onDeviceOnly?: true };

interface Settings {
  sound: boolean;
  rate: number;
  voice?: string;
  /** The mic as the person left it: off, or press to talk. */
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
      rate: [1, 1.5, 2].includes(kept?.rate) ? kept.rate : 1,
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

type Call = "idle" | "starting" | "active";

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
  /** A line about the current or most recent call. */
  callNote?: string;
  listening: boolean;
  /** Words heard so far and not final yet, shown greyed. */
  interim: string;
  /** Where the voice goes, for the line at turn-on and in the voice menu. */
  where: string;
  /** The line was shown once: the mic's first press shows it before asking the browser. */
  told: boolean;
  notice?: string;
  /** Starts or stops manual listening; finals arrive through onFinal. */
  toggleMic: () => void;
  stopListening: () => void;
  call: Call;
  startCall: () => void;
  endCall: () => void;
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
  /** The guide owns the conversation: keep the call open and pause recognition. */
  inputBlocked = false,
): Speech {
  const inputBlockedNow = useRef(inputBlocked);
  inputBlockedNow.current = inputBlocked;
  const [settings, setSettings] = useState(load);
  const [notice, setNotice] = useState<string>();
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

  // A single sentence queue survives renders and speaker pause/resume.
  const [speaking, setSpeaking] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [call, setCallState] = useState<Call>("idle");
  const callNow = useRef<Call>("idle");
  const setCall = (state: Call) => {
    callNow.current = state;
    setCallState(state);
  };
  const [callSound, setCallSound] = useState<boolean>();
  const sound = callSound ?? settings.sound;
  const player = useRef<ReturnType<typeof playback> | undefined>(undefined);
  if (!player.current && synth)
    player.current = playback(synth, setSpeaking, () => setBlocked(true));
  const speak = useCallback(
    (text: string) => {
      if (voice && sound) player.current?.speak(text, voice, settings.rate);
    },
    [voice, sound, settings.rate],
  );
  const stopSpeaking = useCallback(() => player.current?.stop(), []);
  useEffect(() => () => player.current?.stop(), []);

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
  const [callNote, setCallNote] = useState<string>();
  const ear = useRef<Ear | undefined>(undefined);
  const lastHeard = useRef(0);
  const speakingNow = useRef(false);
  speakingNow.current = speaking;
  // A recognition that failed to open beside the detector's stream (§4.1's two captures).
  const clash = useRef(false);
  const manualListening = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: settings are read as they are now
  const listen = useCallback(
    (manual = false) => {
      if (inputBlockedNow.current || rec.current || !mayHear() || !Rec) return;
      setHearingError(undefined);
      if (!settings.told) {
        flushSync(() =>
          setNotice(whereLine("browser", browser, onDeviceOnly && localHearing === true)),
        );
        save({ ...settings, mic: "press", told: true });
      }
      stopSpeaking();
      const r = new Rec();
      r.lang = "en-US";
      r.interimResults = true;
      r.continuous = true;
      if (onDeviceOnly && "processLocally" in r) r.processLocally = true;
      let heardAny = false;
      r.onresult = (e) => {
        if (rec.current !== r) return;
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
        if (rec.current !== r) return;
        const permissionDenied = e.error === "not-allowed" || e.error === "service-not-allowed";
        if (permissionDenied && callNow.current !== "idle") stopCall();
        if (ear.current && e.error === "audio-capture") clash.current = true;
        if (
          e.error !== "aborted" &&
          !(ear.current && ["audio-capture", "no-speech"].includes(e.error))
        )
          setHearingError(
            permissionDenied
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
        if (rec.current !== r) return;
        manualListening.current = false;
        rec.current = undefined;
        setListening(false);
        setInterim("");
        ended.current(heardAny);
        if (clash.current) {
          clash.current = false;
          stopCall(
            "This browser's speech recognition cannot listen beside the voice detector: press to talk instead.",
          );
        }
      };
      rec.current = r;
      manualListening.current = manual;
      channel.current?.postMessage("listening");
      try {
        r.start();
      } catch {
        // A start the browser refuses leaves nothing listening, and the mic free for the next try.
        rec.current = undefined;
        manualListening.current = false;
        setHearingError(
          "The browser could not start speech recognition. Check microphone permission for this Studio address and try again.",
        );
        return;
      }
      if (rec.current !== r) return;
      setListening(true);
      if (settings.mic === "off" || !settings.told) save({ ...settings, mic: "press", told: true });
    },
    [Rec, canHear, onDeviceOnly, localHearing, checkingHearing, stopSpeaking, settings],
  );

  // In a call the detector starts recognition while Smith is silent and ends it at a pause.
  const listenNow = useRef(listen);
  listenNow.current = listen;
  // A stopped or superseded call closes anything it opened while awaiting permission.
  const generation = useRef(0);
  const stopCall = (note?: string) => {
    if (callNow.current === "idle") return;
    setHearingError(undefined);
    generation.current++;
    ear.current?.stop();
    ear.current = undefined;
    setCall("idle");
    const active = rec.current;
    rec.current = undefined;
    manualListening.current = false;
    setListening(false);
    setInterim("");
    active?.abort();
    stopSpeaking();
    setCallSound(undefined);
    setCallNote(note);
  };
  const openCallMicrophone = async (mine: number): Promise<boolean> => {
    if (!Rec) return false;
    setHearingError(undefined);
    if (!settings.told) {
      flushSync(() =>
        setNotice(whereLine("browser", browser, onDeviceOnly && localHearing === true)),
      );
      save({ ...settings, told: true });
    }
    const cancelled = () => mine !== generation.current;
    setCallNote("Starting call…");
    if (onDeviceOnly && localHearing === undefined) {
      // The policy keeps hearing on this computer: asked here, once, before anything opens.
      const local = await (
        Rec.available?.({ langs: ["en-US"], processLocally: true }) ?? Promise.resolve("no")
      ).then(
        (state) => state === "available",
        () => false,
      );
      setLocalHearing(local);
      if (cancelled()) return false;
      if (!local) {
        setCallNote(undefined);
        return false;
      }
    }
    const found = await loadDetector();
    if (cancelled()) return false;
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
              if (cancelled()) return;
              // Nothing is heard while Smith speaks (barge-in is off for these voices): what was
              // being heard when he started is dropped, so he is not written out as the person.
              if (speakingNow.current || inputBlockedNow.current) {
                segments.reset();
                rec.current?.abort();
                return;
              }
              const probability = await found.detect(frame);
              if (cancelled()) return;
              if (manualListening.current) {
                segments.reset();
                return;
              }
              const event = segments.push(probability);
              if (event === "start") {
                lastHeard.current = Date.now();
                listenNow.current();
              } else if (event === "end") rec.current?.stop();
              else if (event === "misfire") rec.current?.abort();
            })
            // A frame the detector failed on is skipped; the next ones still run.
            .catch(() => undefined);
      });
    } catch (error) {
      if (cancelled()) return false;
      setCallNote(
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "Microphone access was refused. Allow the microphone for this Studio address in your browser's site settings, then try again. You can type instead."
          : "The microphone could not be opened. Check that it is connected and allowed, then try again. You can type instead.",
      );
      return false;
    }
    if (cancelled()) {
      opened.stop();
      return false;
    }
    ear.current = opened;
    lastHeard.current = Date.now();
    setCallNote(found.kind === "simple" ? "A simpler voice detector is in use." : undefined);
    channel.current?.postMessage("listening");
    return true;
  };
  const startCall = async () => {
    if (!voice || !canHear || inputBlockedNow.current || callNow.current !== "idle") return;
    rec.current?.abort();
    const mine = ++generation.current;
    setCall("starting");
    // Reset playback on the button gesture, before the microphone permission prompt.
    stopSpeaking();
    const ready = await openCallMicrophone(mine);
    if (mine !== generation.current) return;
    if (!ready) {
      setCall("idle");
      return;
    }
    setCallSound(true);
    setCall("active");
    setBlocked(false);
    player.current?.speak("Hi, it’s Smith. I’m listening.", voice, settings.rate);
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: stopCall reads current refs
  useEffect(() => {
    if (call === "active" && (!canHear || !canSpeak)) stopCall();
  }, [call, canHear, canSpeak]);

  // Back to press to talk after ten minutes without the person speaking, and when the tab hides.
  // biome-ignore lint/correctness/useExhaustiveDependencies: stopCall reads refs only
  useEffect(() => {
    if (call !== "active") return;
    const timer = setInterval(() => {
      if (Date.now() - lastHeard.current > 10 * 60_000)
        stopCall("Back to press to talk: nothing was said for ten minutes.");
    }, 15_000);
    return () => clearInterval(timer);
  }, [call]);
  // Hiding the browser tab ends a call and stops manual dictation.
  useEffect(() => {
    const hide = () => {
      if (document.visibilityState !== "hidden") return;
      // Also a start still loading: it finds itself cancelled.
      if (callNow.current !== "idle") stopCall("Back to press to talk: the tab was hidden.");
      else rec.current?.stop();
    };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  });
  // Listening in another tab ends the call here too.
  useEffect(() => {
    const c = channel.current;
    if (!c) return;
    const other = (e: MessageEvent) => {
      if (e.data === "listening" && callNow.current !== "idle")
        stopCall("Back to press to talk: another tab listens.");
    };
    c.addEventListener("message", other);
    return () => c.removeEventListener("message", other);
  });
  useEffect(
    () => () => {
      generation.current++;
      ear.current?.stop();
      rec.current?.abort();
    },
    [],
  );

  useEffect(() => {
    if (inputBlocked) rec.current?.abort();
  }, [inputBlocked]);

  return {
    canSpeak,
    canHear,
    ...(why ? { why } : {}),
    sound: sound && canSpeak,
    setSound: (on) => {
      if (on) player.current?.resume();
      else player.current?.pause();
      setBlocked(false);
      setCallSound(undefined);
      save({ ...settings, sound: on });
    },
    blocked,
    voices: voices.map((v) => v.name),
    ...(voice ? { voice: voice.name } : {}),
    setVoice: (name) => {
      const selected = voices.find((voice) => voice.name === name);
      if (!selected) return;
      save({ ...settings, voice: name });
      if (!player.current?.busy && sound)
        player.current?.speak("Hello, I'm Smith. This is my voice.", selected, settings.rate);
    },
    rate: settings.rate,
    setRate: (rate) => {
      if ([1, 1.5, 2].includes(rate)) save({ ...settings, rate });
    },
    needsLocalCheck: Boolean(Rec) && onDeviceOnly && localHearing === undefined,
    checkingHearing,
    hearingNote:
      hearingError ??
      (!Rec
        ? why
        : onDeviceOnly
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
    ...(callNote ? { callNote } : {}),
    listening,
    interim,
    where: whereLine("browser", browser, onDeviceOnly && localHearing === true),
    told: Boolean(settings.told),
    ...(notice ? { notice } : {}),
    toggleMic: () => {
      if (callNow.current !== "idle") return;
      if (rec.current) rec.current.stop();
      else listen(true);
    },
    stopListening: () => {
      if (callNow.current !== "idle") stopCall();
      else rec.current?.stop();
    },
    call,
    startCall: () => void startCall(),
    endCall: () => stopCall(),
    speak,
    stopSpeaking,
    speaking,
  };
}
