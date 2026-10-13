# FATHOM — Per-Organization Integrations

FATHOM's alert fan-out lets each organization configure its own notification
destinations. When an alert fires against an organization, FATHOM dispatches
it in parallel to every enabled destination that organization has set up —
Slack, PagerDuty, Opsgenie, Microsoft Teams, or a signed generic webhook.

Dispatch is wrapped by the `NotifierManager`, which provides:

- Parallel delivery across all destinations.
- Per-alert-id deduplication (5-minute window by default).
- Exponential-backoff retry on transient HTTP failures (408, 429, 5xx).
- Per-destination severity gating — send info noise to Slack, keep
  PagerDuty for criticals only.

All destination secrets (bot tokens, routing keys, HMAC secrets) are
encrypted at rest using AES-256-GCM with the `ENCRYPTION_KEY` env var.
Plaintext secrets never leave the backend, never appear in API responses,
and never appear in logs.

## Data model

`pgmonitoringtool.notification_destinations`

| Column         | Type                         | Notes                                                        |
| -------------- | ---------------------------- | ------------------------------------------------------------ |
| `id`           | `serial`                     | primary key                                                  |
| `org_id`       | `integer` (FK organizations) | cascade-delete with the org                                  |
| `name`         | `varchar(120)`               | unique per-org, lowercase-insensitive                        |
| `provider`     | `varchar(32)`                | `slack` \| `pagerduty` \| `opsgenie` \| `teams` \| `webhook` |
| `min_severity` | `varchar(16)`                | `debug` \| `info` \| `warning` \| `error` \| `critical`      |
| `enabled`      | `boolean`                    | disabled rows skip dispatch                                  |
| `config`       | `jsonb`                      | public provider config (see below)                           |
| `secret_enc`   | `text`                       | encrypted secret, never returned via API                     |
| `last_used_at` | `timestamptz`                | updated after each dispatch                                  |
| `last_status`  | `varchar(16)`                | `ok` \| `http_5xx` \| `error` \| ...                         |
| `last_error`   | `text`                       | last failure detail (first 1000 chars)                       |
| `created_by`   | `integer` (FK users)         | set on create, kept for audit                                |

Apply the migration with `npm run migrate --workspace=backend`.

## API

Every route requires `Authorization: Bearer <JWT>` **and**
`x-org-id: <organizationId>`. The caller must belong to that organization;
write operations additionally require `owner` or `admin` role inside the
organization. (Global `super_admin` users bypass the org-role check but are
still scoped to the org they name in the header.)

| Method | Path                         | Body / Query                                                  | Role    |
| ------ | ---------------------------- | ------------------------------------------------------------- | ------- |
| GET    | `/api/integrations`          | —                                                             | member+ |
| GET    | `/api/integrations/:id`      | —                                                             | member+ |
| POST   | `/api/integrations`          | `{ name, provider, config, secret?, minSeverity?, enabled? }` | admin+  |
| PATCH  | `/api/integrations/:id`      | partial; any of the above                                     | admin+  |
| DELETE | `/api/integrations/:id`      | —                                                             | admin+  |
| POST   | `/api/integrations/:id/test` | `{ severity? }` (default `warning`)                           | admin+  |

`POST /test` dispatches a canned `"FATHOM integration test"` alert to the
one destination and returns the raw `NotifierManager` result
(`{ ok, status, detail, ... }`).

### Response shape

Destinations are always returned in this redacted form — `hasSecret` is
`true`/`false` but the secret itself is never exposed:

```json
{
    "id": 42,
    "orgId": 3,
    "name": "ops-slack",
    "provider": "slack",
    "minSeverity": "warning",
    "enabled": true,
    "config": { "channel": "C0123456789" },
    "hasSecret": true,
    "createdAt": "2026-04-22T10:00:00.000Z",
    "updatedAt": "2026-04-22T10:00:00.000Z",
    "lastUsedAt": "2026-04-22T10:05:00.000Z",
    "lastStatus": "ok",
    "lastError": null
}
```

## Provider configuration

### Slack (two modes)

**Bot token + channel (recommended — supports threads, updates)**

```json
{
    "name": "ops-slack",
    "provider": "slack",
    "minSeverity": "warning",
    "config": { "channel": "C0123456789" },
    "secret": "xoxb-XXXXXXXX"
}
```

**Incoming webhook (simple)**

```json
{
    "name": "alerts-channel",
    "provider": "slack",
    "config": { "webhookUrl": "https://hooks.slack.com/services/T.../B.../..." }
}
```

Only `https://hooks.slack.com/` URLs are accepted for the webhook mode.

### PagerDuty (Events API v2)

```json
{
    "name": "pagerduty-primary",
    "provider": "pagerduty",
    "minSeverity": "error",
    "config": { "source": "fathom-prod" },
    "secret": "<32-char-events-api-integration-key>"
}
```

### Opsgenie

```json
{
    "name": "opsgenie-primary",
    "provider": "opsgenie",
    "minSeverity": "error",
    "config": {
        "region": "eu",
        "responderTeams": ["DB On-call"],
        "tags": ["fathom", "postgres"]
    },
    "secret": "<opsgenie-api-integration-key>"
}
```

`region` is `"us"` (default) or `"eu"`.

### Microsoft Teams

```json
{
    "name": "teams-sre",
    "provider": "teams",
    "config": {
        "webhookUrl": "https://outlook.office.com/webhook/..."
    }
}
```

### Generic signed webhook

Posts a JSON body signed with an HMAC-SHA256 timestamped header,
`X-FATHOM-Signature: t=<unix>,v1=<hex>`. Receivers verify with
`verifyWebhookSignature()` exported from `services/notifiers/webhookNotifier.js`.

```json
{
    "name": "siem",
    "provider": "webhook",
    "config": {
        "url": "https://siem.example.com/fathom",
        "extraHeaders": { "X-Env": "prod" }
    },
    "secret": "<hmac-shared-secret>"
}
```

## Secret rotation

`PATCH /api/integrations/:id` supports partial updates. Three behaviours:

- **Omit `secret`** — existing secret retained.
- **Pass `secret: "<newvalue>"`** — old ciphertext is overwritten with new.
- **Pass `secret: null`** — stored secret is cleared (only valid for
  providers that can run without one, e.g. Slack webhook, Teams).

Every rotation is recorded in the audit log with
`action = integration.update` and `metadata.secretRotated = true`.

## Wiring into alerts

`EnhancedAlertEngine.fire(severity, category, message, data)` looks at
`data.orgId` (falling back to `data.organizationId`). If an `orgId` is
present, FATHOM fans out in parallel to every enabled destination for that
organization. The legacy global `SLACK_WEBHOOK_URL` continues to work for
backwards compatibility — both paths fire independently.

```js
await alertService.fire('critical', 'reliability', 'replica lag > 30s', {
    orgId: tenantOrgId,
    replicaHost: 'db-replica-1',
    lagSeconds: 37.2,
});
```

## Operational notes

- Failed deliveries don't block the alert loop. Errors are written to
  `last_error` on the destination row and logged via the JSON logger.
- `POST /integrations/:id/test` updates `last_used_at`/`last_status` just
  like a real alert would, so the UI can show a "last test" indicator.
- Severity floors are compared on the rank scale `debug < info < warning
< error < critical`. An alert below a destination's `minSeverity` is
  reported as `{ ok: true, skipped: true }` and makes no network call.
- Deletion cascades via `ON DELETE CASCADE` on the `org_id` FK — when an
  organization is removed, its destinations go with it.
