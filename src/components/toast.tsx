"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

type ToastTone = "success" | "error" | "info";
type Toast = { id: number; message: string; tone: ToastTone };

type ToastContextValue = {
  toast: (message: string, tone?: ToastTone) => void;
  success: (message: string) => void;
  error: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_STYLES: Record<ToastTone, { icon: string; classes: string }> = {
  success: { icon: "✓", classes: "border-green/40 text-green" },
  error: { icon: "!", classes: "border-red/40 text-red" },
  info: { icon: "i", classes: "border-accent/40 text-accent" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, tone: ToastTone = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, tone }]);
  }, []);

  const value: ToastContextValue = {
    toast,
    success: useCallback((m: string) => toast(m, "success"), [toast]),
    error: useCallback((m: string) => toast(m, "error"), [toast]),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed z-[100] bottom-24 sm:bottom-6 inset-x-0 flex flex-col items-center gap-2 px-4 pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDone={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDone }: { toast: Toast; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 3500);
    return () => clearTimeout(timer);
  }, [onDone]);

  const t = TONE_STYLES[toast.tone];
  return (
    <div
      role="status"
      onClick={onDone}
      className={`pointer-events-auto animate-fade-up cursor-pointer flex items-center gap-2.5 max-w-sm w-full sm:w-auto bg-surface2 border ${t.classes} rounded-xl px-4 py-3 shadow-2xl shadow-black/30 text-sm`}
    >
      <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-xs font-bold shrink-0">
        {t.icon}
      </span>
      <span className="text-text leading-snug">{toast.message}</span>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
