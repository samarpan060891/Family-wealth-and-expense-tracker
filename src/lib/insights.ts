import { addMonths, format, parseISO } from "date-fns";

export type TxLite = {
  type: "expense" | "income";
  amount: string;
  date: string;
  categoryName: string | null;
  isRecurring?: boolean;
};
export type InvestmentLite = { investedAmount: string; currentValue: string | null };
export type DebtLite = { outstandingAmount: string; emiAmount: string | null };
export type SnapshotLite = { date: string; netWorth: string };
export type GoalLite = { name: string; targetAmount: string; currentAmount: string; targetDate: string | null };

export type Insight = {
  tone: "positive" | "warning" | "info" | "danger";
  title: string;
  detail: string;
};
export type Anomaly = { category: string; amount: number; date: string; note: string };

const DISCRETIONARY = new Set([
  "Dining Out",
  "Entertainment",
  "Shopping",
  "Travel / Trip",
]);

function inr(n: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    Math.round(n)
  );
}
function monthKey(d: string) {
  return d.slice(0, 7);
}
function pct(cur: number, prev: number): number | null {
  if (prev <= 0) return null;
  return ((cur - prev) / prev) * 100;
}
function mean(xs: number[]) {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;
}
function stddev(xs: number[]) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

export type InsightsResult = {
  facts: Record<string, unknown>;
  headline: string;
  insights: Insight[];
  anomalies: Anomaly[];
};

export function computeInsights(params: {
  transactions: TxLite[];
  investments: InvestmentLite[];
  debts: DebtLite[];
  netWorth: number;
  snapshots: SnapshotLite[];
  goals: GoalLite[];
  asOf?: Date;
}): InsightsResult {
  const { transactions, investments, debts, netWorth, snapshots, goals, asOf = new Date() } = params;

  const curKey = format(asOf, "yyyy-MM");
  const prevKey = format(addMonths(asOf, -1), "yyyy-MM");

  const expenses = transactions.filter((t) => t.type === "expense");
  const incomes = transactions.filter((t) => t.type === "income");

  const sumIn = (rows: TxLite[], key: string) =>
    rows.filter((r) => monthKey(r.date) === key).reduce((s, r) => s + Number(r.amount), 0);

  const curExpense = sumIn(expenses, curKey);
  const prevExpense = sumIn(expenses, prevKey);
  const curIncome = sumIn(incomes, curKey);
  const savings = curIncome - curExpense;

  // Per-category current vs previous month
  const catCur: Record<string, number> = {};
  const catPrev: Record<string, number> = {};
  for (const e of expenses) {
    const name = e.categoryName ?? "Uncategorized";
    if (monthKey(e.date) === curKey) catCur[name] = (catCur[name] ?? 0) + Number(e.amount);
    if (monthKey(e.date) === prevKey) catPrev[name] = (catPrev[name] ?? 0) + Number(e.amount);
  }

  // Trailing 3-month average per category (months before the current one)
  const trailingKeys = [1, 2, 3].map((n) => format(addMonths(asOf, -n), "yyyy-MM"));
  const catTrailing: Record<string, number> = {};
  for (const e of expenses) {
    if (!trailingKeys.includes(monthKey(e.date))) continue;
    const name = e.categoryName ?? "Uncategorized";
    catTrailing[name] = (catTrailing[name] ?? 0) + Number(e.amount);
  }
  for (const k of Object.keys(catTrailing)) catTrailing[k] /= 3;

  // Biggest category mover (current vs previous month)
  let biggestMover: { name: string; changePct: number; cur: number } | null = null;
  for (const name of Object.keys(catCur)) {
    const p = pct(catCur[name], catPrev[name] ?? 0);
    if (p === null) continue;
    if (!biggestMover || Math.abs(p) > Math.abs(biggestMover.changePct)) {
      biggestMover = { name, changePct: p, cur: catCur[name] };
    }
  }

  // Investment unrealized gain
  const invested = investments.reduce((s, i) => s + Number(i.investedAmount), 0);
  const invCurrent = investments.reduce((s, i) => s + Number(i.currentValue ?? i.investedAmount), 0);
  const unrealized = invCurrent - invested;

  // Net-worth change vs the closest snapshot ~30 days ago
  const target = format(addMonths(asOf, -1), "yyyy-MM-dd");
  let netWorthDelta: number | null = null;
  if (snapshots.length) {
    const older = [...snapshots].sort((a, b) => a.date.localeCompare(b.date)).filter((s) => s.date <= target);
    const ref = older.length ? older[older.length - 1] : null;
    if (ref) netWorthDelta = netWorth - Number(ref.netWorth);
  }

  const totalOutstanding = debts.reduce((s, d) => s + Number(d.outstandingAmount), 0);
  const totalEmi = debts.reduce((s, d) => s + Number(d.emiAmount ?? 0), 0);

  // ---------- ANOMALY DETECTION ----------
  const anomalies: Anomaly[] = [];
  // Per-transaction: unusually large vs the category's own history
  const byCat: Record<string, number[]> = {};
  for (const e of expenses) {
    if (monthKey(e.date) === curKey) continue; // history = prior transactions
    const name = e.categoryName ?? "Uncategorized";
    (byCat[name] ??= []).push(Number(e.amount));
  }
  for (const e of expenses) {
    if (monthKey(e.date) !== curKey) continue;
    const name = e.categoryName ?? "Uncategorized";
    const hist = byCat[name] ?? [];
    if (hist.length < 3) continue;
    const m = mean(hist);
    const sd = stddev(hist);
    const amt = Number(e.amount);
    if (amt > 1000 && amt > m + 2 * sd && amt > m * 1.5) {
      anomalies.push({
        category: name,
        amount: amt,
        date: e.date,
        note: `${inr(amt)} is well above the usual ${inr(m)} for ${name}.`,
      });
    }
  }
  // Category-level: current month total spikes vs trailing average
  for (const name of Object.keys(catCur)) {
    const avg = catTrailing[name] ?? 0;
    if (avg > 2000 && catCur[name] > avg * 1.6) {
      anomalies.push({
        category: name,
        amount: catCur[name],
        date: `${curKey}-01`,
        note: `${name} is ${Math.round((catCur[name] / avg - 1) * 100)}% above its 3-month average.`,
      });
    }
  }
  anomalies.sort((a, b) => b.amount - a.amount);

  // ---------- INSIGHTS & RECOMMENDATIONS ----------
  const insights: Insight[] = [];

  if (curIncome > 0) {
    if (savings >= 0) {
      insights.push({
        tone: "positive",
        title: "You're saving this month",
        detail: `Income ${inr(curIncome)} vs spend ${inr(curExpense)} — a surplus of ${inr(savings)} (${Math.round(
          (savings / curIncome) * 100
        )}% of income).`,
      });
    } else {
      insights.push({
        tone: "danger",
        title: "Spending exceeds income",
        detail: `You've spent ${inr(-savings)} more than you earned this month. Trim discretionary categories to get back to positive.`,
      });
    }
  }

  if (biggestMover && Math.abs(biggestMover.changePct) >= 15) {
    insights.push({
      tone: biggestMover.changePct > 0 ? "warning" : "positive",
      title: `${biggestMover.name} ${biggestMover.changePct > 0 ? "up" : "down"} ${Math.abs(
        Math.round(biggestMover.changePct)
      )}%`,
      detail: `${biggestMover.name} is ${inr(biggestMover.cur)} this month vs ${inr(
        catPrev[biggestMover.name] ?? 0
      )} last month.`,
    });
  }

  // Saving opportunity: largest discretionary category running above trailing avg
  let bestOpp: { name: string; over: number } | null = null;
  for (const name of Object.keys(catCur)) {
    if (!DISCRETIONARY.has(name)) continue;
    const avg = catTrailing[name] ?? 0;
    const over = catCur[name] - avg;
    if (avg > 0 && over > 0 && (!bestOpp || over > bestOpp.over)) bestOpp = { name, over };
  }
  if (bestOpp && bestOpp.over > 1000) {
    insights.push({
      tone: "info",
      title: `Saving opportunity: ${bestOpp.name}`,
      detail: `You're ${inr(bestOpp.over)} above your usual ${bestOpp.name} spend. Cutting back here is an easy win.`,
    });
  }

  if (unrealized > 0) {
    insights.push({
      tone: "positive",
      title: "Investments in the green",
      detail: `Your investments are up ${inr(unrealized)} over what you put in.`,
    });
  } else if (unrealized < -1000) {
    insights.push({
      tone: "warning",
      title: "Investments below cost",
      detail: `Your investments are currently ${inr(-unrealized)} below invested value — normal for long-term holdings, worth a review.`,
    });
  }

  // Risk: EMI burden
  if (curIncome > 0 && totalEmi > 0) {
    const burden = (totalEmi / curIncome) * 100;
    if (burden >= 40) {
      insights.push({
        tone: "danger",
        title: "High EMI burden",
        detail: `EMIs are ${Math.round(burden)}% of your monthly income (${inr(totalEmi)}). Above 40% is stretched — avoid new loans.`,
      });
    }
  }

  // Goals nudges
  for (const g of goals) {
    const tgt = Number(g.targetAmount);
    const cur = Number(g.currentAmount);
    if (tgt <= 0) continue;
    const progress = Math.min(100, (cur / tgt) * 100);
    if (g.targetDate) {
      const monthsLeft = Math.max(0, Math.round((parseISO(g.targetDate).getTime() - asOf.getTime()) / (30.44 * 864e5)));
      const remaining = Math.max(0, tgt - cur);
      if (monthsLeft > 0 && remaining > 0) {
        insights.push({
          tone: progress >= 100 ? "positive" : "info",
          title: `Goal: ${g.name}`,
          detail: `${Math.round(progress)}% funded. Set aside about ${inr(remaining / monthsLeft)}/month to reach ${inr(
            tgt
          )} by ${g.targetDate}.`,
        });
      }
    }
  }

  // ---------- HEADLINE (templated NL fallback) ----------
  const parts: string[] = [];
  if (biggestMover && Math.abs(biggestMover.changePct) >= 10) {
    parts.push(
      `This month you're spending ${Math.abs(Math.round(biggestMover.changePct))}% ${
        biggestMover.changePct > 0 ? "more" : "less"
      } on ${biggestMover.name.toLowerCase()}.`
    );
  } else if (prevExpense > 0) {
    const p = pct(curExpense, prevExpense);
    if (p !== null && Math.abs(p) >= 5)
      parts.push(`Your total spending is ${Math.abs(Math.round(p))}% ${p > 0 ? "higher" : "lower"} than last month.`);
  }
  if (netWorthDelta !== null && Math.abs(netWorthDelta) > 1000) {
    parts.push(
      `Your net worth ${netWorthDelta >= 0 ? "increased" : "decreased"} by ${inr(Math.abs(netWorthDelta))} over the past month.`
    );
  } else if (unrealized > 1000) {
    parts.push(`Your investments are up ${inr(unrealized)} versus what you invested.`);
  }
  if (curIncome > 0) {
    parts.push(
      savings >= 0
        ? `You've saved ${inr(savings)} so far this month.`
        : `You're ${inr(-savings)} over budget this month.`
    );
  }
  const headline = parts.length ? parts.join(" ") : "Add a few more transactions and we'll start surfacing insights here.";

  const facts = {
    currency: "INR",
    thisMonthSpend: Math.round(curExpense),
    lastMonthSpend: Math.round(prevExpense),
    spendChangePct: pct(curExpense, prevExpense),
    thisMonthIncome: Math.round(curIncome),
    savingsThisMonth: Math.round(savings),
    biggestMover: biggestMover
      ? { category: biggestMover.name, changePct: Math.round(biggestMover.changePct), amount: Math.round(biggestMover.cur) }
      : null,
    investmentUnrealizedGain: Math.round(unrealized),
    netWorth: Math.round(netWorth),
    netWorthChange30d: netWorthDelta === null ? null : Math.round(netWorthDelta),
    totalOutstandingDebt: Math.round(totalOutstanding),
    monthlyEmi: Math.round(totalEmi),
    anomalyCount: anomalies.length,
    topCategoriesThisMonth: Object.entries(catCur)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([category, amount]) => ({ category, amount: Math.round(amount) })),
  };

  return { facts, headline, insights, anomalies: anomalies.slice(0, 6) };
}
