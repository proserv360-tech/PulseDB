// ==========================================================================
//  FATHOM — DetectorPicker view tests
// ==========================================================================
//  Covers: loading, configs + events render, save flow, error.
// ==========================================================================

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const fetchData = vi.fn();
const postData = vi.fn();

vi.mock('../../../utils/api', () => ({
    fetchData: (...a: unknown[]) => fetchData(...a),
    postData: (...a: unknown[]) => postData(...a),
    deleteData: vi.fn(),
}));

vi.mock('../../components/LicenseGate', () => ({
    default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import DetectorPicker from '../DetectorPicker';

const CONFIG_FIXTURE = {
    configs: [
        {
            metric: 'pg.qps',
            detector: 'zscore',
            threshold: 3,
            windowSize: 60,
            enabled: true,
        },
        {
            metric: 'pg.lag_ms',
            detector: 'mad',
            threshold: 4,
            windowSize: 30,
            enabled: false,
        },
    ],
};

const EVENTS_FIXTURE = {
    events: [
        {
            id: 'ev1',
            metric: 'pg.qps',
            ts: '2026-04-17T10:00:00Z',
            value: 9000,
            score: 4.27,
            detector: 'zscore',
        },
    ],
};

describe('DetectorPicker', () => {
    beforeEach(() => {
        fetchData.mockReset();
        postData.mockReset();
    });

    it('shows empty-state copy when no configs exist', async () => {
        fetchData
            .mockResolvedValueOnce({ configs: [] })
            .mockResolvedValueOnce({ events: [] });
        render(<DetectorPicker />);
        await waitFor(() => {
            expect(
                screen.getByText(/No metrics are currently being tracked/i),
            ).toBeInTheDocument();
        });
    });

    it('renders per-metric configs and recent anomalies', async () => {
        fetchData
            .mockResolvedValueOnce(CONFIG_FIXTURE)
            .mockResolvedValueOnce(EVENTS_FIXTURE);
        render(<DetectorPicker />);

        await waitFor(() => {
            // 'pg.qps' appears in both the configs section and the events table,
            // so use getAllByText to confirm at least one render.
            expect(screen.getAllByText('pg.qps').length).toBeGreaterThan(0);
        });
        expect(screen.getByText('pg.lag_ms')).toBeInTheDocument();
        expect(screen.getByText('9000')).toBeInTheDocument();
        // Score is formatted via toFixed(2) -> "4.27"
        expect(screen.getByText('4.27')).toBeInTheDocument();
    });

    it('saves a modified config by POSTing to the configs endpoint', async () => {
        fetchData
            .mockResolvedValueOnce(CONFIG_FIXTURE)
            .mockResolvedValueOnce(EVENTS_FIXTURE);
        postData.mockResolvedValueOnce({ ok: true });

        render(<DetectorPicker />);
        await waitFor(() =>
            expect(screen.getAllByText('pg.qps').length).toBeGreaterThan(0),
        );

        const saveButtons = screen.getAllByRole('button', { name: /^Save/ });
        fireEvent.click(saveButtons[0]);

        await waitFor(() => {
            expect(postData).toHaveBeenCalledWith(
                '/api/enterprise/anomaly/configs',
                expect.objectContaining({ metric: 'pg.qps' }),
            );
        });
    });

    it('shows an alert when configs fetch fails', async () => {
        fetchData.mockRejectedValueOnce(new Error('no-anomaly-service'));
        // Second call (events) never happens because Promise.all rejects,
        // but mock it to a resolvable just in case.
        fetchData.mockResolvedValueOnce({ events: [] });

        render(<DetectorPicker />);
        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('no-anomaly-service');
    });
});
