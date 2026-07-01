"use client";
import { useEffect, useState } from "react";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    setTheme((document.documentElement.getAttribute("data-theme") as "dark" | "light") ?? "dark");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("fw-theme", next);
  }

  return (
    <button
      onClick={toggle}
      title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      className={`inline-flex items-center justify-center w-8 h-8 rounded-lg bg-surface2 border border-border text-muted hover:text-accent hover:border-accent/40 transition-colors text-sm ${className}`}
    >
      {theme === "dark" ? "☀" : "☾"}
    </button>
  );
}
