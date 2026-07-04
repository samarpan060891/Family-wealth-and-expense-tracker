"use client";
import { useCallback, useEffect, useRef, useState } from "react";

// Minimal typings for the Web Speech API (not in the default TS DOM lib).
type SpeechRecognitionResultLike = { transcript: string };
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<ArrayLike<SpeechRecognitionResultLike> & { isFinal: boolean }>;
};
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type SpeechState = {
  supported: boolean;
  listening: boolean;
  transcript: string; // finalized text
  interim: string; // in-progress text
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
};

export function useSpeech(lang = "en-IN"): SpeechState {
  const [supported] = useState(() => getRecognitionCtor() !== null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const reset = useCallback(() => {
    setTranscript("");
    setInterim("");
    setError(null);
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError("unsupported");
      return;
    }
    setError(null);
    setTranscript("");
    setInterim("");

    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const text = res[0]?.transcript ?? "";
        if (res.isFinal) finalText += text;
        else interimText += text;
      }
      if (finalText) setTranscript((prev) => (prev ? prev + " " : "") + finalText.trim());
      setInterim(interimText);
    };
    rec.onerror = (e) => {
      // "no-speech", "not-allowed" (permission), "audio-capture" (no mic), etc.
      setError(e.error || "error");
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
    };

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setError("error");
    }
  }, [lang]);

  useEffect(() => {
    return () => {
      try {
        recRef.current?.abort();
      } catch {}
    };
  }, []);

  return { supported, listening, transcript, interim, error, start, stop, reset };
}
