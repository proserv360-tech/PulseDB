import React from 'react';
import { T } from '../../constants/theme';
import { THEME } from '../../../utils/theme';

/**
 * Injects all global CSS once at the app root.
 * CSS-in-JS at this level keeps the bundle self-contained while avoiding
 * repeated style recalculations from inline-style-heavy components.
 */
export const GlobalStyles = () => (
    <style>{`
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    .um-root {
        font-family: ${THEME.fontBody};
        color: ${T.textMain};
        background: ${T.bg};
        min-height: 100vh;
    }

    /* ── Animations ───────────────────────────────────────────────────── */
    @keyframes umFadeUp     { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
    @keyframes umFadeIn     { from { opacity:0; } to { opacity:1; } }
    @keyframes umSlideRight { from { transform:translateX(100%); opacity:0; } to { transform:translateX(0); opacity:1; } }
    @keyframes umPulse      { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
    @keyframes umSpin       { to { transform:rotate(360deg); } }
    @keyframes umShimmer    { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }

    /* ── Staggered entrance ───────────────────────────────────────────── */
    .um-stagger > * { animation: umFadeUp 0.4s ease both; }
    .um-stagger > *:nth-child(1) { animation-delay: 0.00s; }
    .um-stagger > *:nth-child(2) { animation-delay: 0.05s; }
    .um-stagger > *:nth-child(3) { animation-delay: 0.10s; }
    .um-stagger > *:nth-child(4) { animation-delay: 0.15s; }
    .um-stagger > *:nth-child(5) { animation-delay: 0.20s; }

    /* ── Table rows ───────────────────────────────────────────────────── */
    .um-row {
        display: grid;
        align-items: center;
        padding: 0 20px;
        height: 62px;
        border-bottom: 1px solid ${T.glassBorder};
        transition: background 0.15s, border-color 0.15s;
        cursor: pointer;
    }
    .um-row:hover    { background: ${T.primary}08; border-color: ${T.primary}20; }
    .um-row.selected { background: ${T.primary}12; border-color: ${T.primary}30; }
    .um-row:last-child { border-bottom: none; }

    /* ── Buttons ──────────────────────────────────────────────────────── */
    .um-btn {
        display: inline-flex; align-items: center; gap: 7px;
        padding: 8px 16px; border-radius: 22px; border: none;
        font-family: ${THEME.fontBody}; font-size: 13px; font-weight: 600;
        cursor: pointer; transition: all 0.15s; white-space: nowrap; outline: none;
    }
    .um-btn:active  { transform: scale(0.97); }
    .um-btn-primary { background: ${T.primary}; color: #fff; }
    .um-btn-primary:hover { background: #60a5fa; box-shadow: ${T.shadowMd}; }
    .um-btn-ghost   { background: transparent; color: ${T.textSub}; border: 1px solid ${T.glassBorder}; }
    .um-btn-ghost:hover { border-color: ${T.primary}; color: ${T.primary}; background: ${T.primaryDim}; }
    .um-btn-danger  { background: ${T.dangerDim}; color: ${T.danger}; border: 1px solid ${T.danger}44; }
    .um-btn-danger:hover { background: ${T.danger}; color: #fff; }
    .um-btn-sm   { padding: 5px 10px; font-size: 11px; border-radius: 22px; }
    .um-btn-icon { padding: 7px; border-radius: 22px; }

    /* ── Inputs ───────────────────────────────────────────────────────── */
    .um-input {
        background: ${T.surface}; border: 1px solid ${T.glassBorder}; border-radius: 22px;
        color: ${T.textMain}; font-family: ${THEME.fontBody}; font-size: 13px;
        outline: none; padding: 9px 12px;
        transition: border 0.2s, box-shadow 0.2s; width: 100%;
    }
    .um-input:focus { border-color: ${T.primary}; box-shadow: 0 0 0 3px ${T.primary}18; }
    .um-input::placeholder { color: ${T.textDim}; }
    .um-input:disabled { opacity: 0.5; cursor: not-allowed; }

    /* ── Tabs ─────────────────────────────────────────────────────────── */
    .um-tab {
        display: flex; align-items: center; gap: 20px;
        padding: 11px 18px; border: none; border-bottom: 2px solid transparent;
        background: transparent; font-family: ${THEME.fontBody};
        font-size: 13px; font-weight: 600;
        color: ${T.textDim}; cursor: pointer;
        transition: all 0.2s; white-space: nowrap;
    }
    .um-tab.active { color: ${T.primary}; border-bottom-color: ${T.primary}; }
    .um-tab:hover:not(.active) { color: ${T.textSub}; background: ${T.primaryDim}; }

    /* ── Cards ────────────────────────────────────────────────────────── */
    .um-card {
        background: ${T.surface}; border: 1px solid ${T.glassBorder}; border-radius: 20px;
        padding: 20px; transition: border-color 0.2s;
    }
    .um-card:hover { border-color: ${T.glassBorder}; }

    /* ── Overlay / modal / drawer ─────────────────────────────────────── */
    .um-overlay {
        position: fixed; inset: 0;
        background: rgba(4,5,10,0.85); backdrop-filter: blur(12px);
        z-index: 2000; animation: umFadeIn 0.2s ease;
        display: flex; align-items: center; justify-content: center;
    }
    .um-drawer {
        position: fixed; top: 0; right: 0; bottom: 0; width: 580px; max-width: 95vw;
        background: ${T.surface}; border-left: 1px solid ${T.glassBorder};
        box-shadow: ${T.shadowLg};
        animation: umSlideRight 0.32s cubic-bezier(0.16,1,0.3,1);
        display: flex; flex-direction: column; z-index: 2000;
    }
    .um-modal {
        background: ${T.surface}; border: 1px solid ${T.glassBorder}; border-radius: 22px;
        box-shadow: ${T.shadowLg}; overflow: hidden;
        animation: umFadeUp 0.3s cubic-bezier(0.16,1,0.3,1);
    }

    /* ── Scrollbar ────────────────────────────────────────────────────── */
    .um-scroll { overflow-y: auto; }
    .um-scroll::-webkit-scrollbar { width: 4px; }
    .um-scroll::-webkit-scrollbar-track { background: transparent; }
    .um-scroll::-webkit-scrollbar-thumb { background: ${T.glassBorder}; border-radius: 2px; }
    .um-scroll::-webkit-scrollbar-thumb:hover { background: ${T.glassBorder}; }

    /* ── Utilities ────────────────────────────────────────────────────── */
    .um-mono { font-family: ${THEME.fontMono}; }
    .um-perm-chip {
        padding: 3px 7px; border-radius: 22px; font-size: 10px; font-weight: 700;
        letter-spacing: 0.06em; font-family: ${THEME.fontMono};
    }
    .shimmer-skeleton {
        background: linear-gradient(90deg, ${T.surface} 25%, ${T.surfaceRaised} 50%, ${T.surface} 75%);
        background-size: 200% 100%;
        animation: umShimmer 1.5s infinite;
        border-radius: 22px;
    }
    .um-grid-4 { display: grid; grid-template-columns: repeat(4,1fr); gap: 22px; }
    .um-grid-3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 22px; }
    .um-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }

    /* ── Accessibility ────────────────────────────────────────────────── */
    :focus-visible {
        outline: 2px solid ${T.primary};
        outline-offset: 2px;
    }
    .um-btn:focus-visible, .um-input:focus-visible {
        outline: 2px solid ${T.primary};
        outline-offset: 2px;
    }
    `}</style>
);