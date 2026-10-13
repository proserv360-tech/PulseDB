/**
 * KPI / Metric Card — Refined corporate.
 * Gradient accent rail, header icon tile + optional delta pill,
 * optional inline sparkline, lighter display weight.
 * All props backward-compatible with prior version.
 */
import React from 'react';
import { THEME } from '../../../utils/theme';
import { CheckCircle, AlertTriangle, ArrowUpRight, ArrowDownRight, ArrowRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  detail?: string;
  icon: LucideIcon;
  color: string;
  healthy?: boolean;
  sparkline?: React.ReactNode;
  sparkData?: number[];
  delta?: string;
  deltaType?: 'increase' | 'decrease' | 'unchanged';
}

const Sparkline: React.FC<{ data: number[]; color: string }> = ({ data, color }) => {
  if (!data || data.length < 2) return null;
  const w = 120;
  const h = 22;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - 2 - ((d - min) / span) * (h - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = pts.join(' ');
  const area = `${line} ${w},${h} 0,${h}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 20, marginTop: 8, display: 'block' }} aria-hidden="true">
      <polyline points={area} fill={`${color}14`} stroke="none" />
      <polyline points={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  sub,
  detail,
  icon: Icon,
  color,
  healthy,
  sparkline,
  sparkData,
  delta,
  deltaType,
}) => {
  const deltaColor =
    deltaType === 'decrease' ? THEME.rose : deltaType === 'unchanged' ? THEME.textMuted : THEME.success;
  const DeltaIcon =
    deltaType === 'decrease' ? ArrowDownRight : deltaType === 'unchanged' ? ArrowRight : ArrowUpRight;

  return (
    <div
      className="pulsedb-card ov-metric-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '16px 18px',
        borderRadius: 14,
        background: THEME.surface,
        border: `1px solid ${THEME.glassBorder}`,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: THEME.shadowSm,
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: `linear-gradient(90deg, ${color}, ${THEME.secondary})`,
        }}
      />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 11,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `${color}0e`,
            border: `1px solid ${color}1a`,
            color,
            flexShrink: 0,
          }}
        >
          <Icon size={19} color={color} strokeWidth={2} />
        </div>
        {delta && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 11,
              fontWeight: 600,
              color: deltaColor,
              background: `${deltaColor}12`,
              padding: '3px 8px',
              borderRadius: 7,
            }}
          >
            <DeltaIcon size={12} strokeWidth={2.4} />
            {delta}
          </span>
        )}
      </div>

      <div
        style={{
          fontSize: 11,
          color: THEME.textMuted,
          fontWeight: 600,
          lineHeight: 1,
          marginBottom: 6,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {label}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
        <span
          className="ov-mono"
          style={{
            fontSize: 27,
            fontWeight: 600,
            color: THEME.textMain,
            lineHeight: 1,
            letterSpacing: '-0.03em',
          }}
        >
          {value}
        </span>
        {sub && (
          <span style={{ fontSize: 12, color: THEME.textDim, fontWeight: 500 }}>
            {sub}
          </span>
        )}
      </div>

      {sparkline ? (
        <div style={{ marginTop: 8 }}>{sparkline}</div>
      ) : sparkData ? (
        <Sparkline data={sparkData} color={color} />
      ) : null}

      {detail && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            marginTop: 10,
            padding: '3px 8px',
            borderRadius: 7,
            alignSelf: 'flex-start',
            background: healthy ? `${THEME.success}10` : `${THEME.warning}10`,
            border: `1px solid ${healthy ? `${THEME.success}22` : `${THEME.warning}22`}`,
          }}
        >
          {healthy ? (
            <CheckCircle size={12} color={THEME.success} />
          ) : (
            <AlertTriangle size={12} color={THEME.warning} />
          )}
          <span
            className="ov-mono"
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: healthy ? THEME.success : THEME.warning,
            }}
          >
            {detail}
          </span>
        </div>
      )}
    </div>
  );
};

export default KpiCard;
