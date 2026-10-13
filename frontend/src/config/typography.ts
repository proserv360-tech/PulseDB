// ==========================================================================
//  FATHOM — Typography Scale (single source of truth for all text styles)
// ==========================================================================
//
//  Usage:  import { TYPO } from '@/config/typography';
//          style={{ ...TYPO.h1 }}
//          style={{ fontSize: TYPO.sizes.lg, fontWeight: TYPO.weights.semibold }}
// ==========================================================================

export const FONT_STACKS = {
    display:    "'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    body:       "'Outfit', 'Inter', sans-serif",
    mono:       "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
} as const;

// ── Modular Scale (base 14px, ratio ~1.25 — Major Third) ────────────────
export const FONT_SIZES = {
    '2xs':  10,
    xs:     11,
    sm:     12,
    base:   13,
    md:     14,
    lg:     16,
    xl:     18,
    '2xl':  22,
    '3xl':  26,
    '4xl':  32,
} as const;

export const FONT_WEIGHTS = {
    light:      300,
    regular:    400,
    medium:     500,
    semibold:   600,
    bold:       700,
    extrabold:  800,
} as const;

export const LINE_HEIGHTS = {
    tight:    1.1,
    snug:     1.25,
    normal:   1.5,
    relaxed:  1.65,
} as const;

export const LETTER_SPACINGS = {
    tight:    '-0.02em',
    normal:   '0',
    wide:     '0.03em',
    wider:    '0.06em',
    widest:   '0.12em',
} as const;

// ── Pre-built text styles ────────────────────────────────────────────────
// Use these as spread-in style objects:  style={{ ...TYPO.h1 }}
export const TYPO = {
    // sizes/weights/lineHeights for direct access
    sizes:          FONT_SIZES,
    weights:        FONT_WEIGHTS,
    lineHeights:    LINE_HEIGHTS,
    letterSpacings: LETTER_SPACINGS,
    fonts:          FONT_STACKS,

    // ── Headings ─────────────────────────────────────────────────────────
    h1: {
        fontFamily:     FONT_STACKS.display,
        fontSize:       FONT_SIZES['3xl'],
        fontWeight:     FONT_WEIGHTS.bold,
        lineHeight:     LINE_HEIGHTS.tight,
        letterSpacing:  LETTER_SPACINGS.tight,
    },
    h2: {
        fontFamily:     FONT_STACKS.display,
        fontSize:       FONT_SIZES['2xl'],
        fontWeight:     FONT_WEIGHTS.bold,
        lineHeight:     LINE_HEIGHTS.tight,
        letterSpacing:  LETTER_SPACINGS.tight,
    },
    h3: {
        fontFamily:     FONT_STACKS.display,
        fontSize:       FONT_SIZES.xl,
        fontWeight:     FONT_WEIGHTS.semibold,
        lineHeight:     LINE_HEIGHTS.snug,
        letterSpacing:  LETTER_SPACINGS.normal,
    },
    h4: {
        fontFamily:     FONT_STACKS.display,
        fontSize:       FONT_SIZES.lg,
        fontWeight:     FONT_WEIGHTS.semibold,
        lineHeight:     LINE_HEIGHTS.snug,
        letterSpacing:  LETTER_SPACINGS.normal,
    },

    // ── Body ─────────────────────────────────────────────────────────────
    body: {
        fontFamily:     FONT_STACKS.body,
        fontSize:       FONT_SIZES.md,
        fontWeight:     FONT_WEIGHTS.regular,
        lineHeight:     LINE_HEIGHTS.normal,
    },
    bodySmall: {
        fontFamily:     FONT_STACKS.body,
        fontSize:       FONT_SIZES.sm,
        fontWeight:     FONT_WEIGHTS.regular,
        lineHeight:     LINE_HEIGHTS.normal,
    },
    bodyLarge: {
        fontFamily:     FONT_STACKS.body,
        fontSize:       FONT_SIZES.lg,
        fontWeight:     FONT_WEIGHTS.regular,
        lineHeight:     LINE_HEIGHTS.relaxed,
    },

    // ── UI elements ──────────────────────────────────────────────────────
    label: {
        fontFamily:     FONT_STACKS.body,
        fontSize:       FONT_SIZES.xs,
        fontWeight:     FONT_WEIGHTS.semibold,
        lineHeight:     LINE_HEIGHTS.snug,
        letterSpacing:  LETTER_SPACINGS.wide,
        textTransform:  'uppercase' as const,
    },
    caption: {
        fontFamily:     FONT_STACKS.body,
        fontSize:       FONT_SIZES['2xs'],
        fontWeight:     FONT_WEIGHTS.medium,
        lineHeight:     LINE_HEIGHTS.normal,
        letterSpacing:  LETTER_SPACINGS.wide,
    },
    badge: {
        fontFamily:     FONT_STACKS.body,
        fontSize:       FONT_SIZES['2xs'],
        fontWeight:     FONT_WEIGHTS.bold,
        lineHeight:     1,
        letterSpacing:  LETTER_SPACINGS.wider,
        textTransform:  'uppercase' as const,
    },
    button: {
        fontFamily:     FONT_STACKS.body,
        fontSize:       FONT_SIZES.sm,
        fontWeight:     FONT_WEIGHTS.semibold,
        lineHeight:     1,
        letterSpacing:  LETTER_SPACINGS.wide,
    },
    buttonSmall: {
        fontFamily:     FONT_STACKS.body,
        fontSize:       FONT_SIZES.xs,
        fontWeight:     FONT_WEIGHTS.semibold,
        lineHeight:     1,
        letterSpacing:  LETTER_SPACINGS.wide,
    },
    stat: {
        fontFamily:     FONT_STACKS.display,
        fontSize:       FONT_SIZES['4xl'],
        fontWeight:     FONT_WEIGHTS.bold,
        lineHeight:     1,
        letterSpacing:  LETTER_SPACINGS.tight,
    },
    statSmall: {
        fontFamily:     FONT_STACKS.display,
        fontSize:       FONT_SIZES['2xl'],
        fontWeight:     FONT_WEIGHTS.bold,
        lineHeight:     1,
        letterSpacing:  LETTER_SPACINGS.tight,
    },

    // ── Code / Monospace ─────────────────────────────────────────────────
    code: {
        fontFamily:     FONT_STACKS.mono,
        fontSize:       FONT_SIZES.sm,
        fontWeight:     FONT_WEIGHTS.regular,
        lineHeight:     LINE_HEIGHTS.relaxed,
    },
    codeSmall: {
        fontFamily:     FONT_STACKS.mono,
        fontSize:       FONT_SIZES['2xs'],
        fontWeight:     FONT_WEIGHTS.regular,
        lineHeight:     LINE_HEIGHTS.relaxed,
    },

    // ── Metric / Dashboard values ────────────────────────────────────────
    metric: {
        fontFamily:     FONT_STACKS.mono,
        fontSize:       FONT_SIZES.lg,
        fontWeight:     FONT_WEIGHTS.bold,
        lineHeight:     1,
    },
    metricLarge: {
        fontFamily:     FONT_STACKS.mono,
        fontSize:       FONT_SIZES['2xl'],
        fontWeight:     FONT_WEIGHTS.bold,
        lineHeight:     1,
    },
} as const;

export default TYPO;
