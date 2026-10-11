CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"wallet_address" text NOT NULL,
	"paid_plan" text,
	"plan_ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_wallet_address_unique" UNIQUE("wallet_address")
);
--> statement-breakpoint
CREATE TABLE "agentic_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"role_id" text NOT NULL,
	"external_system" text NOT NULL,
	"external_ref" text NOT NULL,
	"key_prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "agentic_accounts_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "agentic_roles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"permissions" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agentic_roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"reference" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"plan" text NOT NULL,
	"amount" bigint NOT NULL,
	"recipient" text NOT NULL,
	"network" text NOT NULL,
	"signature" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"credited_at" timestamp with time zone,
	CONSTRAINT "payments_signature_unique" UNIQUE("signature")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sign_in_challenges" (
	"nonce" text PRIMARY KEY NOT NULL,
	"wallet_address" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agentic_accounts" ADD CONSTRAINT "agentic_accounts_tenant_id_accounts_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agentic_accounts" ADD CONSTRAINT "agentic_accounts_role_id_agentic_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."agentic_roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;