CREATE SCHEMA IF NOT EXISTS "pgmonitoringtool";
--> statement-breakpoint
CREATE TABLE "pgmonitoringtool"."alert_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text DEFAULT '',
	"metric" varchar(100) NOT NULL,
	"condition" varchar(10) NOT NULL,
	"threshold" real NOT NULL,
	"severity" varchar(20) DEFAULT 'warning' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"cooldown_minutes" integer DEFAULT 15,
	"notify_email" boolean DEFAULT false,
	"notify_slack" boolean DEFAULT false,
	"connection_id" integer,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pgmonitoringtool"."alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" varchar(50) NOT NULL,
	"severity" varchar(20) DEFAULT 'warning' NOT NULL,
	"message" text NOT NULL,
	"details" json DEFAULT '{}'::json,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"connection_id" integer,
	"acknowledged_by" varchar(100),
	"acknowledged_at" timestamp,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pgmonitoringtool"."user_api_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"key_prefix" varchar(20) NOT NULL,
	"key_hash" varchar(64) NOT NULL,
	"scope" varchar(50) DEFAULT 'read:all',
	"total_calls" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"revoked_at" timestamp,
	"revoked_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pgmonitoringtool"."audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_username" varchar(100),
	"action" varchar(100) NOT NULL,
	"details" json DEFAULT '{}'::json,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pgmonitoringtool"."pulsedb_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"name" text NOT NULL,
	"host" text DEFAULT '' NOT NULL,
	"port" integer DEFAULT 5432 NOT NULL,
	"db_name" text DEFAULT 'postgres' NOT NULL,
	"username" text DEFAULT '',
	"password_encrypted" text DEFAULT '',
	"ssl" boolean DEFAULT true NOT NULL,
	"color" varchar(7) DEFAULT '#06b6d4',
	"is_default" boolean DEFAULT false NOT NULL,
	"connection_type" varchar(20) DEFAULT 'postgresql',
	"environment" varchar(50) DEFAULT 'production',
	"region" varchar(100),
	"notes" text,
	"health_status" varchar(20) DEFAULT 'unknown',
	"last_health_check" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pgmonitoringtool"."feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"rating" integer NOT NULL,
	"category" varchar(50),
	"message" text,
	"page" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pgmonitoringtool"."user_login_activity" (
	"user_id" integer NOT NULL,
	"day" timestamp NOT NULL,
	"login_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pgmonitoringtool"."user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"ip_address" "inet",
	"user_agent" text,
	"device_label" varchar(100),
	"location" varchar(100),
	"risk_level" varchar(20) DEFAULT 'low',
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp,
	"revoked_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pgmonitoringtool"."users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(50) NOT NULL,
	"password_hash" text NOT NULL,
	"name" varchar(100) NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" varchar(20) DEFAULT 'viewer' NOT NULL,
	"access_level" varchar(10) DEFAULT 'read' NOT NULL,
	"allowed_screens" text[] DEFAULT '{}' NOT NULL,
	"data_access" varchar(20) DEFAULT 'internal',
	"department" varchar(100),
	"location" varchar(100),
	"mfa_enabled" boolean DEFAULT true NOT NULL,
	"api_access" boolean DEFAULT false NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_login_at" timestamp,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "pgmonitoringtool"."alert_rules" ADD CONSTRAINT "alert_rules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "pgmonitoringtool"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pgmonitoringtool"."user_api_keys" ADD CONSTRAINT "user_api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "pgmonitoringtool"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pgmonitoringtool"."pulsedb_connections" ADD CONSTRAINT "pulsedb_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "pgmonitoringtool"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pgmonitoringtool"."feedback" ADD CONSTRAINT "feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "pgmonitoringtool"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pgmonitoringtool"."user_login_activity" ADD CONSTRAINT "user_login_activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "pgmonitoringtool"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pgmonitoringtool"."user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "pgmonitoringtool"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerts_status_idx" ON "pgmonitoringtool"."alerts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "alerts_severity_idx" ON "pgmonitoringtool"."alerts" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "alerts_created_idx" ON "pgmonitoringtool"."alerts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "apikeys_user_idx" ON "pgmonitoringtool"."user_api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "apikeys_hash_unique" ON "pgmonitoringtool"."user_api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "audit_timestamp_idx" ON "pgmonitoringtool"."audit_log" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "connections_user_idx" ON "pgmonitoringtool"."pulsedb_connections" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "login_activity_user_day" ON "pgmonitoringtool"."user_login_activity" USING btree ("user_id","day");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "pgmonitoringtool"."user_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_active_idx" ON "pgmonitoringtool"."user_sessions" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_unique" ON "pgmonitoringtool"."users" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "pgmonitoringtool"."users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "pgmonitoringtool"."users" USING btree ("status");