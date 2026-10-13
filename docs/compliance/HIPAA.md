# FATHOM — HIPAA Compliance Playbook

Operating FATHOM as a HIPAA-eligible service requires three things: the
right BAA posture, the right configuration, and the right operating
controls. This document covers all three.

FATHOM itself is not automatically HIPAA-compliant — compliance is a
property of **your deployment**. These are the knobs you have to turn.

## 1. Business Associate Agreements (BAAs)

You need a signed BAA with every party that touches Protected Health
Information (PHI) at any point in the pipeline.

| Vendor                                  | Signed BAA needed when                                                            |
| --------------------------------------- | --------------------------------------------------------------------------------- |
| Your cloud provider (AWS / GCP / Azure) | You deploy FATHOM on their infra.                                                 |
| Your Postgres host                      | If the control-plane DB will hold any PHI (avoid this if possible).               |
| Your KMS                                | Required — AWS KMS / Google Cloud KMS / Azure Key Vault all have one.             |
| Your email provider                     | If alerts / reports can contain PHI.                                              |
| Your Slack / PagerDuty                  | If alerts fan out there. Pager has a BAA; Slack has one for Enterprise Grid only. |
| Anthropic / OpenAI                      | AI assistant disabled by default in HIPAA mode.                                   |

## 2. Required configuration

Every environment handling PHI must:

1. **Enable HIPAA mode.** Set `HIPAA_MODE=true`. This activates the
   `hipaaMiddleware`:
    - redacts `ssn / mrn / dob / patient_id / name / email / phone /
address` fields from every JSON response body;
    - sets `Cache-Control: no-store` on every response;
    - emits an `X-Fathom-PHI-Access: 1` header and an audit entry for
      every request to `/**/patients/**`, `/**/phi/**`, `/**/records/**`.

2. **Configure a BAA-eligible KMS.** Set `FATHOM_KMS_BACKEND=aws-kms`
   and `FATHOM_KMS_KEY_ID=arn:aws:kms:…`. The `local` backend is for
   dev only.

3. **Provision a tenant key per workspace.** Run
   `POST /api/kms/provision/:workspaceId` immediately after workspace
   creation. All at-rest secrets for that workspace will be wrapped
   with the KEK managed by your KMS.

4. **Disable the AI copilot.** Set `FATHOM_AI_DISABLED=true`. PHI must
   not be sent to a third-party LLM unless you have a specific BAA with
   that provider covering the flow.

5. **Turn on audit export.** The `auditExport.js` service streams
   immutable audit records to long-term WORM storage. Configure an S3
   bucket with Object Lock + Compliance mode.

6. **Tighten retention.** Set `FATHOM_RETENTION_DAYS=2555` (7 years)
   for audit, `=30` for query-sample bodies. Retention is enforced by
   `retentionService.js` on a nightly job.

7. **Force TLS.** Terminate at a load balancer that enforces
   TLS 1.2+; set `FATHOM_REQUIRE_TLS=true` so in-product links also
   refuse plaintext.

8. **IP allow-list admin paths.** Constrain `/api/admin/*` and
   `/api/kms/*` to a jump-host CIDR. Configured per workspace via
   `ipAllowList`.

## 3. Operating controls

- **Access reviews quarterly.** Run
  `GET /api/audit/export?from=...&to=...` and attest that every
  high-privilege action maps to a documented change.
- **De-identify samples before sharing.** When exporting to support,
  pass `?deidentify=true` — the `redactPhi` helper strips known PHI
  fields on the way out. The redaction list lives in
  `backend/middleware/hipaaMode.js`; review it quarterly.
- **Breach playbook.** On suspicion of a breach, rotate the tenant
  KEK (`POST /api/kms/rotate/:workspaceId`) and run
  `ops/rekey.js --workspace=<id>` to re-encrypt all wrapped secrets
  under the new DEK.
- **Vendor SOC 2 / HITRUST reviews annually.** Hold every vendor in
  the table above to a yearly SOC 2 Type II report; file them in
  `docs/compliance/vendor-reports/`.

## 4. What FATHOM does NOT do

- **FATHOM does not store PHI by design.** It stores telemetry about
  databases and applications. If your application data model sends
  PHI through FATHOM (for instance by surfacing a sample row in a
  slow-query view), `HIPAA_MODE` will redact it, but the right answer
  is to avoid capturing it in the first place. Configure
  `FATHOM_QUERY_SAMPLE_MODE=shape-only` to capture query shapes
  without parameter values.
- **FATHOM does not sign your BAA automatically.** Contact sales for a
  countersigned BAA once you have deployed in HIPAA mode.

## 5. Pre-flight checklist

Before handling PHI in production, the following must all be true:

- [ ] `HIPAA_MODE=true` in every environment variable set.
- [ ] `FATHOM_KMS_BACKEND` is one of `aws-kms`, `gcp-kms`, `vault`.
- [ ] `FATHOM_AI_DISABLED=true`.
- [ ] Every workspace has a row in `tenant_keys` with `retired_at IS NULL`.
- [ ] Audit export target is WORM-configured S3 (Object Lock, Compliance).
- [ ] BAAs on file with cloud, KMS, email, paging, monitoring.
- [ ] Penetration test in the last 12 months.
- [ ] Quarterly access review completed.
