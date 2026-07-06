"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  biometricAvailable,
  isUnlocked,
  lockNow,
  markUnlocked,
  touchActivity,
  unlockBiometric,
} from "@/lib/app-lock-client";

// Wraps the authenticated app. When App Lock is on and the session isn't within
// its unlock window, it renders a full-screen lock over the app: biometric first,
// then a 4-digit PIN, then "use password" as the escape hatch.
export function AppLockGate({
  enabled,
  hasBiometric,
  children,
}: {
  enabled: boolean;
  hasBiometric: boolean;
  children: React.ReactNode;
}) {
  const [locked, setLocked] = useState(enabled);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setLocked(false);
      setChecked(true);
      return;
    }
    setLocked(!isUnlocked());
    setChecked(true);

    // Re-lock on inactivity and when the app is backgrounded past the window.
    const activity = () => touchActivity();
    const events = ["pointerdown", "keydown", "touchstart"];
    events.forEach((e) => window.addEventListener(e, activity, { passive: true }));
    const onVisible = () => {
      if (document.visibilityState === "visible" && !isUnlocked()) setLocked(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    const interval = setInterval(() => {
      if (!isUnlocked()) setLocked(true);
    }, 15000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, activity));
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(interval);
    };
  }, [enabled]);

  const onUnlocked = useCallback(() => {
    markUnlocked();
    setLocked(false);
  }, []);

  if (!enabled || (checked && !locked)) return <>{children}</>;

  // While the app is locked we render only the lock screen (children stay mounted
  // behind it via CSS so state isn't lost, but visually hidden and inert).
  return (
    <>
      <div className="pointer-events-none select-none blur-sm opacity-40" aria-hidden="true">
        {children}
      </div>
      <LockScreen hasBiometric={hasBiometric} onUnlocked={onUnlocked} />
    </>
  );
}

function LockScreen({ hasBiometric, onUnlocked }: { hasBiometric: boolean; onUnlocked: () => void }) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [lockSeconds, setLockSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [bioState, setBioState] = useState<"idle" | "trying" | "unavailable">("idle");
  const [shake, setShake] = useState(false);
  const triedAuto = useRef(false);

  const flagError = useCallback((msg: string) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  }, []);

  const tryBiometric = useCallback(async () => {
    setBioState("trying");
    setError("");
    const res = await unlockBiometric();
    if (res.ok) {
      onUnlocked();
      return;
    }
    setBioState("idle");
    if (!res.cancelled) setError(res.error ?? "");
  }, [onUnlocked]);

  // Biometric first, automatically, on mount.
  useEffect(() => {
    if (triedAuto.current) return;
    triedAuto.current = true;
    (async () => {
      if (hasBiometric && (await biometricAvailable())) {
        void tryBiometric();
      } else {
        setBioState("unavailable");
      }
    })();
  }, [hasBiometric, tryBiometric]);

  // Lockout countdown.
  useEffect(() => {
    if (lockSeconds <= 0) return;
    const t = setInterval(() => setLockSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [lockSeconds]);

  const submitPin = useCallback(
    async (value: string) => {
      setBusy(true);
      setError("");
      try {
        const res = await fetch("/api/app-lock/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin: value }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          onUnlocked();
          return;
        }
        setPin("");
        if (data.locked) {
          setLockSeconds(data.retryAfterSeconds ?? 60);
          setRemaining(null);
          flagError("Too many attempts.");
        } else {
          setRemaining(typeof data.remainingAttempts === "number" ? data.remainingAttempts : null);
          flagError(data.error ?? "Incorrect PIN.");
        }
      } finally {
        setBusy(false);
      }
    },
    [onUnlocked, flagError]
  );

  const press = useCallback(
    (digit: string) => {
      if (busy || lockSeconds > 0) return;
      setPin((p) => {
        if (p.length >= 4) return p;
        const next = p + digit;
        if (next.length === 4) void submitPin(next);
        return next;
      });
      setError("");
    },
    [busy, lockSeconds, submitPin]
  );

  const backspace = useCallback(() => {
    setPin((p) => p.slice(0, -1));
    setError("");
  }, []);

  // Hardware keyboard support (desktop): digits type, Backspace deletes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") press(e.key);
      else if (e.key === "Backspace") backspace();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press, backspace]);

  async function usePassword() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    lockNow();
    router.push("/login");
    router.refresh();
  }

  const disabled = busy || lockSeconds > 0;

  const statusText =
    lockSeconds > 0
      ? `Try again in ${lockSeconds}s`
      : error
        ? `${error}${remaining !== null && remaining > 0 ? ` · ${remaining} left` : ""}`
        : "Enter Passcode";

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-between bg-bg/80 backdrop-blur-2xl px-6 pt-16 pb-10 animate-fade-in">
      {/* Header: lock glyph, title, status */}
      <div className="flex flex-col items-center text-center">
        <div className="w-11 h-11 rounded-full bg-surface2/80 border border-border flex items-center justify-center text-lg mb-5 shadow-sm">
          🔒
        </div>
        <div className="font-display text-lg font-semibold text-text">FamilyWealth</div>

        {/* PIN dots */}
        <div className={`flex gap-5 mt-6 ${shake ? "animate-shake" : ""}`}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-[14px] h-[14px] rounded-full border-[1.5px] transition-all duration-150 ${
                pin.length > i
                  ? "bg-text border-text scale-100"
                  : "bg-transparent border-muted-soft scale-95"
              }`}
            />
          ))}
        </div>

        <div className="h-4 mt-4 text-center">
          <span className={`text-[13px] ${error || lockSeconds > 0 ? "text-red" : "text-muted"}`}>{statusText}</span>
        </div>
      </div>

      {/* Keypad + actions pinned toward the bottom, iOS-style */}
      <div className="w-full max-w-[280px] flex flex-col items-center">
        <div className="grid grid-cols-3 gap-x-6 gap-y-4 w-full place-items-center">
          {KEYPAD.map((k) => (
            <KeypadButton key={k.d} onClick={() => press(k.d)} disabled={disabled} sub={k.sub}>
              {k.d}
            </KeypadButton>
          ))}
        </div>

        {/* Bottom row: biometric (left) · 0 · backspace (right) */}
        <div className="grid grid-cols-3 gap-x-6 gap-y-4 w-full place-items-center mt-4">
          <div className="w-[74px] h-[74px] flex items-center justify-center">
            {bioState !== "unavailable" && (
              <button
                onClick={tryBiometric}
                disabled={disabled || bioState === "trying"}
                aria-label="Unlock with Face ID or fingerprint"
                className="w-[74px] h-[74px] flex items-center justify-center text-2xl text-accent active:opacity-60 transition-opacity disabled:opacity-40"
              >
                {bioState === "trying" ? (
                  <span className="w-5 h-5 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                ) : (
                  "☺"
                )}
              </button>
            )}
          </div>
          <KeypadButton onClick={() => press("0")} disabled={disabled}>
            0
          </KeypadButton>
          <button
            onClick={backspace}
            disabled={disabled || pin.length === 0}
            aria-label="Delete"
            className="w-[74px] h-[74px] flex items-center justify-center text-xl text-text active:opacity-50 transition-opacity disabled:opacity-30"
          >
            ⌫
          </button>
        </div>

        <button
          onClick={usePassword}
          className="mt-8 text-[13px] text-accent font-medium hover:text-accent-soft transition-colors"
        >
          Use Password
        </button>
      </div>
    </div>
  );
}

// iOS keypad layout — digit plus the classic letter grouping beneath it.
const KEYPAD = [
  { d: "1", sub: "" },
  { d: "2", sub: "A B C" },
  { d: "3", sub: "D E F" },
  { d: "4", sub: "G H I" },
  { d: "5", sub: "J K L" },
  { d: "6", sub: "M N O" },
  { d: "7", sub: "P Q R S" },
  { d: "8", sub: "T U V" },
  { d: "9", sub: "W X Y Z" },
] as const;

function KeypadButton({
  children,
  onClick,
  disabled,
  sub,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  sub?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group w-[74px] h-[74px] rounded-full bg-surface2/70 border border-border/60 flex flex-col items-center justify-center transition-colors active:bg-accent active:border-accent disabled:opacity-40"
    >
      <span className="text-[30px] leading-none font-light text-text group-active:text-white">{children}</span>
      {sub ? (
        <span className="text-[9px] font-semibold tracking-[0.15em] text-muted-soft mt-0.5 group-active:text-white/80">
          {sub}
        </span>
      ) : null}
    </button>
  );
}
