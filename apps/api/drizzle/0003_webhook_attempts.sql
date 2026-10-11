CREATE TABLE "webhook_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"delivery_id" text NOT NULL,
	"attempt" integer NOT NULL,
	"status_code" integer,
	"error" text,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "webhook_attempts" ADD CONSTRAINT "webhook_attempts_delivery_id_webhook_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."webhook_deliveries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "webhook_attempts_delivery_idx" ON "webhook_attempts" USING btree ("delivery_id");