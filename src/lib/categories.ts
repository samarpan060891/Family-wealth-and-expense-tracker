export const DEFAULT_CATEGORIES: Record<string, string[]> = {
  expense: [
    "Housing / Rent",
    "Electricity",
    "Mobile / Internet",
    "Groceries",
    "Dining Out",
    "Fuel / Transport",
    "Medical / Health",
    "Education",
    "Entertainment",
    "Travel / Trip",
    "Shopping",
    "EMI Payment",
    "Insurance Premium",
    "Other",
  ],
  income: [
    "Salary",
    "Business Income",
    "Rental Income",
    "Dividends",
    "Interest",
    "Freelance",
    "Bonus",
    "Gift",
    "Other",
  ],
};

export const INVESTMENT_TYPES = [
  "Mutual Fund",
  "Stocks",
  "ETF",
  "Fixed Deposit",
  "Recurring Deposit",
  "FCNR Deposit",
  "PPF",
  "EPF",
  "NPS",
  "Gold",
  "Real Estate",
  "Bonds",
  "Cryptocurrency",
  "Other",
];

export const DEBT_TYPES = [
  "Home Loan",
  "Personal Loan",
  "Car Loan",
  "Education Loan",
  "Credit Card",
  "Other",
];

export const ASSET_TYPES = [
  "Real Estate",
  "Vehicle",
  "Gold / Jewellery",
  "Electronics",
  "Furniture",
  "Other",
];

export const INSURANCE_TYPES = [
  "Life Insurance",
  "Term Insurance",
  "Health Insurance",
  "Vehicle Insurance",
  "Home Insurance",
  "ULIP",
  "Other",
];

export const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "debit_card", label: "Debit Card" },
  { value: "credit_card", label: "Credit Card" },
  { value: "upi", label: "UPI / Online" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "auto_debit", label: "Auto Debit / Standing Instruction" },
  { value: "cheque", label: "Cheque" },
  { value: "dividend", label: "Dividend / Interest Credit" },
  { value: "other", label: "Other" },
];

export const FREQUENCIES = [
  { value: "one_time", label: "One-time" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "half_yearly", label: "Half-yearly" },
  { value: "yearly", label: "Yearly" },
];
