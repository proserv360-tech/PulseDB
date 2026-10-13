import React from 'react';
import { useTheme } from '../context/ThemeContext';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// THEME SYSTEM — Velvet Protocol  (adaptive dark / light)
//
// THEME is a *mutable* shared object. Call useAdaptiveTheme() at the top of
// any component to update it in-place for the current colour mode, so that
// every sub-component and CSS-in-JS template in the same render tree
// automatically picks up the right tokens without prop-drilling.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ── Midnight Blue — the single token set (no light/dark split) ───────────────
// Built around the brand colour #102552 (CMYK 100,78,12,55 · RGB 16,37,82).
// Surfaces form a ramp from #0a1734 (app bg) up to #1a3878 (raised chips).
// Text and accents are contrast-checked against bg / surface / surfaceRaised:
// everything clears WCAG AA on the first two. On surfaceRaised, textDim,
// primaryLight, danger and ai land in AA-large territory (3.6–4.4) — fine for
// the chips and badges they're used on, not for body copy.
const _MIDNIGHT = {
    // ── Backgrounds — midnight ramp ───────────────────────────────────────────
    bg:            '#071229',
    bgAlt:         '#0b1c3f',
    surface:       '#102552',
    surfaceHover:  '#16306a',
    surfaceRaised: '#1a3878',
    // Referenced by AlertRuleEditor and PoolMetricsDashboard but never defined,
    // so `background: THEME.surfaceLight` resolved to undefined. React drops an
    // undefined style property, leaving the browser's default button
    // background — a light grey — under near-white `textMain`. The buttons were
    // there the whole time, just invisible. Aliased to surfaceHover rather than
    // invented, so it sits on the existing ramp.
    surfaceLight:  '#16306a',

    // ── Glass ─────────────────────────────────────────────────────────────────
    glass:             'rgba(16, 37, 82, 0.80)',
    glassHeavy:        'rgba(8, 22, 51, 0.95)',
    glassBorder:       'rgba(147, 180, 235, 0.16)',
    glassBorderHover:  'rgba(147, 180, 235, 0.30)',

    // ── Typography ────────────────────────────────────────────────────────────
    textMain:    '#eaf1fd',
    textMuted:   '#9db4dc',
    textDim:     '#7a93c4',
    textInverse: '#ffffff',   // label colour on an accent fill (see primaryDark)

    // ── Blue — primary accent ─────────────────────────────────────────────────
    // primary is the fill colour; primaryDark is the fill when the label is
    // small white text (white clears AA on it); primaryLight is for links and
    // accent text sitting directly on a midnight surface.
    primary:      '#3b82f6',
    primaryDark:  '#2563eb',
    primaryLight: '#60a5fa',
    primaryFaint: 'rgba(59, 130, 246, 0.12)',

    // ── Cyan — secondary (gives charts a 2-colour system) ────────────────────
    secondary:      '#22d3ee',
    secondaryDark:  '#0891b2',
    secondaryLight: '#67e8f9',
    secondaryFaint: 'rgba(34, 211, 238, 0.10)',

    // ── Success ───────────────────────────────────────────────────────────────
    success:      '#34d399',
    successDark:  '#10b981',
    successLight: '#6ee7b7',

    // ── Danger ────────────────────────────────────────────────────────────────
    danger:      '#fb7185',
    dangerDark:  '#f43f5e',
    dangerLight: '#fda4af',

    // ── Warning ───────────────────────────────────────────────────────────────
    warning:      '#fbbf24',
    warningDark:  '#f59e0b',
    warningLight: '#fcd34d',

    // ── Info ──────────────────────────────────────────────────────────────────
    info:      '#38bdf8',
    infoDark:  '#0ea5e9',
    infoLight: '#7dd3fc',

    // ── AI/system ─────────────────────────────────────────────────────────────
    ai:      '#a78bfa',
    aiDark:  '#8b5cf6',
    aiLight: '#c4b5fd',

    // ── Extra accent colours (used by TableAnalytics groups) ─────────────────
    cyan:      '#22d3ee',
    purple:    '#a78bfa',

    // ── Structural accents ────────────────────────────────────────────────────
    grid:      '#1a3878',
    gridAlt:   '#23478f',
    pearl:     '#eaf1fd',
    deepTeal:  '#081633',
    inkBlack:  '#081633',
    phosphor:  '#3b82f6',    // primary alias for shimmer animations
    biolume:   '#22d3ee',    // secondary alias for glow animations
    mariana:   '#071229',

    // ── Shadows — deep, for a dark base ───────────────────────────────────────
    shadowSm:     '0 1px 2px rgba(2,8,23,0.40), 0 1px 3px rgba(2,8,23,0.20)',
    shadowMd:     '0 2px 8px rgba(2,8,23,0.40), 0 1px 3px rgba(2,8,23,0.25)',
    shadowLg:     '0 8px 24px rgba(2,8,23,0.45), 0 2px 8px rgba(2,8,23,0.25)',
    shadowXl:     '0 16px 40px rgba(2,8,23,0.50), 0 4px 12px rgba(2,8,23,0.30)',
    shadowInner:  'inset 0 1px 4px rgba(2,8,23,0.40)',
    shadowNeon:       (color) => `0 0 4px ${color}30, 0 0 12px ${color}15`,
    shadowNeonStrong: (color) => `0 0 6px ${color}50, 0 0 18px ${color}25`,
    shadowGold:   '0 2px 8px rgba(59,130,246,0.22), 0 0 16px rgba(59,130,246,0.10)',
    shadowTeal:   '0 2px 8px rgba(34,211,238,0.25), 0 0 16px rgba(34,211,238,0.12)',
    shadowDeep:   '0 16px 48px rgba(2,8,23,0.55), 0 4px 16px rgba(2,8,23,0.32)',

    // ── Aliases for names the components already use ──────────────────────────
    //
    // Every key below was referenced somewhere in the app but never defined, so
    // it evaluated to `undefined`. React drops an undefined style property
    // rather than warning, which is why this failed silently: a button with
    // `background: THEME.glassLight` fell back to the browser's default light
    // grey and its near-white label vanished. Same cause as the invisible
    // buttons on the alert-rule cards.
    //
    // Between them these names appear ~320 times across the codebase. They are
    // aliased onto existing ramp values rather than given new colours, so
    // nothing that currently looks right changes.
    border:        'rgba(147, 180, 235, 0.16)',  // = glassBorder
    borderHot:     'rgba(147, 180, 235, 0.30)',  // = glassBorderHover
    borderGlow:    'rgba(59, 130, 246, 0.45)',   // primary, for focus rings
    accent:        '#3b82f6',                    // = primary
    primaryHover:  '#2563eb',                    // = primaryDark
    text:          '#eaf1fd',                    // = textMain
    textSub:       '#9db4dc',                    // = textMuted
    card:          '#102552',                    // = surface
    elevated:      '#1a3878',                    // = surfaceRaised
    glassLight:    'rgba(22, 48, 106, 0.60)',    // lighter than `glass`
    tooltipBg:     'rgba(8, 22, 51, 0.95)',      // = glassHeavy
    void:          '#071229',                    // = bg, the deepest surface
    green:         '#34d399',                    // = success
    rose:          '#fb7185',                    // = danger
    gridLine:      'rgba(147, 180, 235, 0.08)',  // chart gridlines, barely there
    gridDark:      'rgba(147, 180, 235, 0.04)',
    shadowNeonPrimary: '0 0 4px rgba(59,130,246,0.30), 0 0 12px rgba(59,130,246,0.15)',

    // ── Border Radius ─────────────────────────────────────────────────────────
    radiusXs:   '4px',
    radiusSm:   '7px',
    radiusMd:   '12px',
    radiusLg:   '18px',
    radiusXl:   '26px',
    radius2Xl:  '36px',
    radiusFull: '9999px',

    // ── Transitions ───────────────────────────────────────────────────────────
    transitionFast:   'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
    transitionBase:   'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    transitionSlow:   'all 0.55s cubic-bezier(0.4, 0, 0.2, 1)',
    transitionSpring: 'all 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)',
    transitionBounce: 'all 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)',

    // ── Typography ────────────────────────────────────────────────────────────
    fontDisplay:     "'Outfit', 'Inter', -apple-system, sans-serif",
    fontBody:        "'Outfit', 'Inter', sans-serif",
    fontMono:        "'JetBrains Mono', 'Fira Code', monospace",
    fontDecorative:  "'Outfit', sans-serif",

    // ── Spacing ───────────────────────────────────────────────────────────────
    space: (n) => `${n * 4}px`,
};

// The app is midnight-only now. Both aliases resolve to the same object, so
// useAdaptiveTheme() below is a no-op colour-wise and ThemeContext can keep
// working untouched until the toggle is removed.
const _DARK = _MIDNIGHT;
const _LIGHT = _MIDNIGHT;

// ── Exported mutable object — starts in light mode (Light Console default) ───
// All importing modules hold a reference to this same object. When
// useAdaptiveTheme() mutates it in-place, every sub-component that reads
// THEME.xxx inside a function body automatically gets the updated value
// on the next render triggered by ThemeContext.
export const THEME = { ..._LIGHT };

// ── Metric values: neutral unless something is actually wrong ────────────────
// Card components take an `accent` colour that tints the icon. Passing that
// same colour to the big value made every healthy metric shout in green, so
// nothing stood out. Run the accent through this instead: alarm tones (warning,
// danger) pass through, everything else resolves to textMain — which leaves a
// real problem as the only coloured number on the screen.
export const metricValue = (accent?: string): string => {
    if (!accent) return THEME.textMain;
    const alarm = [
        THEME.warning, THEME.warningDark, THEME.warningLight,
        THEME.danger, THEME.dangerDark, THEME.dangerLight,
    ];
    return alarm.includes(accent) ? accent : THEME.textMain;
};

// ── Hook: subscribe + update THEME in-place ───────────────────────────────────
// Call this once at the top of any tab/panel component. It:
//   1. Subscribes the component to ThemeContext (re-renders on toggle).
//   2. Mutates THEME so module-level sub-components (Styles, MetricCard…)
//      also see the correct tokens when they render.
export const useAdaptiveTheme = () => {
    const { isDark } = useTheme();
    Object.assign(THEME, isDark ? _DARK : _LIGHT);
    return THEME;
};

// ── Hook: listen for global refresh events from the header button ────────────
// Tabs call useGlobalRefresh(callback) to reload their data when the user
// clicks the single refresh button in the header.
export const useGlobalRefresh = (callback: () => void) => {
    React.useEffect(() => {
        const handler = () => callback();
        window.addEventListener('fathom-refresh', handler);
        return () => window.removeEventListener('fathom-refresh', handler);
    }, [callback]);
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SVG DEFS — Gradients, Filters, Patterns
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const ChartDefs = () => (
    <svg style={{ height: 0, width: 0, position: 'absolute' }} aria-hidden="true">
        <defs>

            {/* ── Glow Filters ── */}

            {/* Blue glow — primary #3b82f6 (rgb 59,130,246 → 0.231, 0.510, 0.965) */}
            <filter id="tealGlow" height="300%" width="300%" x="-100%" y="-100%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feColorMatrix type="matrix"
                    values="0.231 0 0 0 0  0.510 0 0 0 0  0.965 0 0 0 0  0 0 0 1 0"
                    in="blur" result="coloredBlur" />
                <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>

            {/* Cyan glow — secondary #22d3ee (rgb 34,211,238 → 0.133, 0.827, 0.933) */}
            <filter id="goldGlow" height="300%" width="300%" x="-100%" y="-100%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feColorMatrix type="matrix"
                    values="0.133 0 0 0 0  0.827 0 0 0 0  0.933 0 0 0 0  0 0 0 1 0"
                    in="blur" result="coloredBlur" />
                <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>

            <filter id="neonGlow" height="350%" width="350%" x="-125%" y="-125%">
                <feGaussianBlur stdDeviation="4" result="b1" />
                <feGaussianBlur stdDeviation="10" result="b2" />
                <feMerge><feMergeNode in="b2" /><feMergeNode in="b1" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>

            <filter id="neonGlowStrong" height="450%" width="450%" x="-175%" y="-175%">
                <feGaussianBlur stdDeviation="8" result="b1" />
                <feGaussianBlur stdDeviation="18" result="b2" />
                <feGaussianBlur stdDeviation="30" result="b3" />
                <feMerge><feMergeNode in="b3" /><feMergeNode in="b2" /><feMergeNode in="b1" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>

            <filter id="softGlow" height="200%" width="200%" x="-50%" y="-50%">
                <feGaussianBlur stdDeviation="2.5" result="softBlur" />
                <feMerge><feMergeNode in="softBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>

            <filter id="depthBlur">
                <feGaussianBlur stdDeviation="12" result="blur" />
                <feBlend in="SourceGraphic" in2="blur" mode="overlay" />
            </filter>

            <filter id="dropShadowDeep">
                <feDropShadow dx="0" dy="6" stdDeviation="10" floodColor="#000" floodOpacity="0.7" />
            </filter>

            {/* ── Area Gradients ── */}
            <linearGradient id="primaryGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={THEME.primary}   stopOpacity={0.55} />
                <stop offset="45%"  stopColor={THEME.primary}   stopOpacity={0.18} />
                <stop offset="100%" stopColor={THEME.primary}   stopOpacity={0} />
            </linearGradient>

            <linearGradient id="secondaryGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={THEME.secondary} stopOpacity={0.55} />
                <stop offset="45%"  stopColor={THEME.secondary} stopOpacity={0.18} />
                <stop offset="100%" stopColor={THEME.secondary} stopOpacity={0} />
            </linearGradient>

            <linearGradient id="successGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={THEME.success}   stopOpacity={0.55} />
                <stop offset="45%"  stopColor={THEME.success}   stopOpacity={0.18} />
                <stop offset="100%" stopColor={THEME.success}   stopOpacity={0} />
            </linearGradient>

            <linearGradient id="dangerGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={THEME.danger}    stopOpacity={0.55} />
                <stop offset="45%"  stopColor={THEME.danger}    stopOpacity={0.18} />
                <stop offset="100%" stopColor={THEME.danger}    stopOpacity={0} />
            </linearGradient>

            <linearGradient id="aiGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={THEME.ai}        stopOpacity={0.55} />
                <stop offset="45%"  stopColor={THEME.ai}        stopOpacity={0.18} />
                <stop offset="100%" stopColor={THEME.ai}        stopOpacity={0} />
            </linearGradient>

            {/* ── Bar Gradients ── */}
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={THEME.primary}   stopOpacity={0.95} />
                <stop offset="100%" stopColor={THEME.deepTeal}  stopOpacity={0.6} />
            </linearGradient>

            <linearGradient id="barGradientGold" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={THEME.secondary}     stopOpacity={0.95} />
                <stop offset="100%" stopColor={THEME.secondaryDark}  stopOpacity={0.5} />
            </linearGradient>

            <linearGradient id="barGradientSuccess" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={THEME.success}     stopOpacity={0.95} />
                <stop offset="100%" stopColor={THEME.successDark}  stopOpacity={0.5} />
            </linearGradient>

            {/* ── Horizontal / Directional ── */}
            <linearGradient id="horizTealGold" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor={THEME.primary}   />
                <stop offset="100%" stopColor={THEME.secondary} />
            </linearGradient>

            <linearGradient id="horizDeepTeal" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor={THEME.deepTeal}  />
                <stop offset="50%"  stopColor={THEME.primary}   />
                <stop offset="100%" stopColor={THEME.biolume}   />
            </linearGradient>

            <linearGradient id="diagAbyssal" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%"   stopColor={THEME.primary}   />
                <stop offset="40%"  stopColor={THEME.ai}        />
                <stop offset="100%" stopColor={THEME.secondary} />
            </linearGradient>

            <linearGradient id="diagWarm" x1="0" y1="1" x2="1" y2="0">
                <stop offset="0%"   stopColor={THEME.secondaryDark} />
                <stop offset="50%"  stopColor={THEME.secondary}     />
                <stop offset="100%" stopColor={THEME.success}       />
            </linearGradient>

            <linearGradient id="diagCool" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%"   stopColor={THEME.biolume}  />
                <stop offset="50%"  stopColor={THEME.primary}  />
                <stop offset="100%" stopColor={THEME.ai}       />
            </linearGradient>

            {/* ── Radial Gradients ── */}
            <radialGradient id="radialTeal" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor={THEME.primary}  stopOpacity={0.7} />
                <stop offset="60%"  stopColor={THEME.primary}  stopOpacity={0.15} />
                <stop offset="100%" stopColor={THEME.primary}  stopOpacity={0} />
            </radialGradient>

            <radialGradient id="radialGold" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor={THEME.secondary} stopOpacity={0.7} />
                <stop offset="60%"  stopColor={THEME.secondary} stopOpacity={0.15} />
                <stop offset="100%" stopColor={THEME.secondary} stopOpacity={0} />
            </radialGradient>

            <radialGradient id="radialAbyss" cx="30%" cy="30%" r="70%">
                <stop offset="0%"   stopColor={THEME.primary}  stopOpacity={0.25} />
                <stop offset="50%"  stopColor={THEME.deepTeal} stopOpacity={0.10} />
                <stop offset="100%" stopColor={THEME.mariana}  stopOpacity={0} />
            </radialGradient>

            {/* ── Grid / Dot Patterns ── */}
            <pattern id="gridPattern" width="48" height="48" patternUnits="userSpaceOnUse">
                <path d="M 48 0 L 0 0 0 48" fill="none" stroke={THEME.grid} strokeWidth="0.6" strokeOpacity="0.5" />
            </pattern>

            <pattern id="gridFine" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke={THEME.gridAlt} strokeWidth="0.3" strokeOpacity="0.35" />
            </pattern>

            <pattern id="dotPattern" width="22" height="22" patternUnits="userSpaceOnUse">
                <circle cx="11" cy="11" r="1.2" fill={THEME.primary} fillOpacity="0.2" />
            </pattern>

            <pattern id="dotPatternFine" width="12" height="12" patternUnits="userSpaceOnUse">
                <circle cx="6" cy="6" r="0.7" fill={THEME.textDim} fillOpacity="0.4" />
            </pattern>

            <pattern id="hexPattern" width="28" height="32" patternUnits="userSpaceOnUse">
                <polygon points="14,2 24,7.5 24,18.5 14,24 4,18.5 4,7.5"
                    fill="none" stroke={THEME.grid} strokeWidth="0.5" strokeOpacity="0.3" />
            </pattern>

            <pattern id="wavePattern" width="60" height="20" patternUnits="userSpaceOnUse">
                <path d="M0 10 C15 0 30 20 45 10 S60 0 60 10"
                    fill="none" stroke={THEME.primary} strokeWidth="0.5" strokeOpacity="0.15" />
            </pattern>

            {/* ── Clip Paths ── */}
            <clipPath id="roundedClip">
                <rect rx="14" ry="14" width="100%" height="100%" />
            </clipPath>

            <clipPath id="circleClip">
                <circle cx="50%" cy="50%" r="50%" />
            </clipPath>
        </defs>
    </svg>
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GLOBAL STYLES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Import shared keyframes from centralized animation system
import { KEYFRAMES_CSS } from '../config/animations';

export const GlobalStyles = () => (
    <style>{`
    /* ── Shared FATHOM Keyframes (from config/animations.ts) ── */
    ${KEYFRAMES_CSS}

    /* ── Google Font Import ── */
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,600&family=JetBrains+Mono:wght@300;400;500&display=swap');

    /* ── CSS Custom Properties ── */
    :root {
      --primary:    ${THEME.primary};
      --secondary:  ${THEME.secondary};
      --bg:         ${THEME.bg};
      --surface:    ${THEME.surface};
      --text:       ${THEME.textMain};
      --muted:      ${THEME.textMuted};
      --dim:        ${THEME.textDim};
      --grid:       ${THEME.grid};
      --danger:     ${THEME.danger};
      --success:    ${THEME.success};
      --warning:    ${THEME.warning};
      --ai:         ${THEME.ai};
      --radius-sm:  ${THEME.radiusSm};
      --radius-md:  ${THEME.radiusMd};
      --radius-lg:  ${THEME.radiusLg};
      --transition: ${THEME.transitionBase};
    }

    /* ── Base Reset ── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: ${THEME.fontBody};
      background: ${THEME.bg};
      color: ${THEME.textMain};
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       KEYFRAME ANIMATIONS
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-10px); }
    }

    @keyframes floatSlow {
      0%, 100% { transform: translateY(0px) rotate(0deg) scale(1); }
      33% { transform: translateY(-6px) rotate(0.8deg) scale(1.01); }
      66% { transform: translateY(4px) rotate(-0.8deg) scale(0.99); }
    }

    @keyframes pulse-ring {
      0% { transform: scale(0.85); opacity: 1; }
      100% { transform: scale(2.4); opacity: 0; }
    }

    @keyframes pulse-dot {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.2); opacity: 0.8; }
    }

    @keyframes pulse-glow {
      0%, 100% { box-shadow: 0 0 6px ${THEME.primary}60, 0 0 20px ${THEME.primary}20; }
      50% { box-shadow: 0 0 12px ${THEME.primary}90, 0 0 40px ${THEME.primary}40; }
    }

    @keyframes shimmer {
      0% { background-position: -300% 0; }
      100% { background-position: 300% 0; }
    }

    @keyframes deepShimmer {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }

    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(24px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes fadeInDown {
      from { opacity: 0; transform: translateY(-24px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes fadeInLeft {
      from { opacity: 0; transform: translateX(-30px); }
      to { opacity: 1; transform: translateX(0); }
    }

    @keyframes fadeInRight {
      from { opacity: 0; transform: translateX(30px); }
      to { opacity: 1; transform: translateX(0); }
    }

    @keyframes fadeInScale {
      from { opacity: 0; transform: scale(0.9); }
      to { opacity: 1; transform: scale(1); }
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    @keyframes spinReverse {
      from { transform: rotate(360deg); }
      to { transform: rotate(0deg); }
    }

    @keyframes scanlineMove {
      0% { transform: translateY(-100%); }
      100% { transform: translateY(200vh); }
    }

    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }

    @keyframes ripple {
      0% { transform: scale(0); opacity: 0.7; }
      100% { transform: scale(5); opacity: 0; }
    }

    @keyframes morphBlob {
      0%, 100% { border-radius: 62% 38% 34% 66% / 58% 32% 68% 42%; }
      20% { border-radius: 38% 62% 56% 44% / 46% 64% 36% 54%; }
      40% { border-radius: 50% 50% 34% 66% / 28% 62% 38% 72%; }
      60% { border-radius: 42% 58% 62% 38% / 66% 38% 62% 34%; }
      80% { border-radius: 64% 36% 48% 52% / 44% 58% 42% 56%; }
    }

    @keyframes gradientShift {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }

    @keyframes inkDrop {
      0% { transform: scale(0) translateY(-20px); opacity: 0; }
      60% { transform: scale(1.08) translateY(4px); opacity: 1; }
      100% { transform: scale(1) translateY(0); opacity: 1; }
    }

    @keyframes waveform {
      0%, 100% { transform: scaleY(0.4); }
      50% { transform: scaleY(1); }
    }

    @keyframes tideRise {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-12px); }
      75% { transform: translateX(12px); }
    }

    @keyframes countUp {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes orbDrift1 {
      0%, 100% { transform: translate(0, 0) scale(1); }
      25% { transform: translate(70px, -50px) scale(1.12); }
      50% { transform: translate(-40px, 70px) scale(0.88); }
      75% { transform: translate(-70px, -25px) scale(1.06); }
    }

    @keyframes orbDrift2 {
      0%, 100% { transform: translate(0, 0) scale(1); }
      25% { transform: translate(-55px, 55px) scale(0.92); }
      50% { transform: translate(50px, -40px) scale(1.14); }
      75% { transform: translate(25px, 45px) scale(0.94); }
    }

    @keyframes orbDrift3 {
      0%, 100% { transform: translate(0, 0) scale(1); }
      33% { transform: translate(30px, 60px) scale(1.08); }
      66% { transform: translate(-60px, -30px) scale(0.9); }
    }

    @keyframes particleFloat {
      0% { transform: translateY(0) translateX(0) scale(0); opacity: 0; }
      20% { opacity: 1; }
      80% { opacity: 0.6; }
      100% { transform: translateY(-120px) translateX(30px) scale(1.5); opacity: 0; }
    }

    @keyframes depthPulse {
      0%, 100% { opacity: 0.3; transform: scale(0.96); }
      50% { opacity: 0.7; transform: scale(1.04); }
    }

    @keyframes glitchShift {
      0%, 95%, 100% { transform: translate(0); clip-path: none; }
      96% { transform: translate(-3px, 1px); clip-path: inset(30% 0 40% 0); }
      97% { transform: translate(3px, -1px); clip-path: inset(60% 0 10% 0); }
      98% { transform: translate(-2px, 2px); clip-path: inset(10% 0 70% 0); }
      99% { transform: translate(2px, -2px); clip-path: none; }
    }

    @keyframes borderDance {
      0%   { border-color: ${THEME.primary}60; }
      25%  { border-color: ${THEME.secondary}60; }
      50%  { border-color: ${THEME.ai}60; }
      75%  { border-color: ${THEME.success}60; }
      100% { border-color: ${THEME.primary}60; }
    }

    @keyframes textReveal {
      from { clip-path: inset(0 100% 0 0); }
      to   { clip-path: inset(0 0% 0 0); }
    }

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       ANIMATION UTILITIES
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

    .anim-float          { animation: float 4.5s ease-in-out infinite; }
    .anim-float-slow     { animation: floatSlow 7s ease-in-out infinite; }
    .anim-fade-in-up     { animation: fadeInUp 0.55s ease-out forwards; }
    .anim-fade-in-down   { animation: fadeInDown 0.55s ease-out forwards; }
    .anim-fade-in-left   { animation: fadeInLeft 0.5s ease-out forwards; }
    .anim-fade-in-right  { animation: fadeInRight 0.5s ease-out forwards; }
    .anim-fade-in-scale  { animation: fadeInScale 0.45s ease-out forwards; }
    .anim-ink-drop       { animation: inkDrop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
    .anim-spin           { animation: spin 1s linear infinite; }
    .anim-spin-slow      { animation: spin 6s linear infinite; }
    .anim-spin-reverse   { animation: spinReverse 8s linear infinite; }
    .anim-pulse-dot      { animation: pulse-dot 2.2s ease-in-out infinite; }
    .anim-pulse-glow     { animation: pulse-glow 3s ease-in-out infinite; }
    .anim-morph          { animation: morphBlob 10s ease-in-out infinite; }
    .anim-tide           { animation: tideRise 6s ease-in-out infinite; }
    .anim-count          { animation: countUp 0.7s ease-out forwards; }
    .anim-text-reveal    { animation: textReveal 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
    .anim-depth-pulse    { animation: depthPulse 4s ease-in-out infinite; }

    .anim-shimmer {
      background: linear-gradient(90deg, transparent, ${THEME.primaryFaint}, transparent);
      background-size: 300% 100%;
      animation: shimmer 3.5s infinite;
    }

    .anim-gradient {
      background-size: 200% 200%;
      animation: gradientShift 5s ease infinite;
    }

    .anim-glitch { animation: glitchShift 8s steps(1) infinite; }
    .anim-border-dance { animation: borderDance 6s linear infinite; }

    /* Stagger delays */
    .delay-1  { animation-delay: 0.08s; }
    .delay-2  { animation-delay: 0.16s; }
    .delay-3  { animation-delay: 0.24s; }
    .delay-4  { animation-delay: 0.32s; }
    .delay-5  { animation-delay: 0.40s; }
    .delay-6  { animation-delay: 0.50s; }
    .delay-7  { animation-delay: 0.60s; }
    .delay-8  { animation-delay: 0.72s; }
    .delay-9  { animation-delay: 0.86s; }
    .delay-10 { animation-delay: 1.00s; }

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       TYPOGRAPHY
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

    .font-display     { font-family: ${THEME.fontDisplay}; }
    .font-body        { font-family: ${THEME.fontBody}; }
    .font-mono        { font-family: ${THEME.fontMono}; }
    .font-decorative  { font-family: ${THEME.fontDecorative}; }

    .heading-display {
      font-family: ${THEME.fontDisplay};
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .heading-elegant {
      font-family: ${THEME.fontDecorative};
      font-weight: 600;
      font-style: italic;
      letter-spacing: 0.01em;
    }

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       GLASSMORPHISM CARDS
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

    .glass-card {
      background: ${THEME.glass};
      backdrop-filter: blur(20px) saturate(1.4);
      -webkit-backdrop-filter: blur(20px) saturate(1.4);
      border: 1px solid ${THEME.glassBorder};
      border-radius: ${THEME.radiusLg};
      transition: ${THEME.transitionBase};
      position: relative;
      overflow: hidden;
    }

    .glass-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, ${THEME.primary}40, transparent);
      pointer-events: none;
    }

    .glass-card:hover {
      border-color: ${THEME.glassBorderHover};
      box-shadow: ${THEME.shadowNeon(THEME.primary)};
      transform: translateY(-3px);
    }

    .glass-card-heavy {
      background: ${THEME.glassHeavy};
      backdrop-filter: blur(28px) saturate(1.5);
      -webkit-backdrop-filter: blur(28px) saturate(1.5);
      border: 1px solid ${THEME.glassBorder};
      border-radius: ${THEME.radiusLg};
      position: relative;
      overflow: hidden;
    }

    .glass-card-heavy::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, ${THEME.secondary}50, transparent);
      pointer-events: none;
    }

    .glass-card-teal {
      background: ${THEME.glass};
      backdrop-filter: blur(20px);
      border: 1px solid transparent;
      border-radius: ${THEME.radiusLg};
      background-clip: padding-box;
      position: relative;
      overflow: hidden;
    }

    .glass-card-teal::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      padding: 1px;
      background: linear-gradient(135deg, ${THEME.primary}50, transparent 40%, transparent 60%, ${THEME.secondary}40);
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      pointer-events: none;
    }

    .glass-card-gold {
      background: ${THEME.glass};
      backdrop-filter: blur(20px);
      border: 1px solid ${THEME.secondary}25;
      border-radius: ${THEME.radiusLg};
      box-shadow: inset 0 1px 0 ${THEME.secondary}20, 0 0 20px ${THEME.secondary}08;
      position: relative;
      overflow: hidden;
    }

    .glass-card-gold:hover {
      border-color: ${THEME.secondary}55;
      box-shadow: ${THEME.shadowGold};
      transform: translateY(-3px);
    }

    .glass-card-abyss {
      background: linear-gradient(160deg, ${THEME.bgAlt} 0%, ${THEME.mariana} 100%);
      border: 1px solid ${THEME.grid};
      border-radius: ${THEME.radiusLg};
      box-shadow: 0 8px 32px rgba(0,0,0,0.7);
      position: relative;
      overflow: hidden;
    }

    .glass-card-abyss::after {
      content: '';
      position: absolute;
      inset: 0;
      background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
      pointer-events: none;
    }

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       SCANLINE / DEPTH OVERLAYS
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

    .scanline-overlay {
      background: repeating-linear-gradient(
        to bottom,
        transparent,
        transparent 2px,
        rgba(0, 0, 0, 0.12) 2px,
        rgba(0, 0, 0, 0.12) 4px
      );
      pointer-events: none;
    }

    .scanline-moving::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(
        to bottom,
        transparent 0%,
        ${THEME.primaryFaint} 50%,
        transparent 100%
      );
      height: 80px;
      animation: scanlineMove 10s linear infinite;
      pointer-events: none;
    }

    .depth-vignette {
      background: radial-gradient(
        ellipse at center,
        transparent 40%,
        rgba(7, 3, 13, 0.6) 100%
      );
      pointer-events: none;
    }

    .grain-overlay::after {
      content: '';
      position: absolute;
      inset: 0;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E");
      opacity: 0.5;
      pointer-events: none;
      mix-blend-mode: overlay;
    }

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       NEON TEXT & GRADIENT TEXT
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

    .neon-text-primary {
      color: ${THEME.primary};
      text-shadow: 0 0 8px ${THEME.primary}90, 0 0 24px ${THEME.primary}45, 0 0 55px ${THEME.primary}22;
    }

    .neon-text-gold {
      color: ${THEME.secondary};
      text-shadow: 0 0 8px ${THEME.secondary}90, 0 0 24px ${THEME.secondary}45, 0 0 50px ${THEME.secondary}20;
    }

    .neon-text-success {
      color: ${THEME.success};
      text-shadow: 0 0 8px ${THEME.success}90, 0 0 22px ${THEME.success}40;
    }

    .neon-text-danger {
      color: ${THEME.danger};
      text-shadow: 0 0 8px ${THEME.danger}90, 0 0 22px ${THEME.danger}40;
    }

    .neon-text-ai {
      color: ${THEME.ai};
      text-shadow: 0 0 8px ${THEME.ai}90, 0 0 24px ${THEME.ai}45, 0 0 50px ${THEME.ai}20;
    }

    .neon-text-phosphor {
      color: ${THEME.phosphor};
      text-shadow: 0 0 10px ${THEME.phosphor}80, 0 0 30px ${THEME.primary}50, 0 0 60px ${THEME.primary}25;
    }

    .gradient-text {
      background: linear-gradient(135deg, ${THEME.primary}, ${THEME.secondary});
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .gradient-text-abyss {
      background: linear-gradient(135deg, ${THEME.biolume}, ${THEME.primary}, ${THEME.ai});
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .gradient-text-warm {
      background: linear-gradient(135deg, ${THEME.secondaryLight}, ${THEME.secondary}, ${THEME.success});
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .gradient-text-gold {
      background: linear-gradient(135deg, ${THEME.secondaryLight} 0%, ${THEME.secondary} 50%, ${THEME.pearl} 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .gradient-text-animate {
      background: linear-gradient(270deg, ${THEME.primary}, ${THEME.secondary}, ${THEME.ai}, ${THEME.primary});
      background-size: 400% 400%;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: deepShimmer 6s ease infinite;
    }

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       NEON BORDERS
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

    .neon-border-teal {
      border: 1px solid ${THEME.primary}55;
      box-shadow: inset 0 0 18px ${THEME.primary}0C, 0 0 18px ${THEME.primary}12;
    }

    .neon-border-gold {
      border: 1px solid ${THEME.secondary}55;
      box-shadow: inset 0 0 18px ${THEME.secondary}0C, 0 0 18px ${THEME.secondary}12;
    }

    .neon-border-ai {
      border: 1px solid ${THEME.ai}55;
      box-shadow: inset 0 0 18px ${THEME.ai}0C, 0 0 18px ${THEME.ai}12;
    }

    .neon-border-success {
      border: 1px solid ${THEME.success}55;
      box-shadow: inset 0 0 18px ${THEME.success}0C, 0 0 18px ${THEME.success}12;
    }

    .neon-border-danger {
      border: 1px solid ${THEME.danger}55;
      box-shadow: inset 0 0 18px ${THEME.danger}0C, 0 0 18px ${THEME.danger}12;
    }

    .neon-border-animated {
      border: 1px solid transparent;
      animation: borderDance 5s linear infinite;
    }

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       BUTTONS
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

    .btn-neon {
      position: relative;
      padding: 11px 26px;
      border: 1px solid ${THEME.primary}65;
      border-radius: ${THEME.radiusMd};
      background: ${THEME.primary}10;
      color: ${THEME.primary};
      font-family: ${THEME.fontBody};
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.04em;
      cursor: pointer;
      overflow: hidden;
      transition: ${THEME.transitionBase};
    }

    .btn-neon:hover {
      background: ${THEME.primary}22;
      border-color: ${THEME.primary}90;
      box-shadow: ${THEME.shadowTeal};
      transform: translateY(-2px);
    }

    .btn-neon:active { transform: translateY(0); }

    .btn-neon::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, transparent, ${THEME.primary}12, transparent);
      background-size: 300% 100%;
      animation: shimmer 3s infinite;
    }

    .btn-neon-gold {
      position: relative;
      padding: 11px 26px;
      border: 1px solid ${THEME.secondary}65;
      border-radius: ${THEME.radiusMd};
      background: ${THEME.secondary}10;
      color: ${THEME.secondary};
      font-family: ${THEME.fontBody};
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.04em;
      cursor: pointer;
      overflow: hidden;
      transition: ${THEME.transitionBase};
    }

    .btn-neon-gold:hover {
      background: ${THEME.secondary}22;
      border-color: ${THEME.secondary}90;
      box-shadow: ${THEME.shadowGold};
      transform: translateY(-2px);
    }

    .btn-glow {
      position: relative;
      padding: 12px 30px;
      border: none;
      border-radius: ${THEME.radiusMd};
      background: linear-gradient(135deg, ${THEME.primary}, ${THEME.primaryDark});
      color: #fff;
      font-family: ${THEME.fontBody};
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.06em;
      cursor: pointer;
      overflow: hidden;
      transition: ${THEME.transitionBase};
      box-shadow: 0 4px 20px ${THEME.primary}50;
    }

    .btn-glow:hover {
      box-shadow: 0 6px 30px ${THEME.primary}70, 0 0 60px ${THEME.primary}20;
      transform: translateY(-2px);
    }

    .btn-glow::before {
      content: '';
      position: absolute;
      top: 0; left: -100%;
      width: 60%; height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
      transition: left 0.6s;
    }

    .btn-glow:hover::before { left: 150%; }

    .btn-glow-gold {
      position: relative;
      padding: 12px 30px;
      border: none;
      border-radius: ${THEME.radiusMd};
      background: linear-gradient(135deg, ${THEME.secondaryLight}, ${THEME.secondary}, ${THEME.secondaryDark});
      color: ${THEME.inkBlack};
      font-family: ${THEME.fontDisplay};
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      cursor: pointer;
      overflow: hidden;
      transition: ${THEME.transitionBase};
      box-shadow: 0 4px 20px ${THEME.secondary}50;
    }

    .btn-glow-gold:hover {
      box-shadow: 0 6px 30px ${THEME.secondary}70;
      transform: translateY(-2px);
    }

    .btn-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 40px; height: 40px;
      border: 1px solid ${THEME.glassBorder};
      border-radius: ${THEME.radiusMd};
      background: ${THEME.surface};
      color: ${THEME.textMuted};
      cursor: pointer;
      transition: ${THEME.transitionFast};
    }

    .btn-icon:hover {
      border-color: ${THEME.primary}55;
      color: ${THEME.primary};
      box-shadow: 0 0 12px ${THEME.primary}25;
    }

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       INPUT FIELDS
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

    .input-group { position: relative; }

    .input-group:focus-within .input-label {
      color: ${THEME.primary};
      text-shadow: 0 0 8px ${THEME.primary}45;
    }

    .input-neon {
      width: 100%;
      padding: 13px 18px;
      background: ${THEME.surface};
      border: 1px solid ${THEME.grid};
      border-radius: ${THEME.radiusMd};
      color: ${THEME.textMain};
      font-family: ${THEME.fontBody};
      font-size: 14px;
      outline: none;
      transition: ${THEME.transitionBase};
      caret-color: ${THEME.primary};
    }

    .input-neon:focus {
      border-color: ${THEME.primary};
      background: ${THEME.surfaceHover};
      box-shadow: 0 0 0 3px ${THEME.primary}18, ${THEME.shadowTeal};
    }

    .input-neon::placeholder { color: ${THEME.textDim}; font-style: italic; }

    .input-neon:hover:not(:focus) { border-color: ${THEME.gridAlt}; }

    .input-neon.input-gold:focus {
      border-color: ${THEME.secondary};
      box-shadow: 0 0 0 3px ${THEME.secondary}18, ${THEME.shadowGold};
    }

    .input-label {
      display: block;
      margin-bottom: 6px;
      color: ${THEME.textMuted};
      font-family: ${THEME.fontBody};
      font-size: 12px;
      font-weight: 500;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      transition: ${THEME.transitionFast};
    }

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       STATUS INDICATORS
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

    .status-dot {
      position: relative;
      width: 10px; height: 10px;
      border-radius: 50%;
      display: inline-block;
      flex-shrink: 0;
    }

    .status-dot::before {
      content: '';
      position: absolute;
      inset: -3px;
      border-radius: 50%;
      animation: pulse-ring 2s ease-out infinite;
    }

    .status-dot.online  { background: ${THEME.success}; box-shadow: 0 0 6px ${THEME.success}; }
    .status-dot.online::before  { border: 2px solid ${THEME.success}; }

    .status-dot.warning { background: ${THEME.warning}; box-shadow: 0 0 6px ${THEME.warning}; }
    .status-dot.warning::before { border: 2px solid ${THEME.warning}; }

    .status-dot.error   { background: ${THEME.danger}; box-shadow: 0 0 6px ${THEME.danger}; }
    .status-dot.error::before   { border: 2px solid ${THEME.danger}; }

    .status-dot.idle    { background: ${THEME.textDim}; }
    .status-dot.idle::before    { border: 2px solid ${THEME.textDim}; }

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       SKELETON LOADING
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

    .skeleton {
      background: linear-gradient(
        90deg,
        ${THEME.surface} 20%,
        ${THEME.surfaceHover} 50%,
        ${THEME.surface} 80%
      );
      background-size: 300% 100%;
      animation: shimmer 2s infinite;
      border-radius: ${THEME.radiusSm};
    }

    .skeleton-teal {
      background: linear-gradient(
        90deg,
        ${THEME.surface} 20%,
        ${THEME.primaryFaint} 50%,
        ${THEME.surface} 80%
      );
      background-size: 300% 100%;
      animation: shimmer 2.5s infinite;
      border-radius: ${THEME.radiusSm};
    }

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       SCROLLBAR
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

    .custom-scroll::-webkit-scrollbar { width: 5px; }
    .custom-scroll::-webkit-scrollbar-track { background: ${THEME.bg}; }
    .custom-scroll::-webkit-scrollbar-thumb {
      background: linear-gradient(180deg, ${THEME.primary}60, ${THEME.secondary}40);
      border-radius: 3px;
    }
    .custom-scroll::-webkit-scrollbar-thumb:hover { background: ${THEME.primary}; }

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       TOOLTIPS
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

    .tooltip-neon { position: relative; }

    .tooltip-neon::after {
      content: attr(data-tip);
      position: absolute;
      bottom: calc(100% + 10px);
      left: 50%;
      transform: translateX(-50%) translateY(6px);
      padding: 7px 14px;
      background: ${THEME.glassHeavy};
      border: 1px solid ${THEME.primary}30;
      border-radius: ${THEME.radiusSm};
      color: ${THEME.textMain};
      font-family: ${THEME.fontBody};
      font-size: 12px;
      font-weight: 400;
      white-space: nowrap;
      opacity: 0;
      pointer-events: none;
      backdrop-filter: blur(12px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.6), 0 0 12px ${THEME.primary}20;
      transition: ${THEME.transitionFast};
    }

    .tooltip-neon:hover::after {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       PROGRESS BARS
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

    .progress-neon {
      width: 100%;
      height: 6px;
      background: ${THEME.grid};
      border-radius: ${THEME.radiusFull};
      overflow: hidden;
      position: relative;
    }

    .progress-neon::before {
      content: '';
      position: absolute;
      inset: 0;
      background: ${THEME.surface};
      border-radius: inherit;
    }

    .progress-neon-fill {
      height: 100%;
      border-radius: ${THEME.radiusFull};
      background: linear-gradient(90deg, ${THEME.primary}, ${THEME.biolume});
      box-shadow: 0 0 12px ${THEME.primary}70;
      transition: width 1.2s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
    }

    .progress-neon-fill::after {
      content: '';
      position: absolute;
      top: 0; right: 0;
      width: 20px; height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4));
      border-radius: inherit;
    }

    .progress-neon-fill.gold {
      background: linear-gradient(90deg, ${THEME.secondary}, ${THEME.secondaryLight});
      box-shadow: 0 0 12px ${THEME.secondary}70;
    }

    .progress-neon-fill.danger {
      background: linear-gradient(90deg, ${THEME.dangerDark}, ${THEME.danger});
      box-shadow: 0 0 12px ${THEME.danger}70;
    }

    .progress-thick { height: 10px; }
    .progress-thick .progress-neon-fill::after { display: none; }

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       BACKGROUND ORBS
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

    .bg-orb {
      position: absolute;
      border-radius: 50%;
      filter: blur(90px);
      opacity: 0.12;
      pointer-events: none;
    }

    .bg-orb-teal {
      width: 450px; height: 450px;
      background: radial-gradient(circle, ${THEME.primary}, ${THEME.deepTeal});
      animation: orbDrift1 22s ease-in-out infinite;
    }

    .bg-orb-gold {
      width: 380px; height: 380px;
      background: radial-gradient(circle, ${THEME.secondary}, ${THEME.secondaryDark});
      animation: orbDrift2 28s ease-in-out infinite;
      opacity: 0.09;
    }

    .bg-orb-ai {
      width: 320px; height: 320px;
      background: radial-gradient(circle, ${THEME.ai}, ${THEME.aiDark});
      animation: orbDrift3 24s ease-in-out infinite reverse;
      opacity: 0.10;
    }

    .bg-orb-deep {
      width: 600px; height: 600px;
      background: radial-gradient(circle, ${THEME.gridAlt}, transparent);
      animation: depthPulse 12s ease-in-out infinite;
      opacity: 0.08;
      filter: blur(120px);
    }

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       DATA TABLE
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

    .data-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      font-family: ${THEME.fontBody};
    }

    .data-table th {
      padding: 13px 18px;
      text-align: left;
      color: ${THEME.textDim};
      font-size: 10.5px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.10em;
      border-bottom: 1px solid ${THEME.grid};
    }

    .data-table th:first-child { padding-left: 24px; }

    .data-table td {
      padding: 13px 18px;
      color: ${THEME.textMain};
      font-size: 13.5px;
      border-bottom: 1px solid ${THEME.grid}99;
      transition: ${THEME.transitionFast};
    }

    .data-table td:first-child { padding-left: 24px; }

    .data-table tbody tr { transition: ${THEME.transitionFast}; }

    .data-table tbody tr:hover { background: ${THEME.primaryFaint}; }

    .data-table tbody tr:hover td { color: ${THEME.textMain}; }

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       BADGES
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

    .badge-neon {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 11px;
      border-radius: ${THEME.radiusFull};
      font-family: ${THEME.fontBody};
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
    }

    .badge-teal    { background: ${THEME.primary}1A;   color: ${THEME.primary};   border: 1px solid ${THEME.primary}35; }
    .badge-gold    { background: ${THEME.secondary}1A; color: ${THEME.secondary}; border: 1px solid ${THEME.secondary}35; }
    .badge-success { background: ${THEME.success}1A;   color: ${THEME.success};   border: 1px solid ${THEME.success}35; }
    .badge-danger  { background: ${THEME.danger}1A;    color: ${THEME.danger};    border: 1px solid ${THEME.danger}35; }
    .badge-warning { background: ${THEME.warning}1A;   color: ${THEME.warning};   border: 1px solid ${THEME.warning}35; }
    .badge-ai      { background: ${THEME.ai}1A;        color: ${THEME.ai};        border: 1px solid ${THEME.ai}35; }
    .badge-muted   { background: ${THEME.surface};     color: ${THEME.textMuted}; border: 1px solid ${THEME.grid}; }

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       DIVIDERS
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

    .divider-glow {
      height: 1px;
      background: linear-gradient(90deg, transparent, ${THEME.glassBorder}, transparent);
    }

    .divider-glow-teal {
      height: 1px;
      background: linear-gradient(90deg, transparent, ${THEME.primary}40, transparent);
    }

    .divider-glow-gold {
      height: 1px;
      background: linear-gradient(90deg, transparent, ${THEME.secondary}40, transparent);
    }

    .divider-double {
      border: none;
      height: 3px;
      background: linear-gradient(90deg, transparent, ${THEME.primary}30 30%, ${THEME.secondary}30 70%, transparent);
    }

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       STAT CARD
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

    .stat-card {
      padding: 22px 24px;
      border-radius: ${THEME.radiusLg};
      background: ${THEME.glass};
      backdrop-filter: blur(20px);
      border: 1px solid ${THEME.glassBorder};
      transition: ${THEME.transitionBase};
      position: relative;
      overflow: hidden;
    }

    .stat-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 2px;
      border-radius: 2px 2px 0 0;
    }

    .stat-card.teal::before   { background: linear-gradient(90deg, transparent, ${THEME.primary},   transparent); }
    .stat-card.gold::before   { background: linear-gradient(90deg, transparent, ${THEME.secondary}, transparent); }
    .stat-card.danger::before { background: linear-gradient(90deg, transparent, ${THEME.danger},    transparent); }
    .stat-card.ai::before     { background: linear-gradient(90deg, transparent, ${THEME.ai},        transparent); }

    .stat-card:hover { border-color: ${THEME.glassBorderHover}; transform: translateY(-4px); }

    .stat-card.teal:hover { box-shadow: ${THEME.shadowTeal}; }
    .stat-card.gold:hover { box-shadow: ${THEME.shadowGold}; }

    .stat-card .stat-label {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: ${THEME.textDim};
      margin-bottom: 8px;
    }

    .stat-card .stat-value {
      font-family: ${THEME.fontDisplay};
      font-size: 32px;
      font-weight: 700;
      line-height: 1;
      margin-bottom: 6px;
      letter-spacing: -0.01em;
    }

    .stat-card .stat-change {
      font-size: 12px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .stat-change.up   { color: ${THEME.success}; }
    .stat-change.down { color: ${THEME.danger}; }

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       MISC UTILITIES
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

    .ring-teal {
      outline: none;
      box-shadow: 0 0 0 3px ${THEME.primary}30;
    }

    .ring-gold {
      outline: none;
      box-shadow: 0 0 0 3px ${THEME.secondary}30;
    }

    .surface-raised {
      background: ${THEME.surfaceRaised};
      border: 1px solid ${THEME.grid};
      border-radius: ${THEME.radiusMd};
    }

    .surface-inset {
      background: ${THEME.bg};
      border: 1px solid ${THEME.grid};
      border-radius: ${THEME.radiusMd};
      box-shadow: ${THEME.shadowInner};
    }

    .text-balance { text-wrap: balance; }
    .text-pretty  { text-wrap: pretty; }

    ::selection {
      background: ${THEME.primary}35;
      color: ${THEME.textMain};
    }

  `}</style>
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONVENIENCE ALIASES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const LoginStyles = GlobalStyles;
export default THEME;
