const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

function ageInYears(dateOfBirth: string, asOf: Date): number {
  return (asOf.getTime() - new Date(dateOfBirth).getTime()) / YEAR_MS;
}

/** Which projection year (1..N) a person hits `targetAge`, or null if outside the horizon. */
function yearForAge(dateOfBirth: string, targetAge: number, asOf: Date, horizonYears: number): number | null {
  const yearsFromNow = targetAge - ageInYears(dateOfBirth, asOf);
  const year = Math.max(1, Math.round(yearsFromNow));
  return year <= horizonYears ? year : null;
}

export type FamilyMemberLike = { id: string; dateOfBirth: string };
export type EducationPlanLike = {
  id: string;
  familyMemberId: string;
  courseName: string;
  startAge: string;
  durationYears: string;
  currentAnnualCost: string;
};
export type MarriageBudgetLike = {
  id: string;
  familyMemberId: string;
  included: boolean;
  targetAge: string;
  currentBudget: string;
};

export type YearProjection = {
  year: number;
  calendarYear: number;
  livingExpense: number;
  educationExpense: number;
  marriageExpense: number;
  totalExpense: number;
  events: { label: string; amount: number }[];
};

export function buildTenYearProjection(params: {
  baseAnnualExpense: number;
  generalInflationRate: number;
  lifestyleUpgradeRate: number;
  educationInflationRate: number;
  familyMembers: FamilyMemberLike[];
  educationPlans: EducationPlanLike[];
  marriageBudgets: MarriageBudgetLike[];
  horizonYears?: number;
  asOf?: Date;
}): YearProjection[] {
  const {
    baseAnnualExpense,
    generalInflationRate,
    lifestyleUpgradeRate,
    educationInflationRate,
    familyMembers,
    educationPlans,
    marriageBudgets,
    horizonYears = 10,
    asOf = new Date(),
  } = params;

  const combinedRate = (1 + generalInflationRate / 100) * (1 + lifestyleUpgradeRate / 100) - 1;
  const memberById = new Map(familyMembers.map((m) => [m.id, m]));

  const years: YearProjection[] = Array.from({ length: horizonYears }, (_, i) => ({
    year: i + 1,
    calendarYear: asOf.getFullYear() + i + 1,
    livingExpense: Math.round(baseAnnualExpense * Math.pow(1 + combinedRate, i + 1)),
    educationExpense: 0,
    marriageExpense: 0,
    totalExpense: 0,
    events: [],
  }));

  for (const plan of educationPlans) {
    const member = memberById.get(plan.familyMemberId);
    if (!member) continue;
    const startAge = Number(plan.startAge);
    const duration = Math.max(1, Math.ceil(Number(plan.durationYears)));
    const startYear = yearForAge(member.dateOfBirth, startAge, asOf, horizonYears);
    if (startYear === null) continue;
    for (let offset = 0; offset < duration; offset++) {
      const y = startYear + offset;
      if (y > horizonYears) break;
      const inflatedCost = Number(plan.currentAnnualCost) * Math.pow(1 + educationInflationRate / 100, y);
      const bucket = years[y - 1];
      bucket.educationExpense += inflatedCost;
      bucket.events.push({ label: `${plan.courseName} (yr ${offset + 1}/${duration})`, amount: Math.round(inflatedCost) });
    }
  }

  for (const budget of marriageBudgets) {
    if (!budget.included) continue;
    const member = memberById.get(budget.familyMemberId);
    if (!member) continue;
    const targetAge = Number(budget.targetAge);
    const targetYear = yearForAge(member.dateOfBirth, targetAge, asOf, horizonYears);
    if (targetYear === null) continue;
    const inflatedCost = Number(budget.currentBudget) * Math.pow(1 + combinedRate, targetYear);
    const bucket = years[targetYear - 1];
    bucket.marriageExpense += inflatedCost;
    bucket.events.push({ label: "Marriage budget", amount: Math.round(inflatedCost) });
  }

  for (const y of years) {
    y.educationExpense = Math.round(y.educationExpense);
    y.marriageExpense = Math.round(y.marriageExpense);
    y.totalExpense = y.livingExpense + y.educationExpense + y.marriageExpense;
  }

  return years;
}
