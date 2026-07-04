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
  const triedAuto = useRef(false);

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
          setError("Too many attempts.");
        } else {
          setRemaining(typeof data.remainingAttempts === "number" ? data.remainingAttempts : null);
          setError(data.error ?? "Incorrect PIN.");
        }
      } finally {
        setBusy(false);
      }
    },
    [onUnlocked]
  );

  function press(digit: string) {
    if (busy || lockSeconds > 0 || pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    setError("");
    if (next.length === 4) void submitPin(next);
  }

  function backspace() {
    setPin((p) => p.slice(0, -1));
    setError("");
  }

  async function usePassword() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    lockNow();
    router.push("/login");
    router.refresh();
  }

  const disabled = busy || lockSeconds > 0;

  return (
    <div className="fixed inset-0 z-[200] bg-bg flex flex-col items-center justify-center px-6 py-10 animate-fade-in">
      <div className="w-full max-w-xs flex flex-col items-center">
        <div className="w-14 h-14 rounded-2xl bg-accent-glow flex items-center justify-center text-2xl mb-4">🔒</div>
        <div className="font-display text-xl font-semibold text-accent italic">FamilyWealth</div>
        <div className="text-sm text-muted mt-1 mb-7">App locked</div>

        {/* Biometric */}
        {bioState !== "unavailable" && (
          <button
            onClick={tryBiometric}
            disabled={disabled || bioState === "trying"}
            className="w-full mb-5 flex items-center justify-center gap-2 bg-surface2 border border-border rounded-xl py-3 text-sm font-semibold hover:border-accent/50 transition-colors disabled:opacity-60"
          >
            <span className="text-lg">👆</span>
            {bioState === "trying" ? "Waiting for biometric…" : "Unlock with Face ID / Fingerprint"}
          </button>
        )}

        {/* PIN dots */}
        <div className="flex gap-3 mb-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-3.5 h-3.5 rounded-full border transition-colors ${
                pin.length > i ? "bg-accent border-accent" : "border-muted-soft"
              }`}
            />
          ))}
        </div>

        <div className="h-5 mb-2 text-center">
          {lockSeconds > 0 ? (
            <span className="text-xs text-red">Locked — try again in {lockSeconds}s</span>
          ) : error ? (
            <span className="text-xs text-red">
              {error}
              {remaining !== null && remaining > 0 ? ` ${remaining} attempt${remaining === 1 ? "" : "s"} left.` : ""}
            </span>
          ) : (
            <span className="text-xs text-muted-soft">Enter your 4-digit PIN</span>
          )}
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3 w-full">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <KeypadButton key={d} onClick={() => press(d)} disabled={disabled}>
              {d}
            </KeypadButton>
          ))}
          <div />
          <KeypadButton onClick={() => press("0")} disabled={disabled}>
            0
          </KeypadButton>
          <KeypadButton onClick={backspace} disabled={disabled || pin.length === 0}>
            ⌫
          </KeypadButton>
        </div>

        <button onClick={usePassword} className="mt-7 text-xs text-muted hover:text-accent transition-colors">
          Forgot PIN? Log in with password
        </button>
      </div>
    </div>
  );
}

function KeypadButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="aspect-square rounded-2xl bg-surface2 border border-border text-xl font-semibold hover:border-accent/50 active:bg-surface3 transition-colors disabled:opacity-40"
    >
      {children}
    </button>
  );
}
