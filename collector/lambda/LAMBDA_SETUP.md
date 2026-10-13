# Push-based APM ingestion — CloudWatch Logs → Lambda

A lower-latency alternative to the polling shipper. Instead of polling
CloudWatch every 30 s, a **subscription filter** on the RDS log group invokes a
Lambda the moment log events arrive. The Lambda parses `auto_explain` plans and
POSTs them to `/api/auto-explain/ingest`.

Use this if you want near real-time APM data and prefer serverless over running
a long-lived process. The RDS-side configuration (parameter group + log export)
is identical to `../RDS_AUTO_EXPLAIN_SETUP.md` section A — do that first.

```
RDS Postgres ──▶ CloudWatch Logs ──(subscription filter)──▶ Lambda ──▶ /api/auto-explain/ingest
```

---

## 1. Package the Lambda

The handler imports the shared parser, so zip **both** files at the same level:

```sh
cd collector
cp autoexplain-parser.mjs lambda/
cd lambda
zip autoexplain-lambda.zip autoexplain-lambda.mjs autoexplain-parser.mjs
```

> Both `.mjs` files must sit at the **root** of the zip (the handler does
> `import './autoexplain-parser.mjs'`).

## 2. Create the Lambda function

- Runtime: **Node.js 20.x** (or newer)
- Handler: **`autoexplain-lambda.handler`**
- Architecture: arm64 or x86_64 (either is fine)
- Timeout: **30 s**; Memory: 128–256 MB is plenty
- Upload `autoexplain-lambda.zip`

Set environment variables:

| Key                    | Value                                  |
| ---------------------- | -------------------------------------- |
| `PULSEDB_URL`           | `https://postgres-tool.vercel.app`     |
| `PULSEDB_SDK_KEY`       | `sk_...` (Admin → SDK Integration)     |
| `PULSEDB_CONNECTION_ID` | `10` (numeric VIGIL PRD connection id) |

> The handler validates that `PULSEDB_CONNECTION_ID` is a positive integer and
> throws on startup otherwise.

## 3. Execution role

The Lambda's role needs only basic logging (CloudWatch Logs delivers the event
payload directly — no `logs:FilterLogEvents` required):

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
            "Resource": "arn:aws:logs:*:*:*"
        }
    ]
}
```

(The AWS-managed `AWSLambdaBasicExecutionRole` covers this.)

## 4. Allow CloudWatch Logs to invoke the Lambda

```sh
aws lambda add-permission \
  --function-name pulsedb-autoexplain \
  --statement-id cwlogs-invoke \
  --principal logs.amazonaws.com \
  --action lambda:InvokeFunction \
  --source-arn "arn:aws:logs:<region>:<account-id>:log-group:/aws/rds/instance/<db>/postgresql:*"
```

## 5. Create the subscription filter

Point the RDS postgresql log group at the Lambda. The filter pattern narrows
delivery to lines that contain auto_explain output (reduces invocations):

```sh
aws logs put-subscription-filter \
  --log-group-name "/aws/rds/instance/<db>/postgresql" \
  --filter-name pulsedb-autoexplain \
  --filter-pattern "duration" \
  --destination-arn "arn:aws:lambda:<region>:<account-id>:function:pulsedb-autoexplain"
```

> CloudWatch allows **one** Lambda/Kinesis subscription filter per log group on
> the standard tier (up to two on some account tiers). If a filter already
> exists on this group, replace it or use the polling shipper instead.

## 6. Verify

Run a query slower than `auto_explain.log_min_duration` against VIGIL PRD, then:

- Check the Lambda's own CloudWatch logs — you should see
  `{"msg":"shipped N", ...}`.
- Open **Performance → Deep Insights → APM (auto_explain)** — the slow query,
  latency distribution, and EXPLAIN ANALYZE plan tree should appear.

---

## Polling vs. Lambda — which to use

|                   | Polling shipper                       | Lambda (this)                       |
| ----------------- | ------------------------------------- | ----------------------------------- |
| Latency           | up to `SHIPPER_POLL_MS` (≈30 s)       | seconds                             |
| Infra             | a running process / container         | serverless                          |
| AWS perms         | `logs:FilterLogEvents`                | invoke permission + basic logging   |
| Log-group filters | none needed                           | uses the 1 subscription-filter slot |
| Best for          | simple host/container you already run | hands-off, real-time                |

Both share `autoexplain-parser.mjs`, so plan parsing is identical between them.
