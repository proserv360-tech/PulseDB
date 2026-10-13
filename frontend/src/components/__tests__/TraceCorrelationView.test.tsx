import { describe, it, expect } from 'vitest';
import { flattenSpanTree } from '../TraceCorrelationView';

const span = (spanId: string, parentSpanId: string | null) => ({
    spanId,
    parentSpanId,
    queries: [],
    dbTimeMs: 0,
});

describe('TraceCorrelationView.flattenSpanTree', () => {
    it('orders parents before children with increasing depth', () => {
        const rows = flattenSpanTree([span('root', null), span('child', 'root'), span('grandchild', 'child')] as any);
        expect(rows.map((r) => r.spanId)).toEqual(['root', 'child', 'grandchild']);
        expect(rows.map((r) => r.depth)).toEqual([0, 1, 2]);
    });

    it('keeps sibling order under the same parent', () => {
        const rows = flattenSpanTree([span('root', null), span('a', 'root'), span('b', 'root')] as any);
        expect(rows.map((r) => r.spanId)).toEqual(['root', 'a', 'b']);
        expect(rows[1].depth).toBe(1);
        expect(rows[2].depth).toBe(1);
    });

    it('appends spans with a missing parent at depth 0 (broken tree)', () => {
        const rows = flattenSpanTree([span('root', null), span('orphan', 'ghost')] as any);
        const ids = rows.map((r) => r.spanId);
        expect(ids).toContain('orphan');
        expect(rows.find((r) => r.spanId === 'orphan')!.depth).toBe(0);
    });

    it('does not loop forever on a cycle', () => {
        const rows = flattenSpanTree([span('a', 'b'), span('b', 'a')] as any);
        // both appear exactly once
        expect(rows.length).toBe(2);
        expect(new Set(rows.map((r) => r.spanId)).size).toBe(2);
    });

    it('handles empty input', () => {
        expect(flattenSpanTree([])).toEqual([]);
    });
});
