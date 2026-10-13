/**
 * LoginPage — post-logout state
 * ─────────────────────────────
 * Three exits land on this screen and they are not the same event. These tests
 * cover the one that used to be silent: AuthContext set
 * `error: 'Session expired…'` in two places, LoginPage never read it, and a
 * timed-out user saw an ordinary empty form with no explanation.
 *
 * The reason is passed through localStorage rather than React state on purpose
 * — logout() clears currentUser, which routes to /login and unmounts the
 * provider's in-memory state before anything can render it.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

import { AuthProvider, EXIT_REASONS } from '../../context/AuthContext';
import { ThemeProvider } from '../../context/ThemeContext';
import LoginPage from './LoginPage';

const EXIT_KEY = 'pulsedb_exit_reason';
const LAST_USER_KEY = 'pulsedb_last_username';

async function renderLogin() {
    const utils = render(
        <ThemeProvider>
            <AuthProvider>
                <LoginPage />
            </AuthProvider>
        </ThemeProvider>,
    );
    // Both providers fetch on mount. Let those promises settle inside act() so
    // the resulting state updates don't land after the assertions.
    await act(async () => {});
    return utils;
}

beforeEach(() => {
    localStorage.clear();
    // Both the provider (GET /api/auth/me) and the page (GET /api/health) fetch
    // on mount. Fail them: an unauthenticated visitor is exactly the state
    // under test.
    vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({}) })),
    );
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('LoginPage — why you are here', () => {
    it('confirms a deliberate sign-out', async () => {
        localStorage.setItem(EXIT_KEY, EXIT_REASONS.SIGNED_OUT);
        await renderLogin();
        expect(await screen.findByText("You're signed out")).toBeInTheDocument();
    });

    it('explains an expired session instead of showing a bare form', async () => {
        localStorage.setItem(EXIT_KEY, EXIT_REASONS.EXPIRED);
        await renderLogin();
        expect(await screen.findByText('Your session expired')).toBeInTheDocument();
        // The distinction that matters: this was not something the user did.
        expect(screen.queryByText("You're signed out")).not.toBeInTheDocument();
    });

    it('says plainly when the session was ended elsewhere', async () => {
        localStorage.setItem(EXIT_KEY, EXIT_REASONS.REVOKED);
        await renderLogin();
        expect(await screen.findByText('You were signed out')).toBeInTheDocument();
    });

    it('shows nothing to a first-time visitor', async () => {
        await renderLogin();
        expect(screen.queryByText("You're signed out")).not.toBeInTheDocument();
        expect(screen.queryByText('Your session expired')).not.toBeInTheDocument();
    });

    it('consumes the reason so a refresh does not re-announce it', async () => {
        localStorage.setItem(EXIT_KEY, EXIT_REASONS.SIGNED_OUT);
        await renderLogin();
        await screen.findByText("You're signed out");
        expect(localStorage.getItem(EXIT_KEY)).toBeNull();
    });

    it('can be dismissed', async () => {
        localStorage.setItem(EXIT_KEY, EXIT_REASONS.EXPIRED);
        await renderLogin();
        await screen.findByText('Your session expired');
        fireEvent.click(screen.getByLabelText('Dismiss'));
        expect(screen.queryByText('Your session expired')).not.toBeInTheDocument();
    });
});

describe('LoginPage — returning user', () => {
    it('prefills the last username so the return trip is one field', async () => {
        localStorage.setItem(LAST_USER_KEY, 'dilip@company.com');
        await renderLogin();
        expect(screen.getByDisplayValue('dilip@company.com')).toBeInTheDocument();
    });

    it('offers an escape when it is someone else at the keyboard', async () => {
        localStorage.setItem(LAST_USER_KEY, 'dilip@company.com');
        await renderLogin();
        fireEvent.click(screen.getByText('Not you?'));
        expect(screen.queryByDisplayValue('dilip@company.com')).not.toBeInTheDocument();
        // Forgetting must be durable — otherwise the next visit re-fills it and
        // the escape hatch was theatre.
        expect(localStorage.getItem(LAST_USER_KEY)).toBeNull();
    });

    it('drops the escape hatch once the field is edited', async () => {
        localStorage.setItem(LAST_USER_KEY, 'dilip@company.com');
        await renderLogin();
        const field = screen.getByDisplayValue('dilip@company.com');
        fireEvent.change(field, { target: { value: 'someone.else@company.com' } });
        expect(screen.queryByText('Not you?')).not.toBeInTheDocument();
    });

    it('shows no prefill and no escape hatch on a first visit', async () => {
        await renderLogin();
        expect(screen.queryByText('Not you?')).not.toBeInTheDocument();
    });
});
