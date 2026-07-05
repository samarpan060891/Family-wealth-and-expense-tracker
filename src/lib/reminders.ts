// Derives "action needed" reminders from the household's recurring money events —
// recurring income/expenses (incl. utility bills), EMIs, insurance premiums &
// renewals, and investment maturities — cross-referenced against completions so an
// item keeps showing until the user marks that period done.

export type ReminderKind =
  | "recurring_income"
  | "recurring_expense"
  | "emi"
  | "insurance_premium"
  | "insurance_expiry"
  | "investment_maturity";

export type DueItem = {
  id: string; // synthetic: `${kind}:${sourceId}:${dueDate}`
  kind: ReminderKind;
  sourceId: string;
  title: string;
  subtitle: string;
  amount: number | null;
  dueDate: string; // YYYY-MM-DD
  status: "overdue" | "due_soon" | "upcoming";
  actionLabel: string;
};

type Freq = "one_time" | "monthly" | "quarterly" | "half_yearly" | "yearly";
const MONTHS: Record<Exclude<Freq, "one_time">, number> = {
  monthly: 1,
  quarterly: 3,
  half_yearly: 6,
  yearly: 12,
};

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function parse(d: string): Date {
  return new Date(d + "T00:00:00Z");
}
function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  const day = r.getUTCDate();
  r.setUTCDate(1);
  r.setUTCMonth(r.getUTCMonth() + n);
  // Clamp to the month's last day (e.g. Jan 31 + 1mo → Feb 28/29).
  const last = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
  r.setUTCDate(Math.min(day, last));
  return r;
}
function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

/** The most recent occurrence on/before `today`, stepping `anchor` by frequency. */
function lastOccurrence(anchor: Date, freq: Exclude<Freq, "one_time">, today: Date): Date {
  const step = MONTHS[freq];
  let d = new Date(anchor);
  if (d > today) return d; // series hasn't started; the first occurrence is upcoming
  // Fast-forward in the given step until the next one would pass today.
  while (addMonths(d, step) <= today) d = addMonths(d, step);
  return d;
}

const OVERDUE_LOOKBACK_DAYS = 120;
const RECURRING_UPCOMING_DAYS = 10;
const DATED_UPCOMING_DAYS = 45; // renewals / maturities

type RecurringTx = { id: string; type: "income" | "expense"; amount: string; date: string; isRecurring: boolean; recurrenceFrequency: string; categoryName: string | null };
type Debt = { id: string; name: string; type: string; emiAmount: string | null; emiDay: string | null; startDate: string; endDate: string | null };
type Insurance = { id: string; name: string; type: string; premiumAmount: string; premiumFrequency: string; startDate: string; expiryDate: string };
type Investment = { id: string; name: string; type: string; maturityDate: string | null; currentValue: string | null; investedAmount: string };

export type ReminderSources = {
  transactions: RecurringTx[];
  debts: Debt[];
  insurances: Insurance[];
  investments: Investment[];
  completed: Set<string>; // keys `${kind}:${sourceId}:${dueDate}`
  today?: Date;
};

// Emit the current active reminder for a *recurring* series: the latest occurrence
// that's due-and-not-done, else the next upcoming one within the window.
function recurringItem(
  kind: ReminderKind,
  sourceId: string,
  anchor: Date,
  freq: Exclude<Freq, "one_time">,
  today: Date,
  completed: Set<string>,
  build: (dueDate: string, status: DueItem["status"]) => DueItem,
  stopAfter?: Date
): DueItem | null {
  const last = lastOccurrence(anchor, freq, today);
  const key = (d: Date) => `${kind}:${sourceId}:${iso(d)}`;

  if (last <= today) {
    if (stopAfter && last > stopAfter) return null;
    if (!completed.has(key(last)) && daysBetween(today, last) <= OVERDUE_LOOKBACK_DAYS) {
      return build(iso(last), daysBetween(today, last) === 0 ? "due_soon" : "overdue");
    }
  }
  const next = last > today ? last : addMonths(last, MONTHS[freq]);
  if (stopAfter && next > stopAfter) return null;
  if (!completed.has(key(next)) && daysBetween(next, today) <= RECURRING_UPCOMING_DAYS && next >= today) {
    return build(iso(next), "due_soon");
  }
  return null;
}

function datedItem(
  kind: ReminderKind,
  sourceId: string,
  due: Date,
  today: Date,
  completed: Set<string>,
  build: (dueDate: string, status: DueItem["status"]) => DueItem
): DueItem | null {
  const key = `${kind}:${sourceId}:${iso(due)}`;
  if (completed.has(key)) return null;
  const delta = daysBetween(due, today); // >0 upcoming, <0 past
  if (delta < -OVERDUE_LOOKBACK_DAYS) return null;
  if (delta > DATED_UPCOMING_DAYS) return null;
  const status: DueItem["status"] = delta < 0 ? "overdue" : delta <= 7 ? "due_soon" : "upcoming";
  return build(iso(due), status);
}

export function computeReminders(src: ReminderSources): DueItem[] {
  const today = src.today ?? parse(iso(new Date()));
  const items: DueItem[] = [];
  const num = (v: string | null | undefined) => (v == null ? null : Number(v));

  // Recurring income / expenses (utility bills are recurring expenses).
  for (const t of src.transactions) {
    if (!t.isRecurring) continue;
    const freq = t.recurrenceFrequency as Freq;
    if (freq === "one_time" || !(freq in MONTHS)) continue;
    const kind: ReminderKind = t.type === "income" ? "recurring_income" : "recurring_expense";
    const label = t.categoryName ?? (t.type === "income" ? "Income" : "Payment");
    const it = recurringItem(kind, t.id, parse(t.date), freq as Exclude<Freq, "one_time">, today, src.completed, (dueDate, status) => ({
      id: `${kind}:${t.id}:${dueDate}`,
      kind,
      sourceId: t.id,
      title: label,
      subtitle: t.type === "income" ? "Recurring income expected" : "Recurring payment due",
      amount: num(t.amount),
      dueDate,
      status,
      actionLabel: t.type === "income" ? "Mark received" : "Mark paid",
    }));
    if (it) items.push(it);
  }

  // EMIs — monthly on emiDay, until the loan's end date.
  for (const d of src.debts) {
    const emi = num(d.emiAmount);
    const day = num(d.emiDay);
    if (!emi || emi <= 0 || !day || day < 1) continue;
    const start = parse(d.startDate);
    const anchorDay = Math.min(day, 28);
    const anchor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), anchorDay));
    const stopAfter = d.endDate ? parse(d.endDate) : undefined;
    const it = recurringItem("emi", d.id, anchor, "monthly", today, src.completed, (dueDate, status) => ({
      id: `emi:${d.id}:${dueDate}`,
      kind: "emi",
      sourceId: d.id,
      title: `${d.name} EMI`,
      subtitle: `${d.type} installment`,
      amount: emi,
      dueDate,
      status,
      actionLabel: "Mark paid",
    }), stopAfter);
    if (it) items.push(it);
  }

  // Insurance — recurring premium + one-off renewal near expiry.
  for (const ins of src.insurances) {
    const premium = num(ins.premiumAmount);
    const freq = ins.premiumFrequency as Freq;
    const expiry = parse(ins.expiryDate);
    if (premium && premium > 0 && freq !== "one_time" && freq in MONTHS) {
      const it = recurringItem("insurance_premium", ins.id, parse(ins.startDate), freq as Exclude<Freq, "one_time">, today, src.completed, (dueDate, status) => ({
        id: `insurance_premium:${ins.id}:${dueDate}`,
        kind: "insurance_premium",
        sourceId: ins.id,
        title: `${ins.name} premium`,
        subtitle: `${ins.type} premium due`,
        amount: premium,
        dueDate,
        status,
        actionLabel: "Mark paid",
      }), expiry);
      if (it) items.push(it);
    }
    const renewal = datedItem("insurance_expiry", ins.id, expiry, today, src.completed, (dueDate, status) => ({
      id: `insurance_expiry:${ins.id}:${dueDate}`,
      kind: "insurance_expiry",
      sourceId: ins.id,
      title: `${ins.name} renewal`,
      subtitle: `${ins.type} policy ${daysBetween(expiry, today) < 0 ? "expired" : "expires"}`,
      amount: null,
      dueDate,
      status,
      actionLabel: "Mark renewed",
    }));
    if (renewal) items.push(renewal);
  }

  // Investment maturities.
  for (const inv of src.investments) {
    if (!inv.maturityDate) continue;
    const due = parse(inv.maturityDate);
    const it = datedItem("investment_maturity", inv.id, due, today, src.completed, (dueDate, status) => ({
      id: `investment_maturity:${inv.id}:${dueDate}`,
      kind: "investment_maturity",
      sourceId: inv.id,
      title: `${inv.name} matures`,
      subtitle: `${inv.type} ${daysBetween(due, today) < 0 ? "matured" : "maturing"}`,
      amount: num(inv.currentValue ?? inv.investedAmount),
      dueDate,
      status,
      actionLabel: "Mark handled",
    }));
    if (it) items.push(it);
  }

  // Overdue first, then soonest due date.
  const rank = { overdue: 0, due_soon: 1, upcoming: 2 };
  return items.sort((a, b) => rank[a.status] - rank[b.status] || a.dueDate.localeCompare(b.dueDate));
}
