-- 0036_session_text_columns.sql
-- ---------------------------------------------------------------------------
-- 0000 created user_sessions.device_label and .location as varchar(100), but
-- createSession() stores the browser User-Agent (up to 255 chars) in
-- device_label. A desktop Chrome/Edge UA is ~130 chars, so on a database built
-- from the migrations every browser login failed with "value too long for type
-- character varying(100)" and the login route answered 500 "Login failed".
-- (curl's short UA passed, which is why API-level tests did not catch it.)
--
-- Previously deployed databases already used text for both columns (see the
-- table in 0024's header). Widening varchar -> text is metadata-only and a
-- no-op where the columns are already text.
--
-- v_active_sessions (0024) selects both columns, and Postgres will not retype
-- a column a view depends on, so the view is dropped and recreated with its
-- 0024 definition unchanged. The runner wraps the file in one transaction.
-- ---------------------------------------------------------------------------

DROP VIEW IF EXISTS pgmonitoringtool.v_active_sessions;
--> statement-breakpoint

ALTER TABLE pgmonitoringtool.user_sessions
    ALTER COLUMN device_label TYPE TEXT,
    ALTER COLUMN location TYPE TEXT;
--> statement-breakpoint

CREATE OR REPLACE VIEW pgmonitoringtool.v_active_sessions AS
SELECT s.id,
       s.user_id,
       u.username,
       u.name AS user_name,
       s.ip_address,
       s.device_label,
       s.location,
       s.risk_level,
       s.is_active,
       s.expires_at,
       s.created_at
  FROM pgmonitoringtool.user_sessions s
  JOIN pgmonitoringtool.users u ON u.id = s.user_id
 WHERE s.is_active = TRUE
   AND s.expires_at > now()
   AND u.deleted_at IS NULL;
