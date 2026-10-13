# Slack alert format — design options

Detailed spec for the three candidate layouts, so the choice can be made before
any code moves. All three are changes to `renderSlackBlocks()` in
`backend/services/alertFormatter.ts`. Nothing else needs to change.

---

## 1. What is wrong with the current format

From a real message in `#database-alerts`:

```
Incident            Object              Metric  Priority  Owner     Status  SLA
Due
──────────────────  ──────────────────  ──────  ────────  ────────  ──────  ────────
INC-20260803-001    public.orders        62.0%  critical  DBA Team  open    3h
53m left
INC-20260803-002    crm.customer_logs    38.0%  medium    DBA Team  open    2d
23h left
```

### 1.1 The table is wider than the message column

`INCIDENT_COLUMNS_COMPACT` has seven columns. Rendered, the header row is
**78 characters**. Slack's message column fits roughly:

| Surface | Usable monospace characters |
|---|---|
| Desktop, full-width window | ~90 |
| Desktop, split view or thread pane | ~55 |
| Mobile portrait | **~40** |

So the table fits only on a maximised desktop window. Everywhere else it
wraps, and wrapping is worse than truncation here: `SLA Due` breaks onto its
own line, then `53m left` appears under a *different* incident's row. The
columns look aligned — monospace guarantees that — while pairing the wrong
values. A misaligned table that still looks like a table is a correctness
problem, not a cosmetic one.

Widening the budget does not fix it. `crm.customer_logs` is already 17
characters; one `analytics.user_events_daily` (27) pushes any fixed-width
layout over again. Whatever number we pick, a schema will eventually exceed it.

### 1.2 The facts table repeats the header

```
Severity  Category     Database
────────  ───────────  ────────
CRITICAL  maintenance  TestDB
```

`CRITICAL` is already in the header text, the emoji, and the attachment colour
— stated four times. `Category` is internal taxonomy that no reader acts on.
Only `Database` earns its place, and it is one short string.

### 1.3 The `Why` column carries no information

```
Target              Action                Why
INC-20260803-001    VACUUM (FULL, …)      critical
INC-20260803-002    VACUUM ANALYZE        medium
```

`Why` restates `Priority` from the table above. It costs a column and answers
nothing. The genuinely useful "why" — 62% bloat — is already in the metric.

### 1.4 The footer is addressed to a machine

```
Sent by Fathom · or /ack <incident-id> · alert d9832ad1-5031-41c5-9605-2928a53e0e69
```

The alert UUID is unusable by a human: it is not what `/ack` takes (that wants
`INC-…`), and it is not searchable in the UI. It belongs in logs.

---

## 2. Shared decisions

These apply to whichever option is chosen.

**Keep SQL in a code block.** It is the one element that genuinely needs
monospace and clean copy-paste. Every option preserves it verbatim.

**Keep the colour bar.** The attachment `color` stripe is the fastest severity
signal in a busy channel and costs no vertical space.

**Drop the alert UUID from the footer**, keep `/ack <incident-id>`.

**Drop the `Category` fact and the `Why` column.**

**Button limits.** Slack caps an `actions` block at 5 elements. The existing
rule — one button per incident up to 3, then a single bulk button — stays, and
is applied consistently across options.

---

## 3. Option A — narrow table

Same structure as today, cut to four columns and a ~48 character header.

```
Incident   Object              Bloat   SLA
────────── ─────────────────── ─────── ────────
#001       public.orders        62.0%  3h 53m
#002       crm.customer_logs    38.0%  2d 23h
```

Changes to `INCIDENT_COLUMNS_COMPACT`:

| Column | Keep? | Reason |
|---|---|---|
| `id` | Shortened to `#001` | The `INC-20260803-` prefix is identical on every row of a given day |
| `object_path` | Keep | The thing that is broken |
| `metric_display` | Keep, relabel to the metric name | `Bloat` says more than `Metric` |
| `priority` | **Drop** | Encoded in colour and ordering |
| `owner` | **Drop** | Constant across rows in practice |
| `status` | **Drop** | Always `open` on a fresh alert |
| `sla_display` | Keep, drop the word `left` | `3h 53m` is unambiguous under a column headed SLA |

**Pros** — smallest diff; familiar; scannable when many incidents share a shape.

**Cons** — still a fixed-width table, so still breaks on long object names and
still wraps on mobile at ~40 characters. It raises the ceiling rather than
removing it.

**Best when** — alerts are usually 3+ incidents and read on desktop.

---

## 4. Option B — per-incident blocks (recommended)

No code-block table for incident data. Each incident becomes native Slack
blocks, which reflow instead of wrapping.

Per incident:

- a `section` with `*object_path*` and the priority as a trailing bold token
- a `context` line: `62% bloat · SLA 3h 53m · DBA Team · #001`
- a `section` holding that incident's SQL in a code block

Then one `actions` block for the whole message, and a `context` footer.

```json
{
  "type": "section",
  "text": { "type": "mrkdwn", "text": "*`public.orders`*  ·  *critical*" }
},
{
  "type": "context",
  "elements": [{ "type": "mrkdwn", "text": "62% bloat · SLA 3h 53m · DBA Team · `INC-20260803-001`" }]
},
{
  "type": "section",
  "text": { "type": "mrkdwn", "text": "```VACUUM (FULL, ANALYZE) \"public\".\"orders\";```" }
}
```

**Pros**

- Nothing can wrap into a wrong-looking alignment; `context` reflows as prose.
- Reads correctly on mobile, which is where alerts are actually seen out of hours.
- SQL sits next to the incident it fixes, instead of in a separate block the
  reader has to re-associate by name.
- Long object names are a non-issue.

**Cons**

- Roughly 3 blocks per incident, so 10 incidents is 30+ blocks. Slack's limit
  is 50 per message, and anything past ~5 is a wall of text. Needs a cap.
- Loses at-a-glance column comparison when incidents are homogeneous.

**Cap rule.** Render at most 3 incidents in full. Beyond that, render the top 3
by priority then SLA, and add a `context` line: `…and 4 more — /ack to
acknowledge, or open the dashboard`. This is the same threshold already used
for buttons, so the two stay in step.

**Best when** — alerts are usually 1–3 incidents. Matches your current volume:
the sample had 2.

---

## 5. Option C — summary first

One headline, the worst offender, and everything else behind buttons.

```
2 tables bloated on TestDB
Worst: public.orders at 62% — SLA in 3h 53m
Also crm.customer_logs at 38%

[ Ack all 2 ]  [ Details ]  [ Fix SQL ]
```

`Details` and `Fix SQL` post the full findings as a threaded reply, so the
channel stays readable and the detail is one click away.

**Pros** — fastest triage; channel stays skimmable; scales to any incident
count without a cap.

**Cons** — needs two new interaction handlers (`show_details`,
`show_sql`) alongside the existing ack path, which is more code than either
other option. It also hides SQL that people frequently want immediately, and
threaded detail is easy to miss on mobile.

**Best when** — the channel is noisy and most alerts are informational.

---

## 6. Recommendation

**Option B, with Option C's cap.**

The wrapping bug is the actual complaint, and B is the only option that removes
it structurally rather than by staying under a width budget. A is a smaller
change but leaves the same failure one long schema name away. C solves it too,
but pays for it with new interaction handlers and by hiding the SQL.

Concretely: per-incident blocks, at most 3 rendered, a `…and N more` line
beyond that, existing button rules unchanged.

---

## 7. Migration notes

- Only `renderSlackBlocks()` changes. `renderPlainText()` — used for email and
  logs — keeps the wide table, which is correct there since neither surface has
  Slack's width constraint.
- `tests/alertFormatter.test.ts` asserts on block structure, including
  `actions.elements[0].action_id === 'ack_incident:INC-…'`. The ack assertions
  hold under all three options; the table assertions need updating for B and C.
- `INCIDENT_COLUMNS_FULL` is untouched — it is the dashboard's column set.
- No change to the webhook-versus-bot-token path. Both call `renderSlackBlocks`
  and receive the same payload.
