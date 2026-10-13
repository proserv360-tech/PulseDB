// ==========================================================================
//  FATHOM — RedisOverview view tests
// ==========================================================================
//  Covers: loading, success, error, empty-keyspace states.
// ==========================================================================

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';

const fetchData = vi.fn();

vi.mock('../../../utils/api', () => ({
    fetchData: (...a: unknown[]) => fetchData(...a),
    postData: vi.fn(),
    deleteData: vi.fn(),
}));

vi.mock('../../components/LicenseGate', () => ({
    default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import RedisOverview from '../RedisOverview';

const INFO_FIXTURE = {
    server: { redis_version: '7.2.0', uptime_in_seconds: 1024, os: 'Linux' },
    clients: { connected_clients: 42, blocked_clients: 0 },
    memory: {
        used_memory_human: '128M',
        used_memory_peak_human: '256M',
        mem_fragmentation_ratio: 1.2,
    },
    stats: {},
    replication: { role: 'master', connected_slaves: 2 },
    keyspace: {
        db0: { keys: 1000, expires: 10, avg_ttl: 0 },
        db1: { keys: 5, expires: 0, avg_ttl: 0 },
    },
};

describe('RedisOverview', () => {
    beforeEach(() => {
        fetchData.mockReset();
    });

    it('shows loading indicator before data arrives', async () => {
        let resolve!: (v: unknown) => void;
        fetchData.mockImplementationOnce(
            () => new Promise((r) => { resolve = r; }),
        );
        render(<RedisOverview />);
        expect(screen.getByText(/Loading/i)).toBeInTheDocument();
        await act(async () => { resolve(INFO_FIXTURE); });
    });

    it('renders server / memory / replication details on success', async () => {
        fetchData.mockResolvedValueOnce(INFO_FIXTURE);
        render(<RedisOverview />);
        await waitFor(() => {
            expect(screen.getByText('7.2.0')).toBeInTheDocument();
        });
        expect(screen.getByText('128M')).toBeInTheDocument();
        expect(screen.getByText('master')).toBeInTheDocument();
        expect(screen.getByText('db0')).toBeInTheDocument();
        expect(screen.getByText('db1')).toBeInTheDocument();
    });

    it('renders "no data in any DB" when keyspace is empty', async () => {
        fetchData.mockResolvedValueOnce({ ...INFO_FIXTURE, keyspace: {} });
        render(<RedisOverview />);
        await waitFor(() => {
            expect(screen.getByText(/No data in any DB/i)).toBeInTheDocument();
        });
    });

    it('shows an alert when the fetch fails', async () => {
        fetchData.mockRejectedValueOnce(new Error('redis-gone'));
        render(<RedisOverview />);
        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('redis-gone');
    });
});
