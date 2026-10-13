/**
 * Tremor-inspired Ring / Donut Gauge with animated arcs.
 * Supports optional secondary inner ring.
 */
import React from 'react';
import { THEME } from '../../../utils/theme';

interface RingGaugeProps {
  value: number;          // 0–100
  color: string;
  size?: number;
  strokeWidth?: number;
  label?: string;
  showValue?: boolean;
  secondaryValue?: number | null;
  secondaryColor?: string;
}

const RingGauge: React.FC<RingGaugeProps> = ({
  value,
  color,
  size = 80,
  strokeWidth = 6,
  label,
  showValue = true,
  secondaryValue = null,
  secondaryColor,
}) => {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const filled = (circ * Math.min(value, 100)) / 100;

  const r2 = r - strokeWidth - 3;
  const circ2 = 2 * Math.PI * r2;
  const filled2 =
    secondaryValue !== null ? (circ2 * Math.min(secondaryValue, 100)) / 100 : 0;

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`${THEME.grid}45`}
          strokeWidth={strokeWidth}
        />
        {/* Main arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{
            transition: 'stroke-dasharray 1.2s cubic-bezier(0.22, 1, 0.36, 1)',
            filter: `drop-shadow(0 0 6px ${color}60) drop-shadow(0 0 12px ${color}30)`,
          }}
        />

        {/* Optional inner ring */}
        {secondaryValue !== null && secondaryColor && (
          <>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r2}
              fill="none"
              stroke={`${THEME.grid}35`}
              strokeWidth={strokeWidth - 1.5}
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r2}
              fill="none"
              stroke={secondaryColor}
              strokeWidth={strokeWidth - 1.5}
              strokeDasharray={`${filled2} ${circ2 - filled2}`}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              style={{
                transition: 'stroke-dasharray 1.3s cubic-bezier(0.22, 1, 0.36, 1) 0.1s',
                filter: `drop-shadow(0 0 5px ${secondaryColor}50)`,
              }}
            />
          </>
        )}
      </svg>

      {/* Center label */}
      {showValue && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
          }}
        >
          <span
            style={{
              fontSize: size > 70 ? 17 : 10,
              fontWeight: 700,
              color,
              lineHeight: 1,
              fontFamily: THEME.fontMono,
            }}
          >
            {value}%
          </span>
          {label && (
            <span
              style={{
                fontSize: 7.5,
                color: THEME.textDim,
                fontWeight: 600,
                letterSpacing: '0.02em',
                marginTop: 1,
              }}
            >
              {label}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default RingGauge;