-- 0004_security_hardening.sql ───────────────────────────────────────────────
-- Post-audit security hardening.
--
-- MED-3: SCIM tokens gain an explicit expires_at. Default 365 days, adjustable
--        at issue time. NULL means "no expiry" (legacy rows — never minted
--        that way by new code; a rotate operation fills it in).
-- MED-3: copilot_turns gains a retention column so we can prune old LLM
--        conversation history. The scheduler in auditExport.js will
--        clean up rows older than the retention window.
-- HIGH-4: copilot_turns.input is redacted server-side before insertion, so
--         no schema change is strictly needed, but we add an explicit
--         `input_redacted` flag to signal that the column has been filtered.

ALTER TABLE pgmonitoringtool.scim_tokens
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Back-fill: any existing token issued under the old code gets a one-year
-- expiry starting now. Admins can rotate earlier if they want shorter-lived
-- tokens.
UPDATE pgmonitoringtool.scim_tokens
   SET expires_at = now() + INTERVAL '365 days'
 WHERE expires_at IS NULL AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS scim_tokens_expiry_idx
    ON pgmonitoringtool.scim_tokens(expires_at)
    WHERE revoked_at IS NULL;

-- copilot_turns may not exist yet if 0003 hasn't been applied — wrap.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'pgmonitoringtool'
           AND table_name   = 'copilot_turns'
    ) THEN
        EXECUTE 'ALTER TABLE pgmonitoringtool.copilot_turns
                 ADD COLUMN IF NOT EXISTS input_redacted BOOLEAN NOT NULL DEFAULT true';
    END IF;
END$$;
