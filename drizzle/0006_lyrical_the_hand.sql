ALTER TABLE "investments" ADD COLUMN "auto_update" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "investments" ADD COLUMN "symbol" varchar(40);--> statement-breakpoint
ALTER TABLE "investments" ADD COLUMN "quantity" numeric(18, 6);--> statement-breakpoint
ALTER TABLE "investments" ADD COLUMN "last_price" numeric(18, 6);--> statement-breakpoint
ALTER TABLE "investments" ADD COLUMN "last_priced_at" timestamp;