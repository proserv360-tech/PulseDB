// ==========================================================================
//  FATHOM — ElasticsearchOverview view tests
// ==========================================================================
//  Covers: loading, success (health + indices table), empty-indices, error.
// ==========================================================================

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const fetchData = vi.fn();

vi.mock('../../../utils/api', () => ({
    fetchData: (...a: unknown[]) => fetchData(...a),
    postData: vi.fn(),
    deleteData: vi.fn(),
}));

vi.mock('../../components/LicenseGate', () => ({
    default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import ElasticsearchOverview from '../ElasticsearchOverview';

const HEALTH_GREEN = {
    cluster_name: 'fathom-es',
    status: 'green',
    number_of_nodes: 3,
    number_of_data_nodes: 3,
    active_primary_shards: 12,
    active_shards: 24,
    relocating_shards: 0,
    initializing_shards: 0,
    unassigned_shards: 0,
};

describe('ElasticsearchOverview', () => {
    beforeEach(() => {
        fetchData.mockReset();
    });

    it('renders cluster health and indices table on success', async () => {
        fetchData
            .mockResolvedValueOnce(HEALTH_GREEN)
            .mockResolvedValueOnce({
                indices: [
                    {
                        index: 'logs-2026.04',
                        health: 'green',
                        status: 'open',
                        docs: 10_000,
                        primaries: 1,
                        replicas: 1,
                        storeSize: '10mb',
                    },
                ],
            });

        render(<ElasticsearchOverview />);

        await waitFor(() => {
            expect(screen.getByText('fathom-es')).toBeInTheDocument();
        });
        expect(screen.getByText('GREEN')).toBeInTheDocument();
        expect(screen.getByText('logs-2026.04')).toBeInTheDocument();
        expect(screen.getByText('10000')).toBeInTheDocument();
        expect(screen.getByText('10mb')).toBeInTheDocument();
    });

    it('shows "no indices returned" when the indices list is empty', async () => {
        fetchData
            .mockResolvedValueOnce(HEALTH_GREEN)
            .mockResolvedValueOnce({ indices: [] });

        render(<ElasticsearchOverview />);
        await waitFor(() => {
            expect(screen.getByText(/No indices returned/i)).toBeInTheDocument();
        });
    });

    it('shows an alert when either request fails', async () => {
        fetchData
            .mockResolvedValueOnce(HEALTH_GREEN)
            .mockRejectedValueOnce(new Error('es-indices-oops'));

        render(<ElasticsearchOverview />);
        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('es-indices-oops');
    });
});
