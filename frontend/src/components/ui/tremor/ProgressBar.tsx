/**
 * ProgressBar — refined corporate. Gradient fill, clean labels.
 */
import React from 'react';
import { THEME } from '../../../utils/theme';

interface ProgressBarProps {
  value: number;
  color?: string;
  label?: string;
  valueLabel?: string;
  height?: number;
  showLabel?: boolean;
  animate?: boolean;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  color = THEME.primary,
  label,
  valueLabel,
  height = 6,
  showLabel = true,
  animate = true,
}) => {
  const pct = Math.min(Math.max(value, 0), 100);

  return (
    <div>
      {showLabel && (label || valueLabel) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          {label && (
            <span style={{ fontSize: 12, color: THEME.textMuted, fontWeight: 500 }}>
              {label}
            </span>
          )}
          {valueLabel && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: THEME.textMain,
                fontFamily: THEME.fontMono,
              }}
            >
              {valueLabel}
            </span>
          )}
        </div>
      )}
      <div
        style={{
          height,
          borderRadius: height,
          background: `${THEME.grid}45`,
          overflow: 'hidden',
        }}
      >
        <div
          className={animate ? 'ov-bar-animate' : undefined}
          style={{
            width: `${pct}%`,
            height: '100%',
            borderRadius: height,
            background: `linear-gradient(90deg, ${color}, ${color}cc)`,
            transformOrigin: 'left',
          }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
