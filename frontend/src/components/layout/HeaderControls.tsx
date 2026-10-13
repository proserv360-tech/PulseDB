// Small header widgets: status pill, refresh and theme buttons.
// Extracted from App.tsx.
import { Moon, RefreshCw, Sun } from 'lucide-react';
import React from 'react';
import { DS, DS_DARK, DS_LIGHT, setDS } from '../../config/designTokens';
import { useTheme } from '../../context/ThemeContext';

/* ─────────────────────────────────────────────────────────────────
   AMBIENT BACKGROUND ORBS (decorative, pointer-events: none)
   ───────────────────────────────────────────────────────────────── */
/* AmbientOrbs — simplified for clean modern look */
export const AmbientOrbs = () => null;

/* ─────────────────────────────────────────────────────────────────
   LIVE STATUS PILL
   ───────────────────────────────────────────────────────────────── */
export const StatusPill = ({ connected }) => (
    <div
        style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '5px 12px',
            borderRadius: 20,
            background: connected ? 'rgba(52,211,153,0.1)' : 'rgba(251,113,133,0.1)',
            border: `1px solid ${connected ? 'rgba(52,211,153,0.3)' : 'rgba(251,113,133,0.3)'}`,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.02em',
            color: connected ? DS.emerald : DS.rose,
            fontFamily: DS.fontMono,
        }}
    >
        <span
            style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: connected ? DS.emerald : DS.rose,
                animation: connected ? 'dotBlink 2s ease-in-out infinite' : 'none',
                flexShrink: 0,
            }}
        />
        {connected ? 'LIVE' : 'OFFLINE'}
    </div>
);

/* ─────────────────────────────────────────────────────────────────
   THEME TOGGLE — uses ThemeContext as single source of truth and
   also keeps the mutable DS object in sync for legacy consumers
   ───────────────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────────────
   GLOBAL REFRESH BUTTON — dispatches 'fathom-refresh' CustomEvent
   that individual tabs listen for to trigger their own data reload.
   ───────────────────────────────────────────────────────────────── */
export const GlobalRefreshButton = () => {
    const [spinning, setSpinning] = React.useState(false);

    const handleRefresh = () => {
        setSpinning(true);
        window.dispatchEvent(new CustomEvent('fathom-refresh'));
        setTimeout(() => setSpinning(false), 900);
    };

    return (
        <button
            onClick={handleRefresh}
            aria-label="Refresh data"
            title="Refresh current view"
            style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'rgba(99,102,241,0.08)',
                border: '1px solid rgba(99,102,241,0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.1)';
                e.currentTarget.style.background = 'rgba(99,102,241,0.14)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.background = 'rgba(99,102,241,0.08)';
            }}
        >
            <RefreshCw
                size={15}
                color={DS.cyan}
                style={{
                    transition: 'transform 0.6s cubic-bezier(0.4,0,0.2,1)',
                    transform: spinning ? 'rotate(360deg)' : 'rotate(0deg)',
                }}
            />
        </button>
    );
};

export const ThemeToggle = () => {
    // Dark mode removed — the app is light-only, so the theme toggle is gone.
    return null;

    /* eslint-disable no-unreachable */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { isDark, toggleTheme } = useTheme();

    const handleToggle = () => {
        const next = !isDark;
        /* Sync module-level DS so legacy inline styles re-read it on next render */
        setDS(next ? DS_DARK : DS_LIGHT);
        toggleTheme();
    };

    return (
        <button
            onClick={handleToggle}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Light mode' : 'Dark mode'}
            style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: isDark ? 'rgba(251,191,36,0.08)' : 'rgba(99,102,241,0.08)',
                border: `1px solid ${isDark ? 'rgba(251,191,36,0.25)' : 'rgba(99,102,241,0.3)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.1)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
            }}
        >
            {isDark ? <Sun size={16} color="rgba(251,191,36,0.9)" /> : <Moon size={16} color="rgba(99,102,241,0.9)" />}
        </button>
    );
};
