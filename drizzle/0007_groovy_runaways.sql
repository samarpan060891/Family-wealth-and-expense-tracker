CREATE TABLE "reminder_completions" (
	"household_id" uuid NOT NULL,
	"kind" varchar(40) NOT NULL,
	"source_id" uuid NOT NULL,
	"due_date" date NOT NULL,
	"completed_by_id" uuid,
	"completed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reminder_completions_kind_source_id_due_date_pk" PRIMARY KEY("kind","source_id","due_date")
);
--> statement-breakpoint
ALTER TABLE "reminder_completions" ADD CONSTRAINT "reminder_completions_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_completions" ADD CONSTRAINT "reminder_completions_completed_by_id_users_id_fk" FOREIGN KEY ("completed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;