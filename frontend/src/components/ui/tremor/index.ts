/**
 * Tremor-inspired Dashboard UI Components
 * ────────────────────────────────────────
 * Purpose-built for FATHOM PostgreSQL monitoring dashboard.
 * Inspired by Tremor (tremor.so) design language.
 * Compatible with React 19 + Tailwind CSS 4 + Recharts 3.
 */

// Layout
export { Card, PanelCard } from './Card';

// Data Display
export { default as KpiCard } from './KpiCard';
export { default as ProgressBar } from './ProgressBar';
export { default as RingGauge } from './RingGauge';
export { StatStrip, MiniStat } from './StatRow';

// Feedback
export { StatusBadge, LiveDot, LegendItem, Divider } from './StatusBadge';

// Charts
export { default as ChartTooltip } from './ChartTooltip';

// Styles
export { default as TremorStyles } from './TremorStyles';