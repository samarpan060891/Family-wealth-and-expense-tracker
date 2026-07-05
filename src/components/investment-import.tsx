"use client";
import { useRef, useState } from "react";
import { Badge, Button, Modal } from "@/components/ui";
import { useToast } from "@/components/toast";
import { INVESTMENT_TYPES } from "@/lib/categories";

type ImportRow = {
  name: string;
  type: string;
  symbol: string | null;
  quantity: number | null;
  investedAmount: number | null;
  currentValue: number | null;
  purchaseDate: string | null;
};

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function InvestmentImport({ onDone }: { onDone: () => void }) {
  const { success, error: toastError } = useToast();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<"pick" | "loading" | "review" | "committing">("pick");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [aiUsed, setAiUsed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStage("pick");
    setRows([]);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStage("loading");
    try {
      const fileData = await fileToBase64(file);
      const res = await fetch("/api/investments/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileData }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toastError(data.error ?? "Couldn't read the file.");
        reset();
        return;
      }
      setRows(data.rows ?? []);
      setAiUsed(Boolean(data.aiUsed));
      setStage("review");
    } catch {
      toastError("Couldn't read the file.");
      reset();
    }
  }

  function update(i: number, patch: Partial<ImportRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function commit() {
    if (rows.length === 0) return;
    setStage("committing");
    try {
      const res = await fetch("/api/investments/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toastError(data.error ?? "Import failed.");
        setStage("review");
        return;
      }
      const skipped = data.skippedNoPermission
        ? ` (${data.skippedNoPermission} skipped — no permission)`
        : "";
      success(`Imported ${data.created} holding${data.created === 1 ? "" : "s"}${skipped}.`);
      setOpen(false);
      reset();
      onDone();
    } finally {
      if (stage === "committing") setStage("review");
    }
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        ⇪ Import
      </Button>
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          reset();
        }}
        title="Import Investments from Excel / CSV"
      >
        {stage === "pick" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted leading-relaxed">
              Upload a spreadsheet of your holdings. We&apos;ll read the columns and let you review everything before
              anything is saved. Include a <b>symbol/scheme code</b> and <b>quantity</b> for weekly price auto-updates.
            </p>
            <label className="!mb-0 !normal-case flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border hover:border-accent/50 hover:bg-accent-glow rounded-xl px-4 py-8 cursor-pointer text-muted text-center transition-colors">
              <span className="text-2xl">⇪</span>
              <span className="text-sm font-medium">Choose an .xlsx or .csv file</span>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={onFile}
                className="hidden"
              />
            </label>
          </div>
        )}

        {stage === "loading" && (
          <div className="flex flex-col items-center gap-3 py-10">
            <div className="w-9 h-9 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            <div className="text-sm text-muted">Reading your spreadsheet…</div>
          </div>
        )}

        {(stage === "review" || stage === "committing") && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">
                {rows.length} holding{rows.length === 1 ? "" : "s"} found
              </div>
              <Badge tone={aiUsed ? "accent" : "blue"}>{aiUsed ? "AI-mapped" : "Auto-mapped"}</Badge>
            </div>
            <p className="text-xs text-muted-soft">
              Review and fix anything. Rows with a symbol + quantity get{" "}
              <span className="text-green font-semibold">Auto</span> price updates.
            </p>

            <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto pr-1">
              {rows.map((r, i) => {
                const auto = Boolean(r.symbol) && (r.quantity ?? 0) > 0;
                return (
                  <div key={i} className="border border-border rounded-xl p-2.5 flex flex-col gap-2 bg-surface2/40">
                    <div className="flex items-center gap-2">
                      <input
                        value={r.name}
                        onChange={(e) => update(i, { name: e.target.value })}
                        placeholder="Name"
                        className="flex-1 !py-1.5 text-sm"
                      />
                      {auto && <Badge tone="green">Auto</Badge>}
                      <button
                        onClick={() => removeRow(i)}
                        className="text-muted-soft hover:text-red text-sm px-1 shrink-0"
                        aria-label="Remove row"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={r.type}
                        onChange={(e) => update(i, { type: e.target.value })}
                        className="!py-1.5 text-sm"
                      >
                        {INVESTMENT_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <input
                        value={r.symbol ?? ""}
                        onChange={(e) => update(i, { symbol: e.target.value || null })}
                        placeholder="Symbol / code"
                        className="!py-1.5 text-sm"
                      />
                      <input
                        type="number"
                        step="any"
                        value={r.quantity ?? ""}
                        onChange={(e) => update(i, { quantity: e.target.value ? Number(e.target.value) : null })}
                        placeholder="Quantity"
                        className="!py-1.5 text-sm"
                      />
                      <input
                        type="number"
                        step="any"
                        value={r.investedAmount ?? ""}
                        onChange={(e) => update(i, { investedAmount: e.target.value ? Number(e.target.value) : null })}
                        placeholder="Invested ₹"
                        className="!py-1.5 text-sm"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2 pt-1">
              <Button onClick={commit} disabled={stage === "committing" || rows.length === 0} className="flex-1">
                {stage === "committing" ? "Importing…" : `Import ${rows.length}`}
              </Button>
              <Button variant="outline" onClick={reset}>
                Start over
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
