"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useCurrencyCtx } from "@/components/currency-context";
import { CURRENCIES } from "@/lib/currency";

export function CurrencySettings() {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const { displayCurrency, defaultCurrency, isAdmin } = useCurrencyCtx();
  const [display, setDisplay] = useState(displayCurrency);
  const [base, setBase] = useState(defaultCurrency);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const body: Record<string, string> = { displayCurrency: display };
      if (isAdmin && base !== defaultCurrency) body.defaultCurrency = base;
      const res = await fetch("/api/settings/currency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return toastError(data.error ?? "Couldn't save.");
      success("Currency settings saved.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const dirty = display !== displayCurrency || (isAdmin && base !== defaultCurrency);

  return (
    <Card>
      <div className="text-sm font-bold mb-1">Currency</div>
      <div className="text-xs text-muted mb-4">
        Amounts are stored in each entry&apos;s own currency. Totals are shown in your display currency using live
        exchange rates.
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <label>Show my totals in</label>
          <select value={display} onChange={(e) => setDisplay(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} · {c.name} ({c.symbol})
              </option>
            ))}
          </select>
        </div>

        {isAdmin && (
          <div>
            <label>Household default currency (for new entries)</label>
            <select value={base} onChange={(e) => setBase(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} · {c.name} ({c.symbol})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-soft mt-1">
              Existing entries keep their currency; this only sets the default for new ones.
            </p>
          </div>
        )}

        <Button onClick={save} disabled={saving || !dirty} className="w-fit">
          {saving ? "Saving…" : "Save currency settings"}
        </Button>
      </div>
    </Card>
  );
}
