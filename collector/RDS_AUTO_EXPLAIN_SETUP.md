# Live APM data on AWS RDS — `auto_explain` setup

This wires real `auto_explain` query plans from your **VIGIL PRD** RDS Postgres
instance into PulseDB's **Performance → Deep Insights → APM (auto_explain)** tab.

On RDS you cannot read the Postgres log file directly, so the pipeline is:

```
RDS Postgres (auto_explain ON, log_format=json)
   → CloudWatch Logs  (/aws/rds/instance/<db>/postgresql)
   → pulsedb-autoexplain-shipper.mjs  (parse + batch)
   → POST /api/auto-explain/ingest   (x-sdk-key)
   → APM tab
```

There are two halves: **A) configure RDS** (done by you in the AWS console) and
**B) run the shipper** (the script in this folder).

---

## A. Configure RDS

### 1. Enable `auto_explain` in a custom DB parameter group

RDS doesn't let you edit the default parameter group, so create/use a **custom**
one attached to the VIGIL PRD instance, then set:

| Parameter                            | Value                  | Notes                                                         |
| ------------------------------------ | ---------------------- | ------------------------------------------------------------- |
| `shared_preload_libraries`           | include `auto_explain` | **static** — requires a reboot                                |
| `auto_explain.log_min_duration`      | `500`                  | ms; log plans for queries slower than this. Lower = more data |
| `auto_explain.log_format`            | `json`                 | required — the shipper parses JSON                            |
| `auto_explain.log_analyze`           | `1` (on)               | gives real `Actual Total Time` / `Actual Rows`                |
| `auto_explain.log_timing`            | `1` (on)               | per-node timings                                              |
| `auto_explain.log_nested_statements` | `1` (on)               | optional; captures plans inside functions                     |
| `auto_explain.log_buffers`           | `1` (on)               | optional                                                      |

> ⚠️ `log_analyze=on` adds per-query overhead. Start with a conservative
> `log_min_duration` (e.g. 500–1000 ms) so only genuinely slow queries are
> instrumented.

After changing `shared_preload_libraries`, **reboot** the instance for it to
take effect. The `auto_explain.*` runtime params apply without a reboot.

### 2. Export the Postgres log to CloudWatch Logs

In the RDS console → your instance → **Modify** → **Log exports** → check
**PostgreSQL log** → save. RDS will publish to a log group named:

```
/aws/rds/instance/<your-db-instance-id>/postgresql
```

Copy that exact name — it's the `CW_LOG_GROUP` value below.

### 3. (Recommended) Set a parseable `log_line_prefix`

The shipper reads `db`, `user`, and `application` from the log prefix. RDS's
default `%t:%r:%u@%d:[%p]:` (`user@db`) is supported. If you want the explicit
form, set:

```
log_line_prefix = '%t db=%d user=%u app=%a '
```

---

## B. Run the shipper

### 1. IAM permissions

The shipper uses the standard AWS credential chain (env vars, shared config, or
an instance/Lambda role). The principal needs read access to the log group:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": ["logs:FilterLogEvents", "logs:GetLogEvents", "logs:DescribeLogStreams"],
            "Resource": "arn:aws:logs:<region>:<account-id>:log-group:/aws/rds/instance/<db>/postgresql:*"
        }
    ]
}
```

### 2. Install and configure

```sh
cd collector
npm install @aws-sdk/client-cloudwatch-logs
```

Set environment variables:

| Env var                | Required | Example                                  | Purpose                                                  |
| ---------------------- | -------- | ---------------------------------------- | -------------------------------------------------------- |
| `PULSEDB_URL`           | yes      | `https://postgres-tool.vercel.app`       | PulseDB base URL                                          |
| `PULSEDB_SDK_KEY`       | yes      | `sk_...`                                 | from **Admin → SDK Integration**                         |
| `PULSEDB_CONNECTION_ID` | yes      | `10`                                     | **numeric** connection id for VIGIL PRD (see note below) |
| `CW_LOG_GROUP`         | yes      | `/aws/rds/instance/vigil-prd/postgresql` | from step A.2                                            |
| `AWS_REGION`           | yes      | `us-east-1`                              | region of the log group                                  |
| `SHIPPER_POLL_MS`      | no       | `30000`                                  | poll interval (default 30 s)                             |
| `SHIPPER_LOOKBACK_MS`  | no       | `300000`                                 | first-poll lookback window (default 5 min)               |
| `SHIPPER_BATCH_MAX`    | no       | `200`                                    | events per POST (ingest caps at 500)                     |

> **`PULSEDB_CONNECTION_ID` must be the numeric id**, not a host label. The APM
> tab queries by numeric connection id (e.g. the live UI calls
> `…?connectionId=10`). Use the id of the VIGIL PRD connection in PulseDB. If
> you're unsure, open the APM tab in the browser, check the network request to
> `/api/performance/stats?connectionId=<N>` — that `<N>` is the value.

### 3. Start it

```sh
PULSEDB_URL=https://postgres-tool.vercel.app \
PULSEDB_SDK_KEY=sk_your_key \
PULSEDB_CONNECTION_ID=10 \
CW_LOG_GROUP=/aws/rds/instance/vigil-prd/postgresql \
AWS_REGION=us-east-1 \
node pulsedb-autoexplain-shipper.mjs
```

You should see log lines like `shipped N events`. Then open the APM tab — slow
queries, latency distribution, and EXPLAIN ANALYZE plan trees will populate.

### 4. Run it as a service (systemd)

```ini
[Unit]
Description=PulseDB auto_explain shipper
After=network-online.target

[Service]
Environment=PULSEDB_URL=https://postgres-tool.vercel.app
Environment=PULSEDB_SDK_KEY=sk_your_key
Environment=PULSEDB_CONNECTION_ID=10
Environment=CW_LOG_GROUP=/aws/rds/instance/vigil-prd/postgresql
Environment=AWS_REGION=us-east-1
ExecStart=/usr/bin/node /opt/pulsedb/pulsedb-autoexplain-shipper.mjs
Restart=always

[Install]
WantedBy=multi-user.target
```

(For a serverless option, the same parser can run in a Lambda triggered by a
CloudWatch Logs subscription filter instead of polling — ask if you want that
variant.)

---

## Troubleshooting

| Symptom                            | Likely cause                                                                     |
| ---------------------------------- | -------------------------------------------------------------------------------- |
| APM still shows 0 events           | No query exceeded `auto_explain.log_min_duration`; lower it, or run a slow query |
| `401 invalid_sdk_key`              | Wrong/expired `PULSEDB_SDK_KEY`                                                   |
| `400 connectionId required`        | `PULSEDB_CONNECTION_ID` not set to a positive integer                             |
| `AccessDenied` on FilterLogEvents  | IAM policy missing `logs:FilterLogEvents` on the log group                       |
| Events ship but plan tree is empty | `auto_explain.log_format` is not `json`, or `log_analyze` is off                 |
| No log group exists                | PostgreSQL log export not enabled (step A.2)                                     |
