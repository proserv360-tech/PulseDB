import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

const ThemeContext = createContext(null);

/* ── Midnight Blue tokens — one theme, no light/dark split ── */
const DS_ACCENTS = {
    cyan: '#3b82f6',
    cyanDim: 'rgba(59,130,246,0.15)',
    cyanGlow: 'rgba(59,130,246,0.35)',
    violet: '#a78bfa',
    violetDim: 'rgba(167,139,250,0.15)',
    emerald: '#34d399',
    amber: '#fbbf24',
    rose: '#fb7185',
    fontMono: `'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace`,
    fontUI: `'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif`,
};

export const MIDNIGHT_TOKENS = {
    ...DS_ACCENTS,
    bg: '#071229',
    bgDeep: '#081633',
    surface: '#102552',
    surfaceHover: '#16306a',
    border: 'rgba(147,180,235,0.14)',
    borderAccent: 'rgba(59,130,246,0.28)',
    textPrimary: '#eaf1fd',
    textSub: '#9db4dc',
    textMuted: '#7a93c4',
    headerBg: 'rgba(7,18,41,0.92)',
    sidebarBg: '#081633',
    sidebarBorder: 'rgba(147,180,235,0.10)',
    sidebarText: '#9db4dc',
    sidebarHover: 'rgba(59,130,246,0.10)',
    cardBg: '#102552',
    inputBg: 'rgba(147,180,235,0.07)',
    scrollTrack: '#071229',
    scrollThumb: '#1a3878',
    glowCyan: '0 0 20px rgba(59,130,246,0.20), 0 0 60px rgba(59,130,246,0.07)',
    glowViolet: '0 0 20px rgba(167,139,250,0.20), 0 0 60px rgba(167,139,250,0.07)',
    shadowCard: '0 4px 24px rgba(2,8,23,0.55), 0 1px 4px rgba(2,8,23,0.62)',
    shadowDeep: '0 20px 60px rgba(2,8,23,0.65)',
    logoBg: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)',
    logoText: '#eaf1fd',
    logoSub: '#7a93c4',
    _dark: true,
};

/* Back-compat aliases — both resolve to the same midnight token set. */
export const DARK_TOKENS = MIDNIGHT_TOKENS;
export const LIGHT_TOKENS = MIDNIGHT_TOKENS;

export const ThemeProvider = ({ children }) => {
    // Single Midnight Blue theme. isDark stays true (the palette is dark) and
    // toggleTheme is a no-op, so any residual toggle UI does nothing instead of
    // switching themes.
    const isDark = true;
    const tokens = MIDNIGHT_TOKENS;

    useEffect(() => {
        try {
            // Normalize any previously-stored light/dark preference.
            localStorage.setItem('fathom_theme', 'midnight');
        } catch {}
        document.documentElement.setAttribute('data-theme', 'midnight');
        document.body.style.backgroundColor = tokens.bg;
        document.body.style.color = tokens.textPrimary;
    }, [tokens]);

    const toggleTheme = useCallback(() => {
        /* no-op: dark mode removed, app is light-only */
    }, []);

    const value = useMemo(() => ({ isDark, tokens, toggleTheme }), [tokens, toggleTheme]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
    return ctx;
};

export default ThemeContext;
