"use client";
import { useEffect, useState } from "react";
import { Button, Card, PasswordInput } from "@/components/ui";
import { useToast } from "@/components/toast";
import { biometricAvailable, registerBiometric } from "@/lib/app-lock-client";

type Status = { enabled: boolean; hasPin: boolean; hasBiometric: boolean; biometricCount: number };

export function AppLockSettings() {
  const { success, error: toastError } = useToast();
  const [status, setStatus] = useState<Status | null>(null);
  const [bioSupported, setBioSupported] = useState(false);

  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [savingPin, setSavingPin] = useState(false);

  const [password, setPassword] = useState("");
  const [disabling, setDisabling] = useState(false);
  const [showDisable, setShowDisable] = useState(false);
  const [addingBio, setAddingBio] = useState(false);

  async function load() {
    const res = await fetch("/api/app-lock").then((r) => r.json());
    setStatus(res);
  }
  useEffect(() => {
    load();
    biometricAvailable().then(setBioSupported);
  }, []);

  async function savePin(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{4}$/.test(pin)) return toastError("PIN must be exactly 4 digits.");
    if (pin !== confirmPin) return toastError("The PINs don't match.");
    setSavingPin(true);
    try {
      const res = await fetch("/api/app-lock/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return toastError(data.error ?? "Could not save PIN.");
      setPin("");
      setConfirmPin("");
      success(status?.hasPin ? "PIN updated." : "App Lock is on — PIN set.");
      load();
    } finally {
      setSavingPin(false);
    }
  }

  async function addBiometric() {
    setAddingBio(true);
    try {
      const label = typeof navigator !== "undefined" ? navigator.platform || "This device" : "This device";
      const res = await registerBiometric(label);
      if (!res.ok) return toastError(res.error ?? "Could not set up biometric.");
      success("Biometric unlock enabled on this device.");
      load();
    } finally {
      setAddingBio(false);
    }
  }

  async function disable(e: React.FormEvent) {
    e.preventDefault();
    setDisabling(true);
    try {
      const res = await fetch("/api/app-lock/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return toastError(data.error ?? "Could not disable App Lock.");
      setPassword("");
      setShowDisable(false);
      success("App Lock turned off.");
      load();
    } finally {
      setDisabling(false);
    }
  }

  if (!status) {
    return (
      <Card>
        <div className="text-sm text-muted-soft">Loading App Lock…</div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <div className="text-sm font-bold">App Lock</div>
          <div className="text-xs text-muted mt-0.5">
            Require Face ID / fingerprint or a 4-digit PIN to open the app.
          </div>
        </div>
        <span
          className={`text-[11px] font-mono uppercase tracking-wide px-2 py-1 rounded-full ${
            status.enabled ? "bg-green/10 text-green" : "bg-surface3 text-muted"
          }`}
        >
          {status.enabled ? "On" : "Off"}
        </span>
      </div>

      <div className="h-px bg-border-soft my-4" />

      {/* PIN — the reliable fallback, always available */}
      <form onSubmit={savePin} className="flex flex-col gap-3">
        <div>
          <div className="text-sm font-semibold mb-1">
            {status.hasPin ? "Change PIN" : "Set a 4-digit PIN"}
            {!status.hasPin && <span className="text-red"> *</span>}
          </div>
          <div className="text-xs text-muted-soft mb-2">
            Your PIN is stored securely (hashed) and is the fallback when biometric isn&apos;t available.
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              placeholder="New PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            />
            <input
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              placeholder="Confirm PIN"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            />
          </div>
        </div>
        <Button type="submit" disabled={savingPin} className="w-fit">
          {savingPin ? "Saving…" : status.hasPin ? "Update PIN" : "Enable App Lock with PIN"}
        </Button>
      </form>

      {/* Biometric — the primary method */}
      <div className="h-px bg-border-soft my-4" />
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Biometric unlock</div>
          <div className="text-xs text-muted-soft mt-0.5">
            {status.hasBiometric
              ? `Enabled (${status.biometricCount} device${status.biometricCount === 1 ? "" : "s"}). Add more devices anytime.`
              : bioSupported
                ? "Use Face ID / Touch ID / fingerprint on this device."
                : "Not available on this device or browser."}
          </div>
        </div>
        {bioSupported && (
          <Button variant="outline" onClick={addBiometric} disabled={addingBio} className="shrink-0">
            {addingBio ? "Setting up…" : status.hasBiometric ? "Add device" : "Set up"}
          </Button>
        )}
      </div>

      {/* Disable */}
      {status.enabled && (
        <>
          <div className="h-px bg-border-soft my-4" />
          {showDisable ? (
            <form onSubmit={disable} className="flex flex-col gap-2">
              <div className="text-sm font-semibold text-red">Turn off App Lock</div>
              <div className="text-xs text-muted-soft">Confirm your account password to remove the PIN and biometrics.</div>
              <PasswordInput
                required
                placeholder="Account password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <div className="flex gap-2">
                <Button type="submit" variant="danger" disabled={disabling}>
                  {disabling ? "Turning off…" : "Turn off"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowDisable(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowDisable(true)}
              className="text-xs text-muted hover:text-red transition-colors"
            >
              Turn off App Lock
            </button>
          )}
        </>
      )}
    </Card>
  );
}
