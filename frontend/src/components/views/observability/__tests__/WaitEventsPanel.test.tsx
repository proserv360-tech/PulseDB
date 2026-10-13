import { describe, it, expect } from 'vitest';
import { toBars } from '../WaitEventsPanel';

describe('WaitEventsPanel.toBars', () => {
    it('maps ms events and computes pct of the max', () => {
        const bars = toBars([
            { event: 'log file sync', ms: 120 },
            { event: 'db file read', ms: 60 },
            { event: 'CPU', ms: 0 },
        ]);
        expect(bars[0]).toMatchObject({ event: 'log file sync', value: 120, unit: 'ms', pct: 100 });
        expect(bars[1].pct).toBe(50);
        expect(bars[2].pct).toBe(0);
    });

    it('falls back to waiter counts when ms is absent', () => {
        const bars = toBars([{ event: 'lock', waiters: 4 }]);
        expect(bars[0]).toMatchObject({ value: 4, unit: 'waiters', pct: 100 });
    });

    it('handles an empty list without dividing by zero', () => {
        expect(toBars([])).toEqual([]);
        expect(toBars(undefined as any)).toEqual([]);
    });

    it('uses empty unit when neither ms nor waiters present', () => {
        const bars = toBars([{ event: 'mystery' } as any]);
        expect(bars[0].unit).toBe('');
        expect(bars[0].value).toBe(0);
    });
});
