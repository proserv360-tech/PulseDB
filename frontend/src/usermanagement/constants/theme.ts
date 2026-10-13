/**
 * Unified design tokens for User Management components.
 *
 * All values are derived from the single app-wide THEME object so that
 * every section of the app renders with the same colour palette.
 * Uses getter properties so T always reflects the *current* THEME —
 * works with both dark and light mode without any extra wiring.
 */
import { THEME } from '../../utils/theme';

export const T = {
    // ── Backgrounds ──────────────────────────────────────────────────────────
    get bg()          { return THEME.bg; },
    get surface()     { return THEME.surface; },
    get surfaceHigh() { return THEME.surfaceRaised; },

    // ── Borders / Grid ───────────────────────────────────────────────────────
    get border()      { return THEME.grid; },
    get borderHigh()  { return THEME.gridAlt; },

    // ── Primary ──────────────────────────────────────────────────────────────
    get primary()     { return THEME.primary; },
    get primaryDim()  { return THEME.primaryFaint; },

    // ── Accent ───────────────────────────────────────────────────────────────
    get accent()      { return THEME.secondary; },

    // ── Semantic colours ─────────────────────────────────────────────────────
    get success()     { return THEME.success; },
    get successDim()  { return `${THEME.success}26`; },

    get warning()     { return THEME.warning; },
    get warningDim()  { return `${THEME.warning}26`; },

    get danger()      { return THEME.danger; },
    get dangerDim()   { return `${THEME.danger}26`; },

    get info()        { return THEME.info; },
    get infoDim()     { return `${THEME.info}26`; },

    // ── Typography ───────────────────────────────────────────────────────────
    get text()        { return THEME.textMain; },
    get textSub()     { return THEME.textMuted; },
    get textDim()     { return THEME.textDim; },
};
