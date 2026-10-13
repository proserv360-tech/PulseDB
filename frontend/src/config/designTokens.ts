// ==========================================================================
//  FATHOM — Design Tokens (single source of truth for the visual system)
// ==========================================================================

/* Accent colors — Midnight Blue palette (single theme, no light/dark split) */
export const DS_ACCENTS = {
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

/* The single Midnight Blue theme, built around brand #102552. */
export const DS_MIDNIGHT = {
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
    glowCyan: '0 0 12px rgba(59,130,246,0.14), 0 0 30px rgba(59,130,246,0.05)',
    glowViolet: '0 0 12px rgba(167,139,250,0.14), 0 0 30px rgba(167,139,250,0.05)',
    shadowCard: '0 2px 8px rgba(2,8,23,0.45), 0 1px 3px rgba(2,8,23,0.28)',
    shadowDeep: '0 8px 32px rgba(2,8,23,0.55)',
    sidebarBg: '#081633',
    sidebarBorder: 'rgba(147,180,235,0.10)',
    sidebarText: '#9db4dc',
    sidebarHover: 'rgba(59,130,246,0.10)',
    headerBg: 'rgba(7,18,41,0.92)',
    logoBg: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)',
    logoText: '#eaf1fd',
    logoSub: '#7a93c4',
    _dark: true,
};

/* Back-compat aliases — both resolve to the same midnight object. */
export const DS_DARK = DS_MIDNIGHT;
export const DS_LIGHT = DS_MIDNIGHT;

/* ── Z-Index Scale ── consistent layering across the app ──────────────── *
 *  Use these instead of arbitrary values (e.g. 9999, 10000).
 *  Import: import { Z } from '@/config/designTokens';
 *
 *  Note: the Midnight Blue palette is the single source of truth. Prefer
 *        DS.cyan / DS.violet / DS.emerald / DS.amber / DS.rose over any
 *        hardcoded accent hexes in component files.
 * ──────────────────────────────────────────────────────────────────────── */
export const Z = {
    base: 1, // default stacking (sticky headers, relative layers)
    dropdown: 100, // dropdowns, popovers, tooltips
    sticky: 200, // sticky elements, floating action buttons
    sidebar: 300, // sidebar, panels
    overlay: 400, // overlays, backdrops
    modal: 500, // modal dialogs
    toast: 600, // toast notifications, snackbars
    popover: 700, // popovers that sit above modals
    max: 999, // absolute top (debug tools, critical alerts)
};

/* Single Midnight Blue theme — there is no light/dark split any more. */
let DS = DS_MIDNIGHT;

export function setDS(newDS) {
    DS = newDS;
}
export function getDS() {
    return DS;
}
export { DS };
export default DS;
