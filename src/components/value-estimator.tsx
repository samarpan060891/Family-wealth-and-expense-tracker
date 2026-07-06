"use client";
import { useState } from "react";
import { Button, fmtCurrency } from "@/components/ui";
import { useToast } from "@/components/toast";

const SIZE_UNITS = ["sqft", "sqm", "sqyd", "acre", "gram", "tola", "unit"];

type Estimate = {
  estimatedValue: number | null;
  currency: string;
  confidence: string | null;
  summary: string;
  sources: { title: string; url: string }[];
  configured: boolean;
};

// Self-contained "estimate current value" block using the AI web-search valuation.
// Suitable for real estate, vehicles, gold/jewellery, etc.
export function ValueEstimator({
  assetType,
  name,
  currency,
  purchasePrice,
  purchaseDate,
  onApply,
}: {
  assetType: string;
  name?: string;
  currency: string;
  purchasePrice?: string | number;
  purchaseDate?: string;
  onApply: (value: number, note: string) => void;
}) {
  const { success, error: toastError } = useToast();
  const [location, setLocation] = useState("");
  const [sizeValue, setSizeValue] = useState("");
  const [sizeUnit, setSizeUnit] = useState("sqft");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [est, setEst] = useState<Estimate | null>(null);

  const isProperty = /real estate|property|land|house|apartment|flat/i.test(assetType);

  async function run() {
    if (!location.trim() && !details.trim()) {
      toastError("Add a location or some details to estimate the value.");
      return;
    }
    setBusy(true);
    setEst(null);
    try {
      const res = await fetch("/api/valuation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetType,
          name: name || undefined,
          location: location || undefined,
          sizeValue: sizeValue || undefined,
          sizeUnit: sizeValue ? sizeUnit : undefined,
          details: details || undefined,
          purchasePrice: purchasePrice || undefined,
          purchaseDate: purchaseDate || undefined,
          currency,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toastError(data.error ?? "Couldn't estimate the value.");
        return;
      }
      setEst(data);
      if (data.configured === false) toastError("AI valuation needs ANTHROPIC_API_KEY set on the server.");
      else if (!data.estimatedValue) toastError("Couldn't find enough comparable data — add more detail.");
    } finally {
      setBusy(false);
    }
  }

  function apply() {
    if (!est?.estimatedValue) return;
    const src = est.sources.map((s) => s.url).join(" · ");
    const note = `AI estimate ${new Date().toISOString().slice(0, 10)} (${est.confidence ?? "?"}): ${est.summary}${src ? ` Sources: ${src}` : ""}`;
    onApply(est.estimatedValue, note);
    success("Estimated value applied — review and save.");
  }

  return (
    <div className="border border-border rounded-xl p-3 bg-surface2/40 flex flex-col gap-2.5">
      <div className="text-sm font-semibold">🔍 Estimate current value</div>
      <div>
        <label>{isProperty ? "Area / location" : "Location (optional)"}</label>
        <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Dubai Marina, Dubai" />
      </div>
      {isProperty && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label>Size</label>
            <input type="number" min="0" value={sizeValue} onChange={(e) => setSizeValue(e.target.value)} placeholder="e.g. 1200" />
          </div>
          <div>
            <label>Unit</label>
            <select value={sizeUnit} onChange={(e) => setSizeUnit(e.target.value)}>
              {SIZE_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      <div>
        <label>Details (optional)</label>
        <input
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder={
            /vehicle|car|bike/i.test(assetType)
              ? "e.g. 2019 Toyota Camry, 60k km"
              : /gold|jewel/i.test(assetType)
                ? "e.g. 50 grams, 22K"
                : "make/model/year, condition, spec…"
          }
        />
      </div>
      <Button type="button" variant="outline" onClick={run} disabled={busy} className="w-fit">
        {busy ? "Searching recent listings…" : "🔍 Estimate value"}
      </Button>
      {est && est.estimatedValue != null && (
        <div className="bg-surface2 border border-border-soft rounded-lg p-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs text-muted">Estimated value</span>
            <span className="text-[10px] font-mono uppercase text-muted-soft">{est.confidence ?? "?"} confidence</span>
          </div>
          <div className="text-xl font-bold font-mono text-green">{fmtCurrency(est.estimatedValue, est.currency)}</div>
          <p className="text-xs text-muted mt-1 leading-relaxed">{est.summary}</p>
          {est.sources.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {est.sources.map((s, i) => (
                <a key={i} href={s.url} target="_blank" rel="noreferrer" className="text-[10px] text-accent underline truncate max-w-[10rem]">
                  {s.title}
                </a>
              ))}
            </div>
          )}
          <Button type="button" onClick={apply} className="mt-2" size="sm">
            Use as value
          </Button>
        </div>
      )}
      <p className="text-[11px] text-muted-soft leading-relaxed">
        An AI estimate from recent comparable listings/market rates — a guide, not a formal appraisal.
      </p>
    </div>
  );
}
