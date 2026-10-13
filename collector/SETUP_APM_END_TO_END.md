# Live APM data — complete end-to-end setup

This is the master checklist to get real `auto_explain` plans flowing into the
**Performance → Deep Insights → APM (auto_explain)** tab for **VIGIL PRD** (AWS RDS).

Do the steps in order. Steps marked **[You · AWS]** require your AWS account and
can't be automated from here; steps marked **[Script]** are done by the provided
deploy script. There's a one-time **[App]** step to mint an SDK key.

> Big picture: nothing new gets "deployed to Vercel." Your frontend + backend are
> already live on Vercel. This setup runs a small program on **AWS** that reads
> the RDS log from CloudWatch and pushes plans into your already-deployed
> `/api/auto-explain/ingest` endpoint.

---

## Step 0 — Get a PulseDB SDK key **[App]**

Both the Lambda and the poller authenticate with an SDK key (`sk_live_...`).

- In the app, open the **SDK Dashboard** (it creates apps/keys). Create an app
  (any name, e.g. "rds-autoexplain", appType `collector`, environment
  `production`). Copy the `sk_live_...` key it returns — it's shown once.
- This calls `POST /api/sdk/apps` under the hood; the response contains the key.

Keep the key handy for the steps below.

---

## Step 1 — Find the numeric connection id **[App]**

The shipper must target VIGIL PRD's **numeric** connection id.

- Open **Performance** for VIGIL PRD, open DevTools → Network, and look at a
  request like `/api/performance/stats?connectionId=N`. That `N` is the value.
- From earlier inspection this is **`10`** — confirm it still matches.

---

## Step 2 — Enable auto_explain on RDS **[You · AWS console]**

RDS won't let you edit the default parameter group. Create/use a **custom**
parameter group attached to VIGIL PRD and set:

| Parameter                       | Value                                        |
| ------------------------------- | -------------------------------------------- |
| `shared_preload_libraries`      | include `auto_explain` (**reboot required**) |
| `auto_explain.log_min_duration` | `500` (ms)                                   |
| `auto_explain.log_format`       | `json`                                       |
| `auto_explain.log_analyze`      | `1`                                          |
| `auto_explain.log_timing`       | `1`                                          |

Reboot the instance after changing `shared_preload_libraries`. The other
`auto_explain.*` values apply without a reboot.

(Full table + optional params in `RDS_AUTO_EXPLAIN_SETUP.md` section A.)

---

## Step 3 — Export the Postgres log to CloudWatch **[You · AWS console]**

RDS console → VIGIL PRD → **Modify** → **Log exports** → check **PostgreSQL log**
→ save. Note the resulting log group name:

```
/aws/rds/instance/<your-db-instance-id>/postgresql
```

You also now know your **region** (top-right of the RDS console) — you'll need it
for the deploy script.

---

## Step 4 — Deploy the ingestion

You picked **both**. Start with the Lambda (real-time, hands-off); keep the
poller as a fallback.

### 4a. Lambda (push, real-time) **[Script · needs AWS CLI]**

If `aws sts get-caller-identity` works, this is one command:

```sh
cd collector/lambda
chmod +x deploy-lambda.sh

AWS_REGION=<your-region> \
CW_LOG_GROUP=/aws/rds/instance/<db-id>/postgresql \
PULSEDB_SDK_KEY=sk_live_xxx \
PULSEDB_CONNECTION_ID=10 \
./deploy-lambda.sh
```

The script packages the zip, creates the IAM role, creates/updates the Lambda,
grants CloudWatch invoke permission, and creates the subscription filter. It's
idempotent — safe to re-run.

> No AWS CLI? Either install it (`aws configure` with an access key), or follow
> the manual console steps in `lambda/LAMBDA_SETUP.md`.

### 4b. Polling shipper (fallback) **[You · any server/container]**

On a host/container with AWS credentials (env vars or instance role):

```sh
cd collector
npm install @aws-sdk/client-cloudwatch-logs

AWS_REGION=<your-region> \
CW_LOG_GROUP=/aws/rds/instance/<db-id>/postgresql \
PULSEDB_URL=https://postgres-tool.vercel.app \
PULSEDB_SDK_KEY=sk_live_xxx \
PULSEDB_CONNECTION_ID=10 \
node pulsedb-autoexplain-shipper.mjs
```

(systemd unit + IAM policy in `RDS_AUTO_EXPLAIN_SETUP.md` section B. Don't run
both Lambda and poller against the same log group at once — pick one as primary.)

---

## Step 5 — Verify **[App]**

1. Run a query slower than `auto_explain.log_min_duration` against VIGIL PRD
   (e.g. a deliberate `SELECT pg_sleep(1), * FROM <big_table> LIMIT 1000`).
2. Lambda: check its CloudWatch logs for `{"msg":"shipped N"}`.
   Poller: watch its stdout for `shipped N events`.
3. Open **Performance → Deep Insights → APM (auto_explain)**. The slow query,
   latency distribution, and EXPLAIN ANALYZE plan tree should now appear.

If the tab still shows 0 events, see the troubleshooting table in
`RDS_AUTO_EXPLAIN_SETUP.md`.

---

## What I can and can't do for you

| Step                                         | Who                                                 |
| -------------------------------------------- | --------------------------------------------------- |
| Mint SDK key (Step 0)                        | You, in the app UI                                  |
| RDS parameter group + log export (Steps 2–3) | You, in AWS console (needs your account)            |
| Lambda deploy (Step 4a)                      | The script runs it; you provide AWS creds           |
| Poller (Step 4b)                             | You run it on your host                             |
| Verify (Step 5)                              | You/me — I can re-check the APM tab once data flows |

Tell me once Steps 2–3 are done and you have the SDK key + log group name, and
I'll help you run the deploy script and verify the APM tab shows live data.
