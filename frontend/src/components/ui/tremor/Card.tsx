/**
 * Card & Panel — Refined corporate.
 * Hairline borders, subtle elevation + hover lift, two-line panel headers
 * with optional subtitle/timestamp and an icon tile.
 * All props backward-compatible with prior version.
 */
import React from 'react';
import { THEME } from '../../../utils/theme';
import type { LucideIcon } from 'lucide-react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className = '', style, noPadding }) => (
  <div
    className={`fathom-card ${className}`}
    style={{
      background: THEME.surface,
      borderRadius: 14,
      border: `1px solid ${THEME.glassBorder}`,
      boxShadow: THEME.shadowSm,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative',
      padding: noPadding ? 0 : undefined,
      transition: 'box-shadow 0.2s ease, border-color 0.2s ease, transform 0.2s ease',
      ...style,
    }}
  >
    {children}
  </div>
);

interface PanelCardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  icon?: LucideIcon;
  accentColor?: string;
  rightNode?: React.ReactNode;
  noPadding?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const PanelCard: React.FC<PanelCardProps> = ({
  children,
  title,
  subtitle,
  icon: TIcon,
  accentColor,
  rightNode,
  noPadding,
  className = '',
  style,
}) => {
  const accent = accentColor || THEME.primary;

  return (
    <div
      className={`fathom-card ${className}`}
      style={{
        background: THEME.surface,
        borderRadius: 14,
        border: `1px solid ${THEME.glassBorder}`,
        boxShadow: THEME.shadowSm,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        transition: 'box-shadow 0.2s ease, border-color 0.2s ease, transform 0.2s ease',
        ...style,
      }}
    >
      {title && (
        <div
          style={{
            padding: '13px 18px',
            borderBottom: `1px solid ${THEME.glassBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            minHeight: 52,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
            {TIcon && (
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 9,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: `${accent}0e`,
                  border: `1px solid ${accent}1a`,
                  flexShrink: 0,
                }}
              >
                <TIcon size={15} color={accent} strokeWidth={2} />
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: THEME.textMain,
                  letterSpacing: '-0.01em',
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {title}
              </div>
              {subtitle && (
                <div
                  style={{
                    fontSize: 11,
                    color: THEME.textMuted,
                    fontWeight: 500,
                    marginTop: 2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {subtitle}
                </div>
              )}
            </div>
          </div>
          {rightNode}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, padding: noPadding ? 0 : '16px 18px' }}>
        {children}
      </div>
    </div>
  );
};
