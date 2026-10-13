-- 0002_plugins_marketplace.sql
-- Dashboard marketplace + plugin registry tables.

CREATE TABLE IF NOT EXISTS "pgmonitoringtool"."plugins" (
    "id"            serial PRIMARY KEY,
    "slug"          varchar(100) UNIQUE NOT NULL,
    "name"          varchar(200) NOT NULL,
    "description"   text DEFAULT '',
    "author"        varchar(200),
    "version"       varchar(32)  NOT NULL,
    "manifest"      jsonb        NOT NULL,
    "entry_url"     text,
    "verified"      boolean      DEFAULT false NOT NULL,
    "downloads"     bigint       DEFAULT 0 NOT NULL,
    "published_by"  integer,
    "published_at"  timestamp    DEFAULT now() NOT NULL,
    "updated_at"    timestamp    DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_plugins_slug_v" ON "pgmonitoringtool"."plugins"("slug","version");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "pgmonitoringtool"."workspace_plugins" (
    "id"            serial PRIMARY KEY,
    "workspace_id"  integer NOT NULL,
    "plugin_id"     integer NOT NULL
                    REFERENCES "pgmonitoringtool"."plugins"("id") ON DELETE CASCADE,
    "version"       varchar(32) NOT NULL,
    "settings"      jsonb DEFAULT '{}'::jsonb NOT NULL,
    "enabled"       boolean DEFAULT true NOT NULL,
    "installed_by"  integer,
    "installed_at"  timestamp DEFAULT now() NOT NULL,
    UNIQUE ("workspace_id", "plugin_id")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "pgmonitoringtool"."shared_dashboards" (
    "id"            serial PRIMARY KEY,
    "slug"          varchar(120) UNIQUE NOT NULL,
    "name"          varchar(200) NOT NULL,
    "description"   text DEFAULT '',
    "tags"          text[] DEFAULT ARRAY[]::text[],
    "definition"    jsonb NOT NULL,
    "published_by"  integer,
    "workspace_id"  integer,
    "downloads"     bigint DEFAULT 0 NOT NULL,
    "stars"         integer DEFAULT 0 NOT NULL,
    "verified"      boolean DEFAULT false NOT NULL,
    "created_at"    timestamp DEFAULT now() NOT NULL,
    "updated_at"    timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
