# FATHOM — SOC 2 Type II Controls Checklist

**Purpose.** This document is an internal, engineering-facing checklist of the controls FATHOM must have in place _before the SOC 2 Type II observation window opens_. It maps each control to (a) the Trust Service Criterion it satisfies, (b) the owning team, (c) the artifact a SOC 2 auditor will ask for, and (d) the current status. It is _not_ the audit itself — it is the preparation sheet an auditor would expect to see on the first day of kickoff.

**Scope.** The initial SOC 2 engagement covers Security (mandatory) plus Availability and Confidentiality. Privacy and Processing Integrity are out of scope for the first year and will be reassessed before the Year 2 renewal.

**Observation window target.** Minimum 3 months for a Type II report (6 months preferred).

**Status legend.** `[x]` in place · `[~]` partial · `[ ]` not yet started.

---

## How to read this document

Each Trust Service Criterion section contains a table of specific controls. A control "in place" means every one of the following is true: there is a written policy, the control is enforced in the product or in an operational process, and there is an artifact an auditor can inspect (a log export, a Jira ticket, a signed attestation, a Git history, a configuration screenshot, etc.). Anything short of all three is `[~]` or `[ ]`.

---

## CC1 — Control Environment

| #     | Control                                                                                                       | Owner             | Artifact                                                | Status |
| ----- | ------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------- | ------ |
| CC1.1 | Board-approved code of conduct and information security policy, reviewed annually                             | CEO / People      | Signed policy PDF, board-meeting minutes                | `[ ]`  |
| CC1.2 | Org chart with segregation-of-duties matrix (no engineer may both deploy production and approve their own PR) | Eng Management    | Confluence org chart, branch protection rules on `main` | `[x]`  |
| CC1.3 | Background check policy for all employees and long-term contractors                                           | People            | Signed policy, check vendor contract                    | `[ ]`  |
| CC1.4 | Annual employee attestation of policy acknowledgement                                                         | People            | Signed attestations in HRIS                             | `[ ]`  |
| CC1.5 | Security training on hire and annually thereafter, with completion tracked                                    | People / Security | LMS completion report                                   | `[~]`  |

## CC2 — Communication and Information

| #     | Control                                                                      | Owner         | Artifact                     | Status |
| ----- | ---------------------------------------------------------------------------- | ------------- | ---------------------------- | ------ |
| CC2.1 | Internal runbook index kept current (on-call, incident, customer escalation) | Eng           | `runbooks/` in internal repo | `[x]`  |
| CC2.2 | Customer-facing status page with subscription and incident history           | Eng           | status.fathom.example.com    | `[ ]`  |
| CC2.3 | External communication policy — who speaks to customers during incidents     | Eng / Support | Policy doc                   | `[~]`  |
| CC2.4 | Whistleblower / anonymous-reporting channel with published email alias       | People        | Policy doc + mailbox         | `[ ]`  |

## CC3 — Risk Assessment

| #     | Control                                                                         | Owner    | Artifact                                       | Status |
| ----- | ------------------------------------------------------------------------------- | -------- | ---------------------------------------------- | ------ |
| CC3.1 | Annual risk assessment covering confidentiality, integrity, availability, fraud | Security | Risk register                                  | `[~]`  |
| CC3.2 | Threat model for every new major feature before GA                              | Eng      | Threat-model docs in feature folder            | `[~]`  |
| CC3.3 | Vendor risk register with annual review of each sub-processor                   | Security | `vendors.md` + evidence of SOC 2 / DPA on file | `[ ]`  |

## CC4 — Monitoring Activities

| #     | Control                                                                                | Owner    | Artifact                              | Status |
| ----- | -------------------------------------------------------------------------------------- | -------- | ------------------------------------- | ------ |
| CC4.1 | Continuous monitoring of production logs with alerting on error / latency SLO breaches | SRE      | Alert config + incident history       | `[x]`  |
| CC4.2 | Quarterly access review: every role, every user, every integration, signed off         | Security | Access review ticket per quarter      | `[ ]`  |
| CC4.3 | Automated scanning for leaked secrets in Git history                                   | Eng      | gitleaks / trufflehog CI job output   | `[~]`  |
| CC4.4 | SAST on every PR; failed scans block merge                                             | Eng      | CI configuration, blocked-PR examples | `[~]`  |

## CC5 — Control Activities

| #     | Control                                                                          | Owner | Artifact                            | Status |
| ----- | -------------------------------------------------------------------------------- | ----- | ----------------------------------- | ------ |
| CC5.1 | Documented change-management policy: branch protection, required review, CI gate | Eng   | Policy doc + GitHub branch rules    | `[x]`  |
| CC5.2 | Production deploy requires CI green + at least one approver + traceable to a PR  | Eng   | Deploy logs                         | `[x]`  |
| CC5.3 | Emergency-change procedure with post-hoc review within 24h                       | Eng   | Policy doc + sample review          | `[~]`  |
| CC5.4 | Automated database migration history with rollback plan                          | Eng   | Migration files + rollback runbooks | `[x]`  |

## CC6 — Logical and Physical Access Controls

| #     | Control                                                                          | Owner           | Artifact                                                   | Status |
| ----- | -------------------------------------------------------------------------------- | --------------- | ---------------------------------------------------------- | ------ |
| CC6.1 | SSO (SAML 2.0) supported for customer tenants; enforced for all internal systems | Eng             | FATHOM SAML settings UI, IdP screenshots                   | `[x]`  |
| CC6.2 | MFA enforced for every employee on every system that holds customer data         | Security        | IdP enforcement policy                                     | `[x]`  |
| CC6.3 | Role-based access control (RBAC) with least-privilege role assignment            | Eng             | `RBAC_CONFIGURATION.md`, role matrix                       | `[x]`  |
| CC6.4 | SCIM 2.0 provisioning so tenants can automate user lifecycle                     | Eng             | `backend/enterprise/scim/` + Okta / Entra integration docs | `[x]`  |
| CC6.5 | IP allowlisting per tenant for the admin surface                                 | Eng             | `backend/enterprise/ipWhitelist`                           | `[x]`  |
| CC6.6 | Password policy: minimum length, complexity, rotation, reuse prevention          | Security        | IdP policy + product-side validation                       | `[~]`  |
| CC6.7 | Termination procedure revokes access within 1 business day, logged               | People / IT     | Termination ticket template                                | `[~]`  |
| CC6.8 | Physical access (office, servers) controlled via badges with logs retained ≥ 90d | Facilities / IT | Badge log export                                           | `[~]`  |

## CC7 — System Operations

| #     | Control                                                                        | Owner    | Artifact                              | Status |
| ----- | ------------------------------------------------------------------------------ | -------- | ------------------------------------- | ------ |
| CC7.1 | 24×7 monitoring of production with on-call rotation                            | SRE      | On-call schedule, incident acks       | `[x]`  |
| CC7.2 | Formal incident-response runbook: detect → triage → mitigate → postmortem      | SRE      | `runbooks/incident-response.md`       | `[~]`  |
| CC7.3 | Every incident has a retrospective within 5 business days with action items    | SRE      | Postmortem docs + action tracker      | `[~]`  |
| CC7.4 | Automated database backups, tested restore at least quarterly                  | SRE      | Backup schedule + restore test report | `[ ]`  |
| CC7.5 | Disaster recovery plan with documented RTO and RPO, tested annually            | SRE      | DR plan + drill report                | `[ ]`  |
| CC7.6 | Vulnerability management: critical CVEs patched within 30 days, high within 60 | Security | CVE scan reports + remediation log    | `[~]`  |

## CC8 — Change Management

| #     | Control                                                                           | Owner | Artifact                           | Status |
| ----- | --------------------------------------------------------------------------------- | ----- | ---------------------------------- | ------ |
| CC8.1 | All production changes go through PR review + CI; direct pushes to `main` blocked | Eng   | GitHub branch-protection settings  | `[x]`  |
| CC8.2 | Database migrations reviewed by DBA / Eng lead before merge                       | Eng   | PR history + reviewer assignments  | `[x]`  |
| CC8.3 | Feature-flag changes in production logged with actor, timestamp, old/new value    | Eng   | Audit log export                   | `[~]`  |
| CC8.4 | Infrastructure-as-code for all prod resources (no click-ops in the cloud console) | SRE   | IaC repo + drift-detection reports | `[~]`  |

## CC9 — Risk Mitigation

| #     | Control                                                              | Owner           | Artifact                    | Status |
| ----- | -------------------------------------------------------------------- | --------------- | --------------------------- | ------ |
| CC9.1 | Cyber-liability insurance policy sized to worst-case breach scenario | Legal / Finance | Policy PDF                  | `[ ]`  |
| CC9.2 | Business continuity plan with named successor for each critical role | CEO             | BCP doc                     | `[ ]`  |
| CC9.3 | Vendor security review completed before onboarding any sub-processor | Security        | Review checklist per vendor | `[~]`  |

---

## A1 — Availability (in scope)

| #    | Control                                                                         | Owner | Artifact                     | Status |
| ---- | ------------------------------------------------------------------------------- | ----- | ---------------------------- | ------ |
| A1.1 | Published uptime SLO per plan tier, measured against a third-party probe        | SRE   | SLO dashboard + probe config | `[~]`  |
| A1.2 | Capacity planning reviewed quarterly based on tenant growth forecast            | SRE   | Quarterly capacity memo      | `[~]`  |
| A1.3 | Automatic horizontal scaling on the data plane; load-tested to 3× expected peak | SRE   | Load-test report             | `[ ]`  |
| A1.4 | Database replication with at least one warm standby in a different AZ           | SRE   | Replication topology diagram | `[x]`  |

## C1 — Confidentiality (in scope)

| #    | Control                                                                            | Owner    | Artifact                              | Status |
| ---- | ---------------------------------------------------------------------------------- | -------- | ------------------------------------- | ------ |
| C1.1 | Encryption at rest for every production data store (AES-256 or equivalent)         | SRE      | Cloud KMS screenshots, storage config | `[x]`  |
| C1.2 | Encryption in transit: TLS 1.2+ enforced on every public endpoint                  | Eng      | TLS scan report (SSL Labs grade ≥ A)  | `[x]`  |
| C1.3 | Customer data segregated by `tenantId` at the query level with automated tests     | Eng      | Tenant-isolation test suite           | `[x]`  |
| C1.4 | Data classification policy: PII / secrets / general / public, with handling rules  | Security | Policy doc                            | `[~]`  |
| C1.5 | Secrets managed in a dedicated secret store (not environment files in prod)        | SRE      | Secret-manager config                 | `[x]`  |
| C1.6 | Tamper-evident audit log: append-only, cryptographically chained, 1-year retention | Eng      | Audit log sample + integrity verifier | `[~]`  |
| C1.7 | Customer-data export / deletion workflow, SLA ≤ 30 days                            | Eng      | Runbook + sample ticket               | `[~]`  |

## PI1 / P1–P8 — Processing Integrity / Privacy

**Out of scope for the first engagement.** Reassess for Year 2, particularly if expansion into healthcare or government verticals is on the roadmap.

---

## Product-side controls mapped to source

The following product controls are the ones most often audited in interview form. The file paths below point to where the implementation lives.

| Control                                        | Criterion               | Code / Doc location                                                                     |
| ---------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------- |
| SSO via SAML 2.0                               | CC6.1                   | `backend/enterprise/samlSso/`                                                           |
| SCIM 2.0 provisioning                          | CC6.4                   | `backend/enterprise/scim/`                                                              |
| IP allowlisting                                | CC6.5                   | `backend/enterprise/ipWhitelist/`                                                       |
| RBAC with least-privilege defaults             | CC6.3                   | `RBAC_CONFIGURATION.md` and role checks in `backend/middleware/`                        |
| Multi-tenancy isolation                        | C1.3                    | `tenantId` guards in every storage method; `tests/scimService.test.js` covers isolation |
| Audit log                                      | C1.6, CC4.2             | `backend/services/auditLog*`                                                            |
| Signed webhook notifications                   | CC5 (integrity)         | `backend/services/notifiers/webhookNotifier.js` (HMAC-SHA256 + timestamp)               |
| Alert dedupe + retry                           | CC7.1                   | `backend/services/notifiers/notifierManager.js`                                         |
| Trace-to-query correlation                     | CC4.1 (investigability) | `backend/services/trace/`, `backend/routes/traceRoutes.js`                              |
| Anomaly detection in "suggest" mode by default | CC4.1                   | `backend/services/anomaly/`, default mode per roadmap R3                                |

---

## Pre-audit readiness punch list

The items below are the ones most likely to delay a SOC 2 Type II report if not closed before the observation window opens. They are ordered by leverage — completing them early pays off across the whole audit.

1. **Change-management policy.** Write it down. Branch protection already enforces most of it; the policy document just needs to be authored, signed, and filed.
2. **Vendor risk register.** Enumerate every sub-processor, obtain each one's SOC 2 report (or equivalent), store the DPA. Auditors will ask for this on day 1.
3. **Access-review cadence.** Schedule quarterly access reviews now so that at least one cycle falls within the observation window. Each review produces a signed Jira ticket.
4. **Incident-response runbook.** Expand the partial runbook into a complete document covering detection, triage, communication, remediation, and postmortem, with sample incidents walked through end-to-end.
5. **Encryption-at-rest verification.** Capture the cloud-console screenshots that show AES-256 enabled on every production data store. Auditors will not accept "it's on by default" — they want the evidence.
6. **Tamper-evident audit log.** Ship the cryptographic-chain verification and retention enforcement. This is the single most visible product-side C1 control and directly backs multiple CC6 controls as well.
7. **Backup and restore drill.** Run at least one full restore test during the observation window and document the outcome.
8. **Background check policy.** Required for CC1.3; easiest to set up is a vendor contract with Checkr or similar and backfill for existing staff.
9. **Board-approved information security policy.** Draft, present at the next board meeting, capture minutes.
10. **Cyber-liability insurance.** Bind the policy before the observation window closes; auditors look for effective-dated coverage across the entire window.

---

## Observation-window entry criteria

The observation window should not begin until:

- every control marked `[x]` above has produced at least one month of passing evidence,
- every `[~]` has been promoted to `[x]` or has a dated plan with owner assignment,
- every `[ ]` has a dated plan with owner assignment even if implementation is not yet complete — the auditor will want to see the work in progress rather than a cold silence.

---

_This checklist is a living document. Update it whenever a control's status changes, and review it at the beginning of every quarter._
