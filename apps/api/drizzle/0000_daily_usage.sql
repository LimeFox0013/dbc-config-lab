CREATE TABLE "daily_usage" (
	"caller" text NOT NULL,
	"day" date NOT NULL,
	"calls" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "daily_usage_caller_day_pk" PRIMARY KEY("caller","day")
);
