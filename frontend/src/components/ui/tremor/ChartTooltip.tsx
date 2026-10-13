/**
 * Tremor-inspired chart tooltip for recharts.
 * Clean, minimal, glass-morphism style.
 */
import React from 'react';
import { THEME } from '../../../utils/theme';

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

const ChartTooltip: React.FC<ChartTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  return (
    <div
      style={{
        background: THEME.glassHeavy || THEME.surface,
        border: `1px solid ${THEME.glassBorder}`,
        borderRadius: 10,
        padding: '8px 12px',
        boxShadow: THEME.shadowLg,
        backdropFilter: 'blur(12px)',
        minWidth: 120,
      }}
    >
      {label && (
        <div
          style={{
            fontSize: 10,
            color: THEME.textDim,
            marginBottom: 6,
            fontWeight: 600,
            fontFamily: THEME.fontMono,
          }}
        >
          {label}
        </div>
      )}
      {payload.map((entry, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '2px 0',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span
              style={{
                width: 8,
                height: 3,
                borderRadius: 1,
                background: entry.color,
              }}
            />
            <span style={{ fontSize: 10.5, color: THEME.textMuted }}>{entry.name}</span>
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: THEME.textMain,
              fontFamily: THEME.fontMono,
            }}
          >
            {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export default ChartTooltip;