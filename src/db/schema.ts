import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  numeric,
  date,
  boolean,
  timestamp,
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
  currentValue: numeric("current_value", { precision: 14, scale: 2 }),
  purchaseDate: date("purchase_date").notNull(),
  maturityDate: date("maturity_date"),
  expectedReturnRate: numeric("expected_return_rate", { precision: 5, scale: 2 }),
  notes: text("notes"),
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

export const householdsRelations = relations(households, ({ many }) => ({
  users: many(users),
}));

export const usersRelations = relations(users, ({ one }) => ({
  household: one(households, {
    fields: [users.householdId],
    references: [households.id],
  }),
}));
