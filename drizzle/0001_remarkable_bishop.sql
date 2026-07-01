CREATE TYPE "public"."relation_type" AS ENUM('self', 'spouse', 'child', 'parent', 'other');--> statement-breakpoint
CREATE TABLE "education_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"family_member_id" uuid NOT NULL,
	"course_name" varchar(150) NOT NULL,
	"country" varchar(60) NOT NULL,
	"start_age" numeric(4, 1) DEFAULT '18' NOT NULL,
	"duration_years" numeric(4, 1) DEFAULT '4' NOT NULL,
	"current_annual_cost" numeric(14, 2) NOT NULL,
	"notes" text,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "family_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"date_of_birth" date NOT NULL,
	"relation" "relation_type" DEFAULT 'other' NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_settings" (
	"household_id" uuid PRIMARY KEY NOT NULL,
	"country" varchar(60) DEFAULT 'India' NOT NULL,
	"currency" varchar(10) DEFAULT 'INR' NOT NULL,
	"general_inflation_rate" numeric(5, 2) DEFAULT '6.00' NOT NULL,
	"lifestyle_upgrade_rate" numeric(5, 2) DEFAULT '2.00' NOT NULL,
	"education_inflation_rate" numeric(5, 2) DEFAULT '8.00' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marriage_budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"family_member_id" uuid NOT NULL,
	"included" boolean DEFAULT true NOT NULL,
	"target_age" numeric(4, 1) DEFAULT '26' NOT NULL,
	"current_budget" numeric(14, 2) NOT NULL,
	"notes" text,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "education_plans" ADD CONSTRAINT "education_plans_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "education_plans" ADD CONSTRAINT "education_plans_family_member_id_family_members_id_fk" FOREIGN KEY ("family_member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "education_plans" ADD CONSTRAINT "education_plans_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_settings" ADD CONSTRAINT "financial_settings_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marriage_budgets" ADD CONSTRAINT "marriage_budgets_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marriage_budgets" ADD CONSTRAINT "marriage_budgets_family_member_id_family_members_id_fk" FOREIGN KEY ("family_member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marriage_budgets" ADD CONSTRAINT "marriage_budgets_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;