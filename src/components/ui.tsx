"use client";
import { useEffect, useState, InputHTMLAttributes } from "react";

export function Card({
  children,
  className = "",
  hover = false,
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={`bg-surface border border-border-soft rounded-2xl p-5 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset] transition-all duration-200 ${
        hover ? "hover:border-border hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "outline" | "subtle";
  size?: "sm" | "md";
}) {
  const styles = {
    primary:
      "bg-gradient-to-b from-accent-soft to-accent text-black hover:brightness-105 shadow-[0_1px_0_rgba(255,255,255,0.35)_inset,0_8px_20px_-6px_rgba(232,163,61,0.45)] active:translate-y-px",
    ghost: "bg-surface2 text-text border border-border hover:border-muted-soft hover:bg-surface3",
    danger: "bg-red/90 text-white hover:bg-red shadow-[0_8px_20px_-8px_rgba(239,106,99,0.55)]",
    outline: "bg-transparent border border-accent/60 text-accent hover:bg-accent-glow",
    subtle: "bg-transparent text-muted hover:text-text hover:bg-surface2",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-xs rounded-lg",
    md: "px-4 py-2.5 text-sm rounded-xl",
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none ${styles[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function IconButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex items-center justify-center w-9 h-9 rounded-xl bg-surface2 border border-border text-muted hover:text-text hover:border-muted-soft transition-all ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={visible ? "text" : "password"} className="pr-16" />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold tracking-wide text-muted hover:text-accent px-2 py-1 uppercase"
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}

export function EmptyState({ title, sub, icon }: { title: string; sub?: string; icon?: string }) {
  return (
    <div className="text-center py-12 px-4">
      {icon && <div className="text-3xl mb-3 opacity-60">{icon}</div>}
      <div className="text-text font-semibold mb-1">{title}</div>
      {sub && <div className="text-sm text-muted max-w-xs mx-auto">{sub}</div>}
    </div>
  );
}

export function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function PageHeader({
  title,
  accent,
  sub,
  action,
}: {
  title: string;
  accent?: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-1">
      <div>
        <h1 className="font-display text-[26px] sm:text-3xl font-semibold text-text leading-tight">
          {title} {accent && <span className="text-accent italic">{accent}</span>}
        </h1>
        {sub && <div className="text-muted text-sm mt-1 font-mono">{sub}</div>}
      </div>
      {action}
    </div>
  );
}

const STAT_TONES: Record<string, { text: string; bg: string; ring: string }> = {
  accent: { text: "text-accent", bg: "bg-accent/10", ring: "ring-accent/20" },
  green: { text: "text-green", bg: "bg-green/10", ring: "ring-green/20" },
  red: { text: "text-red", bg: "bg-red/10", ring: "ring-red/20" },
  blue: { text: "text-blue", bg: "bg-blue/10", ring: "ring-blue/20" },
  purple: { text: "text-purple", bg: "bg-purple/10", ring: "ring-purple/20" },
};

export function StatCard({
  label,
  value,
  sub,
  tone = "accent",
  icon,
  className = "",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: keyof typeof STAT_TONES;
  icon?: string;
  className?: string;
}) {
  const t = STAT_TONES[tone];
  return (
    <Card hover className={`relative overflow-hidden ${className}`}>
      <div className={`absolute -top-6 -right-6 w-24 h-24 rounded-full ${t.bg} blur-sm`} />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted mb-2">{label}</div>
          <div className={`text-2xl font-bold font-mono ${t.text}`}>{value}</div>
          {sub && <div className="text-xs text-muted-soft mt-1">{sub}</div>}
        </div>
        {icon && (
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base ${t.bg} ring-1 ${t.ring}`}>
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

export function Badge({ children, tone = "accent" }: { children: React.ReactNode; tone?: keyof typeof STAT_TONES }) {
  const t = STAT_TONES[tone];
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${t.bg} ${t.text}`}>
      {children}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!mounted) return null;

  return (
    <div
      className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 transition-opacity duration-200 ${
        open ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      onClick={onClose}
      onTransitionEnd={() => {
        if (!open) setMounted(false);
      }}
    >
      <div
        className={`bg-surface border border-border rounded-t-3xl sm:rounded-2xl p-6 w-full sm:w-[540px] max-h-[92vh] overflow-y-auto shadow-2xl shadow-black/50 transition-transform duration-200 ${
          open ? "translate-y-0" : "translate-y-6"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface2 border border-border text-muted hover:text-text hover:border-muted-soft transition-colors flex items-center justify-center text-lg leading-none"
          >
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
