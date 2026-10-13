/**
 * Alert and notification types
 */

export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved';

// ── Alert ───────────────────────────────────────────────────────────────────
export interface Alert {
  id: number;
  type: string;
  severity: AlertSeverity;
  message: string;
  details: Record<string, unknown>;
  status: AlertStatus;
  connectionId: number | null;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

// ── Alert Rule ──────────────────────────────────────────────────────────────
export type AlertRuleCondition = 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'ne';

export interface AlertRule {
  id: number;
  name: string;
  description: string;
  metric: string;
  condition: AlertRuleCondition;
  threshold: number;
  severity: AlertSeverity;
  enabled: boolean;
  cooldownMinutes: number;
  notifyEmail: boolean;
  notifySlack: boolean;
  connectionId: number | null;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAlertRuleInput {
  name: string;
  description?: string;
  metric: string;
  condition: AlertRuleCondition;
  threshold: number;
  severity?: AlertSeverity;
  enabled?: boolean;
  cooldownMinutes?: number;
  notifyEmail?: boolean;
  notifySlack?: boolean;
  connectionId?: number | null;
}

export interface UpdateAlertRuleInput extends Partial<CreateAlertRuleInput> {
  id: number;
}

// ── Alert Statistics ────────────────────────────────────────────────────────
export interface AlertStatistics {
  total: number;
  acknowledged: number;
  unacknowledged: number;
  bySeverity: Record<AlertSeverity, number>;
}
