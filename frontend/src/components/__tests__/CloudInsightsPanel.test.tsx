import { describe, it, expect } from 'vitest';
import { groupProcessesByReplicaSet } from '../CloudInsightsPanel';

describe('CloudInsightsPanel.groupProcessesByReplicaSet', () => {
    it('groups processes by replica set, sorted by name', () => {
        const groups = groupProcessesByReplicaSet([
            { id: 'h2:27017', replicaSetName: 'rs1' },
            { id: 'h1:27017', replicaSetName: 'rs0' },
            { id: 'h3:27017', replicaSetName: 'rs0' },
        ] as any);
        expect(groups.map((g) => g.replicaSet)).toEqual(['rs0', 'rs1']);
        expect(groups[0].processes.map((p) => p.id)).toEqual(['h1:27017', 'h3:27017']);
    });

    it('buckets processes with no replica set under (standalone)', () => {
        const groups = groupProcessesByReplicaSet([{ id: 'solo:27017' }] as any);
        expect(groups[0].replicaSet).toBe('(standalone)');
        expect(groups[0].processes).toHaveLength(1);
    });

    it('handles empty / undefined input', () => {
        expect(groupProcessesByReplicaSet([])).toEqual([]);
        expect(groupProcessesByReplicaSet(undefined as any)).toEqual([]);
    });
});
