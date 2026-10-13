/**
 * StatStrip & MiniStat — clean original styling.
 */
import React from 'react';
import { THEME, metricValue } from '../../../utils/theme';

/* ── Stat Strip ──────────────────────────────────────────────────────── */

interface StatItem {
  label: string;
  value: string | number;
  color?: string;
}

interface StatStripProps {
  items: StatItem[];
  dividers?: boolean;
}

export const StatStrip: React.FC<StatStripProps> = ({ items, dividers = false }) => (
  <div
    style={{
      display: 'flex',
      gap: dividers ? 0 : 16,
      marginTop: 14,
      paddingTop: 14,
      borderTop: `1px solid ${THEME.glassBorder}`,
    }}
  >
    {items.map((s, i) => (
      <div
        key={i}
        style={{
          flex: 1,
          minWidth: 0,
          ...(dividers
            ? {
                paddingRight: 14,
                borderRight: i < items.length - 1 ? `1px solid ${THEME.glassBorder}` : 'none',
                paddingLeft: i > 0 ? 14 : 0,
              }
            : {}),
        }}
      >
        <div
          style={{
            fontSize: 10,
            color: THEME.textDim,
            fontWeight: 600,
            marginBottom: 4,
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
          }}
        >
          {s.label}
        </div>
        <div
          className="ov-mono"
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: s.color || THEME.textMain,
            lineHeight: 1,
          }}
        >
          {s.value}
        </div>
      </div>
    ))}
  </div>
);

/* ── Mini Stat ──────────────────────────────────────────────────────── */

interface MiniStatProps {
  label: string;
  value: string | number;
  color?: string;
}

export const MiniStat: React.FC<MiniStatProps> = ({ label, value, color }) => (
  <div
    style={{
      padding: '10px 14px',
      borderRadius: 10,
      background: THEME.bgAlt || THEME.surface,
      border: `1px solid ${THEME.glassBorder}`,
    }}
  >
    <div
      style={{
        fontSize: 10,
        color: THEME.textDim,
        fontWeight: 600,
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: '0.03em',
      }}
    >
      {label}
    </div>
    <div
      className="ov-mono"
      style={{
        fontSize: 16,
        fontWeight: 600,
        color: metricValue(color) || THEME.textMain,
        lineHeight: 1,
      }}
    >
      {value}
    </div>
  </div>
);