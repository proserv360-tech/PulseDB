// ==========================================================================
//  FATHOM — Spacing Scale (4px base unit — consistent rhythm)
// ==========================================================================
//
//  Usage:  import { SP, GAP, PAD } from '@/config/spacing';
//          style={{ padding: SP[4], gap: GAP.md }}
//          style={{ ...PAD.card }}
// ==========================================================================

// ── Base unit: 4px ───────────────────────────────────────────────────────
const BASE = 4;

// ── Spacing scale (multipliers of 4px) ──────────────────────────────────
// SP[0]=0  SP[1]=4  SP[2]=8  SP[3]=12  SP[4]=16  SP[5]=20  SP[6]=24
// SP[8]=32  SP[10]=40  SP[12]=48  SP[16]=64  SP[20]=80  SP[24]=96
export const SP: Record<number, number> = new Proxy({} as Record<number, number>, {
    get(_, key) {
        const n = Number(key);
        return isNaN(n) ? 0 : n * BASE;
    },
});

// Helper: convert to px string
export const sp = (n: number): string => `${n * BASE}px`;

// ── Named gap presets ────────────────────────────────────────────────────
export const GAP = {
    '2xs':  sp(0.5),   // 2px
    xs:     sp(1),     // 4px
    sm:     sp(2),     // 8px
    md:     sp(3),     // 12px
    lg:     sp(4),     // 16px
    xl:     sp(5),     // 20px
    '2xl':  sp(6),     // 24px
    '3xl':  sp(8),     // 32px
    '4xl':  sp(10),    // 40px
} as const;

// ── Named padding presets ────────────────────────────────────────────────
export const PAD = {
    /** Tight inline element: 4px 8px */
    badge:    { padding: `${sp(1)} ${sp(2)}` },
    /** Button: 8px 16px */
    button:   { padding: `${sp(2)} ${sp(4)}` },
    /** Small button: 6px 12px */
    buttonSm: { padding: `${sp(1.5)} ${sp(3)}` },
    /** Card interior: 20px */
    card:     { padding: sp(5) },
    /** Section panel: 24px */
    section:  { padding: sp(6) },
    /** Page-level: 32px */
    page:     { padding: sp(8) },
    /** Modal interior: 24px */
    modal:    { padding: sp(6) },
    /** Input field: 10px 14px */
    input:    { padding: `${sp(2.5)} ${sp(3.5)}` },
    /** Table cell: 10px 16px */
    cell:     { padding: `${sp(2.5)} ${sp(4)}` },
} as const;

// ── Grid layout helpers ──────────────────────────────────────────────────
export const GRID = {
    /** Standard card grid gap */
    gap:        sp(4),      // 16px
    /** Sidebar width collapsed */
    sidebarCollapsed: 56,
    /** Sidebar width expanded */
    sidebarExpanded:  256,
    /** Header height */
    headerHeight:     56,
    /** Card min-width for responsive grids */
    cardMinWidth:     320,
} as const;

export default { SP, sp, GAP, PAD, GRID };
