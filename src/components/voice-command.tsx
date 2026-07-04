"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Modal, fmtCurrency } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useSpeech } from "@/lib/use-speech";
import { cleanAmount } from "@/lib/extract-fields";
import {
  PAYMENT_METHODS,
  FREQUENCIES,
  INVESTMENT_TYPES,
  DEBT_TYPES,
  ASSET_TYPES,
  INSURANCE_TYPES,
} from "@/lib/categories";

type VoiceModule = "expense" | "income" | "investment" | "debt" | "asset" | "insurance";
type Fields = Record<string, string | number | boolean | null>;

type Intent = {
  intent: "create" | "query" | "unknown";
  module: VoiceModule | null;
  fields: Fields;
  missing: string[];
  query: string | null;
  message: string;
  clarification: string | null;
  configured?: boolean;
};

type OpenOpts = { module?: VoiceModule; onFilled?: (fields: Fields) => void };

type VoiceContextValue = { open: (opts?: OpenOpts) => void };
const VoiceContext = createContext<VoiceContextValue | null>(null);

export function useVoice() {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error("useVoice must be used within VoiceProvider");
  return ctx;
}

// ---- Field specs per module (drive the review form) --------------------------

type FieldKind = "amount" | "date" | "text" | "category" | "type" | "payment" | "frequency" | "bool";
type FieldSpec = { key: string; label: string; kind: FieldKind; required?: boolean; options?: string[] };

const MODULE_SPECS: Record<VoiceModule, { title: string; endpoint: string; fields: FieldSpec[] }> = {
  expense: {
    title: "Expense",
    endpoint: "/api/transactions",
    fields: [
      { key: "categoryName", label: "Category", kind: "category", required: true },
      { key: "amount", label: "Amount", kind: "amount", required: true },
      { key: "date", label: "Date", kind: "date", required: true },
      { key: "paymentMethod", label: "Payment method", kind: "payment" },
      { key: "note", label: "Note", kind: "text" },
      { key: "isRecurring", label: "Repeats regularly", kind: "bool" },
      { key: "recurrenceFrequency", label: "Frequency", kind: "frequency" },
    ],
  },
  income: {
    title: "Income",
    endpoint: "/api/transactions",
    fields: [
      { key: "categoryName", label: "Category", kind: "category", required: true },
      { key: "amount", label: "Amount", kind: "amount", required: true },
      { key: "date", label: "Date", kind: "date", required: true },
      { key: "paymentMethod", label: "Received via", kind: "payment" },
      { key: "note", label: "Note", kind: "text" },
      { key: "isRecurring", label: "Repeats regularly", kind: "bool" },
      { key: "recurrenceFrequency", label: "Frequency", kind: "frequency" },
    ],
  },
  investment: {
    title: "Investment",
    endpoint: "/api/investments",
    fields: [
      { key: "name", label: "Name", kind: "text", required: true },
      { key: "type", label: "Type", kind: "type", required: true, options: INVESTMENT_TYPES },
      { key: "investedAmount", label: "Invested amount", kind: "amount", required: true },
      { key: "currentValue", label: "Current value", kind: "amount" },
      { key: "purchaseDate", label: "Start date", kind: "date" },
      { key: "maturityDate", label: "Maturity date", kind: "date" },
      { key: "isRecurring", label: "Recurring (SIP)", kind: "bool" },
      { key: "recurrenceFrequency", label: "Frequency", kind: "frequency" },
    ],
  },
  debt: {
    title: "Debt / Loan",
    endpoint: "/api/debts",
    fields: [
      { key: "name", label: "Name", kind: "text", required: true },
      { key: "lender", label: "Lender", kind: "text" },
      { key: "type", label: "Type", kind: "type", required: true, options: DEBT_TYPES },
      { key: "principal", label: "Principal", kind: "amount", required: true },
      { key: "outstandingAmount", label: "Outstanding", kind: "amount", required: true },
      { key: "interestRate", label: "Interest %", kind: "amount" },
      { key: "emiAmount", label: "EMI", kind: "amount" },
      { key: "startDate", label: "Start date", kind: "date" },
    ],
  },
  asset: {
    title: "Asset",
    endpoint: "/api/assets",
    fields: [
      { key: "name", label: "Name", kind: "text", required: true },
      { key: "type", label: "Type", kind: "type", required: true, options: ASSET_TYPES },
      { key: "value", label: "Value", kind: "amount", required: true },
      { key: "purchaseDate", label: "Purchase date", kind: "date" },
    ],
  },
  insurance: {
    title: "Insurance",
    endpoint: "/api/insurances",
    fields: [
      { key: "name", label: "Policy name", kind: "text", required: true },
      { key: "type", label: "Type", kind: "type", required: true, options: INSURANCE_TYPES },
      { key: "provider", label: "Provider", kind: "text" },
      { key: "premiumAmount", label: "Premium", kind: "amount", required: true },
      { key: "premiumFrequency", label: "Premium frequency", kind: "frequency" },
      { key: "startDate", label: "Start date", kind: "date" },
      { key: "expiryDate", label: "Expiry / renewal", kind: "date", required: true },
      { key: "sumAssured", label: "Sum assured", kind: "amount" },
      { key: "nominee", label: "Nominee", kind: "text" },
    ],
  },
};

const EXAMPLES = [
  "Add expense of 2500 for groceries today",
  "Add salary income of 85000",
  "Investment in mutual fund SIP 5000 monthly",
  "Show my net worth",
  "What are my upcoming insurance renewals?",
];

// ---- Provider ----------------------------------------------------------------

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<OpenOpts | null>(null);
  const open = useCallback((o?: OpenOpts) => setOpts(o ?? {}), []);
  const value = useMemo(() => ({ open }), [open]);

  return (
    <VoiceContext.Provider value={value}>
      {children}
      {/* Floating mic button, above the mobile bottom nav */}
      <button
        onClick={() => open()}
        aria-label="Voice command"
        className="fixed z-40 right-4 bottom-24 lg:bottom-6 w-14 h-14 rounded-full bg-accent text-black shadow-lg shadow-black/30 flex items-center justify-center text-2xl hover:scale-105 active:scale-95 transition-transform"
      >
        🎤
      </button>
      {opts && <VoiceModal opts={opts} onClose={() => setOpts(null)} />}
    </VoiceContext.Provider>
  );
}

// ---- Modal -------------------------------------------------------------------

type Stage = "listen" | "processing" | "confirm" | "answer" | "error";

function VoiceModal({ opts, onClose }: { opts: OpenOpts; onClose: () => void }) {
  const { success, error: toastError } = useToast();
  const speech = useSpeech();
  const [stage, setStage] = useState<Stage>("listen");
  const [manual, setManual] = useState("");
  const [intent, setIntent] = useState<Intent | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const startedRef = useRef(false);

  const process = useCallback(
    async (transcript: string) => {
      const text = transcript.trim();
      if (!text) return;
      setStage("processing");
      try {
        const res = await fetch("/api/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: text, module: opts.module }),
        });
        const data = (await res.json()) as Intent;
        if (!res.ok) {
          setErrorMsg((data as { error?: string }).error ?? "Couldn't understand that.");
          setStage("error");
          return;
        }
        setIntent(data);
        if (data.intent === "query") {
          setStage("answer");
        } else if (data.intent === "create" && data.module) {
          // Form-scoped voice: hand fields back to the form and close.
          if (opts.onFilled) {
            opts.onFilled(data.fields);
            success("Filled from your voice.");
            onClose();
            return;
          }
          setStage("confirm");
        } else {
          setErrorMsg(data.message || "I couldn't tell what to do with that.");
          setStage("error");
        }
      } catch {
        setErrorMsg("Something went wrong. Please try again.");
        setStage("error");
      }
    },
    [opts, onClose, success]
  );

  // Auto-start listening when the mic is available.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (speech.supported) speech.start();
  }, [speech]);

  // When listening ends and we have a transcript, process it.
  useEffect(() => {
    if (!speech.listening && speech.transcript && stage === "listen") {
      process(speech.transcript);
    }
  }, [speech.listening, speech.transcript, stage, process]);

  // Surface mic errors (permission / no mic / unsupported).
  useEffect(() => {
    if (speech.error) {
      const map: Record<string, string> = {
        "not-allowed": "Microphone permission was blocked. Allow it in your browser settings, or type your command below.",
        "service-not-allowed": "Microphone permission was blocked. Allow it, or type your command below.",
        "audio-capture": "No microphone was found. You can type your command instead.",
        unsupported: "Voice input isn't supported in this browser. You can type your command instead.",
        "no-speech": "I didn't hear anything. Tap the mic to try again, or type it below.",
      };
      setErrorMsg(map[speech.error] ?? "Couldn't access the microphone. Type your command instead.");
      setStage((s) => (s === "listen" ? "error" : s));
    }
  }, [speech.error]);

  function restart() {
    setIntent(null);
    setErrorMsg("");
    speech.reset();
    setStage("listen");
    if (speech.supported) speech.start();
  }

  const title =
    stage === "confirm" && intent?.module
      ? `Review ${MODULE_SPECS[intent.module].title}`
      : stage === "answer"
        ? "Here's what I found"
        : "Voice Command";

  return (
    <Modal open onClose={onClose} title={title}>
      {stage === "listen" && (
        <ListenView speech={speech} manual={manual} setManual={setManual} onSubmitManual={() => process(manual)} onStop={() => speech.stop()} />
      )}

      {stage === "processing" && (
        <div className="flex flex-col items-center gap-3 py-8">
          <div className="w-10 h-10 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          <div className="text-sm text-muted">Understanding your command…</div>
        </div>
      )}

      {stage === "confirm" && intent?.module && (
        <ConfirmForm
          module={intent.module}
          intent={intent}
          onCancel={restart}
          onSaved={() => {
            success(`${MODULE_SPECS[intent.module!].title} saved.`);
            onClose();
          }}
          onError={(m) => toastError(m)}
        />
      )}

      {stage === "answer" && intent && <QueryAnswer intent={intent} onAskAgain={restart} />}

      {stage === "error" && (
        <div className="flex flex-col gap-4 py-2">
          <div className="text-sm text-muted">{errorMsg}</div>
          <ManualInput value={manual} setValue={setManual} onSubmit={() => process(manual)} />
          {speech.supported && (
            <Button variant="outline" onClick={restart} className="w-fit">
              🎤 Try voice again
            </Button>
          )}
        </div>
      )}
    </Modal>
  );
}

// ---- Listening view ----------------------------------------------------------

function ListenView({
  speech,
  manual,
  setManual,
  onSubmitManual,
  onStop,
}: {
  speech: ReturnType<typeof useSpeech>;
  manual: string;
  setManual: (v: string) => void;
  onSubmitManual: () => void;
  onStop: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <button
        onClick={speech.listening ? onStop : speech.start}
        className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl transition-all ${
          speech.listening ? "bg-red/15 text-red ring-4 ring-red/30 animate-pulse" : "bg-accent-glow text-accent"
        }`}
      >
        🎤
      </button>
      <div className="text-sm font-semibold">
        {speech.listening ? "Listening… tap to stop" : "Tap the mic and speak"}
      </div>

      <div className="min-h-[3rem] w-full text-center px-2">
        {speech.transcript || speech.interim ? (
          <p className="text-sm">
            <span className="text-text">{speech.transcript}</span>{" "}
            <span className="text-muted-soft">{speech.interim}</span>
          </p>
        ) : (
          <div className="text-xs text-muted-soft">
            <div className="mb-1">Try:</div>
            {EXAMPLES.map((e) => (
              <div key={e}>“{e}”</div>
            ))}
          </div>
        )}
      </div>

      <div className="w-full border-t border-border-soft pt-3">
        <div className="text-[11px] font-mono uppercase tracking-wide text-muted-soft mb-2 text-center">
          or type it
        </div>
        <ManualInput value={manual} setValue={setManual} onSubmit={onSubmitManual} />
      </div>
    </div>
  );
}

function ManualInput({ value, setValue, onSubmit }: { value: string; setValue: (v: string) => void; onSubmit: () => void }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex gap-2"
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="e.g. Add expense of 2500 for groceries"
        className="flex-1"
      />
      <Button type="submit" disabled={!value.trim()}>
        Go
      </Button>
    </form>
  );
}

// ---- Confirm / review form ---------------------------------------------------

type Category = { id: string; name: string };

function ConfirmForm({
  module,
  intent,
  onCancel,
  onSaved,
  onError,
}: {
  module: VoiceModule;
  intent: Intent;
  onCancel: () => void;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const spec = MODULE_SPECS[module];
  const isTx = module === "expense" || module === "income";
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [saving, setSaving] = useState(false);

  // Local editable copy of the parsed fields, normalized to strings for inputs.
  const [values, setValues] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const f of spec.fields) {
      const v = intent.fields[f.key];
      if (f.kind === "amount") out[f.key] = cleanAmount(v == null ? "" : String(v));
      else if (f.kind === "bool") out[f.key] = v === true || v === "true" ? "true" : "false";
      else if (f.kind === "date") out[f.key] = typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "";
      else out[f.key] = v == null ? "" : String(v);
    }
    if ((module === "expense" || module === "income") && !out.date) out.date = new Date().toISOString().slice(0, 10);
    return out;
  });

  useEffect(() => {
    if (!isTx) return;
    fetch(`/api/categories?module=${module}`)
      .then((r) => r.json())
      .then((d) => {
        const cats: Category[] = d.categories ?? [];
        setCategories(cats);
        const wanted = String(intent.fields.categoryName ?? "").toLowerCase();
        const match = cats.find((c) => c.name.toLowerCase() === wanted) ?? cats.find((c) => c.name === "Other");
        setCategoryId(match?.id ?? cats[0]?.id ?? "");
      })
      .catch(() => {});
  }, [isTx, module, intent.fields]);

  function set(key: string, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  function buildBody(): Record<string, unknown> | null {
    const f = values;
    const num = (k: string) => (f[k] ? Number(cleanAmount(f[k])) : undefined);
    if (module === "expense" || module === "income") {
      if (!categoryId) {
        onError("Please choose a category.");
        return null;
      }
      return {
        type: module,
        categoryId,
        amount: num("amount"),
        date: f.date || new Date().toISOString().slice(0, 10),
        paymentMethod: f.paymentMethod || (module === "income" ? "bank_transfer" : "cash"),
        note: f.note || undefined,
        isRecurring: f.isRecurring === "true",
        recurrenceFrequency: f.isRecurring === "true" ? f.recurrenceFrequency || "monthly" : "one_time",
      };
    }
    if (module === "investment")
      return {
        name: f.name,
        type: f.type,
        investedAmount: num("investedAmount") ?? 0,
        currentValue: num("currentValue"),
        purchaseDate: f.purchaseDate || new Date().toISOString().slice(0, 10),
        maturityDate: f.maturityDate || undefined,
        notes: f.isRecurring === "true" ? `Recurring (${f.recurrenceFrequency || "monthly"})` : undefined,
      };
    if (module === "debt")
      return {
        name: f.name,
        lender: f.lender || undefined,
        type: f.type,
        principal: num("principal") ?? 0,
        outstandingAmount: num("outstandingAmount") ?? 0,
        interestRate: num("interestRate"),
        emiAmount: num("emiAmount"),
        startDate: f.startDate || new Date().toISOString().slice(0, 10),
      };
    if (module === "asset")
      return {
        name: f.name,
        type: f.type,
        value: num("value") ?? 0,
        purchaseDate: f.purchaseDate || undefined,
      };
    // insurance
    return {
      name: f.name,
      type: f.type,
      provider: f.provider || undefined,
      premiumAmount: num("premiumAmount") ?? 0,
      premiumFrequency: f.premiumFrequency || "yearly",
      startDate: f.startDate || new Date().toISOString().slice(0, 10),
      expiryDate: f.expiryDate,
      sumAssured: num("sumAssured"),
      nominee: f.nominee || undefined,
    };
  }

  async function save() {
    const body = buildBody();
    if (!body) return;
    // Required-field guard.
    for (const fld of spec.fields) {
      if (!fld.required) continue;
      if (fld.kind === "category") continue; // handled by categoryId
      if (!values[fld.key]) {
        onError(`${fld.label} is required.`);
        return;
      }
    }
    setSaving(true);
    try {
      const res = await fetch(spec.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onError(data.error ?? "Couldn't save that.");
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  const missing = intent.missing?.filter((m) => spec.fields.some((f) => f.key === m)) ?? [];

  return (
    <div className="flex flex-col gap-3">
      {intent.message && <div className="text-sm text-muted bg-surface2 rounded-lg px-3 py-2">🗣️ {intent.message}</div>}
      {intent.clarification && missing.length > 0 && (
        <div className="text-sm text-accent bg-accent-glow rounded-lg px-3 py-2">{intent.clarification}</div>
      )}

      {spec.fields.map((f) => {
        // Hide the frequency field unless "repeats" is on.
        if (f.key === "recurrenceFrequency" && values.isRecurring !== "true") return null;
        const highlight = missing.includes(f.key) || (f.kind === "category" && missing.includes("categoryName"));
        return (
          <div key={f.key}>
            <label className={highlight ? "!text-accent" : ""}>
              {f.label}
              {f.required ? " *" : ""}
            </label>
            <FieldInput
              spec={f}
              value={values[f.key] ?? ""}
              onChange={(v) => set(f.key, v)}
              categories={categories}
              categoryId={categoryId}
              setCategoryId={setCategoryId}
            />
          </div>
        );
      })}

      <div className="flex gap-2 mt-1">
        <Button onClick={save} disabled={saving} className="flex-1">
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button variant="outline" onClick={onCancel}>
          🎤 Redo
        </Button>
      </div>
    </div>
  );
}

function FieldInput({
  spec,
  value,
  onChange,
  categories,
  categoryId,
  setCategoryId,
}: {
  spec: FieldSpec;
  value: string;
  onChange: (v: string) => void;
  categories: Category[];
  categoryId: string;
  setCategoryId: (v: string) => void;
}) {
  if (spec.kind === "category") {
    return (
      <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
        <option value="">— Select —</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    );
  }
  if (spec.kind === "type") {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— Select —</option>
        {(spec.options ?? []).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }
  if (spec.kind === "payment") {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {PAYMENT_METHODS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
    );
  }
  if (spec.kind === "frequency") {
    return (
      <select value={value || "monthly"} onChange={(e) => onChange(e.target.value)}>
        {FREQUENCIES.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
    );
  }
  if (spec.kind === "bool") {
    return (
      <label className="!mb-0 !normal-case flex items-center gap-2 text-sm text-text">
        <input
          type="checkbox"
          className="!w-auto"
          checked={value === "true"}
          onChange={(e) => onChange(e.target.checked ? "true" : "false")}
        />
        Yes
      </label>
    );
  }
  return (
    <input
      type={spec.kind === "date" ? "date" : spec.kind === "amount" ? "number" : "text"}
      inputMode={spec.kind === "amount" ? "decimal" : undefined}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

// ---- Query answer ------------------------------------------------------------

type Dashboard = {
  netWorth: number;
  totals: { investments: number; assets: number; debts: number; thisMonthExpense: number };
  savingsRate: number | null;
  categoryBreakdown: { name: string; amount: number }[];
  upcomingExpiries: { id: string; name: string; type: string; expiryDate: string; kind: string }[];
};

function QueryAnswer({ intent, onAskAgain }: { intent: Intent; onAskAgain: () => void }) {
  const [data, setData] = useState<Dashboard | null>(null);
  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, []);

  return (
    <div className="flex flex-col gap-3">
      {intent.message && <div className="text-sm text-muted">🗣️ {intent.message}</div>}
      {!data ? (
        <div className="text-sm text-muted-soft py-4 text-center">Fetching your numbers…</div>
      ) : (
        <QueryBody query={intent.query} data={data} />
      )}
      <Button variant="outline" onClick={onAskAgain} className="w-fit">
        🎤 Ask something else
      </Button>
    </div>
  );
}

function QueryBody({ query, data }: { query: string | null; data: Dashboard }) {
  if (query === "renewals") {
    const ins = data.upcomingExpiries.filter((e) => e.kind === "insurance");
    const list = ins.length ? ins : data.upcomingExpiries;
    if (list.length === 0) return <Big label="Upcoming renewals" value="None coming up 🎉" />;
    return (
      <div className="flex flex-col gap-2">
        <div className="text-xs font-mono uppercase tracking-wide text-muted">Upcoming renewals</div>
        {list.map((e) => (
          <div key={e.id} className="flex justify-between items-center bg-surface2 border border-border-soft rounded-xl px-3 py-2 text-sm">
            <div>
              <div className="font-semibold">{e.name}</div>
              <div className="text-xs text-muted capitalize">{e.kind} · {e.type}</div>
            </div>
            <div className="text-xs text-accent font-mono">{e.expiryDate}</div>
          </div>
        ))}
      </div>
    );
  }
  if (query === "spending_this_month") return <Big label="Spent this month" value={fmtCurrency(data.totals.thisMonthExpense)} tone="red" />;
  if (query === "top_categories") {
    const top = [...data.categoryBreakdown].sort((a, b) => b.amount - a.amount).slice(0, 5);
    if (top.length === 0) return <Big label="Top categories" value="No spending yet" />;
    return (
      <div className="flex flex-col gap-2">
        <div className="text-xs font-mono uppercase tracking-wide text-muted">Top spending categories</div>
        {top.map((c) => (
          <div key={c.name} className="flex justify-between text-sm bg-surface2 border border-border-soft rounded-xl px-3 py-2">
            <span>{c.name}</span>
            <span className="font-mono text-red">{fmtCurrency(c.amount)}</span>
          </div>
        ))}
      </div>
    );
  }
  if (query === "totals")
    return (
      <div className="grid grid-cols-2 gap-2">
        <Big label="Investments" value={fmtCurrency(data.totals.investments)} tone="green" />
        <Big label="Assets" value={fmtCurrency(data.totals.assets)} tone="green" />
        <Big label="Debts" value={fmtCurrency(data.totals.debts)} tone="red" />
        <Big label="This month spend" value={fmtCurrency(data.totals.thisMonthExpense)} tone="red" />
      </div>
    );
  // Default: net worth
  return (
    <div className="grid grid-cols-2 gap-2">
      <Big label="Net Worth" value={fmtCurrency(data.netWorth)} tone="accent" />
      <Big
        label="Savings rate"
        value={data.savingsRate === null ? "—" : `${Math.round(data.savingsRate * 100)}%`}
        tone="green"
      />
    </div>
  );
}

function Big({ label, value, tone = "accent" }: { label: string; value: string; tone?: "accent" | "green" | "red" }) {
  const c = tone === "green" ? "text-green" : tone === "red" ? "text-red" : "text-accent";
  return (
    <div className="bg-surface2 border border-border-soft rounded-xl px-3 py-3">
      <div className="text-[10px] font-mono uppercase tracking-wide text-muted mb-1">{label}</div>
      <div className={`text-lg font-bold font-mono ${c}`}>{value}</div>
    </div>
  );
}
