// Global stylesheet for the app shell.
// Extracted from App.tsx.
import React from 'react';
import { DS } from '../../config/designTokens';
import { THEME } from '../../utils/theme';

/* ─────────────────────────────────────────────────────────────────
   GLOBAL STYLES
   ───────────────────────────────────────────────────────────────── */
export const AppStyles = React.memo(() => (
    <style>{`

        *, *::before, *::after { box-sizing: border-box; }

        @keyframes slideIn         { from { transform: translateX(-100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideInRight    { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes fadeIn          { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideDown       { from { transform: translateY(-14px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes slideUp         { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes sectionOpen     { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse           { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes bounce          { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        @keyframes shimmer         { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        @keyframes subtlePulse      { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
        @keyframes rotate          { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes tabIn           { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes notifPop        { 0% { transform: scale(0.85); opacity: 0; } 80% { transform: scale(1.02); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes badgePop        { 0% { transform: scale(0); } 70% { transform: scale(1.3); } 100% { transform: scale(1); } }
        @keyframes waveFlow        { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        @keyframes dotBlink        { 0%,100% { opacity: 1; } 50% { opacity: 0.2; } }

        @media (prefers-reduced-motion: reduce) {
            *, *::before, *::after {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
            }
        }

        /* ═══ FATHOM — Clean & Refined ═══ */

        /* ── Sidebar ── */
        aside {
            background: ${DS._dark ? THEME.bgAlt : DS.sidebarBg} !important;
            border-right: 1px solid ${DS.sidebarBorder} !important;
            box-shadow: none !important;
        }
        aside::after { display: none; }

        /* ── Header ── */
        header {
            background: ${DS._dark ? THEME.bgAlt : DS.headerBg} !important;
            box-shadow: ${DS._dark ? '0 1px 0 rgba(255,255,255,0.04)' : '0 1px 0 rgba(0,0,0,0.06)'} !important;
        }
        header::after { display: none; }

        /* ── Nav items ── */
        .nav-item {
            transition: all 0.15s ease !important;
            border-radius: 8px !important;
            margin: 1px 0 !important;
        }
        .nav-item:hover {
            background: ${DS._dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'} !important;
        }
        .nav-item[aria-selected="true"] {
            background: ${DS._dark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)'} !important;
        }
        .section-btn {
            transition: all 0.15s ease !important;
            border-radius: 6px !important;
        }
        .section-btn:hover {
            background: ${DS._dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)'} !important;
        }

        /* ── Tab content ── */
        .tab-mount {
            animation: tabIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        /* ═══ CARD SYSTEM — clean elevation ═══ */
        .fathom-card {
            transition: box-shadow 0.2s ease, border-color 0.2s ease !important;
        }
        .fathom-card:hover {
            box-shadow: ${
                DS._dark
                    ? '0 4px 16px rgba(0,0,0,0.3), 0 1px 4px rgba(0,0,0,0.15)'
                    : '0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)'
            } !important;
            border-color: ${DS._dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'} !important;
        }

        /* ── Class-based cards (legacy screens) ── */
        [class*="-card"],
        [class*="_card"],
        [class*="Card"] {
            border-radius: 16px !important;
            box-shadow: ${
                DS._dark
                    ? '0 1px 3px rgba(0,0,0,0.2), 0 1px 2px rgba(0,0,0,0.1)'
                    : '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.03)'
            } !important;
            transition: box-shadow 0.2s ease, border-color 0.2s ease !important;
            border: 1px solid ${DS._dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'} !important;
        }
        [class*="-card"]:hover,
        [class*="_card"]:hover,
        [class*="Card"]:hover {
            box-shadow: ${
                DS._dark
                    ? '0 4px 16px rgba(0,0,0,0.3), 0 2px 6px rgba(0,0,0,0.15)'
                    : '0 4px 16px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)'
            } !important;
            border-color: ${DS._dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.09)'} !important;
        }

        /* ── Panels & sections ── */
        [class*="-panel"],
        [class*="_panel"],
        [class*="-section"],
        [class*="_section"] {
            border-radius: 14px !important;
            border: 1px solid ${DS._dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'} !important;
        }

        /* ── Card headers ── */
        [class*="-card-header"],
        [class*="_card_header"],
        [class*="card-header"],
        [class*="CardHeader"] {
            background: ${DS._dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)'} !important;
            padding: 14px 20px !important;
            border-bottom: 1px solid ${DS._dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'} !important;
            font-weight: 600 !important;
        }

        /* ── Row hover ── */
        [class*="-row"]:not(table tr) {
            transition: background 0.15s ease !important;
            border-radius: 8px !important;
        }
        [class*="-row"]:not(table tr):hover {
            background: ${DS._dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'} !important;
        }

        /* ── Badges ── */
        [class*="-badge"],
        [class*="_badge"],
        [class*="Badge"] {
            border-radius: 20px !important;
            font-weight: 600 !important;
        }

        /* ── Primary buttons ── */
        button[style*="background: linear-gradient"],
        button[style*="background:linear-gradient"],
        button[style*="background: #3b82f6"],
        button[style*="background:#3b82f6"],
        button[style*="background: rgb(99"],
        [class*="-btn-primary"],
        [class*="_btn_primary"] {
            box-shadow: 0 2px 8px rgba(99,102,241,0.25) !important;
            border-radius: 10px !important;
            font-weight: 600 !important;
            transition: all 0.2s ease !important;
        }
        button[style*="background: linear-gradient"]:hover,
        button[style*="background:linear-gradient"]:hover,
        button[style*="background: #3b82f6"]:hover,
        button[style*="background:#3b82f6"]:hover,
        [class*="-btn-primary"]:hover,
        [class*="_btn_primary"]:hover {
            box-shadow: 0 4px 14px rgba(99,102,241,0.35) !important;
            transform: translateY(-1px) !important;
        }
        button[style*="background: linear-gradient"]:active,
        button[style*="background:linear-gradient"]:active,
        [class*="-btn-primary"]:active,
        [class*="_btn_primary"]:active {
            transform: translateY(0) !important;
        }

        /* ── Ghost buttons ── */
        button[style*="background: none"],
        button[style*="background:none"],
        button[style*="background: transparent"],
        button[style*="background:transparent"] {
            border-radius: 8px !important;
            transition: all 0.15s ease !important;
        }
        button[style*="background: none"]:hover,
        button[style*="background:none"]:hover,
        button[style*="background: transparent"]:hover,
        button[style*="background:transparent"]:hover {
            background: ${DS._dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'} !important;
        }

        /* ── Tables ── */
        table { border-collapse: separate !important; border-spacing: 0 !important; }
        table th {
            text-transform: uppercase !important;
            letter-spacing: 0.05em !important;
            font-size: 11px !important;
            font-weight: 600 !important;
            padding: 12px 16px !important;
            background: ${DS._dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'} !important;
            border-bottom: 1px solid ${DS._dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'} !important;
            color: ${DS.textMuted} !important;
        }
        table td {
            padding: 11px 16px !important;
            border-bottom: 1px solid ${DS.border} !important;
            transition: background 0.15s ease !important;
            font-size: 13px !important;
        }
        table tr:hover td {
            background: ${DS._dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)'} !important;
        }
        table tr:last-child td { border-bottom: none !important; }

        /* ── Global transitions ── */
        button { transition: all 0.15s ease !important; }

        /* ── Inputs ── */
        input, textarea, select {
            transition: all 0.15s ease !important;
            border-radius: 8px !important;
        }
        input:focus, textarea:focus, select:focus {
            border-color: ${DS.cyan}50 !important;
            box-shadow: 0 0 0 3px ${DS.cyan}15 !important;
            outline: none !important;
        }

        /* ── Scrollbar ── */
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${DS._dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}; border-radius: 99px; }
        ::-webkit-scrollbar-thumb:hover { background: ${DS._dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'}; }

        /* ── Charts tooltip ── */
        .recharts-default-tooltip {
            background: ${DS._dark ? 'rgba(26,39,54,0.95)' : 'rgba(255,255,255,0.98)'} !important;
            border: 1px solid ${DS._dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'} !important;
            border-radius: 10px !important;
            box-shadow: ${DS._dark ? '0 4px 16px rgba(0,0,0,0.3)' : '0 4px 16px rgba(0,0,0,0.06)'} !important;
            padding: 10px 14px !important;
        }
        .recharts-tooltip-label {
            font-weight: 600 !important;
            margin-bottom: 6px !important;
            font-size: 11px !important;
        }

        /* ── Flex overflow fix ── */
        [style*="flex: 1"], [style*="flex:1"] { min-width: 0; }
        [style*="flexDirection: column"] > [style*="flex: 1"],
        [style*="flex-direction: column"] > [style*="flex:1"] { min-height: 0; }

        /* ── Selection ── */
        ::selection { background: ${DS.cyan}25; color: ${DS.textPrimary}; }
        *:focus-visible { outline: 2px solid ${DS.cyan}40 !important; outline-offset: 2px !important; }

        /* ── Interactive card hover ── */
        [style*="cursor: pointer"][style*="border-radius"],
        [style*="cursor:pointer"][style*="borderRadius"] {
            transition: box-shadow 0.2s ease !important;
        }
        [style*="cursor: pointer"][style*="border-radius"]:hover,
        [style*="cursor:pointer"][style*="borderRadius"]:hover {
            box-shadow: ${DS._dark ? '0 4px 12px rgba(0,0,0,0.25)' : '0 4px 12px rgba(0,0,0,0.06)'} !important;
        }

        @keyframes meshGradient {
            0%, 100% { background-position: 0% 0%; }
            25% { background-position: 100% 0%; }
            50% { background-position: 100% 100%; }
            75% { background-position: 0% 100%; }
        }

        @keyframes subtleFloat {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            50% { transform: translateY(-12px) rotate(1deg); }
        }

        body {
            margin: 0;
            font-family: ${DS.fontUI};
            background: ${DS.bg};
            color: ${DS.textPrimary};
            -webkit-font-smoothing: antialiased;
        }

        /* ═══ ANIMATED MESH BACKGROUND ═══ */
        #root > div > div[style*="flex"] > div:last-child,
        main, [role="main"] {
            position: relative;
        }

        /* ── Scrollbar styling (sidebar + main content) ── */
        .sidebar-nav::-webkit-scrollbar { width: 3px; }
        .sidebar-nav::-webkit-scrollbar-track { background: transparent; }
        .sidebar-nav::-webkit-scrollbar-thumb { background: ${DS.sidebarBorder}; border-radius: 2px; }
        .sidebar-nav::-webkit-scrollbar-thumb:hover { background: rgba(99,102,241,0.6); }

        /* Main content scrollbar — thin overlay style */
        .main-scroll::-webkit-scrollbar { width: 6px; }
        .main-scroll::-webkit-scrollbar-track { background: transparent; }
        .main-scroll::-webkit-scrollbar-thumb { background: ${DS._dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}; border-radius: 3px; }
        .main-scroll::-webkit-scrollbar-thumb:hover { background: ${DS._dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}; }
        .main-scroll { scrollbar-width: thin; scrollbar-color: ${DS._dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'} transparent; }

        /* ── Section tab animation ── */
        .section-open { animation: sectionOpen 0.18s ease-out both; }

        /* ── Notification panel ── */
        .notif-panel { animation: slideDown 0.22s cubic-bezier(0.34,1.4,0.64,1) both; }
        .notif-item { transition: background 0.15s ease; }
        .notif-item:hover { background: rgba(99,102,241,0.08) !important; }

        /* ── Feedback overlay ── */
        .feedback-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 2000; display: flex; align-items: center; justify-content: center; animation: fadeIn 0.2s ease-out; }
        .feedback-modal   { animation: slideUp 0.3s cubic-bezier(0.34,1.4,0.64,1) both; }
        .fb-input:focus   { border-color: rgba(99,102,241,0.5) !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.12) !important; }
        .fb-tab:hover     { opacity: 1 !important; }
        .fb-prio:hover    { opacity: 1 !important; }
        .fb-opt:hover     { background: rgba(99,102,241,0.08) !important; }
        .fb-submit:not(:disabled):hover { filter: brightness(1.12); transform: translateY(-1px); }
        .fb-submit:not(:disabled):active { transform: translateY(0); }

        /* ── Tooltip ── */
        [data-tip] { position: relative; }
        [data-tip]::after { content: attr(data-tip); position: absolute; left: calc(100% + 10px); top: 50%; transform: translateY(-50%); background: ${DS.surface}; color: ${DS.textPrimary}; font-size: 11px; padding: 5px 9px; border-radius: 6px; border: 1px solid ${DS.border}; white-space: nowrap; pointer-events: none; opacity: 0; transition: opacity 0.15s; z-index: 999; }
        [data-tip]:hover::after { opacity: 1; }

        /* ── Star button ── */
        .star-btn { transition: transform 0.15s ease; }
        .star-btn:hover { transform: scale(1.2); }

        /* ── Collapse button ── */
        .collapse-btn { transition: all 0.2s ease; }
        .collapse-btn:hover { transform: scale(1.12); }

        /* ── Tag badge ── */
        .badge-new { animation: badgePop 0.35s ease-out both; }

        /* scrollbar: see enhanced version above */

        /* ── Responsive Design Improvements ── */
        @media (max-width: 768px) {
            /* Force sidebar collapse on tablets */
            body { --sidebar-collapsed: true; }

            /* Adjust header padding on smaller screens */
            header { padding: 0 16px !important; }

            /* Stack breadcrumb items on mobile */
            @media (max-width: 640px) {
                header { height: auto; flex-wrap: wrap; gap: 8px; }
            }
        }

        @media (max-width: 480px) {
            /* Reduce padding on very small screens */
            .tab-mount { padding: 16px 12px !important; }

            /* Stack everything on mobile */
            main > div { flex-direction: column !important; }

            /* Make buttons full-width on mobile */
            button { min-width: 100%; }
        }

        /* ── Chart responsiveness ── */
        @media (max-width: 900px) {
            /* Reduce chart container heights */
            [class*="chart"], [class*="graph"] { min-height: 200px !important; }
        }

        /* ── Improved touch targets for mobile ── */
        @media (hover: none) and (pointer: coarse) {
            button, [role="button"], .nav-item, .section-btn {
                min-height: 44px;
                min-width: 44px;
                padding: 12px !important;
            }
        }

    `}</style>
));
AppStyles.displayName = 'AppStyles';
