// ==========================================================================
//  FATHOM — Shared Animation System
// ==========================================================================
//
//  Centralises all @keyframes and timing constants.
//  Components import ANIM for durations/easings, and inject
//  KEYFRAMES_CSS into a <style> tag (done once in GlobalStyles).
//
//  Usage:
//    import { ANIM, KEYFRAMES_CSS } from '@/config/animations';
//    style={{ animation: `${ANIM.names.fadeUp} ${ANIM.duration.normal} ${ANIM.ease.out}` }}
// ==========================================================================

// ── Easing Curves ────────────────────────────────────────────────────────
export const EASE = {
    /** Default smooth: cubic-bezier(0.4, 0, 0.2, 1) */
    default:    'cubic-bezier(0.4, 0, 0.2, 1)',
    /** Enter: starts slow */
    in:         'cubic-bezier(0.4, 0, 1, 1)',
    /** Exit: ends slow */
    out:        'cubic-bezier(0, 0, 0.2, 1)',
    /** Smooth in-out */
    inOut:      'cubic-bezier(0.4, 0, 0.2, 1)',
    /** Spring bounce */
    spring:     'cubic-bezier(0.34, 1.56, 0.64, 1)',
    /** Elastic overshoot */
    bounce:     'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    /** Linear */
    linear:     'linear',
} as const;

// ── Durations (ms) ───────────────────────────────────────────────────────
export const DURATION = {
    instant:    '0.1s',
    fast:       '0.15s',
    normal:     '0.3s',
    slow:       '0.5s',
    slower:     '0.8s',
    slowest:    '1.2s',
} as const;

// ── Animation shorthand names (used in keyframes below) ──────────────────
export const ANIM_NAMES = {
    fadeIn:         'v-fadeIn',
    fadeUp:         'v-fadeUp',
    fadeDown:       'v-fadeDown',
    fadeLeft:       'v-fadeLeft',
    fadeRight:      'v-fadeRight',
    fadeScale:      'v-fadeScale',
    slideUp:        'v-slideUp',
    slideDown:      'v-slideDown',
    slideLeft:      'v-slideLeft',
    slideRight:     'v-slideRight',
    spin:           'v-spin',
    spinReverse:    'v-spinReverse',
    pulse:          'v-pulse',
    pulseRing:      'v-pulseRing',
    pulseGlow:      'v-pulseGlow',
    pulseDot:       'v-pulseDot',
    shimmer:        'v-shimmer',
    deepShimmer:    'v-deepShimmer',
    float:          'v-float',
    floatSlow:      'v-floatSlow',
    blink:          'v-blink',
    barGrow:        'v-barGrow',
    countUp:        'v-countUp',
    scanline:       'v-scanline',
    ripple:         'v-ripple',
    modalIn:        'v-modalIn',
    tabIn:          'v-tabIn',
    badgePop:       'v-badgePop',
    borderDance:    'v-borderDance',
    gradientShift:  'v-gradientShift',
} as const;

// ── Pre-built animation shorthand strings ─────────────────────────────────
export const ANIM = {
    names:      ANIM_NAMES,
    ease:       EASE,
    duration:   DURATION,

    // Quick presets: animation: ANIM.fadeUp
    fadeIn:      `${ANIM_NAMES.fadeIn} ${DURATION.normal} ${EASE.out}`,
    fadeUp:      `${ANIM_NAMES.fadeUp} ${DURATION.normal} ${EASE.out}`,
    fadeDown:    `${ANIM_NAMES.fadeDown} ${DURATION.normal} ${EASE.out}`,
    fadeScale:   `${ANIM_NAMES.fadeScale} ${DURATION.normal} ${EASE.spring}`,
    slideUp:     `${ANIM_NAMES.slideUp} ${DURATION.normal} ${EASE.out}`,
    slideDown:   `${ANIM_NAMES.slideDown} ${DURATION.normal} ${EASE.out}`,
    spin:        `${ANIM_NAMES.spin} ${DURATION.slowest} ${EASE.linear} infinite`,
    pulse:       `${ANIM_NAMES.pulse} 2s ${EASE.inOut} infinite`,
    pulseRing:   `${ANIM_NAMES.pulseRing} 1.5s ${EASE.out} infinite`,
    shimmer:     `${ANIM_NAMES.shimmer} 2.5s ${EASE.linear} infinite`,
    float:       `${ANIM_NAMES.float} 5s ${EASE.inOut} infinite`,
    barGrow:     `${ANIM_NAMES.barGrow} ${DURATION.slow} ${EASE.out} forwards`,
    modalIn:     `${ANIM_NAMES.modalIn} ${DURATION.normal} ${EASE.spring}`,
    tabIn:       `${ANIM_NAMES.tabIn} ${DURATION.normal} ${EASE.out}`,
    badgePop:    `${ANIM_NAMES.badgePop} ${DURATION.normal} ${EASE.spring}`,
    blink:       `${ANIM_NAMES.blink} 1.4s ${EASE.inOut} infinite`,
    scanline:    `${ANIM_NAMES.scanline} 4s ${EASE.linear} infinite`,
    ripple:      `${ANIM_NAMES.ripple} 0.6s ${EASE.out}`,
} as const;

// ── Central @keyframes CSS ───────────────────────────────────────────────
// Inject once via <style>{KEYFRAMES_CSS}</style> in GlobalStyles.
// Components reference animation names from ANIM_NAMES / ANIM presets.
export const KEYFRAMES_CSS = `
/* ═══ FATHOM Shared Keyframes ═══ */

@keyframes ${ANIM_NAMES.fadeIn} {
    from { opacity: 0; }
    to   { opacity: 1; }
}

@keyframes ${ANIM_NAMES.fadeUp} {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
}

@keyframes ${ANIM_NAMES.fadeDown} {
    from { opacity: 0; transform: translateY(-16px); }
    to   { opacity: 1; transform: translateY(0); }
}

@keyframes ${ANIM_NAMES.fadeLeft} {
    from { opacity: 0; transform: translateX(-16px); }
    to   { opacity: 1; transform: translateX(0); }
}

@keyframes ${ANIM_NAMES.fadeRight} {
    from { opacity: 0; transform: translateX(16px); }
    to   { opacity: 1; transform: translateX(0); }
}

@keyframes ${ANIM_NAMES.fadeScale} {
    from { opacity: 0; transform: scale(0.92); }
    to   { opacity: 1; transform: scale(1); }
}

@keyframes ${ANIM_NAMES.slideUp} {
    from { transform: translateY(20px); opacity: 0; }
    to   { transform: translateY(0); opacity: 1; }
}

@keyframes ${ANIM_NAMES.slideDown} {
    from { transform: translateY(-20px); opacity: 0; }
    to   { transform: translateY(0); opacity: 1; }
}

@keyframes ${ANIM_NAMES.slideLeft} {
    from { transform: translateX(-20px); opacity: 0; }
    to   { transform: translateX(0); opacity: 1; }
}

@keyframes ${ANIM_NAMES.slideRight} {
    from { transform: translateX(20px); opacity: 0; }
    to   { transform: translateX(0); opacity: 1; }
}

@keyframes ${ANIM_NAMES.spin} {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
}

@keyframes ${ANIM_NAMES.spinReverse} {
    from { transform: rotate(360deg); }
    to   { transform: rotate(0deg); }
}

@keyframes ${ANIM_NAMES.pulse} {
    0%, 100% { opacity: 1; }
    50%      { opacity: 0.5; }
}

@keyframes ${ANIM_NAMES.pulseRing} {
    0%   { transform: scale(0.85); opacity: 1; }
    100% { transform: scale(2.4); opacity: 0; }
}

@keyframes ${ANIM_NAMES.pulseGlow} {
    0%, 100% { box-shadow: 0 0 6px currentColor; }
    50%      { box-shadow: 0 0 20px currentColor, 0 0 40px currentColor; }
}

@keyframes ${ANIM_NAMES.pulseDot} {
    0%, 100% { transform: scale(1); opacity: 1; }
    50%      { transform: scale(1.2); opacity: 0.8; }
}

@keyframes ${ANIM_NAMES.shimmer} {
    0%   { background-position: -200% 0; }
    100% { background-position: 200% 0; }
}

@keyframes ${ANIM_NAMES.deepShimmer} {
    0%   { background-position: -300% 0; }
    100% { background-position: 300% 0; }
}

@keyframes ${ANIM_NAMES.float} {
    0%, 100% { transform: translateY(0px); }
    50%      { transform: translateY(-10px); }
}

@keyframes ${ANIM_NAMES.floatSlow} {
    0%, 100% { transform: translateY(0px) rotate(0deg) scale(1); }
    33%      { transform: translateY(-6px) rotate(0.8deg) scale(1.01); }
    66%      { transform: translateY(4px) rotate(-0.8deg) scale(0.99); }
}

@keyframes ${ANIM_NAMES.blink} {
    0%, 100% { opacity: 1; }
    50%      { opacity: 0.3; }
}

@keyframes ${ANIM_NAMES.barGrow} {
    from { transform: scaleX(0); transform-origin: left; }
    to   { transform: scaleX(1); transform-origin: left; }
}

@keyframes ${ANIM_NAMES.countUp} {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
}

@keyframes ${ANIM_NAMES.scanline} {
    0%   { transform: translateY(-100%); }
    100% { transform: translateY(100vh); }
}

@keyframes ${ANIM_NAMES.ripple} {
    0%   { transform: scale(0); opacity: 0.5; }
    100% { transform: scale(4); opacity: 0; }
}

@keyframes ${ANIM_NAMES.modalIn} {
    from { opacity: 0; transform: scale(0.95) translateY(10px); }
    to   { opacity: 1; transform: scale(1) translateY(0); }
}

@keyframes ${ANIM_NAMES.tabIn} {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
}

@keyframes ${ANIM_NAMES.badgePop} {
    0%   { transform: scale(0); }
    60%  { transform: scale(1.15); }
    100% { transform: scale(1); }
}

@keyframes ${ANIM_NAMES.borderDance} {
    0%, 100% { border-color: currentColor; }
    50%      { border-color: transparent; }
}

@keyframes ${ANIM_NAMES.gradientShift} {
    0%   { background-position: 0% 50%; }
    50%  { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
}
`;

export default ANIM;
