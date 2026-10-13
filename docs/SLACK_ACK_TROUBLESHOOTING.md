# Slack acknowledgement — troubleshooting

"The Ack button does nothing" has four independent causes. From inside Slack
they are indistinguishable: the button greys out and no error appears. Work
through them in order — later fixes do nothing while an earlier blocker stands.

Run the probe first. It reproduces exactly what Slack sends and turns the
silence into a readable HTTP status:

```bash
npm run slack:probe            # local, server must be running
npm run slack:probe -- --prod  # the deployed instance Slack actually talks to
```

Safe by default: the incident id it uses does not exist, so nothing is
mutated, and it omits `response_url`, so nothing is posted into your channel.

## Reading the result

| Probe output | Cause | Fix |
|---|---|---|
| `HTTP 503` | **#1** `SLACK_SIGNING_SECRET` unset on the host that answered | Set it in the environment that serves Slack's requests — for Vercel, Project → Settings → Environment Variables, then **redeploy** (env changes need a new deployment) |
| `HTTP 400` "Raw request body unavailable" | **#2** body parsed before Express saw it | Preserve the raw body — see below |
| `HTTP 403` | Secret mismatch, mangled body, or clock skew | Re-run with `--tamper` to disambiguate (see below) |
| `HTTP 404` | Route not mounted on that host | Deployment is stale, or `incidentRoutes` is not mounted at `/api` |
| `HTTP 401` | Auth middleware, IP allow-list, or Vercel Deployment Protection intercepting | This path must be publicly reachable — Slack cannot authenticate |
| `HTTP 200` | #1 and #2 are clear | If buttons still fail, the Request URL in the Slack app config is wrong or missing |

### Disambiguating a 403

```bash
npm run slack:probe -- --prod --tamper
```

`--tamper` sends a deliberately invalid signature.

- **403 again** → verification is genuinely running, so your real 403 is a
  secret mismatch (most likely) or clock skew. The usual cause is a local
  `.env` that was updated while the deployed environment was not.
- **anything else** → the endpoint is not really verifying, and your 403 is
  blocker #2 wearing a different status code.

If `--tamper` returns 200, stop and treat it as a security issue: unsigned
requests are being accepted and anyone can acknowledge your incidents.

The signing maths itself is verified against Slack's published test vector, so
a 403 is never a bug in the HMAC — it is the secret or the bytes.

## Blocker #1 — signing secret

Both Slack ack paths hard-fail without it:

- `POST /api/slack/interactions` → 503 (`routes/incidentRoutes.ts`)
- `POST /api/slack/commands` (`/ack`) → 403

Note that alert *delivery* keeps working without the secret, because outgoing
messages come from the `notification_destinations` row rather than the
environment. A working webhook therefore proves nothing about ack.

## Blocker #2 — raw body on serverless

`/api/slack/interactions` mounts `express.raw()` on itself specifically so
signature verification sees Slack's exact bytes. The base string is
`v0:<timestamp>:<raw body>`, so anything that re-serialises the body breaks
verification even when the secret is perfect.

On Vercel, `api/index.js` exports the Express app directly and the platform's
Node request helpers parse `application/x-www-form-urlencoded` before Express
runs. Two symptoms, both handled explicitly in the route:

- `req.body` arrives as a parsed object → 400, logged as
  `"Slack interaction: request body was parsed before this handler"`
- the stream is already consumed → empty `rawBody` → signs to a valid but
  wrong digest → 403, logged as `"bad signature"`

Check the function logs right after a click; the two log lines tell you which.

The fix is to get the raw bytes to the handler — disable the platform's body
parsing for this route, or capture the raw buffer in `api/index.js` before
Express and attach it as `req.rawBody`. A different secret will not help.

## Blocker #3 — no button to click

The Ack button is only emitted by `alertFormatter.renderSlackBlocks`, for
incident digests that contain unacknowledged incidents. The general path,
`slackNotifier.buildSlackBlocks`, adds only Dashboard and Runbook buttons.

For ordinary alerts there is nothing to click, and `/ack <id>` is the only
route. Note the button layout changes with volume: up to three unacked
incidents get one button each, beyond that a single "Acknowledge all" button.

## Blocker #4 — ack succeeds but the message never changes

`updateAlertMessage` needs `slack_ts` plus a bot token. Incoming webhooks
return no message timestamp, so in webhook-only mode `slack_ts` is always
NULL and `alertService`'s update call is unreachable.

The acknowledgement does land in the database and a follow-up is posted into
the thread, but the original alert keeps looking unacknowledged — which reads
as "ack is broken" even when it worked.

Only a bot token fixes this. Setting `SLACK_BOT_TOKEN` + `SLACK_CHANNEL_ID`
switches delivery to `chat.postMessage`, which returns a `ts` that gets
persisted, enabling both in-place updates and threaded replies.

## Slack app configuration

At [api.slack.com/apps](https://api.slack.com/apps), for the app that owns the
webhook:

- **Interactivity & Shortcuts** → on, Request URL
  `https://<your-domain>/api/slack/interactions`
- **Slash Commands** → `/ack`, Request URL
  `https://<your-domain>/api/slack/commands`
- **Basic Information** → Signing Secret is the value for
  `SLACK_SIGNING_SECRET`

Interactivity is a property of the *app*, not the webhook, so buttons
delivered through an incoming webhook still route back to the app's Request
URL. Slack expects a 200 within 3 seconds; the probe reports latency and warns
if you are over budget.

## Related: duplicate messages

Setting `SLACK_WEBHOOK_URL` while a Slack row exists in
`notification_destinations` sends every alert twice — once via the legacy
global path in `alertService`, once via the per-org fan-out. If both point at
the same channel you get duplicates. Use one or the other.
