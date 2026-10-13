# FATHOM — TypeScript Migration Setup Guide

## Quick Start

Run these commands from the project root to install everything:

```bash
# 1. Install all dependencies (root + all workspaces)
npm install

# 2. Verify type checking works
npm run type-check

# 3. Run tests
npm test

# 4. Start development
cd frontend && npm run dev    # Frontend on :5173
cd backend && npm run dev:js  # Backend on :5000 (JS mode)
cd backend && npm run dev     # Backend on :5000 (TS mode via tsx)
```

## What Was Added

### New Packages to Install

**Root (monorepo tooling):**

- `husky` — Git hooks
- `lint-staged` — Run linters on staged files

**Frontend:**

- `typescript` — TypeScript compiler
- `@typescript-eslint/parser` + `@typescript-eslint/eslint-plugin` — ESLint TS support
- `zod` — Runtime validation + type inference

**Backend:**

- `typescript` + `tsx` — TypeScript compiler + zero-config runner
- `@types/express`, `@types/pg`, `@types/jsonwebtoken`, `@types/bcryptjs`, `@types/ws`, `@types/node-cron`, `@types/uuid`, `@types/nodemailer`, `@types/node`, `@types/cors`
- `zod` — Runtime validation + type inference
- `helmet` — Security headers (typed)

**Shared packages (new):**

- `@fathom/types` — Shared TypeScript interfaces
- `@fathom/validators` — Shared Zod schemas

### New Files Created

```
shared/
  types/
    index.ts          ← Re-exports all types
    auth.ts           ← User, Session, JWT, ApiKey types
    connection.ts     ← Connection, Health, Fleet types
    database.ts       ← Schema, Query, Chart types
    alert.ts          ← Alert, AlertRule types
    monitoring.ts     ← Pool, Replication, Observability types
    api.ts            ← ApiResponse, WsMessage, RequestOptions
    config.ts         ← TabConfig, Theme, ServerConfig types
    tsconfig.json
    package.json
  validators/
    index.ts          ← All Zod schemas (Login, CreateUser, CreateConnection, etc.)
    tsconfig.json
    package.json

frontend/
  tsconfig.json       ← allowJs: true, strict, paths to shared types
  vite-env.d.ts       ← Typed import.meta.env
  src/utils/api.ts    ← Typed API client (drop-in for api.js)

backend/
  tsconfig.json       ← allowJs: true, strict, NodeNext modules
  middleware/
    authenticate.ts   ← Typed auth middleware
  db/
    schema.ts         ← Drizzle ORM schema (single source of truth)
  drizzle.config.ts   ← Drizzle Kit migration config

turbo.json            ← Turborepo task orchestration
.husky/pre-commit     ← lint-staged on commit
.github/workflows/ci.yml ← Updated with type-check job
```

### Updated Files

- `package.json` (root) — Added workspaces for `shared/*`, husky, lint-staged
- `frontend/package.json` — Added typescript, zod, type-check script
- `backend/package.json` — Added typescript, tsx, all @types, helmet, zod, drizzle
- `frontend/vite.config.js` — Added path aliases for `@fathom/types` and `@fathom/validators`
- `.github/workflows/ci.yml` — Added TypeScript type-check job, updated Node to 22

## How to Use Types

### Frontend — Typed API Calls

```typescript
import { fetchData } from '@/utils/api';
import type { Connection, Alert } from '@fathom/types';

// Generic typed response — autocomplete works!
const connections = await fetchData<Connection[]>('/api/connections');
connections[0].host; // ✅ autocomplete
connections[0].hst; // ❌ compile error

const alerts = await fetchData<Alert[]>('/api/alerts/recent');
alerts[0].severity; // ✅ "critical" | "warning" | "info"
```

### Backend — Zod Request Validation

```typescript
import { CreateConnectionSchema } from '@fathom/validators';

app.post('/api/connections', authenticate, (req, res) => {
    const result = CreateConnectionSchema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({ error: result.error.flatten() });
    }
    // result.data is fully typed — no casting needed
    const { name, host, port, username, password } = result.data;
});
```

### Drizzle ORM — Type-Safe Queries

```typescript
import { db } from './db/client';
import { users, connections } from './db/schema';
import { eq } from 'drizzle-orm';

// Type-safe select
const activeUsers = await db.select().from(users).where(eq(users.status, 'active'));

// Type-safe insert
await db.insert(connections).values({
    name: 'Production',
    host: 'db.example.com',
    port: 5432,
    // TypeScript catches missing required fields
});
```

## Incremental Migration Path

The setup uses `allowJs: true` so all existing `.js`/`.jsx` files continue working unchanged. Convert files one at a time:

1. **Rename** `file.js` → `file.ts` (or `.jsx` → `.tsx`)
2. **Add types** to function parameters and return values
3. **Import** from `@fathom/types` for shared interfaces
4. **Run** `npm run type-check` to verify

Priority conversion order:

1. `api.ts` ✅ (already converted)
2. `authenticate.ts` ✅ (already converted)
3. Route files (`routes/*.js` → `routes/*.ts`)
4. Service files (`services/*.js` → `services/*.ts`)
5. React components (`.jsx` → `.tsx`)

## Adding Drizzle ORM (Optional)

To switch from raw SQL to Drizzle:

```bash
cd backend
npm install drizzle-orm
npm install -D drizzle-kit

# Generate migrations from schema.ts
npx drizzle-kit generate

# Push schema to database
npx drizzle-kit push
```

## Adding Turborepo (Optional)

For faster builds with caching:

```bash
npm install -g turbo

# Build all packages in dependency order with caching
turbo build

# Type-check everything in parallel
turbo type-check

# Run all tests
turbo test
```
