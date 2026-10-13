# Copilot conversation retention

Wave A task A5 (2026-06-02).

The copilot stores conversation turns (`pgmonitoringtool.copilot_turns`) so
users can scroll their recent NL→SQL / EXPLAIN / RCA history. Even though
input is redacted server-side before insert (HIGH-4 fix) and the redaction
matrix covers OpenAI / Anthropic / Slack / GitHub / GitLab / AWS / generic
`password=…` patterns (MED-2), no redactor is perfect. A bounded TTL caps
exposure of any regulated identifier that slips through.

## TTL

- **Default:** 30 days.
- **Override:** set `FATHOM_COPILOT_HISTORY_DAYS=<n>` in the backend env.
- **Minimum:** 1 day (clamped server-side).

## Scheduled purge

`backend/server.js` schedules `purgeOldConversations()` daily at process
startup + once every 24 h. The first run happens 30 seconds after boot so
testing the schedule end-to-end requires only a server restart.

Sweep skipped under:

- `VERCEL=1` — serverless instances are short-lived.
- `NODE_ENV=test` — keeps tests deterministic.

When B1 lands (web/worker split) the sweep moves to `backend/worker.js`.

## User-initiated purge

| Endpoint                          | Effect                                     |
| --------------------------------- | ------------------------------------------ |
| `DELETE /api/copilot/history/:id` | Remove one turn the caller owns            |
| `DELETE /api/copilot/history`     | Remove every turn this user has in this ws |
| `GET    /api/copilot/retention`   | Return `{ maxAgeDays }` for the UI banner  |

Both DELETE endpoints scope to `(workspace_id, user_id)` so an ID guess
from outside the caller's workspace returns 404, not deletes.

## Redaction matrix (reference)

Documented here because it's part of the retention contract. The patterns
live in `services/copilotService.js` under `REDACT_PATTERNS`. They cover:

- `sk_live_…` / `sk_test_…` (OpenAI, Stripe)
- `sk-ant-…` (Anthropic)
- `xoxb-…` / `xoxp-…` / `xoxa-…` (Slack)
- `ghp_…` / `gho_…` / `ghs_…` (GitHub)
- `glpat-…` (GitLab)
- `AKIA…` / `ASIA…` (AWS access keys)
- generic `password=` / `api_key=` / `secret=` key=value pairs
- bearer-token Authorization headers

Anything else (PII strings, internal hostnames) is not auto-redacted and
is bounded only by the TTL above.

## UI

The Copilot panel (`frontend/src/components/Copilot.tsx`) shows a small
"Auto-purged after N days" banner sourced from `/api/copilot/retention`
and exposes a "Delete this conversation" affordance on each saved turn,
plus a "Clear my history" action in the user menu.
