// "by PROSERV360" attribution: the word "by" followed by the Proserv360 logo.
// The logo PNG has a transparent background and keeps its own grey/orange
// brand colours, so it sits on any of the app's dark surfaces as-is.
import React from 'react';
import proserv360Logo from '../../assets/proserv360-logo.png';

interface ByProserv360Props {
    /** Rendered height of the logo in px; the "by" text scales with it. */
    height?: number;
    /** Colour of the "by" text. */
    color?: string;
    style?: React.CSSProperties;
}

export default function ByProserv360({ height = 12, color = 'currentColor', style }: ByProserv360Props) {
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(height * 0.4), ...style }}>
            <span style={{ fontSize: Math.round(height * 0.85), color, lineHeight: 1, letterSpacing: '0.02em' }}>
                by
            </span>
            <img
                src={proserv360Logo}
                alt="Proserv360"
                style={{ height, width: 'auto', display: 'block' }}
                draggable={false}
            />
        </span>
    );
}
