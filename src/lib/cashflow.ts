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

export function buildCashflowProjection(
  transactions: TxLike[],
  debts: DebtLike[],
  insurances: InsuranceLike[],
  monthsAhead = 12
) {
  const recurringIncome = transactions.filter((t) => t.type === "income" && t.isRecurring);
  const recurringExpense = transactions.filter((t) => t.type === "expense" && t.isRecurring);

  const now = new Date();
  const threeMonthsAgo = addMonths(now, -3);
  const discretionaryExpenses = transactions.filter(
    (t) => t.type === "expense" && !t.isRecurring && parseISO(t.date) >= threeMonthsAgo
  );
  const avgDiscretionaryMonthly =
    discretionaryExpenses.reduce((s, t) => s + Number(t.amount), 0) / 3;

  const recurringIncomeMonthly = recurringIncome.reduce(
    (s, t) => s + monthlyEquivalent(Number(t.amount), t.recurrenceFrequency),
    0
  );
  const recurringExpenseMonthly = recurringExpense.reduce(
    (s, t) => s + monthlyEquivalent(Number(t.amount), t.recurrenceFrequency),
    0
  );
  const insurancePremiumMonthly = insurances.reduce(
    (s, ins) => s + monthlyEquivalent(Number(ins.premiumAmount), ins.premiumFrequency),
    0
  );

  const months = [];
  for (let i = 0; i < monthsAhead; i++) {
    const monthDate = addMonths(startOfMonth(now), i);
    const monthEnd = addMonths(monthDate, 1);

    const activeEmis = debts
      .filter((d) => d.emiAmount)
      .filter((d) => {
        const start = parseISO(d.startDate);
        const end = d.endDate ? parseISO(d.endDate) : null;
        return start < monthEnd && (!end || end >= monthDate);
      })
      .reduce((s, d) => s + Number(d.emiAmount), 0);

    const projectedIncome = recurringIncomeMonthly;
    const projectedExpense =
      recurringExpenseMonthly + activeEmis + insurancePremiumMonthly + avgDiscretionaryMonthly;
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
