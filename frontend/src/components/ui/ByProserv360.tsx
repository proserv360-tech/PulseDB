// "by PROSERV360" attribution: the word "by" followed by the Proserv360 logo.
// The logo PNG has a transparent background. Its grey "PROSERV" (~#757170) is
// dim on the app's dark surfaces, so on dark it is brightened: 1.6x lifts the
// grey to ~#BBB5B3 while the orange "360" (already at full red) stays orange.
import React from 'react';
import proserv360Logo from '../../assets/proserv360-logo.png';

interface ByProserv360Props {
    /** Rendered height of the logo in px; the "by" text scales with it. */
    height?: number;
    /** Colour of the "by" text. */
    color?: string;
    /** Brighten the grey part of the logo for dark backgrounds (default true). */
    onDark?: boolean;
    style?: React.CSSProperties;
}

export default function ByProserv360({ height = 12, color = 'currentColor', onDark = true, style }: ByProserv360Props) {
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(height * 0.4), ...style }}>
            <span style={{ fontSize: Math.round(height * 0.85), color, lineHeight: 1, letterSpacing: '0.02em' }}>
                by
            </span>
            <img
                src={proserv360Logo}
                alt="Proserv360"
                style={{ height, width: 'auto', display: 'block', filter: onDark ? 'brightness(1.6)' : undefined }}
                draggable={false}
            />
        </span>
    );
}
