import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  numeric,
  date,
  boolean,
  integer,
  timestamp,
  primaryKey,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const userRoleEnum = pgEnum("user_role", ["admin", "member"]);
export const moduleEnum = pgEnum("module_type", [
  "expense",
  "income",
  "investment",
  "debt",
  "asset",
  "insurance",
]);
export const accessLevelEnum = pgEnum("access_level", ["view", "edit"]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "debit_card",
  "credit_card",
  "upi",
  "bank_transfer",
  "auto_debit",
  "cheque",
  "dividend",
  "other",
]);
export const frequencyEnum = pgEnum("frequency", [
  "one_time",
  "monthly",
  "quarterly",
  "half_yearly",
  "yearly",
]);
export const relationEnum = pgEnum("relation_type", [
  "self",
  "spouse",
  "child",
  "parent",
  "other",
]);

export const households = pgTable("households", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  // Currency new records default to and household-wide snapshots are stored in.
  defaultCurrency: varchar("default_currency", { length: 3 }).notNull().default("INR"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 200 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("member"),
  // The currency this user prefers to see totals in (null = use household default).
  displayCurrency: varchar("display_currency", { length: 3 }),
  // App Lock: an optional local re-auth gate on top of the login session.
  appLockEnabled: boolean("app_lock_enabled").notNull().default(false),
  pinHash: text("pin_hash"), // bcrypt hash of the 4-digit PIN; never stored in plain text
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Platform biometric credentials (WebAuthn) used to unlock App Lock via
// Face ID / Fingerprint. The private key never leaves the device; we store only
// the public key and signature counter to verify assertions server-side.
export const webauthnCredentials = pgTable("webauthn_credentials", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  credentialId: text("credential_id").notNull().unique(), // base64url
  publicKey: text("public_key").notNull(), // base64url of COSE public key bytes
  counter: integer("counter").notNull().default(0),
  transports: jsonb("transports").$type<string[]>().notNull().default([]),
  deviceLabel: varchar("device_label", { length: 120 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Which family member can view which module/category. No row = no access (except admin, who always has full access).
// category = null means "all categories in this module".
export const sharePermissions = pgTable("share_permissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  memberId: uuid("member_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  module: moduleEnum("module").notNull(),
  category: varchar("category", { length: 80 }),
  accessLevel: accessLevelEnum("access_level").notNull().default("view"),
});

export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  module: moduleEnum("module").notNull(),
  name: varchar("name", { length: 80 }).notNull(),
  color: varchar("color", { length: 20 }).notNull().default("#f0a500"),
});

// Unified expense + income ledger
export const transactions = pgTable("transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  createdById: uuid("created_by_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: moduleEnum("type").notNull(), // 'expense' | 'income'
  categoryId: uuid("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("INR"),
  date: date("date").notNull(),
  paymentMethod: paymentMethodEnum("payment_method")
    .notNull()
    .default("cash"),
  note: text("note"),
  isRecurring: boolean("is_recurring").notNull().default(false),
  recurrenceFrequency: frequencyEnum("recurrence_frequency")
    .notNull()
    .default("one_time"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const investments = pgTable("investments", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  createdById: uuid("created_by_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 150 }).notNull(),
  type: varchar("type", { length: 80 }).notNull(),
  investedAmount: numeric("invested_amount", { precision: 14, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("INR"),
  currentValue: numeric("current_value", { precision: 14, scale: 2 }),
  purchaseDate: date("purchase_date").notNull(),
  maturityDate: date("maturity_date"),
  expectedReturnRate: numeric("expected_return_rate", { precision: 5, scale: 2 }),
  notes: text("notes"),
  // Market-price auto-update: when enabled with a symbol + quantity, a weekly job
  // refreshes currentValue = quantity × latest price (converted to INR).
  autoUpdate: boolean("auto_update").notNull().default(false),
  // Yahoo Finance ticker (e.g. AAPL, RELIANCE.NS, GOLDBEES.NS) or a numeric AMFI
  // mutual-fund scheme code (e.g. 120503).
  symbol: varchar("symbol", { length: 40 }),
  quantity: numeric("quantity", { precision: 18, scale: 6 }),
  lastPrice: numeric("last_price", { precision: 18, scale: 6 }),
  lastPricedAt: timestamp("last_priced_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const debts = pgTable("debts", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  createdById: uuid("created_by_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 150 }).notNull(),
  lender: varchar("lender", { length: 150 }),
  type: varchar("type", { length: 80 }).notNull(),
  principal: numeric("principal", { precision: 14, scale: 2 }).notNull(),
  outstandingAmount: numeric("outstanding_amount", { precision: 14, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("INR"),
  interestRate: numeric("interest_rate", { precision: 5, scale: 2 }),
  emiAmount: numeric("emi_amount", { precision: 14, scale: 2 }),
  emiDay: numeric("emi_day", { precision: 2, scale: 0 }),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const assets = pgTable("assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  createdById: uuid("created_by_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 150 }).notNull(),
  type: varchar("type", { length: 80 }).notNull(),
  value: numeric("value", { precision: 14, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("INR"),
  purchaseDate: date("purchase_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insurances = pgTable("insurances", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  createdById: uuid("created_by_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 150 }).notNull(),
  type: varchar("type", { length: 80 }).notNull(),
  provider: varchar("provider", { length: 150 }),
  policyNumber: varchar("policy_number", { length: 100 }),
  premiumAmount: numeric("premium_amount", { precision: 14, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("INR"),
  premiumFrequency: frequencyEnum("premium_frequency").notNull().default("yearly"),
  startDate: date("start_date").notNull(),
  expiryDate: date("expiry_date").notNull(),
  sumAssured: numeric("sum_assured", { precision: 14, scale: 2 }),
  nominee: varchar("nominee", { length: 120 }),
  // Emergency contacts so family can reach the insurer quickly during a claim
  claimHelpline: varchar("claim_helpline", { length: 60 }),
  insurerHelpline: varchar("insurer_helpline", { length: 60 }),
  agentName: varchar("agent_name", { length: 120 }),
  agentPhone: varchar("agent_phone", { length: 60 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Generic file attachments (bills, statements, insurance copies) for any module record
export const attachments = pgTable("attachments", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  module: moduleEnum("module").notNull(),
  recordId: uuid("record_id").notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileType: varchar("file_type", { length: 100 }).notNull(),
  fileData: text("file_data").notNull(), // base64-encoded content
  uploadedById: uuid("uploaded_by_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

// Household member profiles (self, spouse, kids...) used for age-based planning.
// Distinct from `users` - a family profile need not have a login account.
export const familyMembers = pgTable("family_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  dateOfBirth: date("date_of_birth").notNull(),
  relation: relationEnum("relation").notNull().default("other"),
  createdById: uuid("created_by_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// One row per household: country + inflation assumptions used for the 10-year projection.
export const financialSettings = pgTable("financial_settings", {
  householdId: uuid("household_id")
    .primaryKey()
    .references(() => households.id, { onDelete: "cascade" }),
  country: varchar("country", { length: 60 }).notNull().default("India"),
  currency: varchar("currency", { length: 10 }).notNull().default("INR"),
  generalInflationRate: numeric("general_inflation_rate", { precision: 5, scale: 2 }).notNull().default("6.00"),
  lifestyleUpgradeRate: numeric("lifestyle_upgrade_rate", { precision: 5, scale: 2 }).notNull().default("2.00"),
  educationInflationRate: numeric("education_inflation_rate", { precision: 5, scale: 2 }).notNull().default("8.00"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const educationPlans = pgTable("education_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  familyMemberId: uuid("family_member_id")
    .notNull()
    .references(() => familyMembers.id, { onDelete: "cascade" }),
  courseName: varchar("course_name", { length: 150 }).notNull(),
  country: varchar("country", { length: 60 }).notNull(),
  startAge: numeric("start_age", { precision: 4, scale: 1 }).notNull().default("18"),
  durationYears: numeric("duration_years", { precision: 4, scale: 1 }).notNull().default("4"),
  currentAnnualCost: numeric("current_annual_cost", { precision: 14, scale: 2 }).notNull(),
  notes: text("notes"),
  createdById: uuid("created_by_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const marriageBudgets = pgTable("marriage_budgets", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  familyMemberId: uuid("family_member_id")
    .notNull()
    .references(() => familyMembers.id, { onDelete: "cascade" }),
  included: boolean("included").notNull().default(true),
  targetAge: numeric("target_age", { precision: 4, scale: 1 }).notNull().default("26"),
  currentBudget: numeric("current_budget", { precision: 14, scale: 2 }).notNull(),
  notes: text("notes"),
  createdById: uuid("created_by_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InviteGrant = {
  module: "expense" | "income" | "investment" | "debt" | "asset" | "insurance";
  category: string | null;
  accessLevel: "view" | "edit";
};

// Pending family invitations. The admin generates one (with pre-chosen permissions),
// shares the link, and the invitee accepts by setting their own name + password.
export const invites = pgTable("invites", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 64 }).notNull().unique(),
  email: varchar("email", { length: 200 }),
  suggestedName: varchar("suggested_name", { length: 120 }),
  grants: jsonb("grants").$type<InviteGrant[]>().notNull().default([]),
  invitedById: uuid("invited_by_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  acceptedAt: timestamp("accepted_at"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Financial goals the household is saving toward (vacation, emergency fund, etc.).
export const goals = pgTable("goals", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  createdById: uuid("created_by_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 150 }).notNull(),
  category: varchar("category", { length: 60 }),
  targetAmount: numeric("target_amount", { precision: 14, scale: 2 }).notNull(),
  currentAmount: numeric("current_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  targetDate: date("target_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Daily-ish net-worth snapshots so month-over-month deltas become real over time.
// One row per household per day (composite PK), written on dashboard/insights load.
export const netWorthSnapshots = pgTable(
  "net_worth_snapshots",
  {
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    netWorth: numeric("net_worth", { precision: 16, scale: 2 }).notNull(),
    investments: numeric("investments", { precision: 16, scale: 2 }).notNull(),
    assets: numeric("assets", { precision: 16, scale: 2 }).notNull(),
    debts: numeric("debts", { precision: 16, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.householdId, t.date] })]
);

// Records that a due item (an EMI, premium, recurring income, renewal, maturity…)
// was acted on for a specific due date, so reminders stop nagging for that period.
// A recurring item completed for one period reappears for the next (different dueDate).
export const reminderCompletions = pgTable(
  "reminder_completions",
  {
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 40 }).notNull(), // e.g. emi, insurance_premium, recurring_income
    sourceId: uuid("source_id").notNull(), // the debt/insurance/investment/transaction id
    dueDate: date("due_date").notNull(),
    completedById: uuid("completed_by_id").references(() => users.id, { onDelete: "set null" }),
    completedAt: timestamp("completed_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.kind, t.sourceId, t.dueDate] })]
);

// Cached FX rates: 1 unit of `base` = `rate` units of `quote`. Refreshed on demand.
export const fxRates = pgTable(
  "fx_rates",
  {
    base: varchar("base", { length: 3 }).notNull(),
    quote: varchar("quote", { length: 3 }).notNull(),
    rate: numeric("rate", { precision: 18, scale: 8 }).notNull(),
    fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.base, t.quote] })]
);

export const householdsRelations = relations(households, ({ many }) => ({
  users: many(users),
}));

export const usersRelations = relations(users, ({ one }) => ({
  household: one(households, {
    fields: [users.householdId],
    references: [households.id],
  }),
}));
