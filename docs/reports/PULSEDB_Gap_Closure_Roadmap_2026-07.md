# PulseDB — Closing the Competitive Gaps: What's Buildable vs Not

Date: 2026-07-02
Context: turning the five "where PulseDB trails" items into an honest, actionable plan. These are not one-shot code tasks — they split into organizational work, multi-week engineering, and things the codebase already partly has.

---

## Category A — NOT code (organizational / time-based). Cannot be "implemented" in software.

| Gap                                                                           | Why it isn't code                                                                                                                                                       | What actually closes it                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Maturity & scale** ("years of production hardening")                        | Maturity is accrued from real production load, incident cycles, and time — not a feature.                                                                               | Ship to real users, run load/chaos testing, track MTTR, keep a public changelog + status history. The _concrete near-term slice_ (fix audited dependency vulns, get a clean build) is done/queued.                                       |
| **SOC 2 certification + SLAs**                                                | SOC 2 is an external audit engagement (Type I then Type II over 3–12 months) with an accredited auditor collecting evidence. SLAs are contractual/staffing commitments. | Engage an auditor (Vanta/Drata/Secureframe accelerate evidence). PulseDB already has the controls scaffolding — `docs/reports/PULSEDB_SOC2_Controls_Checklist.md`, RBAC, SSO/SCIM, audit-log export. This is a business project, not a PR. |
| **Ecosystem gravity** (Datadog-style infra + logs + RUM + APM all correlated) | A full-stack observability suite is a multi-year, multi-team product.                                                                                                   | Don't chase parity. Stay the _database_ pane of glass and integrate outward — OTLP export to Datadog/Grafana, a Grafana data source, webhooks. PulseDB already ingests OTLP (`otelService.ts`); make it bi-directional.                   |

Verdict for Category A: these are roadmap/business items. The only session-actionable piece — dependency hardening + clean build — is already handled (see the code audit report); the rest need people, time, and money, not a commit.

---

## Category B — Buildable engineering (each a real, multi-week feature; foundations already exist)

The codebase already ships partial implementations — the work is deepening them, and each needs a full build + test cycle that this environment can't run:

### B-1 Deeper per-engine analysis (matches pganalyze / SolarWinds depth)

- Foundation: `autoExplainService.ts` (150 lines), `bloatWatcher.ts`, `indexAdvisor.ts`, collector `pulsedb-autoexplain-shipper.mjs`.
- Build: (1) auto_explain **Log Insights** — ingest `auto_explain` output, aggregate plans per normalized query, flag plan regressions over time; (2) a **tuned VACUUM advisor** — model dead-tuple growth rate + autovacuum thresholds to predict when bloat will bite, not just report current bloat; (3) wait-event → query attribution depth.
- Effort: ~2–4 weeks. Testable against a seeded Postgres.

### B-2 Mature backup / restore / PITR (matches Percona PMM)

- Foundation: `backupService.ts` (81), `backupExecutor.ts` (247), migrations `0015_backups.sql`.
- Build: WAL archiving orchestration, scheduled base backups, **point-in-time recovery** (restore to a timestamp), backup verification/restore drills, retention policy per target. Engine-specific: `pg_basebackup`/WAL for PG, `mysqldump`/xtrabackup for MySQL, `mongodump`/PITR for Mongo.
- Effort: ~3–5 weeks. Requires real storage (S3) + restore testing — high blast radius, needs careful QA.

### B-3 Long historical retention + rollups (matches incumbents' retention)

- Foundation: `retentionService.ts` (300), `queryStatsRollup.ts` (83), `0020_otel_metrics.sql`.
- Build: continuous-aggregate rollups (raw → 1m → 1h → 1d), tiered retention (e.g. 7d raw / 90d hourly / 2y daily), optional TimescaleDB hypertables, downsampling on ingest. This is the most self-contained and highest-leverage code item.
- Effort: ~1–2 weeks. Cleanly testable.

---

## Recommended sequence

1. **Now (done/queued):** dependency + build hardening from the code audit — the one concrete slice of "maturity."
2. **Next, if you want code built here:** B-3 (retention + rollups) — smallest, self-contained, testable, directly answers "long historical retention."
3. **Then:** B-1 (per-engine depth) — the clearest competitive differentiator vs pganalyze.
4. **Later, with QA capacity:** B-2 (PITR) — highest value but highest risk; needs real storage + restore drills.
5. **Parallel (business track):** start SOC 2 evidence collection; keep the DB-pane focus and integrate outward instead of building a full observability suite.

---

## Honest note

I did not write code for these in this pass because: (a) SOC 2, "years of hardening," SLAs, and a full observability platform are not software; and (b) the buildable items (B-1/B-2/B-3) are each multi-week features that need a real build + test loop — which this environment can't run reliably (the mount truncated large files repeatedly this session). Shipping a half-built, untested backup/PITR path would be worse than not shipping it.

Pick one of B-1 / B-2 / B-3 and I'll implement it properly, in a scoped way, with tests — rather than gesture at all five.
