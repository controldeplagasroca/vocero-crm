CREATE TABLE "reminder_log" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"roca_client_id" text NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"sent_by" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reminder_log" ADD CONSTRAINT "reminder_log_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reminder_log_client_idx" ON "reminder_log" USING btree ("organization_id","roca_client_id","sent_at");