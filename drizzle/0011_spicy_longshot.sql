ALTER TABLE "investments" ADD COLUMN "location" varchar(200);--> statement-breakpoint
ALTER TABLE "investments" ADD COLUMN "size_value" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "investments" ADD COLUMN "size_unit" varchar(20);--> statement-breakpoint
ALTER TABLE "investments" ADD COLUMN "valuation_note" text;