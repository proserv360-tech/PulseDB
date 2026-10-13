-- switch-to-slack-bot.sql ────────────────────────────────────────────────────
-- Move Slack delivery from the incoming webhook to the global bot token.
--
--   npm run sql -- scripts/switch-to-slack-bot.sql
--
-- Run this AFTER SLACK_BOT_TOKEN and SLACK_CHANNEL_ID are set and the server
-- has been restarted. Order matters: this disables the webhook destination, so
-- running it first leaves a window with no Slack delivery at all.
--
-- Why disable rather than delete: the row keeps its name, min_severity and
-- encrypted secret, so re-enabling is a one-line UPDATE if the bot token turns
-- out to be wrong. Deleting would mean re-registering from scratch.
--
-- Why it has to be disabled at all: alertService sends through the global bot
-- token AND the per-org fan-out. Leaving both live is what produced duplicate
-- messages. _orgHasSlackDestination() only counts rows with enabled = true, so
-- flipping this flag is what stops the second copy.

\echo Slack destinations before

SELECT id, name, provider, min_severity, enabled, last_status,
       CASE WHEN config ? 'webhookUrl' THEN 'incoming webhook'
            WHEN config ? 'channel'    THEN 'bot token'
            ELSE 'unknown' END AS mode
  FROM pgmonitoringtool.notification_destinations
 ORDER BY id;

\echo Disabling webhook-mode Slack destinations

-- Only webhook-mode rows. A destination already using a bot token is left
-- alone: it is not the source of the duplicate, and disabling it would take
-- out a deliberately configured per-org route.
UPDATE pgmonitoringtool.notification_destinations
   SET enabled = false,
       updated_at = now()
 WHERE provider = 'slack'
   AND enabled = true
   AND config ? 'webhookUrl';

\echo Slack destinations after

SELECT id, name, provider, enabled, updated_at
  FROM pgmonitoringtool.notification_destinations
 WHERE provider = 'slack'
 ORDER BY id;

-- To undo:
--   UPDATE pgmonitoringtool.notification_destinations
--      SET enabled = true WHERE id = <id>;
--   …and unset SLACK_BOT_TOKEN so the global path stops firing.
