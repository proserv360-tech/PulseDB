# FATHOM — Full Tech Stack with TypeScript

## Current Stack vs Recommended TypeScript Stack

---

## 1. Frontend

| Layer            | Current                            | TypeScript Upgrade                                           |
| ---------------- | ---------------------------------- | ------------------------------------------------------------ |
| Language         | JavaScript (ES2022)                | **TypeScript 5.x**                                           |
| Framework        | React 19.2 (.jsx)                  | React 19.2 (**.tsx**)                                        |
| Build Tool       | Vite 7.1                           | Vite 7.1 (native TS support)                                 |
| Routing          | React Router 7.13                  | React Router 7.13 (has built-in types)                       |
| State Management | React Context + useState           | **Zustand** (TS-first) or React Context with typed hooks     |
| Charts           | Recharts 3.7                       | Recharts 3.7 (has @types)                                    |
| Code Editor      | CodeMirror 6 (react-codemirror)    | CodeMirror 6 (written in TS natively)                        |
| Icons            | Lucide React 0.563                 | Lucide React (written in TS natively)                        |
| Date Utilities   | date-fns 4.1                       | date-fns 4.1 (written in TS natively)                        |
| Styling          | 8,300+ inline styles               | **Tailwind CSS 4** or **CSS Modules** with typed class names |
| Forms            | Manual state management            | **React Hook Form** + **Zod** (type-safe validation)         |
| HTTP Client      | Custom fetch wrapper (api.js)      | **Custom typed wrapper** or **ky** (TS-native fetch wrapper) |
| Testing          | Vitest (configured, minimal tests) | **Vitest** + **React Testing Library** + **MSW** (mock API)  |
| Linting          | ESLint 9                           | ESLint 9 + **typescript-eslint**                             |
| Type Checking    | None                               | **tsc --noEmit** in CI pipeline                              |

---

## 2. Backend

| Layer             | Current                           | TypeScript Upgrade                                                           |
| ----------------- | --------------------------------- | ---------------------------------------------------------------------------- |
| Language          | JavaScript (ES Modules)           | **TypeScript 5.x** via **tsx** runner                                        |
| Runtime           | Node.js 22                        | Node.js 22 (use **tsx** or **--experimental-strip-types**)                   |
| Framework         | Express 5.2                       | Express 5.2 + **@types/express** (or migrate to **Hono** / **Fastify**)      |
| Database Driver   | pg 8.18                           | pg 8.18 + **@types/pg** (or **Drizzle ORM** for type-safe queries)           |
| Authentication    | jsonwebtoken + bcryptjs           | jsonwebtoken + bcryptjs (both have @types)                                   |
| Validation        | Manual checks                     | **Zod** (runtime + compile-time type safety)                                 |
| WebSockets        | ws 8.19                           | ws 8.19 + **@types/ws**                                                      |
| Email             | Nodemailer 8.0                    | Nodemailer 8.0 (has built-in types)                                          |
| Scheduling        | node-cron 4.2                     | node-cron 4.2 + **@types/node-cron**                                         |
| AWS               | @aws-sdk/client-cloudwatch 3.x    | AWS SDK v3 (written in TS natively)                                          |
| Security          | Custom securityHeaders middleware | **helmet** + custom middleware (both typed)                                  |
| Error Handling    | Centralized error middleware      | **Typed error classes** with discriminated unions                            |
| Testing           | Node built-in test runner         | **Vitest** (same as frontend, shared config)                                 |
| API Documentation | None                              | **Swagger/OpenAPI** via **zod-to-openapi** (auto-generated from Zod schemas) |

---

## 3. Shared / Monorepo

| Layer        | Current                                  | TypeScript Upgrade                                 |
| ------------ | ---------------------------------------- | -------------------------------------------------- |
| Monorepo     | npm workspaces                           | **Turborepo** + npm workspaces                     |
| Shared Types | None (duplicated shapes)                 | **@fathom/types** shared package                   |
| API Contract | Implicit (hope frontend matches backend) | **tRPC** or **Zod schemas** shared between FE & BE |
| Environment  | .env + dotenv                            | **@t3-oss/env-nextjs** pattern with Zod validation |
| Git Hooks    | None                                     | **Husky** + **lint-staged** (type-check on commit) |

---

## 4. Database

| Layer         | Current                                    | Recommended                                             |
| ------------- | ------------------------------------------ | ------------------------------------------------------- |
| Primary DB    | Neon PostgreSQL (free tier, AWS Singapore) | Neon PostgreSQL (same — already excellent)              |
| Connection    | Raw pg.Pool with manual SQL                | **Drizzle ORM** (type-safe SQL, zero runtime overhead)  |
| Migrations    | Manual SQL / ad-hoc                        | **Drizzle Kit** migrations (auto-generated from schema) |
| Query Builder | String templates                           | Drizzle's **typed select/insert/update/delete**         |
| Schema        | Implicit (no schema file)                  | **Drizzle schema.ts** (single source of truth)          |

---

## 5. DevOps & Deployment

| Layer        | Current                    | Recommended                                                   |
| ------------ | -------------------------- | ------------------------------------------------------------- |
| Hosting (FE) | Vercel                     | Vercel (same)                                                 |
| Hosting (BE) | Vercel Serverless          | Vercel Serverless (same) or **Railway** for persistent server |
| CI/CD        | None visible               | **GitHub Actions** (type-check, lint, test, build)            |
| Monitoring   | Custom (built into FATHOM) | Custom + **Sentry** for error tracking                        |
| Logging      | Custom JSON logger         | **Pino** (typed, fast, structured JSON)                       |
| Container    | None                       | **Docker** + **docker-compose** for local dev                 |

---

## 6. Recommended Migration Priority

### Phase 1 — Foundation (Week 1-2)

- Add `tsconfig.json` to frontend and backend with `allowJs: true`
- Create `@fathom/types` shared package with core interfaces
- Install TypeScript, `tsx`, and all `@types/*` packages
- Add type-check script to CI: `tsc --noEmit`

### Phase 2 — Critical Path (Week 3-4)

- Convert `api.js` → `api.ts` (typed request/response)
- Convert `server.js` middleware and auth → TypeScript
- Add Zod validation schemas for all API endpoints
- Convert shared components (ErrorBoundary, ConnectionSwitcher)

### Phase 3 — Data Layer (Week 5-6)

- Add Drizzle ORM with typed schema definitions
- Replace raw SQL strings with Drizzle query builder
- Auto-generate database migrations from schema changes
- Type all database service files

### Phase 4 — Full Coverage (Week 7-8)

- Convert remaining 50+ React components (.jsx → .tsx)
- Replace inline styles with Tailwind CSS
- Add React Testing Library tests for critical flows
- Enable `strict: true` in tsconfig

---

## 7. Key TypeScript Packages to Add

### Frontend

```
typescript
@types/react @types/react-dom
@typescript-eslint/parser @typescript-eslint/eslint-plugin
zod (runtime validation)
zustand (state management, TS-first)
react-hook-form @hookform/resolvers (typed forms)
tailwindcss @tailwindcss/vite (replace inline styles)
msw (API mocking for tests)
```

### Backend

```
typescript
tsx (zero-config TS runner for Node)
@types/express @types/pg @types/jsonwebtoken
@types/bcryptjs @types/ws @types/node-cron @types/uuid
zod (request/response validation)
drizzle-orm drizzle-kit (typed database)
pino (typed structured logging)
helmet (security headers)
```

### Shared

```
turborepo (monorepo build orchestration)
husky lint-staged (pre-commit hooks)
```

---

## 8. Example: What Type Safety Looks Like

### Before (Current JavaScript)

```javascript
// No guarantee what shape `data` has
const data = await fetchData('/api/connections');
// Runtime crash if data.connections doesn't exist
data.connections.forEach((c) => console.log(c.name));
```

### After (TypeScript)

```typescript
// Shared type used by both frontend AND backend
interface Connection {
    id: number;
    name: string;
    host: string;
    port: number;
    db_name: string;
    ssl: boolean;
    isDefault: boolean;
}

interface ConnectionsResponse {
    connections: Connection[];
    total: number;
}

// Compiler catches errors at write-time
const data = await fetchData<ConnectionsResponse>('/api/connections');
data.connections.forEach((c) => console.log(c.name)); // ✅ Autocomplete works
data.conections.forEach((c) => {}); // ❌ Compile error: typo caught instantly
```

### API Layer Example

```typescript
// Zod schema = runtime validation + TypeScript type in one definition
import { z } from 'zod';

const CreateConnectionSchema = z.object({
    name: z.string().min(1).max(100),
    host: z.string().min(1),
    port: z.number().int().min(1).max(65535).default(5432),
    db_name: z.string().default('postgres'),
    username: z.string().min(1),
    password: z.string().min(1),
    ssl: z.boolean().default(true),
});

// Type is automatically inferred — no duplication
type CreateConnectionInput = z.infer<typeof CreateConnectionSchema>;

// Express route with validation
app.post('/api/connections', authenticate, (req, res) => {
    const result = CreateConnectionSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ error: result.error });
    // result.data is fully typed — autocomplete for .name, .host, .port, etc.
    createConnection(result.data);
});
```
