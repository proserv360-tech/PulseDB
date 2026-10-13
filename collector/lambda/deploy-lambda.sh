#!/usr/bin/env bash
#
# deploy-lambda.sh — one-shot deploy of the auto_explain CloudWatch->Lambda shipper.
#
# Does everything on the AWS side that can be scripted:
#   1. Packages autoexplain-lambda.mjs + autoexplain-parser.mjs into a zip
#   2. Creates (or reuses) an IAM execution role with basic logging
#   3. Creates (or updates) the Lambda function with your env vars
#   4. Grants CloudWatch Logs permission to invoke the function
#   5. Creates the subscription filter on the RDS postgresql log group
#
# PREREQUISITES (do these first — see RDS_AUTO_EXPLAIN_SETUP.md section A):
#   - aws CLI installed & configured (`aws sts get-caller-identity` works)
#   - auto_explain enabled on the RDS parameter group (log_format=json)
#   - PostgreSQL log exported to CloudWatch Logs (you have the log group name)
#   - A FATHOM SDK key (sk_live_...) from the app's SDK Dashboard
#
# USAGE:
#   Edit the CONFIG block below, then:
#     chmod +x deploy-lambda.sh
#     ./deploy-lambda.sh
#
# The script is idempotent: re-running updates code/config rather than failing.

set -euo pipefail

# ───────────────────────── CONFIG — EDIT THESE ─────────────────────────
AWS_REGION="${AWS_REGION:-us-east-1}"                 # region of the RDS log group
FUNCTION_NAME="${FUNCTION_NAME:-fathom-autoexplain}"
LOG_GROUP="${CW_LOG_GROUP:-/aws/rds/instance/REPLACE-DB-ID/postgresql}"
FATHOM_URL="${FATHOM_URL:-https://postgres-tool.vercel.app}"
FATHOM_SDK_KEY="${FATHOM_SDK_KEY:-sk_live_REPLACE_ME}"
FATHOM_CONNECTION_ID="${FATHOM_CONNECTION_ID:-10}"   # numeric VIGIL PRD connection id
ROLE_NAME="${ROLE_NAME:-fathom-autoexplain-role}"
FILTER_NAME="${FILTER_NAME:-fathom-autoexplain}"
FILTER_PATTERN="${FILTER_PATTERN:-duration}"          # only deliver lines containing "duration"
# ───────────────────────────────────────────────────────────────────────

here="$(cd "$(dirname "$0")" && pwd)"
parent="$(cd "$here/.." && pwd)"

echo "==> sanity checks"
command -v aws >/dev/null || { echo "aws CLI not found"; exit 1; }
command -v zip >/dev/null || { echo "zip not found"; exit 1; }
[[ "$FATHOM_SDK_KEY" == sk_live_REPLACE_ME ]] && { echo "Set FATHOM_SDK_KEY"; exit 1; }
[[ "$LOG_GROUP" == *REPLACE-DB-ID* ]] && { echo "Set CW_LOG_GROUP to the real RDS log group"; exit 1; }

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
echo "    account: $ACCOUNT_ID   region: $AWS_REGION"

echo "==> 1. packaging zip"
# both .mjs files must be at the zip root (handler imports ./autoexplain-parser.mjs)
cp "$parent/autoexplain-parser.mjs" "$here/autoexplain-parser.mjs"
( cd "$here" && zip -q -FS autoexplain-lambda.zip autoexplain-lambda.mjs autoexplain-parser.mjs )
echo "    built $here/autoexplain-lambda.zip"

echo "==> 2. IAM role"
if ! aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
    aws iam create-role --role-name "$ROLE_NAME" \
        --assume-role-policy-document '{
            "Version":"2012-10-17",
            "Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]
        }' >/dev/null
    aws iam attach-role-policy --role-name "$ROLE_NAME" \
        --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
    echo "    created role $ROLE_NAME; waiting for propagation..."
    sleep 10
else
    echo "    role $ROLE_NAME exists"
fi
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

echo "==> 3. Lambda function"
ENV_VARS="Variables={FATHOM_URL=$FATHOM_URL,FATHOM_SDK_KEY=$FATHOM_SDK_KEY,FATHOM_CONNECTION_ID=$FATHOM_CONNECTION_ID}"
if aws lambda get-function --function-name "$FUNCTION_NAME" --region "$AWS_REGION" >/dev/null 2>&1; then
    echo "    updating code + config"
    aws lambda update-function-code --function-name "$FUNCTION_NAME" --region "$AWS_REGION" \
        --zip-file "fileb://$here/autoexplain-lambda.zip" >/dev/null
    aws lambda wait function-updated --function-name "$FUNCTION_NAME" --region "$AWS_REGION"
    aws lambda update-function-configuration --function-name "$FUNCTION_NAME" --region "$AWS_REGION" \
        --environment "$ENV_VARS" --timeout 30 --memory-size 256 >/dev/null
else
    echo "    creating function"
    aws lambda create-function --function-name "$FUNCTION_NAME" --region "$AWS_REGION" \
        --runtime nodejs20.x --handler autoexplain-lambda.handler \
        --role "$ROLE_ARN" --timeout 30 --memory-size 256 \
        --zip-file "fileb://$here/autoexplain-lambda.zip" \
        --environment "$ENV_VARS" >/dev/null
fi
aws lambda wait function-active --function-name "$FUNCTION_NAME" --region "$AWS_REGION"
FUNC_ARN="arn:aws:lambda:${AWS_REGION}:${ACCOUNT_ID}:function:${FUNCTION_NAME}"
echo "    $FUNC_ARN"

echo "==> 4. allow CloudWatch Logs to invoke"
aws lambda add-permission --function-name "$FUNCTION_NAME" --region "$AWS_REGION" \
    --statement-id cwlogs-invoke --principal logs.amazonaws.com \
    --action lambda:InvokeFunction \
    --source-arn "arn:aws:logs:${AWS_REGION}:${ACCOUNT_ID}:log-group:${LOG_GROUP}:*" \
    >/dev/null 2>&1 && echo "    permission added" || echo "    permission already present (ok)"

echo "==> 5. subscription filter on $LOG_GROUP"
aws logs put-subscription-filter --region "$AWS_REGION" \
    --log-group-name "$LOG_GROUP" \
    --filter-name "$FILTER_NAME" \
    --filter-pattern "$FILTER_PATTERN" \
    --destination-arn "$FUNC_ARN"
echo "    subscription filter set"

echo ""
echo "✅ Done. Run a query slower than auto_explain.log_min_duration on VIGIL PRD,"
echo "   then check the Lambda's CloudWatch logs for {\"msg\":\"shipped N\"} and open"
echo "   Performance → Deep Insights → APM (auto_explain)."
