#!/usr/bin/env node
/**
 * Migration review gate.
 *
 * Static checks for Drizzle SQL migrations under backend/db/migrations.
 * Run locally with `node scripts/review-migrations.mjs` or in CI on PRs that
 * touch migration files. Exits non-zero if any hard check fails; prints
 * warnings for softer issues without failing.
 *
 * Checks:
 *  1. Filenames follow the NNNN_name.sql convention.
 *  2. Numeric prefixes are unique (no two migrations share an index).
 *  3. Every migration file has an entry in meta/_journal.json (and vice-versa).
 *  4. Destructive statements (DROP TABLE / DROP COLUMN / TRUNCATE / DELETE
 *     without WHERE) are flagged for explicit reviewer attention.
 *  5. CREATE TABLE uses IF NOT EXISTS (idempotency) -- warning only.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const migDir = join(root, 'backend', 'db', 'migrations')
const journalPath = join(migDir, 'meta', '_journal.json')

const errors = []
const warnings = []

if (!existsSync(migDir)) {
  console.error(`No migrations directory at ${migDir}`)
  process.exit(1)
}

const files = readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()

// 1 + 2: filename convention + unique numeric prefix
const seenIdx = new Map()
const namePattern = /^(\d{4})_[a-z0-9_]+\.sql$/
for (const f of files) {
  const m = f.match(namePattern)
  if (!m) {
    errors.push(`Bad filename: "${f}" (expected NNNN_snake_name.sql)`)
    continue
  }
  const idx = m[1]
  if (seenIdx.has(idx)) {
    errors.push(`Duplicate migration index ${idx}: "${f}" and "${seenIdx.get(idx)}"`)
  } else {
    seenIdx.set(idx, f)
  }
}

// 3: journal sync
if (!existsSync(journalPath)) {
  errors.push('meta/_journal.json is missing')
} else {
  const journal = JSON.parse(readFileSync(journalPath, 'utf8'))
  const journalTags = new Set((journal.entries || []).map((e) => e.tag))
  const fileTags = files.map((f) => f.replace(/\.sql$/, ''))
  for (const tag of fileTags) {
    if (!journalTags.has(tag)) {
      warnings.push(`Migration "${tag}.sql" has no entry in meta/_journal.json (run drizzle-kit to regenerate the journal).`)
    }
  }
  for (const tag of journalTags) {
    if (!fileTags.includes(tag)) {
      warnings.push(`Journal references "${tag}" but no matching .sql file exists.`)
    }
  }
}

// 4 + 5: per-file SQL safety
const destructive = [
  { re: /\bDROP\s+TABLE\b/i, label: 'DROP TABLE' },
  { re: /\bDROP\s+COLUMN\b/i, label: 'DROP COLUMN' },
  { re: /\bTRUNCATE\b/i, label: 'TRUNCATE' },
  { re: /\bDELETE\s+FROM\b(?![\s\S]*\bWHERE\b)/i, label: 'DELETE without WHERE' },
]
for (const f of files) {
  const sql = readFileSync(join(migDir, f), 'utf8')
  for (const d of destructive) {
    if (d.re.test(sql)) {
      warnings.push(`${f}: contains ${d.label} -- confirm this is intended and reversible.`)
    }
  }
  if (/\bCREATE\s+TABLE\b/i.test(sql) && !/\bCREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\b/i.test(sql)) {
    warnings.push(`${f}: CREATE TABLE without IF NOT EXISTS -- prefer idempotent DDL.`)
  }
}

// Report
if (warnings.length) {
  console.log('\nMigration review warnings:')
  for (const w of warnings) console.log(`  ! ${w}`)
}
if (errors.length) {
  console.log('\nMigration review errors:')
  for (const e of errors) console.log(`  x ${e}`)
  console.log(`\nFAILED: ${errors.length} error(s), ${warnings.length} warning(s).`)
  process.exit(1)
}
console.log(`\nMigration review passed (${files.length} migrations, ${warnings.length} warning(s)).`)
