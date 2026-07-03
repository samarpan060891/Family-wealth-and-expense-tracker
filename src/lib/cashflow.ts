import { addMonths, format, isWithinInterval, parseISO, startOfMonth } from "date-fns";

type Frequency = "one_time" | "monthly" | "quarterly" | "half_yearly" | "yearly";

const OCCURRENCES_PER_YEAR: Record<Frequency, number> = {
  one_time: 0,
  monthly: 12,
  quarterly: 4,
  half_yearly: 2,
  yearly: 1,
};

export function monthlyEquivalent(amount: number, frequency: Frequency) {
  return (amount * OCCURRENCES_PER_YEAR[frequency]) / 12;
}

export type TxLike = {
  type: "expense" | "income";
  amount: string;
  date: string;
  isRecurring: boolean;
  recurrenceFrequency: Frequency;
};

export type DebtLike = {
  emiAmount: string | null;
  startDate: string;
  endDate: string | null;
};

export type InsuranceLike = {
  premiumAmount: string;
  premiumFrequency: Frequency;
  startDate: string;
  expiryDate: string;
};

const PERIOD_MONTHS: Record<Frequency, number> = {
  one_time: 0,
  monthly: 1,
  quarterly: 3,
  half_yearly: 6,
  yearly: 12,
};

function monthsBetween(from: Date, to: Date) {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

/** A recurring item anchored at `anchor` is "due" in `monthDate` if it lands on a period boundary. */
function isDue(anchor: Date, monthDate: Date, periodMonths: number) {
  if (periodMonths <= 0) return false;
  const diff = monthsBetween(startOfMonth(anchor), monthDate);
  return diff >= 0 && diff % periodMonths === 0;
}

/** Trailing monthly average of a set of rows, divided by the number of distinct months that actually had activity (min 1, capped window). */
function trailingMonthlyAverage(rows: TxLike[], now: Date, windowMonths = 6) {
  const cutoff = addMonths(startOfMonth(now), -windowMonths);
  const inWindow = rows.filter((r) => parseISO(r.date) >= cutoff);
  if (!inWindow.length) return 0;
  const total = inWindow.reduce((s, r) => s + Number(r.amount), 0);
  const distinctMonths = new Set(inWindow.map((r) => r.date.slice(0, 7))).size;
  return total / Math.max(1, distinctMonths);
}

/**
 * 12-month cashflow projection. More accurate than a flat average:
 * - Recurring income/expenses land as lump sums in the months they actually recur
 *   (a yearly premium hits once, not smoothed across 12 months).
 * - Irregular (non-recurring) income and discretionary spend use a trailing average
 *   over the months that actually had activity, so sparse history isn't diluted.
 * - Loan EMIs are counted only while the loan is active.
 */
export function buildCashflowProjection(
  transactions: TxLike[],
  debts: DebtLike[],
  insurances: InsuranceLike[],
  monthsAhead = 12
) {
  const now = new Date();
  const recurringIncome = transactions.filter((t) => t.type === "income" && t.isRecurring);
  const recurringExpense = transactions.filter((t) => t.type === "expense" && t.isRecurring);
  const irregularIncome = transactions.filter((t) => t.type === "income" && !t.isRecurring);
  const irregularExpense = transactions.filter((t) => t.type === "expense" && !t.isRecurring);

  const avgIrregularIncome = trailingMonthlyAverage(irregularIncome, now);
  const avgDiscretionary = trailingMonthlyAverage(irregularExpense, now);

  const months = [];
  for (let i = 0; i < monthsAhead; i++) {
    const monthDate = addMonths(startOfMonth(now), i);
    const monthEnd = addMonths(monthDate, 1);

    // Recurring items due this month (monthly items are due every month; others land on their cycle).
    const recIncomeDue = recurringIncome
      .filter((t) => isDue(parseISO(t.date), monthDate, PERIOD_MONTHS[t.recurrenceFrequency]))
      .reduce((s, t) => s + Number(t.amount), 0);
    const recExpenseDue = recurringExpense
      .filter((t) => isDue(parseISO(t.date), monthDate, PERIOD_MONTHS[t.recurrenceFrequency]))
      .reduce((s, t) => s + Number(t.amount), 0);

    // Insurance premiums land in their actual renewal months.
    const premiumsDue = insurances
      .filter((ins) => isDue(parseISO(ins.startDate), monthDate, PERIOD_MONTHS[ins.premiumFrequency]))
      .reduce((s, ins) => s + Number(ins.premiumAmount), 0);

    const activeEmis = debts
      .filter((d) => d.emiAmount)
      .filter((d) => {
        const start = parseISO(d.startDate);
        const end = d.endDate ? parseISO(d.endDate) : null;
        return start < monthEnd && (!end || end >= monthDate);
      })
      .reduce((s, d) => s + Number(d.emiAmount), 0);

    const projectedIncome = recIncomeDue + avgIrregularIncome;
    const projectedExpense = recExpenseDue + premiumsDue + activeEmis + avgDiscretionary;
    const net = projectedIncome - projectedExpense;

    months.push({
      month: format(monthDate, "MMM yyyy"),
      projectedIncome: Math.round(projectedIncome),
      projectedExpense: Math.round(projectedExpense),
      net: Math.round(net),
    });
  }

  let cumulative = 0;
  return months.map((m) => {
    cumulative += m.net;
    return { ...m, cumulative: Math.round(cumulative) };
  });
}

export function upcomingExpiries<
  T extends { expiryDate?: string | null; endDate?: string | null; maturityDate?: string | null }
>(items: T[], dateField: keyof T, withinDays = 90) {
  const now = new Date();
  const horizon = addMonths(now, withinDays / 30);
  return items.filter((item) => {
    const value = item[dateField] as unknown as string | null;
    if (!value) return false;
    const date = parseISO(value);
    return isWithinInterval(date, { start: now, end: horizon });
  });
}
