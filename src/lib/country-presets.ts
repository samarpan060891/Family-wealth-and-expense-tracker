// Indicative planning defaults per country, based on commonly-cited long-run averages
// (national CPI trends, typical private-education cost inflation, and general higher-education
// benchmarks). These are starting points for a household to adjust, not verified live data or
// financial advice - always let the user override every number.
export type CountryPreset = {
  country: string;
  currency: string;
  currencySymbol: string;
  generalInflation: number; // long-run CPI, %
  lifestyleUpgrade: number; // typical "standard of living" creep on top of CPI, %
  educationInflation: number; // education cost inflation tends to run above general CPI, %
  courseCosts: { name: string; annualCost: number; durationYears: number }[];
};

export const COUNTRY_PRESETS: CountryPreset[] = [
  {
    country: "India",
    currency: "INR",
    currencySymbol: "₹",
    generalInflation: 5.5,
    lifestyleUpgrade: 2,
    educationInflation: 10,
    courseCosts: [
      { name: "Engineering (B.Tech/B.E.)", annualCost: 250000, durationYears: 4 },
      { name: "Medicine (MBBS)", annualCost: 1200000, durationYears: 5.5 },
      { name: "MBA", annualCost: 1000000, durationYears: 2 },
      { name: "Arts / Commerce / Science (BA/B.Com/B.Sc)", annualCost: 80000, durationYears: 3 },
      { name: "Law (LLB)", annualCost: 300000, durationYears: 5 },
      { name: "Diploma / Vocational", annualCost: 60000, durationYears: 2 },
    ],
  },
  {
    country: "United States",
    currency: "USD",
    currencySymbol: "$",
    generalInflation: 3,
    lifestyleUpgrade: 1.5,
    educationInflation: 5,
    courseCosts: [
      { name: "Engineering (B.S.)", annualCost: 40000, durationYears: 4 },
      { name: "Medicine (MD)", annualCost: 60000, durationYears: 4 },
      { name: "MBA", annualCost: 70000, durationYears: 2 },
      { name: "Arts / Sciences (B.A./B.S.)", annualCost: 35000, durationYears: 4 },
      { name: "Law (JD)", annualCost: 55000, durationYears: 3 },
      { name: "Community College / Vocational", annualCost: 8000, durationYears: 2 },
    ],
  },
  {
    country: "United Kingdom",
    currency: "GBP",
    currencySymbol: "£",
    generalInflation: 3,
    lifestyleUpgrade: 1.5,
    educationInflation: 5,
    courseCosts: [
      { name: "Engineering (BEng)", annualCost: 25000, durationYears: 3 },
      { name: "Medicine (MBBS)", annualCost: 40000, durationYears: 5 },
      { name: "MBA", annualCost: 35000, durationYears: 1 },
      { name: "Arts / Sciences (BA/BSc)", annualCost: 22000, durationYears: 3 },
      { name: "Law (LLB)", annualCost: 24000, durationYears: 3 },
      { name: "Vocational / Apprenticeship", annualCost: 8000, durationYears: 2 },
    ],
  },
  {
    country: "Canada",
    currency: "CAD",
    currencySymbol: "$",
    generalInflation: 3,
    lifestyleUpgrade: 1.5,
    educationInflation: 5,
    courseCosts: [
      { name: "Engineering (B.Eng)", annualCost: 22000, durationYears: 4 },
      { name: "Medicine (MD)", annualCost: 30000, durationYears: 4 },
      { name: "MBA", annualCost: 35000, durationYears: 2 },
      { name: "Arts / Sciences (BA/BSc)", annualCost: 18000, durationYears: 4 },
      { name: "Law (JD)", annualCost: 25000, durationYears: 3 },
      { name: "College Diploma", annualCost: 10000, durationYears: 2 },
    ],
  },
  {
    country: "Australia",
    currency: "AUD",
    currencySymbol: "$",
    generalInflation: 3.5,
    lifestyleUpgrade: 1.5,
    educationInflation: 5.5,
    courseCosts: [
      { name: "Engineering (B.Eng)", annualCost: 30000, durationYears: 4 },
      { name: "Medicine (MBBS)", annualCost: 65000, durationYears: 5 },
      { name: "MBA", annualCost: 40000, durationYears: 1.5 },
      { name: "Arts / Sciences (BA/BSc)", annualCost: 25000, durationYears: 3 },
      { name: "Law (LLB)", annualCost: 30000, durationYears: 4 },
      { name: "TAFE / Vocational", annualCost: 10000, durationYears: 2 },
    ],
  },
  {
    country: "UAE",
    currency: "AED",
    currencySymbol: "د.إ",
    generalInflation: 3,
    lifestyleUpgrade: 2,
    educationInflation: 6,
    courseCosts: [
      { name: "Engineering (B.Eng)", annualCost: 60000, durationYears: 4 },
      { name: "Medicine (MBBS)", annualCost: 150000, durationYears: 6 },
      { name: "MBA", annualCost: 90000, durationYears: 2 },
      { name: "Arts / Sciences (BA/BSc)", annualCost: 45000, durationYears: 3 },
      { name: "Law (LLB)", annualCost: 55000, durationYears: 4 },
      { name: "Diploma / Vocational", annualCost: 25000, durationYears: 2 },
    ],
  },
  {
    country: "Singapore",
    currency: "SGD",
    currencySymbol: "$",
    generalInflation: 3,
    lifestyleUpgrade: 1.5,
    educationInflation: 5,
    courseCosts: [
      { name: "Engineering (B.Eng)", annualCost: 30000, durationYears: 4 },
      { name: "Medicine (MBBS)", annualCost: 50000, durationYears: 5 },
      { name: "MBA", annualCost: 60000, durationYears: 1.5 },
      { name: "Arts / Sciences (BA/BSc)", annualCost: 25000, durationYears: 3 },
      { name: "Law (LLB)", annualCost: 30000, durationYears: 4 },
      { name: "Polytechnic Diploma", annualCost: 8000, durationYears: 3 },
    ],
  },
  {
    country: "Other",
    currency: "USD",
    currencySymbol: "$",
    generalInflation: 4,
    lifestyleUpgrade: 1.5,
    educationInflation: 6,
    courseCosts: [
      { name: "Engineering", annualCost: 20000, durationYears: 4 },
      { name: "Medicine", annualCost: 40000, durationYears: 5 },
      { name: "MBA", annualCost: 30000, durationYears: 2 },
      { name: "Arts / Sciences", annualCost: 15000, durationYears: 3 },
      { name: "Law", annualCost: 25000, durationYears: 3 },
      { name: "Diploma / Vocational", annualCost: 8000, durationYears: 2 },
    ],
  },
];

export function getCountryPreset(country: string): CountryPreset {
  return COUNTRY_PRESETS.find((c) => c.country === country) ?? COUNTRY_PRESETS[COUNTRY_PRESETS.length - 1];
}
