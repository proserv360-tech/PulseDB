/**
 * CSS animations — exact match of the original OvStyles from OverviewTab.
 * Uses ov- prefix to match original class names used throughout the codebase.
 */
import React from 'react';
import { THEME } from '../../../utils/theme';

const TremorStyles: React.FC = () => (
  <style>{`
    @keyframes ovFadeIn {
      from { opacity: 0; transform: translateY(14px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes ovFadeInLeft {
      from { opacity: 0; transform: translateX(-10px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @keyframes ovPulse {
      0%, 100% { opacity: 1; }
      50%      { opacity: 0.3; }
    }
    @keyframes ovPulseRing {
      0%   { transform: scale(0.8); opacity: 0.7; }
      100% { transform: scale(2.8); opacity: 0; }
    }
    @keyframes ovPulseRingSlower {
      0%   { transform: scale(0.8); opacity: 0.4; }
      100% { transform: scale(2.2); opacity: 0; }
    }
    @keyframes ovBarGrow {
      from { transform: scaleX(0); }
      to   { transform: scaleX(1); }
    }
    @keyframes ovGlowPulse {
      0%, 100% { box-shadow: 0 0 0px rgba(139,92,246,0); }
      50%      { box-shadow: 0 2px 8px rgba(139,92,246,0.08); }
    }
    @keyframes ovGlowPulseWarn {
      0%, 100% { box-shadow: 0 0 0px rgba(251,146,60,0); }
      50%      { box-shadow: 0 2px 8px rgba(251,146,60,0.08); }
    }
    @keyframes ovSweep {
      0%   { left: -40%; }
      100% { left: 140%; }
    }
    @keyframes ovRotate {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }
    @keyframes ovBell {
      0%, 100% { transform: rotate(0deg); }
      20%      { transform: rotate(-15deg); }
      40%      { transform: rotate(12deg); }
      60%      { transform: rotate(-8deg); }
      80%      { transform: rotate(5deg); }
    }
    @keyframes ovDropIn {
      from { opacity: 0; transform: translateY(-8px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes ovNotifSlide {
      from { opacity: 0; transform: translateX(12px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @keyframes ovPgBadge {
      from { opacity: 0; transform: scale(0.85); }
      to   { opacity: 1; transform: scale(1); }
    }
    @keyframes ovShimmer {
      0%   { background-position: -200% center; }
      100% { background-position: 200% center; }
    }
    @keyframes ovCountUp {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes ovVacuumPulse {
      0%, 100% { transform: scale(1); }
      50%      { transform: scale(1.04); }
    }

    .ov-stagger > * { animation: ovFadeIn 0.45s ease-out both; }
    .ov-stagger > *:nth-child(1) { animation-delay: 0.00s; }
    .ov-stagger > *:nth-child(2) { animation-delay: 0.07s; }
    .ov-stagger > *:nth-child(3) { animation-delay: 0.14s; }
    .ov-stagger > *:nth-child(4) { animation-delay: 0.21s; }
    .ov-stagger > *:nth-child(5) { animation-delay: 0.28s; }
    .ov-stagger > *:nth-child(6) { animation-delay: 0.35s; }
    .ov-stagger > *:nth-child(7) { animation-delay: 0.42s; }
    .ov-stagger > *:nth-child(8) { animation-delay: 0.49s; }

    .ov-bar-animate {
      transform-origin: left;
      animation: ovBarGrow 0.9s cubic-bezier(0.22, 1, 0.36, 1) both;
    }
    .ov-bell-anim { animation: ovBell 1.2s ease-in-out; }

    .ov-notif-item {
      animation: ovNotifSlide 0.28s ease-out both;
    }
    .ov-notif-item:nth-child(1) { animation-delay: 0.03s; }
    .ov-notif-item:nth-child(2) { animation-delay: 0.09s; }
    .ov-notif-item:nth-child(3) { animation-delay: 0.15s; }
    .ov-notif-item:nth-child(4) { animation-delay: 0.21s; }

    .ov-pg-badge { animation: ovPgBadge 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both; animation-delay: 0.3s; }
    .ov-env-dropdown { animation: ovDropIn 0.22s cubic-bezier(0.34, 1.56, 0.64, 1); }

    .ov-shimmer-btn {
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent);
      background-size: 200% 100%;
      animation: ovShimmer 2s linear infinite;
    }

    .ov-metric-card:hover {
      box-shadow: 0 4px 12px rgba(0,0,0,0.06) !important;
      transform: translateY(-1px);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .ov-metric-card {
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .ov-vacuum-urgent { animation: ovVacuumPulse 2s ease-in-out infinite; }

    .ov-mono { font-family: ${THEME.fontMono} !important; }
    .ov-display { font-family: ${THEME.fontBody} !important; }

    .ov-card-shine {
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(255,255,255,0.02) 0%, transparent 50%);
      pointer-events: none;
      border-radius: inherit;
    }
    .ov-card-shine::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(255,255,255,0.015) 0%, transparent 60%);
      pointer-events: none;
      border-radius: inherit;
    }
  `}</style>
);

export default TremorStyles;