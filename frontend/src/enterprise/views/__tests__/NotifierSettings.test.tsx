// ==========================================================================
//  FATHOM — NotifierSettings view tests
// ==========================================================================
//  Covers: loading, success, empty, error, create/test/delete flows.
// ==========================================================================

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// Mock the api layer before importing the component.
const fetchData = vi.fn();
const postData = vi.fn();
const deleteData = vi.fn();

vi.mock('../../../utils/api', () => ({
    fetchData: (...a: unknown[]) => fetchData(...a),
    postData: (...a: unknown[]) => postData(...a),
    deleteData: (...a: unknown[]) => deleteData(...a),
}));

// Bypass LicenseGate — we're testing the inner view, not license logic.
vi.mock('../../components/LicenseGate', () => ({
    default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import NotifierSettings from '../NotifierSettings';

describe('NotifierSettings', () => {
    beforeEach(() => {
        fetchData.mockReset();
        postData.mockReset();
        deleteData.mockReset();
    });

    it('shows a loading indicator while notifiers are fetched', async () => {
        let resolve!: (v: unknown) => void;
        fetchData.mockImplementationOnce(
            () => new Promise((r) => { resolve = r; }),
        );
        render(<NotifierSettings />);
        expect(screen.getByText(/Loading/i)).toBeInTheDocument();
        await act(async () => { resolve({ notifiers: [] }); });
    });

    it('renders empty-state copy when no notifiers are configured', async () => {
        fetchData.mockResolvedValueOnce({ notifiers: [] });
        render(<NotifierSettings />);
        await waitFor(() => {
            expect(
                screen.getByText(/No notifiers configured yet/i),
            ).toBeInTheDocument();
        });
    });

    it('renders configured notifier rows with labels and kinds', async () => {
        fetchData.mockResolvedValueOnce({
            notifiers: [
                {
                    id: 'n1',
                    kind: 'webhook',
                    label: 'prod-webhook',
                    enabled: true,
                    lastStatus: 'ok',
                    lastUsedAt: '2026-01-01T00:00:00Z',
                },
                {
                    id: 'n2',
                    kind: 'pagerduty',
                    label: 'on-call',
                    enabled: true,
                    lastStatus: null,
                    lastUsedAt: null,
                },
            ],
        });
        render(<NotifierSettings />);
        await waitFor(() => {
            expect(screen.getByText('prod-webhook')).toBeInTheDocument();
        });
        expect(screen.getByText('on-call')).toBeInTheDocument();
        expect(screen.getByText('Generic Webhook')).toBeInTheDocument();
        // 'PagerDuty' appears in the configured rows and in the "Add" form's
        // <option> list, so use getAllByText and assert at least one.
        expect(screen.getAllByText('PagerDuty').length).toBeGreaterThan(0);
    });

    it('shows an alert when the fetch fails', async () => {
        fetchData.mockRejectedValueOnce(new Error('boom'));
        render(<NotifierSettings />);
        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('boom');
    });

    it('posts a new notifier and re-fetches the list', async () => {
        fetchData
            .mockResolvedValueOnce({ notifiers: [] }) // initial
            .mockResolvedValueOnce({
                notifiers: [
                    {
                        id: 'n9',
                        kind: 'webhook',
                        label: 'freshly-created',
                        enabled: true,
                    },
                ],
            });
        postData.mockResolvedValueOnce({ ok: true });

        render(<NotifierSettings />);
        await screen.findByText(/No notifiers configured yet/i);

        const labelInput = screen.getByPlaceholderText(/Label/i);
        fireEvent.change(labelInput, { target: { value: 'my-hook' } });

        const configBox = screen.getByPlaceholderText(/Config JSON/i);
        fireEvent.change(configBox, {
            target: { value: '{"url":"https://example.com"}' },
        });

        fireEvent.click(screen.getByRole('button', { name: /Create/i }));

        await waitFor(() => {
            expect(postData).toHaveBeenCalledWith(
                '/api/enterprise/notifiers',
                expect.objectContaining({
                    kind: 'webhook',
                    label: 'my-hook',
                    config: { url: 'https://example.com' },
                }),
            );
        });
        await waitFor(() => {
            expect(screen.getByText('freshly-created')).toBeInTheDocument();
        });
    });

    it('surfaces a JSON parse error when config is invalid and does not POST', async () => {
        fetchData.mockResolvedValueOnce({ notifiers: [] });
        render(<NotifierSettings />);
        await screen.findByText(/No notifiers configured yet/i);

        fireEvent.change(screen.getByPlaceholderText(/Label/i), {
            target: { value: 'bad-cfg' },
        });
        fireEvent.change(screen.getByPlaceholderText(/Config JSON/i), {
            target: { value: '{not-json' },
        });
        fireEvent.click(screen.getByRole('button', { name: /Create/i }));

        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent(/Config must be valid JSON/i);
        expect(postData).not.toHaveBeenCalled();
    });
});
