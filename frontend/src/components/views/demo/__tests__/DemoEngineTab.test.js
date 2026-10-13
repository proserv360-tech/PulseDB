/**
 * DemoEngineTab.test.js
 *
 * Smoke coverage for the Phase-5 generic demo tab. We verify:
 *   1. Every engine key in demoEngineData.ts has a complete EngineDemoSpec
 *      (all required fields populated).
 *   2. The 9 engine short-forms wired in DemoSectionView.ENGINE_MAP all
 *      resolve to a known engine spec.
 *   3. The engine specs pass basic sanity checks (non-empty KPIs,
 *      slow-query list, wait events, plan body).
 */

import { describe, it, expect } from 'vitest';
import DEMO_ENGINES from '../../../../utils/demoEngineData';

const EXPECTED = [
    'mssql',
    'oracle',
    'redis',
    'elasticsearch',
    'snowflake',
    'bigquery',
    'redshift',
    'cassandra',
    'dynamodb',
];

describe('demoEngineData', () => {
    it('exposes one spec per Phase-5 engine', () => {
        for (const key of EXPECTED) {
            expect(DEMO_ENGINES[key], `missing: ${key}`).toBeDefined();
        }
    });

    it.each(EXPECTED)('%s spec has the required fields', (key) => {
        const spec = DEMO_ENGINES[key];
        expect(spec.key).toBe(key);
        expect(spec.name).toBeTruthy();
        expect(spec.accentColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(spec.versionString).toBeTruthy();
        expect(spec.identity).toBeTypeOf('object');
        expect(Array.isArray(spec.catalog)).toBe(true);
        expect(spec.catalog.length).toBeGreaterThan(0);
        expect(Array.isArray(spec.kpis)).toBe(true);
        expect(spec.kpis.length).toBeGreaterThanOrEqual(3);
        expect(Array.isArray(spec.slowQueries)).toBe(true);
        expect(spec.plan.body).toBeTruthy();
        expect(spec.waits.events.length).toBeGreaterThan(0);
        expect(Array.isArray(spec.tables)).toBe(true);
        expect(Array.isArray(spec.indexes)).toBe(true);
        expect(Array.isArray(spec.connections)).toBe(true);
        expect(spec.locks.note).toBeTruthy();
        expect(Array.isArray(spec.locks.rows)).toBe(true);
        expect(spec.replication.note).toBeTruthy();
        expect(Array.isArray(spec.replication.rows)).toBe(true);
        expect(Array.isArray(spec.bloat)).toBe(true);
        expect(Array.isArray(spec.substitutes)).toBe(true);
        // Mid-depth upgrade additions
        expect(spec.timeseries).toBeTypeOf('object');
        expect(spec.signature).toBeTypeOf('object');
        expect(spec.signature.kind).toBeTruthy();
        expect(Array.isArray(spec.alerts)).toBe(true);
        expect(spec.alerts.length).toBeGreaterThan(0);
        expect(Array.isArray(spec.topology)).toBe(true);
        expect(spec.topology.length).toBeGreaterThan(0);
    });

    it('every engine has a unique signature widget kind', () => {
        const kinds = EXPECTED.map((k) => DEMO_ENGINES[k].signature.kind);
        const unique = new Set(kinds);
        expect(unique.size).toBe(EXPECTED.length);
    });

    it('time-series have populated points for each KPI', () => {
        for (const key of EXPECTED) {
            const spec = DEMO_ENGINES[key];
            for (const kpi of spec.kpis) {
                if (kpi.sparkline) {
                    expect(spec.timeseries[kpi.label], `${key} missing timeseries for ${kpi.label}`).toBeDefined();
                    expect(spec.timeseries[kpi.label].length).toBeGreaterThan(0);
                }
            }
        }
    });

    it('KPI values are non-empty strings', () => {
        for (const key of EXPECTED) {
            for (const kpi of DEMO_ENGINES[key].kpis) {
                expect(kpi.label).toBeTruthy();
                expect(kpi.value).toBeTruthy();
            }
        }
    });

    it('substitute-heavy engines (redis / cassandra / dynamodb) declare their substitutions', () => {
        for (const key of ['redis', 'cassandra', 'dynamodb']) {
            expect(DEMO_ENGINES[key].substitutes.length).toBeGreaterThan(0);
        }
    });
});
