// ==========================================================================
//  FATHOM — TraceDetail view tests
// ==========================================================================
//  Covers: traceparent normalisation, load flow, summary + queries render,
//  error surface, initialTraceId auto-load.
// ==========================================================================

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const fetchData = vi.fn();

vi.mock('../../../utils/api', () => ({
    fetchData: (...a: unknown[]) => fetchData(...a),
    postData: vi.fn(),
    deleteData: vi.fn(),
}));

vi.mock('../../components/LicenseGate', () => ({
    default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import TraceDetail, { normaliseTraceInput } from '../TraceDetail';

const TRACE_ID = 'a'.repeat(32);

const SUMMARY_FIXTURE = {
    traceId: TRACE_ID,
    queryCount: 3,
    totalExecMs: 12.3,
    slowestQueryId: 'q-slow',
    firstSeen: '2026-04-17T10:00:00Z',
    lastSeen: '2026-04-17T10:00:02Z',
};

const QUERIES_FIXTURE = {
    queries: [
        {
            traceId: TRACE_ID,
            spanId: '1234567890abcdef',
            queryId: 'q-1',
            sqlPreview: 'SELECT * FROM users',
            meanExecMs: 4.5,
            rows: 10,
            ts: '2026-04-17T10:00:00Z',
        },
    ],
};

describe('normaliseTraceInput', () => {
    it('returns the trace id from a full traceparent', () => {
        const tp = `00-${TRACE_ID}-1234567890abcdef-01`;
        expect(normaliseTraceInput(tp)).toBe(TRACE_ID);
    });

    it('returns a bare 32-hex id untouched', () => {
        expect(normaliseTraceInput(TRACE_ID)).toBe(TRACE_ID);
    });

    it('handles empty / whitespace input', () => {
        expect(normaliseTraceInput('')).toBe('');
        expect(normaliseTraceInput('   ')).toBe('');
    });
});

describe('TraceDetail', () => {
    beforeEach(() => {
        fetchData.mockReset();
    });

    it('renders only the form before a trace id is submitted', () => {
        render(<TraceDetail />);
        expect(
            screen.getByPlaceholderText(/traceparent or 32-char trace id/i),
        ).toBeInTheDocument();
        // The summary block (with its "Queries" KV) only appears after a load.
        expect(screen.queryByText(/^Queries$/)).not.toBeInTheDocument();
        expect(
            screen.queryByText(/Correlated queries/i),
        ).not.toBeInTheDocument();
        expect(fetchData).not.toHaveBeenCalled();
    });

    it('auto-loads when initialTraceId is provided', async () => {
        fetchData
            .mockResolvedValueOnce(QUERIES_FIXTURE)
            .mockResolvedValueOnce(SUMMARY_FIXTURE);
        render(<TraceDetail initialTraceId={TRACE_ID} />);
        await waitFor(() => {
            expect(fetchData).toHaveBeenCalledWith(
                `/api/enterprise/trace/${TRACE_ID}/queries`,
            );
        });
        expect(fetchData).toHaveBeenCalledWith(
            `/api/enterprise/trace/${TRACE_ID}/summary`,
        );
    });

    it('loads a trace on form submit and renders summary + queries', async () => {
        fetchData
            .mockResolvedValueOnce(QUERIES_FIXTURE)
            .mockResolvedValueOnce(SUMMARY_FIXTURE);

        render(<TraceDetail />);
        fireEvent.change(
            screen.getByPlaceholderText(/traceparent or 32-char trace id/i),
            { target: { value: `00-${TRACE_ID}-1234567890abcdef-01` } },
        );
        fireEvent.click(screen.getByRole('button', { name: /^Load$/ }));

        await waitFor(() => {
            expect(screen.getByText('SELECT * FROM users')).toBeInTheDocument();
        });
        expect(screen.getByText('q-slow')).toBeInTheDocument();
        expect(screen.getByText('12.3')).toBeInTheDocument();
    });

    it('surfaces an alert when the load fails', async () => {
        fetchData.mockRejectedValueOnce(new Error('trace-404'));
        fetchData.mockResolvedValueOnce(null);

        render(<TraceDetail />);
        fireEvent.change(
            screen.getByPlaceholderText(/traceparent or 32-char trace id/i),
            { target: { value: TRACE_ID } },
        );
        fireEvent.click(screen.getByRole('button', { name: /^Load$/ }));

        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('trace-404');
    });
});
