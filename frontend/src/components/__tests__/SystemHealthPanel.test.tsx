import { describe, it, expect } from 'vitest';
import { summarizeHealth } from '../SystemHealthPanel';

describe('SystemHealthPanel.summarizeHealth', () => {
    it('reports ok/green when everything is healthy', () => {
        const s = summarizeHealth({
            controlPlane: 'ok',
            diagnostics: {
                ok: true,
                provider: { provider: 'supabase', pooled: false, tls: true, host: 'db.x.supabase.co' },
                warnings: [],
                blockers: [],
            },
        });
        expect(s.ok).toBe(true);
        expect(s.tone).toBe('ok');
        expect(s.provider).toBe('supabase');
        expect(s.tls).toBe(true);
        expect(s.host).toBe('db.x.supabase.co');
    });

    it('is warn (not error) when only non-blocking warnings exist', () => {
        const s = summarizeHealth({
            controlPlane: 'ok',
            diagnostics: {
                ok: true,
                provider: { provider: 'supabase', pooled: false, tls: false },
                warnings: [{ code: 'DB_TLS_RECOMMENDED', hint: 'Supabase requires TLS.' }],
                blockers: [],
            },
        });
        expect(s.tone).toBe('warn');
        expect(s.warnings).toHaveLength(1);
        expect(s.blockers).toHaveLength(0);
    });

    it('is error when there are blockers regardless of warnings', () => {
        const s = summarizeHealth({
            controlPlane: 'degraded',
            diagnostics: {
                ok: false,
                blockers: [{ component: 'schema', code: 'SCHEMA_NOT_MIGRATED', hint: 'Run migrations' }],
                warnings: [{ code: 'X', hint: 'y' }],
            },
        });
        expect(s.tone).toBe('error');
        expect(s.ok).toBe(false);
        expect(s.blockers[0].component).toBe('schema');
    });

    it('falls back to provider.warnings when top-level warnings absent', () => {
        const s = summarizeHealth({
            controlPlane: 'ok',
            diagnostics: {
                ok: true,
                provider: {
                    provider: 'neon',
                    pooled: false,
                    tls: true,
                    warnings: [{ code: 'W', hint: 'nested warning' }],
                },
            },
        });
        expect(s.warnings).toHaveLength(1);
        expect(s.warnings[0].hint).toBe('nested warning');
    });

    it('handles a null/empty payload safely', () => {
        const s = summarizeHealth(null);
        expect(s.ok).toBe(false);
        expect(s.tone).toBe('error');
        expect(s.provider).toBe('unknown');
        expect(s.warnings).toEqual([]);
        expect(s.blockers).toEqual([]);
    });
});
