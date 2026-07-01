import { addMonths, format } from "date-fns";

export type AmortizationRow = {
  month: number;
  date: string;
  emi: number;
  principal: number;
  interest: number;
  balance: number;
};

export type AmortizationResult = {
  schedule: AmortizationRow[];
  totalInterest: number;
  totalPaid: number;
  monthsToPayoff: number;
  payoffDate: string | null;
  warning: string | null;
};

/** Builds a forward-looking monthly schedule from today's outstanding balance to payoff. */
export function buildAmortizationSchedule(params: {
  outstandingAmount: number;
  annualInterestRate: number;
  emiAmount: number;
  asOf?: Date;
  maxMonths?: number;
}): AmortizationResult {
  const { outstandingAmount, annualInterestRate, emiAmount, asOf = new Date(), maxMonths = 600 } = params;

  const monthlyRate = annualInterestRate / 12 / 100;
  let balance = outstandingAmount;

  if (emiAmount <= balance * monthlyRate) {
    return {
      schedule: [],
      totalInterest: 0,
      totalPaid: 0,
      monthsToPayoff: 0,
      payoffDate: null,
      warning:
        "The EMI amount doesn't cover the monthly interest on the outstanding balance, so this loan would never be paid off at the current EMI. Increase the EMI or check the interest rate.",
    };
  }

  const schedule: AmortizationRow[] = [];
  let totalInterest = 0;
  let month = 0;

  while (balance > 0.5 && month < maxMonths) {
    month += 1;
    const interest = balance * monthlyRate;
    let principal = emiAmount - interest;
    let emiThisMonth = emiAmount;
    if (principal > balance) {
      principal = balance;
      emiThisMonth = balance + interest;
    }
    balance = Math.max(0, balance - principal);
    totalInterest += interest;
    schedule.push({
      month,
      date: format(addMonths(asOf, month), "MMM yyyy"),
      emi: Math.round(emiThisMonth),
      principal: Math.round(principal),
      interest: Math.round(interest),
      balance: Math.round(balance),
    });
  }

  const warning =
    month >= maxMonths && balance > 0.5
      ? `Schedule truncated at ${maxMonths} months - the loan doesn't pay off within that horizon at the current EMI.`
      : null;

  return {
    schedule,
    totalInterest: Math.round(totalInterest),
    totalPaid: Math.round(totalInterest + outstandingAmount - balance),
    monthsToPayoff: month,
    payoffDate: schedule.length ? schedule[schedule.length - 1].date : null,
    warning,
  };
}
