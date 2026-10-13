/**
 * StatusBadge, LiveDot, LegendItem, Divider — refined corporate.
 */
import React from 'react';
import { THEME } from '../../../utils/theme';

interface StatusBadgeProps {
  label: string;
  color: string;
  pulse?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ label, color, pulse }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 11,
      fontWeight: 500,
      padding: '4px 10px',
      borderRadius: 7,
      background: `${color}10`,
      border: `1px solid ${color}22`,
      color,
      lineHeight: 1.3,
      whiteSpace: 'nowrap',
      fontFamily: THEME.fontMono,
      letterSpacing: '0.01em',
    }}
  >
    <span
      style={{
        width: 5,
        height: 5,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
        animation: pulse ? 'ovPulse 1.5s ease-in-out infinite' : 'none',
      }}
    />
    {label}
  </span>
);

interface LiveDotProps {
  color?: string;
  size?: number;
}

export const LiveDot: React.FC<LiveDotProps> = ({ color = THEME.success, size = 7 }) => (
  <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: '50%',
        background: color,
      }}
    />
    <div
      style={{
        position: 'absolute',
        inset: -3,
        borderRadius: '50%',
        border: `1px solid ${color}60`,
        animation: 'ovPulseRing 2s ease-out infinite',
      }}
    />
    <div
      style={{
        position: 'absolute',
        inset: -5,
        borderRadius: '50%',
        border: `1px solid ${color}35`,
        animation: 'ovPulseRing 2s ease-out infinite 0.5s',
      }}
    />
  </div>
);

interface LegendItemProps {
  label: string;
  color: string;
  dashed?: boolean;
}

export const LegendItem: React.FC<LegendItemProps> = ({ label, color }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: THEME.textMuted, fontWeight: 500 }}>
    <span
      style={{
        width: 10,
        height: 10,
        borderRadius: 3,
        background: color,
        flexShrink: 0,
      }}
    />
    {label}
  </span>
);

export const Divider: React.FC<{ style?: React.CSSProperties }> = ({ style = {} }) => (
  <div
    style={{
      height: 1,
      background: `linear-gradient(90deg, transparent, ${THEME.glassBorder}, transparent)`,
      ...style,
    }}
  />
);
