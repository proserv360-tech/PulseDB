import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Build DATABASE_URL from individual PG* env vars if DATABASE_URL isn't set.
// This lets Prisma work with the existing .env without any changes.
function buildDatabaseUrl(): string {
    if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
    const host = process.env.PGHOST ?? 'localhost';
    const port = process.env.PGPORT ?? '5432';
    const db = process.env.PGDATABASE ?? 'postgres';
    const user = process.env.PGUSER ?? 'postgres';
    const pass = process.env.PGPASSWORD ? encodeURIComponent(process.env.PGPASSWORD) : '';
    const ssl = process.env.DB_SSL === 'true' ? '?sslmode=require' : '';
    return `postgresql://${user}${pass ? `:${pass}` : ''}@${host}:${port}/${db}${ssl}`;
}

export default defineConfig({
    schema: 'prisma/schema.prisma',
    migrations: {
        path: 'prisma/migrations',
    },
    datasource: {
        url: buildDatabaseUrl(),
    },
});
