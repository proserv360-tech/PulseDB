# Handoff — enable Slack acknowledgement in production

**For:** whoever administers the Vercel project serving
`postgres-tool-frontend.vercel.app` (under the `foxsense-innovations` scope).

**Ask:** add one environment variable and redeploy. Two minutes of work.

## Background

Slack alert *delivery* already works. Clicking **Acknowledge** on a Slack
message does not — the endpoint rejects every request before it reads them.

Slack signs each request with an HMAC and our handler verifies it against
`SLACK_SIGNING_SECRET`. That variable is not present in the deployed
environment, so `POST /api/slack/interactions` returns:

```
HTTP 503  {"error":"Slack signing secret not configured"}
```

This is our own code reporting on its own environment
(`backend/routes/incidentRoutes.ts`), not an inference — the variable is
genuinely absent from the running deployment.

It was added to a project in a different Vercel scope, which is why it had no
effect. It needs to be on the project that owns this domain.

## What to do

1. Vercel → the project serving `postgres-tool-frontend.vercel.app` →
   **Settings → Environment Variables**
2. Add:

   | Name | Value | Environments |
   |---|---|---|
   | `SLACK_SIGNING_SECRET` | Slack app → **Basic Information → Signing Secret** (32 hex chars) | **Production** |
   | `SLACK_BOT_TOKEN` | Slack app → **OAuth & Permissions → Bot User OAuth Token** (`xoxb-…`) | **Production** |
   | `SLACK_CHANNEL_ID` | The alerts channel ID (`C…`) | **Production** |

   The signing secret alone makes the Acknowledge button work. The bot token
   additionally lets an acknowledgement rewrite the original alert message
   instead of only replying in-thread.

3. **Redeploy.** Environment variables are baked into a deployment at build
   time — adding the variable does not affect the deployment already running.

### Please do NOT add `SLACK_WEBHOOK_URL`

Outgoing messages are already routed through the `notification_destinations`
table. Setting the environment variable as well makes `alertService` send every
alert twice — once through the legacy global path, once through the per-org
fan-out — and both currently point at the same channel.

## Also in this deploy

A code change ships alongside, needed for the same feature. No action required,
but for context:

`api/index.js` previously did a bare `export default app`. Vercel's Node
runtime parses the request body before the handler runs, which destroys the
exact bytes Slack signed and makes verification impossible. The wrapper now
sets `config.api.bodyParser = false` and captures the raw body itself for
`/api/slack/*` only. All other routes pass through untouched, so uploads and
streaming are unaffected.

Verified against the real handler under three conditions — stream intact,
body pre-parsed to a Buffer, body pre-parsed to an object — with valid,
forged, and replayed signatures. Forged and replayed requests are still
rejected; the unrecoverable case fails with a clear error rather than hanging
or returning a misleading 403.

## Verification

Anyone can confirm from outside; no Vercel access needed:

```bash
cd backend
npm run slack:probe -- --prod
```

Sends a genuinely Slack-signed request and prints the result. Safe against
production: the incident id it uses does not exist and no `response_url` is
sent, so nothing is modified and nothing is posted to Slack.

- `HTTP 200` — working
- `HTTP 503` — the variable still is not reaching this deployment
- anything else — see `docs/SLACK_ACK_TROUBLESHOOTING.md`

## If you set the bot token

Two things must happen alongside it, or alerts arrive twice:

1. Invite the bot to the channel (`/invite @PulseDB`). `chat.postMessage` and
   `chat.update` both fail with `not_in_channel` otherwise.
2. Disable the webhook-mode Slack destination, so delivery does not run through
   both the global bot token and the per-org fan-out:

   ```bash
   npm run sql -- scripts/switch-to-slack-bot.sql
   ```

Scopes required on the bot: `chat:write` (post and update) and `users:read`
(resolving a Slack user id to a display name on acknowledgement).

## Known remaining behaviour

Incident digest messages are updated by a threaded reply rather than being
rewritten in place. That is deliberate — the digest contains a findings table,
and overwriting it to say "acknowledged" would destroy the content people need.
Single-alert messages are rewritten in place once the bot token is set.
