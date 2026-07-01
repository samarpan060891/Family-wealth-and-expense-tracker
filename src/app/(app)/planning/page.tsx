"use client";
import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { Badge, Button, Card, EmptyState, PageHeader, fmtCurrency } from "@/components/ui";
import { COUNTRY_PRESETS, getCountryPreset } from "@/lib/country-presets";

type Settings = {
  country: string;
  currency: string;
  generalInflationRate: string;
  lifestyleUpgradeRate: string;
  educationInflationRate: string;
};

type FamilyMember = { id: string; name: string; dateOfBirth: string; relation: string };
type EducationPlan = {
  id: string;
  familyMemberId: string;
  courseName: string;
  country: string;
  startAge: string;
  durationYears: string;
  currentAnnualCost: string;
};
type MarriageBudget = {
  id: string;
  familyMemberId: string;
  included: boolean;
  targetAge: string;
  currentBudget: string;
};
type YearProjection = {
  year: number;
  calendarYear: number;
  livingExpense: number;
  educationExpense: number;
  marriageExpense: number;
  totalExpense: number;
  events: { label: string; amount: number }[];
};

function ageOf(dob: string) {
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}

const RELATIONS = [
  { value: "self", label: "Self" },
  { value: "spouse", label: "Spouse" },
  { value: "child", label: "Child" },
  { value: "parent", label: "Parent" },
  { value: "other", label: "Other" },
];

const chartTooltip = {
  contentStyle: {
    background: "var(--surface2)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    fontSize: 12,
    fontFamily: "var(--font-mono)",
  },
  labelStyle: { color: "var(--muted)" },
};
const axisTick = { fill: "var(--muted)", fontSize: 10 };

export default function PlanningPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [plans, setPlans] = useState<EducationPlan[]>([]);
  const [budgets, setBudgets] = useState<MarriageBudget[]>([]);
  const [projection, setProjection] = useState<{ baseAnnualExpense: number; projection: YearProjection[] } | null>(
    null
  );
  const [savingSettings, setSavingSettings] = useState(false);

  const [memberForm, setMemberForm] = useState({ name: "", dateOfBirth: "", relation: "child" });
  const [planForm, setPlanForm] = useState({
    familyMemberId: "",
    courseName: "",
    country: "India",
    startAge: "18",
    durationYears: "4",
    currentAnnualCost: "",
  });
  const [budgetForm, setBudgetForm] = useState({ familyMemberId: "", targetAge: "26", currentBudget: "" });
  const [error, setError] = useState("");

  async function loadAll() {
    const [s, m, p, b, proj] = await Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/family-members").then((r) => r.json()),
      fetch("/api/education-plans").then((r) => r.json()),
      fetch("/api/marriage-budgets").then((r) => r.json()),
      fetch("/api/projection").then((r) => r.json()),
    ]);
    setSettings(s.settings);
    setMembers(m.familyMembers ?? []);
    setPlans(p.educationPlans ?? []);
    setBudgets(b.marriageBudgets ?? []);
    setProjection(proj);
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function refreshProjection() {
    const proj = await fetch("/api/projection").then((r) => r.json());
    setProjection(proj);
  }

  function applyCountryPreset(country: string) {
    if (!settings) return;
    const preset = getCountryPreset(country);
    setSettings({
      ...settings,
      country,
      currency: preset.currency,
      generalInflationRate: preset.generalInflation.toString(),
      lifestyleUpgradeRate: preset.lifestyleUpgrade.toString(),
      educationInflationRate: preset.educationInflation.toString(),
    });
  }

  async function saveSettings() {
    if (!settings) return;
    setSavingSettings(true);
    setError("");
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? "Failed to save settings");
      setSettings(data.settings);
      await refreshProjection();
    } finally {
      setSavingSettings(false);
    }
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/family-members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(memberForm),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "Failed to add family member");
    setMemberForm({ name: "", dateOfBirth: "", relation: "child" });
    loadAll();
  }

  async function deleteMember(id: string) {
    await fetch(`/api/family-members/${id}`, { method: "DELETE" });
    loadAll();
  }

  async function addPlan(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!planForm.familyMemberId) return setError("Select a family member");
    const res = await fetch("/api/education-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(planForm),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "Failed to add education plan");
    setPlanForm({ ...planForm, courseName: "", currentAnnualCost: "" });
    loadAll();
  }

  async function deletePlan(id: string) {
    await fetch(`/api/education-plans/${id}`, { method: "DELETE" });
    loadAll();
  }

  async function addBudget(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!budgetForm.familyMemberId) return setError("Select a family member");
    const res = await fetch("/api/marriage-budgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...budgetForm, included: true }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "Failed to add marriage budget");
    setBudgetForm({ familyMemberId: "", targetAge: "26", currentBudget: "" });
    loadAll();
  }

  async function toggleBudgetIncluded(id: string, included: boolean) {
    await fetch(`/api/marriage-budgets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ included }),
    });
    loadAll();
  }

  async function deleteBudget(id: string) {
    await fetch(`/api/marriage-budgets/${id}`, { method: "DELETE" });
    loadAll();
  }

  if (!settings) return <div className="text-muted text-sm font-mono">Loading…</div>;

  const preset = getCountryPreset(planForm.country);
  const currency = settings.currency;

  return (
    <div className="flex flex-col gap-6 stagger">
      <PageHeader
        title="Life"
        accent="Planning"
        sub="10-year expense projection with inflation, education & marriage goals"
      />

      {error && <div className="text-red text-sm bg-red/10 border border-red/20 rounded-lg px-3 py-2">{error}</div>}

      {/* PROJECTION CHART */}
      <Card>
        <div className="text-sm font-bold mb-1 font-mono uppercase tracking-wide text-muted">
          10-Year Rollover Projection
        </div>
        <div className="text-xs text-muted-soft mb-4">
          Base annual expense today: <span className="text-text font-mono">{fmtCurrency(projection?.baseAnnualExpense ?? 0)}</span>{" "}
          · compounding at {settings.generalInflationRate}% inflation + {settings.lifestyleUpgradeRate}% lifestyle upgrade/yr
        </div>
        {!projection || projection.projection.every((y) => y.totalExpense === 0) ? (
          <EmptyState icon="◎" title="Not enough data yet" sub="Add some expenses, family members and goals to see a projection" />
        ) : (
          <>
            <div className="h-72 -ml-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={projection.projection}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="calendarYear" tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis tick={axisTick} axisLine={false} tickLine={false} />
                  <Tooltip {...chartTooltip} cursor={{ fill: "var(--surface3)", opacity: 0.4 }} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "var(--muted)" }} />
                  <Bar dataKey="livingExpense" name="Living (inflated)" stackId="a" fill="#6fa1f5" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="educationExpense" name="Education" stackId="a" fill="#e8a33d" />
                  <Bar dataKey="marriageExpense" name="Marriage" stackId="a" fill="#a988e8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted font-mono uppercase text-[10px] tracking-wide border-b border-border-soft">
                    <th className="text-left py-2">Year</th>
                    <th className="text-right py-2">Living</th>
                    <th className="text-right py-2">Education</th>
                    <th className="text-right py-2">Marriage</th>
                    <th className="text-right py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {projection.projection.map((y) => (
                    <tr key={y.year} className="border-b border-border-soft/50">
                      <td className="py-2 font-semibold">{y.calendarYear}</td>
                      <td className="py-2 text-right font-mono text-muted">{fmtCurrency(y.livingExpense)}</td>
                      <td className="py-2 text-right font-mono text-accent">
                        {y.educationExpense ? fmtCurrency(y.educationExpense) : "—"}
                      </td>
                      <td className="py-2 text-right font-mono text-purple">
                        {y.marriageExpense ? fmtCurrency(y.marriageExpense) : "—"}
                      </td>
                      <td className="py-2 text-right font-mono font-bold">{fmtCurrency(y.totalExpense)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {/* SETTINGS */}
      <Card>
        <div className="text-sm font-bold mb-4 font-mono uppercase tracking-wide text-muted">
          Country &amp; Inflation Assumptions
        </div>
        <div className="flex flex-col gap-3 max-w-md">
          <div>
            <label>Country</label>
            <select value={settings.country} onChange={(e) => applyCountryPreset(e.target.value)}>
              {COUNTRY_PRESETS.map((c) => (
                <option key={c.country} value={c.country}>
                  {c.country}
                </option>
              ))}
            </select>
            <div className="text-xs text-muted-soft mt-1">
              Selecting a country fills in commonly-cited long-run estimates below — adjust freely, these are
              indicative planning defaults, not verified live data.
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label>General Inflation %</label>
              <input
                type="number"
                step="0.1"
                value={settings.generalInflationRate}
                onChange={(e) => setSettings({ ...settings, generalInflationRate: e.target.value })}
              />
            </div>
            <div>
              <label>Lifestyle Upgrade %</label>
              <input
                type="number"
                step="0.1"
                value={settings.lifestyleUpgradeRate}
                onChange={(e) => setSettings({ ...settings, lifestyleUpgradeRate: e.target.value })}
              />
            </div>
            <div>
              <label>Education Inflation %</label>
              <input
                type="number"
                step="0.1"
                value={settings.educationInflationRate}
                onChange={(e) => setSettings({ ...settings, educationInflationRate: e.target.value })}
              />
            </div>
          </div>
          <Button onClick={saveSettings} disabled={savingSettings} className="w-fit">
            {savingSettings ? "Saving…" : "Save Assumptions"}
          </Button>
        </div>
      </Card>

      {/* FAMILY MEMBERS */}
      <Card>
        <div className="text-sm font-bold mb-4 font-mono uppercase tracking-wide text-muted">
          Family Member Profiles
        </div>
        {members.length === 0 ? (
          <EmptyState icon="◐" title="No family profiles yet" sub="Add yourself and family members with date of birth to enable age-based planning" />
        ) : (
          <div className="flex flex-col divide-y divide-border-soft mb-4">
            {members.map((m) => (
              <div key={m.id} className="flex justify-between items-center py-2.5 first:pt-0">
                <div>
                  <span className="font-semibold text-sm">{m.name}</span>{" "}
                  <span className="text-xs text-muted-soft capitalize">
                    · {m.relation} · age {ageOf(m.dateOfBirth)}
                  </span>
                </div>
                <button onClick={() => deleteMember(m.id)} className="text-xs text-muted-soft hover:text-red transition-colors">
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={addMember} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div className="sm:col-span-2">
            <label>Name</label>
            <input required value={memberForm.name} onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })} />
          </div>
          <div>
            <label>Date of Birth</label>
            <input
              type="date"
              required
              value={memberForm.dateOfBirth}
              onChange={(e) => setMemberForm({ ...memberForm, dateOfBirth: e.target.value })}
            />
          </div>
          <div>
            <label>Relation</label>
            <select value={memberForm.relation} onChange={(e) => setMemberForm({ ...memberForm, relation: e.target.value })}>
              {RELATIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" className="sm:col-span-4 w-fit">
            + Add Family Member
          </Button>
        </form>
      </Card>

      {/* EDUCATION PLANS */}
      <Card>
        <div className="text-sm font-bold mb-4 font-mono uppercase tracking-wide text-muted">
          Children&apos;s Education Plans
        </div>
        {plans.length === 0 ? (
          <EmptyState icon="◈" title="No education plans yet" sub="Pick a course, country and cost to project future education spend" />
        ) : (
          <div className="flex flex-col divide-y divide-border-soft mb-4">
            {plans.map((p) => {
              const member = members.find((m) => m.id === p.familyMemberId);
              return (
                <div key={p.id} className="flex justify-between items-start py-2.5 first:pt-0">
                  <div>
                    <div className="font-semibold text-sm">
                      {p.courseName} <span className="text-muted-soft font-normal">— {member?.name ?? "?"}</span>
                    </div>
                    <div className="text-xs text-muted mt-0.5">
                      {p.country} · starts at age {p.startAge} · {p.durationYears} yrs · {fmtCurrency(Number(p.currentAnnualCost))}/yr today
                    </div>
                  </div>
                  <button onClick={() => deletePlan(p.id)} className="text-xs text-muted-soft hover:text-red transition-colors shrink-0 pl-3">
                    Delete
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {members.length === 0 ? (
          <div className="text-xs text-muted-soft">Add a family member above first.</div>
        ) : (
          <form onSubmit={addPlan} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label>Family Member</label>
                <select
                  required
                  value={planForm.familyMemberId}
                  onChange={(e) => setPlanForm({ ...planForm, familyMemberId: e.target.value })}
                >
                  <option value="">-- Select --</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Country of Study</label>
                <select
                  value={planForm.country}
                  onChange={(e) => setPlanForm({ ...planForm, country: e.target.value, courseName: "", currentAnnualCost: "" })}
                >
                  {COUNTRY_PRESETS.map((c) => (
                    <option key={c.country} value={c.country}>
                      {c.country}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label>Career Course</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {preset.courseCosts.map((c) => (
                  <button
                    type="button"
                    key={c.name}
                    onClick={() =>
                      setPlanForm({
                        ...planForm,
                        courseName: c.name,
                        durationYears: c.durationYears.toString(),
                        currentAnnualCost: c.annualCost.toString(),
                      })
                    }
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      planForm.courseName === c.name
                        ? "bg-accent text-black border-accent"
                        : "border-border text-muted hover:border-accent/50"
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
              <input
                required
                value={planForm.courseName}
                onChange={(e) => setPlanForm({ ...planForm, courseName: e.target.value })}
                placeholder="Or type a custom course name"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label>Start Age</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={planForm.startAge}
                  onChange={(e) => setPlanForm({ ...planForm, startAge: e.target.value })}
                />
              </div>
              <div>
                <label>Duration (yrs)</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={planForm.durationYears}
                  onChange={(e) => setPlanForm({ ...planForm, durationYears: e.target.value })}
                />
              </div>
              <div>
                <label>Annual Cost Today ({currency})</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={planForm.currentAnnualCost}
                  onChange={(e) => setPlanForm({ ...planForm, currentAnnualCost: e.target.value })}
                />
              </div>
            </div>
            <Button type="submit" className="w-fit">
              + Add Education Plan
            </Button>
          </form>
        )}
      </Card>

      {/* MARRIAGE BUDGETS */}
      <Card>
        <div className="text-sm font-bold mb-4 font-mono uppercase tracking-wide text-muted">
          Marriage Budgets <span className="text-muted-soft normal-case font-sans">— selective, only included ones count</span>
        </div>
        {budgets.length === 0 ? (
          <EmptyState icon="◉" title="No marriage budgets yet" sub="Add a target age and budget per child — toggle off any you don't want counted" />
        ) : (
          <div className="flex flex-col divide-y divide-border-soft mb-4">
            {budgets.map((b) => {
              const member = members.find((m) => m.id === b.familyMemberId);
              return (
                <div key={b.id} className="flex justify-between items-center py-2.5 first:pt-0">
                  <div>
                    <div className="font-semibold text-sm">{member?.name ?? "?"}</div>
                    <div className="text-xs text-muted mt-0.5">
                      Target age {b.targetAge} · {fmtCurrency(Number(b.currentBudget))} today
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 pl-3">
                    <button
                      onClick={() => toggleBudgetIncluded(b.id, !b.included)}
                      className={b.included ? "" : "opacity-60"}
                    >
                      <Badge tone={b.included ? "green" : "accent"}>{b.included ? "Included" : "Excluded"}</Badge>
                    </button>
                    <button onClick={() => deleteBudget(b.id)} className="text-xs text-muted-soft hover:text-red transition-colors">
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {members.length === 0 ? (
          <div className="text-xs text-muted-soft">Add a family member above first.</div>
        ) : (
          <form onSubmit={addBudget} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div>
              <label>Family Member</label>
              <select
                required
                value={budgetForm.familyMemberId}
                onChange={(e) => setBudgetForm({ ...budgetForm, familyMemberId: e.target.value })}
              >
                <option value="">-- Select --</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Target Age</label>
              <input
                type="number"
                step="0.5"
                required
                value={budgetForm.targetAge}
                onChange={(e) => setBudgetForm({ ...budgetForm, targetAge: e.target.value })}
              />
            </div>
            <div>
              <label>Budget Today ({currency})</label>
              <input
                type="number"
                min="0"
                required
                value={budgetForm.currentBudget}
                onChange={(e) => setBudgetForm({ ...budgetForm, currentBudget: e.target.value })}
              />
            </div>
            <Button type="submit" className="w-fit">
              + Add Budget
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
