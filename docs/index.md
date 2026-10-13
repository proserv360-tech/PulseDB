---
title: FATHOM Documentation
---

# FATHOM Documentation

Multi-engine database monitoring and administration platform.

## Getting started

- [README](https://github.com/your-org/postgres-tool#readme) — project overview and quick start
- [Collector agent](../collector/README.md) — install the host agent (Postgres, MySQL, MongoDB)
- [Backend architecture](../backend/docs/ARCHITECTURE.md)

## Platform guides

- [Frontend data layer (TanStack Query)](FRONTEND_DATA_LAYER.md)
- [TypeScript migration & burn-down](TS_MIGRATION.md)
- [Scalability](scalability.md)
- [Phase 2 notes](PHASE_2.md) · [Phase 3/4 notes](PHASE_3_4.md)

## Feature deep-dives (backend/docs)

- [Index Advisor](../backend/docs/INDEX_ADVISOR.md)
- [Query Workbench](../backend/docs/QUERY_WORKBENCH.md)
- [Audit Export](../backend/docs/AUDIT_EXPORT.md)
- [Bloat Watcher](../backend/docs/BLOAT_WATCHER.md)
- [Integrations](../backend/docs/INTEGRATIONS.md)
- [Copilot Retention](../backend/docs/COPILOT_RETENTION.md)
- [Migration Notes](../backend/docs/MIGRATION_NOTES.md)

## June 2026 gap-sprint features

- Autonomous agent loop — `GET /api/agent/findings`, sweep on every monitoring cron tick
- Continuous query advisor — `GET /api/query-advisor/recommendations`, rewrite benchmark endpoint
- Schema drift timeline — `GET /api/schema/track/timeline`
- What-if index analysis — `POST /api/advisor/what-if` (HypoPG-aware)
- Backup orchestration — schedules + pg_dump/mysqldump/mongodump executors (`FATHOM_BACKUPS_ENABLED=1`)
- Top queries by load — `GET /api/agent/top-queries` over collector snapshots

## Operations

- [Runbooks](runbooks/) · [Compliance](compliance/) · [Reports](reports/)
