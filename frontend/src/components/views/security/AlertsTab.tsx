import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  AlertCircle, AlertTriangle, Info, Check, RefreshCw, CheckCircle2,
  Bell, Settings, History, Plus, Search, X, Clock, Shield, Zap,
  Filter, MoreVertical, PauseCircle, PlayCircle, Share2, ArrowUpRight,
  Trash2, ChevronDown, Activity, TrendingUp, TrendingDown, Eye,
  EyeOff, Volume2, VolumeX, Layers, BarChart2, Target, Terminal,
  AlertOctagon, Cpu, Database, Server, Wifi, HardDrive, GitBranch,
  CornerDownRight, ExternalLink, ChevronRight, Minus, Edit3, Copy,
  Download, Upload, Moon, Sun, SlidersHorizontal, MessageSquare,
  Users, AtSign, Send, Lock, GitMerge, CheckCircle, XCircle
} from 'lucide-react';
import { THEME, useAdaptiveTheme, useGlobalRefresh, metricValue } from '../../../utils/theme';
import { fetchData, postData, deleteData } from '../../../utils/api';

/* ─────────────────────────────────────────────────────────────────
   PulseDB v3 – Advanced Monitoring & Alert Intelligence Platform
   NEW: Team Collaboration, Approval Workflows, Channel Health,
        Alert Simulator, Impact Radius, Suppression Windows, API Quotas
───────────────────────────────────────────────────────────────── */

const SEVERITY = {
  critical: { color: THEME.danger, glow: `${THEME.danger}40`, bg: `${THEME.danger}14`, icon: AlertOctagon, label: 'CRIT' },
  warning:  { color: THEME.warning, glow: `${THEME.warning}33`,   bg: `${THEME.warning}12`,  icon: AlertTriangle, label: 'WARN' },
  info:     { color: THEME.primary, glow: `${THEME.primary}2e`, bg: `${THEME.primary}0f`, icon: Info, label: 'INFO' },
  resolved: { color: THEME.success, glow: `${THEME.success}26`, bg: `${THEME.success}0d`, icon: CheckCircle2, label: 'RSLV' },
};

const METRICS = {
  cpu_usage:    { label: 'CPU Usage', unit: '%', icon: Cpu, max: 100 },
  memory_usage: { label: 'Memory', unit: '%', icon: Database, max: 100 },
  disk_free:    { label: 'Disk Free', unit: 'GB', icon: HardDrive, max: 500 },
  api_latency:  { label: 'API Latency', unit: 'ms', icon: Wifi, max: 2000 },
  error_rate:   { label: 'Error Rate', unit: '%', icon: AlertCircle, max: 100 },
  throughput:   { label: 'Throughput', unit: 'rps', icon: Activity, max: 10000 },
  network_in:   { label: 'Network In', unit: 'MB/s', icon: Upload, max: 1000 },
  network_out:  { label: 'Network Out', unit: 'MB/s', icon: Download, max: 1000 },
};

const CATEGORIES = ['performance', 'security', 'reliability', 'resources', 'maintenance', 'network'];

const TEAM_MEMBERS = [];

const MOCK_ALERTS = [];

const MOCK_RULES = [];

const MOCK_HISTORY = [];

const MOCK_SUPPRESSION = [];

const CHANNEL_STATUS = [];

const genSparkData = (points = 20, base = 50, variance = 20) =>
    Array.from({ length: points }, (_, i) => ({
      v: 0,
      t: i
    }));

const LIVE_METRICS = {
  cpu_usage:    { current: 0,  data: genSparkData(20, 73, 15),  trend: 'stable' },
  memory_usage: { current: 0,  data: genSparkData(20, 61, 10),  trend: 'stable' },
  error_rate:   { current: 0, data: genSparkData(20, 2.4, 2),  trend: 'stable' },
  api_latency:  { current: 0, data: genSparkData(20, 187, 80), trend: 'stable' },
};

const formatAge = (ts) => {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};
const formatTime = (ts) => new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

// ─── SUB-COMPONENTS ───────────────────────────────────────────────
const Sparkline = ({ data, color, width = 80, height = 28 }) => {
  if (!data?.length) return null;
  const max = Math.max(...data.map(d => d.v), 0.01);
  const min = Math.min(...data.map(d => d.v));
  const range = max - min || 1;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((d.v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  const lastPt = data[data.length - 1];
  const lastX = width;
  const lastY = height - ((lastPt.v - min) / range) * (height - 4) - 2;
  return (
      <svg width={width} height={height} style={{ overflow: 'visible' }}>
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
        <circle cx={lastX} cy={lastY} r="2.5" fill={color} />
      </svg>
  );
};

const PulseDot = ({ color, size = 8 }) => (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size + 8, height: size + 8 }}>
    <span style={{ position: 'absolute', borderRadius: '50%', background: color, opacity: 0.3, width: size + 8, height: size + 8, animation: 'pulse-ring 1.8s ease infinite' }} />
    <span style={{ borderRadius: '50%', background: color, width: size, height: size, display: 'block', position: 'relative', zIndex: 1 }} />
  </span>
);

const SeverityBadge = ({ severity, small }) => {
  const s = SEVERITY[severity] || SEVERITY.info;
  return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: small ? '2px 6px' : '3px 8px', borderRadius: 18, background: s.bg, border: `1px solid ${s.color}20`, color: s.color, fontSize: small ? 9 : 10, fontFamily: THEME.fontMono, fontWeight: 700, letterSpacing: '0.02em' }}>
      {s.label}
    </span>
  );
};

const Toggle = ({ on, onChange, accent = THEME.primary }) => (
    <button onClick={onChange} style={{ width: 36, height: 20, borderRadius: 16, border: 'none', cursor: 'pointer', padding: 0, background: on ? accent : THEME.glassBorder, position: 'relative', transition: 'background 0.25s', outline: 'none', flexShrink: 0 }} aria-checked={on} role="switch">
      <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: on ? 19 : 3, transition: 'left 0.2s cubic-bezier(.4,0,.2,1)', boxShadow: '0 4px 20px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)' }} />
    </button>
);

const ChannelDot = ({ active, label }) => (
    <span title={label} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 16, background: active ? `${THEME.primary}12` : THEME.glassBorder, border: `1px solid ${active ? `${THEME.primary}40` : THEME.glassBorder}`, fontSize: 8, fontWeight: 700, color: active ? THEME.primary : THEME.textMuted, fontFamily: THEME.fontMono, cursor: 'default', transition: 'all 0.2s' }}>
    {label.slice(0,2).toUpperCase()}
  </span>
);

const Avatar = ({ initials, online, size = 24 }) => (
    <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
    <span style={{ width: size, height: size, borderRadius: '50%', background: `${THEME.primary}33`, border: `1px solid ${THEME.primary}59`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: 700, color: THEME.primary, fontFamily: THEME.fontMono }}>
      {initials}
    </span>
      {online !== undefined && (
          <span style={{ position: 'absolute', bottom: 0, right: 0, width: 7, height: 7, borderRadius: '50%', background: online ? THEME.success : THEME.textMuted, border: `1.5px solid ${THEME.bg}` }} />
      )}
  </span>
);

const MetricCard = ({ metricKey, data }) => {
  const m = METRICS[metricKey];
  const Icon = m.icon;
  const pct = Math.min(100, (data.current / m.max) * 100);
  const color = pct > 85 ? SEVERITY.critical.color : pct > 65 ? SEVERITY.warning.color : SEVERITY.info.color;
  return (
      <div style={{ background: THEME.surface, border: `1px solid ${THEME.glassBorder}`, borderRadius: 18, padding: '22px 28px', display: 'flex', flexDirection: 'column', gap: 22, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, ${color}00, ${color}, ${color}00)`, opacity: 0.4 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <Icon size={12} color={color} />
            <span style={{ fontSize: 11, color: THEME.textMuted, fontFamily: THEME.fontMono, letterSpacing: '0.04em' }}>{m.label.toUpperCase()}</span>
          </div>
          {data.trend === 'up' && <TrendingUp size={12} color={SEVERITY.warning.color} />}
          {data.trend === 'down' && <TrendingDown size={12} color={SEVERITY.resolved.color} />}
          {data.trend === 'stable' && <Minus size={12} color={THEME.textMuted} />}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: metricValue(color), fontFamily: THEME.fontMono, lineHeight: 1 }}>
            {data.current}<span style={{ fontSize: 10, color: THEME.textMuted, fontWeight: 400, marginLeft: 3 }}>{m.unit}</span>
          </span>
          <Sparkline data={data.data} color={color} />
        </div>
        <div style={{ height: 2, background: THEME.glassBorder, borderRadius: 1, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${color}70, ${color})`, borderRadius: 1, transition: 'width 0.5s ease' }} />
        </div>
      </div>
  );
};

// ─────────────────────────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────
const PULSEDBDashboard = () => {
  useAdaptiveTheme();
  // Note: useGlobalRefresh will be added after loadAlerts is defined
  const [activeTab, setActiveTab]               = useState('active');
  const [showCreateModal, setShowCreateModal]   = useState(false);
  const [showDetailPanel, setShowDetailPanel]   = useState(null);
  const [showCommentPanel, setShowCommentPanel] = useState(null);
  const [showImpactPanel, setShowImpactPanel]   = useState(null);
  const [maintenanceMode, setMaintenanceMode]   = useState(false);
  const [soundEnabled, setSoundEnabled]         = useState(true);
  const [alerts, setAlerts]                     = useState(MOCK_ALERTS);
  const [alertsLoading, setAlertsLoading]       = useState(true);
  const [alertsRefreshing, setAlertsRefreshing] = useState(false);
  const [alertRules, setAlertRules]             = useState(MOCK_RULES);
  const [history]                               = useState(MOCK_HISTORY);
  const [liveMetrics]                           = useState(LIVE_METRICS);
  const [tickCount, setTickCount]               = useState(0);
  const [filters, setFilters]                   = useState({ severity: 'all', category: 'all', search: '', acknowledged: 'all' });
  const [histFilter, setHistFilter]             = useState('');
  const [editingRule, setEditingRule]           = useState(null);
  const [selectedAlerts, setSelectedAlerts]     = useState(new Set());
  const [toast, setToast]                       = useState(null);
  const [commentText, setCommentText]           = useState('');
  const [approvalState, setApprovalState]       = useState({});
  const [suppressionWindows, setSuppressionWindows] = useState(MOCK_SUPPRESSION);
  const [simState, setSimState]                 = useState({ rule: 'rule-001', running: false, result: null });
  const [newRule, setNewRule]                   = useState({ name: '', metric: 'cpu_usage', condition: 'gt', threshold: 80, duration: 5, severity: 'warning', channels: { email: true, slack: false, pagerduty: false }, category: 'performance', description: '' });

  // ── Live alerts fetch ──────────────────────────────────────────
  const loadAlerts = useCallback(async (quiet = false) => {
    if (!quiet) setAlertsLoading(true); else setAlertsRefreshing(true);
    try {
      const data = await fetchData('/api/alerts?limit=100');

      // GET /api/alerts returns a bare array; /api/alerts/recent and the demo
      // fixture return { alerts: [...] }. This read `data?.alerts?.length`,
      // which is undefined on an array — so with a real backend the branch
      // never ran and the tab silently kept showing mock data. Accept both
      // shapes rather than pick a side and break the other caller.
      const incoming = Array.isArray(data) ? data : (data?.alerts ?? null);

      // Distinguish "no alerts" from "no response". An empty array is a real
      // answer and must clear the mocks; null means we never got one.
      if (Array.isArray(incoming)) {
        // Merge: preserve UI-only fields (comments, impactRadius, pendingApproval)
        setAlerts(prev => {
          const prevMap = Object.fromEntries(prev.map(a => [String(a.id), a]));
          return incoming.map(a => ({
            ...a,
            // The list filters on a.source and a.message; a row missing either
            // throws inside the filter and blanks the whole tab.
            source: a.source ?? a.category ?? 'pulsedb',
            message: a.message ?? '',
            // keep local enrichment if available
            comments: prevMap[String(a.id)]?.comments ?? [],
            impactRadius: prevMap[String(a.id)]?.impactRadius ?? null,
            pendingApproval: prevMap[String(a.id)]?.pendingApproval ?? null,
          }));
        });
      }
    } catch {
      // Keep existing state (mock data already populated) on network error
    } finally {
      setAlertsLoading(false);
      setAlertsRefreshing(false);
    }
  }, []);

  // ── Live rules fetch ───────────────────────────────────────────
  // This tab used to show MOCK_RULES forever — nothing ever fetched, so the
  // "Active Rules" stat and the whole rules list were fabricated regardless of
  // what was in alert_rules. Anyone seeding rules saw no change here.
  const loadRules = useCallback(async () => {
    try {
      const data = await fetchData('/api/alerts/rules');
      const rows = Array.isArray(data) ? data : (data?.rules ?? null);
      if (!Array.isArray(rows)) return;
      // The backend row shape differs from the mock's: `enabled` not `active`,
      // and no trigger counters. Map rather than let the UI read undefined and
      // silently render every rule as disabled.
      setAlertRules(rows.map(r => ({
        ...r,
        active: r.enabled ?? r.active ?? false,
        channels: r.channels ?? [],
        triggerCount: r.trigger_count ?? 0,
        lastTriggered: r.last_triggered ?? null,
      })));
    } catch {
      // Leave whatever is on screen; an empty rules list is worse than a stale one.
    }
  }, []);

  useGlobalRefresh(() => { loadAlerts(true); loadRules(); });

  useEffect(() => { loadAlerts(false); loadRules(); }, [loadAlerts, loadRules]);

  // Refresh alerts on a 30s interval
  useEffect(() => {
    const t = setInterval(() => loadAlerts(true), 30_000);
    return () => clearInterval(t);
  }, [loadAlerts]);

  useEffect(() => {
    const t = setInterval(() => setTickCount(c => c + 1), 10000);
    return () => clearInterval(t);
  }, []);

  // `action` is optional { label, onClick } — used by delete to offer Undo.
  // The toast outlives the default 3s when it carries an action, so the button
  // does not vanish while the user is still deciding; it is dismissed on click.
  const toastTimer = useRef(null);
  const showToast = useCallback((msg, type = 'success', action = null) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type, action });
    toastTimer.current = setTimeout(() => setToast(null), action ? 5000 : 3000);
  }, []);

  const stats = useMemo(() => ({
    total: alerts.length,
    critical: alerts.filter(a => a.severity === 'critical').length,
    warning: alerts.filter(a => a.severity === 'warning').length,
    unacked: alerts.filter(a => !a.acknowledged).length,
    activeRules: alertRules.filter(r => r.active).length,
  }), [alerts, alertRules]);

  const filteredAlerts = useMemo(() => alerts.filter(a => {
    if (filters.severity !== 'all' && a.severity !== filters.severity) return false;
    if (filters.category !== 'all' && a.category !== filters.category) return false;
    if (filters.acknowledged === 'unacked' && a.acknowledged) return false;
    if (filters.acknowledged === 'acked' && !a.acknowledged) return false;
    if (filters.search && !a.message.toLowerCase().includes(filters.search.toLowerCase()) && !a.source.toLowerCase().includes(filters.search.toLowerCase())) return false;
    return true;
  }), [alerts, filters, tickCount]);

  const filteredHistory = useMemo(() =>
      history.filter(h => !histFilter || h.message.toLowerCase().includes(histFilter.toLowerCase())), [history, histFilter]);

  // Actions
  const acknowledgeAlert = async (id) => {
    const alert = alerts.find(a => a.id === id);
    if (alert?.severity === 'critical' && !approvalState[id]) {
      setApprovalState(prev => ({ ...prev, [id]: { status: 'pending', requestedBy: 'you', requestedAt: Date.now() } }));
      showToast('Approval request sent to L2 team', 'info');
      return;
    }
    // Optimistic update
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true, acknowledged_by: 'you' } : a));
    setApprovalState(prev => { const n = {...prev}; delete n[id]; return n; });
    showToast('Alert acknowledged');
    // Persist to backend
    try { await postData(`/api/alerts/${id}/acknowledge`, {}); }
    catch { /* revert */ setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: false, acknowledged_by: undefined } : a)); showToast('Failed to acknowledge', 'warning'); }
  };

  const approveAck = (id) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true, acknowledged_by: 'current user' } : a));
    setApprovalState(prev => { const n = {...prev}; delete n[id]; return n; });
    showToast('Acknowledgment approved and applied');
  };

  const rejectAck = (id) => {
    setApprovalState(prev => { const n = {...prev}; delete n[id]; return n; });
    showToast('Acknowledgment request rejected', 'warning');
  };

  const snoozeAlert = (id) => { setAlerts(prev => prev.filter(a => a.id !== id)); showToast('Alert snoozed for 1 hour', 'info'); };
  const escalateAlert = (id) => showToast(`Alert ${id} escalated to L2 on-call`, 'warning');
  const toggleSelect = (id) => setSelectedAlerts(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAll = () => setSelectedAlerts(new Set(filteredAlerts.map(a => a.id)));
  const clearSelection = () => setSelectedAlerts(new Set());
  const acknowledgeMany = async () => {
    const ids = [...selectedAlerts];
    // Optimistic update
    setAlerts(prev => prev.map(a => ids.includes(a.id) ? { ...a, acknowledged: true, acknowledged_by: 'you' } : a));
    showToast(`${ids.length} alerts acknowledged`);
    setSelectedAlerts(new Set());
    // Persist to backend
    try { await postData('/api/alerts/bulk-acknowledge', { alertIds: ids }); }
    catch { loadAlerts(true); showToast('Bulk acknowledge partially failed', 'warning'); }
  };
  /**
   * Delete with a grace period rather than a confirm dialog.
   *
   * The row disappears immediately and the request is held for UNDO_MS. Undo
   * cancels the timer and puts the row back, so nothing was ever sent — which
   * is why this can offer undo at all. Once the timer fires the delete is a
   * hard delete server-side and there is nothing left to restore.
   *
   * Pending timers are keyed by alert id so several deletions can be in flight
   * at once without one undo cancelling another.
   */
  const UNDO_MS = 5000;
  const pendingDeletes = useRef(new Map());

  // A pending delete that never fires because the tab closed would leave the
  // row on screen but gone from the list on next load. Flush on unmount.
  useEffect(() => () => {
    for (const [, entry] of pendingDeletes.current) clearTimeout(entry.timer);
    pendingDeletes.current.clear();
  }, []);

  const deleteAlert = (id) => {
    const alert = alerts.find(a => a.id === id);
    if (!alert) return;

    setAlerts(prev => prev.filter(a => a.id !== id));
    setSelectedAlerts(prev => { const n = new Set(prev); n.delete(id); return n; });

    const timer = setTimeout(async () => {
      pendingDeletes.current.delete(id);
      try {
        await deleteData(`/api/alerts/${id}`);
      } catch {
        // Put it back rather than leaving the screen disagreeing with the DB.
        loadAlerts(true);
        showToast('Failed to delete alert', 'warning');
      }
    }, UNDO_MS);

    pendingDeletes.current.set(id, { timer, alert });

    showToast('Alert deleted', 'info', {
      label: 'Undo',
      onClick: () => {
        const entry = pendingDeletes.current.get(id);
        if (!entry) return;              // already committed — too late
        clearTimeout(entry.timer);
        pendingDeletes.current.delete(id);
        setAlerts(prev =>
          [...prev, entry.alert].sort((a, b) => b.timestamp - a.timestamp),
        );
      },
    });
  };

  const deleteMany = () => {
    const ids = [...selectedAlerts];
    if (!ids.length) return;
    const removed = alerts.filter(a => ids.includes(a.id));

    setAlerts(prev => prev.filter(a => !ids.includes(a.id)));
    setSelectedAlerts(new Set());

    const key = `bulk:${Date.now()}`;
    const timer = setTimeout(async () => {
      pendingDeletes.current.delete(key);
      try {
        const r = await postData('/api/alerts/bulk-delete', { alertIds: ids });
        // `missing` is not an error: someone else may have cleared part of the
        // selection first. Only say so if it actually happened.
        if (r?.missing > 0) showToast(`${r.deleted} deleted, ${r.missing} already gone`, 'info');
      } catch {
        loadAlerts(true);
        showToast('Bulk delete failed', 'warning');
      }
    }, UNDO_MS);

    pendingDeletes.current.set(key, { timer, alert: null });

    showToast(`${ids.length} alert${ids.length !== 1 ? 's' : ''} deleted`, 'info', {
      label: 'Undo',
      onClick: () => {
        const entry = pendingDeletes.current.get(key);
        if (!entry) return;
        clearTimeout(entry.timer);
        pendingDeletes.current.delete(key);
        setAlerts(prev => [...prev, ...removed].sort((a, b) => b.timestamp - a.timestamp));
      },
    });
  };

  // These three used to mutate local state only, so a rule you disabled came
  // back enabled on the next refresh and a rule you "deleted" reappeared. The
  // endpoints existed the whole time. Optimistic update, then reconcile — and
  // reload on failure so the screen never disagrees with the database.
  const toggleRule = async (id) => {
    const rule = alertRules.find(r => r.id === id);
    if (!rule) return;
    const next = !rule.active;
    setAlertRules(prev => prev.map(r => r.id === id ? { ...r, active: next } : r));
    try {
      await postData(`/api/alerts/rules/${id}`, { enabled: next });
      showToast(next ? 'Rule enabled' : 'Rule disabled');
    } catch {
      showToast('Could not update rule', 'warning');
      loadRules();
    }
  };

  const deleteRule = async (id) => {
    const snapshot = alertRules;
    setAlertRules(prev => prev.filter(r => r.id !== id));
    try {
      await deleteData(`/api/alerts/rules/${id}`);
      showToast('Rule deleted', 'warning');
    } catch {
      setAlertRules(snapshot);
      showToast('Could not delete rule', 'warning');
    }
  };

  const handleCreateRule = async (e) => {
    e.preventDefault();
    try {
      if (editingRule) {
        await postData(`/api/alerts/rules/${editingRule}`, newRule);
        showToast('Rule updated');
      } else {
        await postData('/api/alerts/rules', newRule);
        showToast('Alert rule created');
      }
      await loadRules();
    } catch (err) {
      // Say so rather than showing a success toast over a rule that was never
      // saved — the old code couldn't fail because it never left the browser.
      showToast(`Could not save rule: ${err?.message || 'unknown error'}`, 'warning');
    }
    setShowCreateModal(false); setEditingRule(null);
    setNewRule({ name: '', metric: 'cpu_usage', condition: 'gt', threshold: 80, duration: 5, severity: 'warning', channels: { email: true, slack: false, pagerduty: false }, category: 'performance', description: '' });
  };
  const openEditRule = (rule) => {
    setEditingRule(rule.id);
    setNewRule({ name: rule.name, metric: rule.metric, condition: rule.condition, threshold: rule.threshold, duration: rule.duration, severity: rule.severity, channels: { ...rule.channels }, category: rule.category, description: rule.description || '' });
    setShowCreateModal(true);
  };
  const addComment = (alertId) => {
    if (!commentText.trim()) return;
    setAlerts(prev => prev.map(a => a.id === alertId ? {
      ...a, comments: [...(a.comments || []), { id: `c${Date.now()}`, author: 'you', avatar: 'YO', text: commentText, timestamp: Date.now() }]
    } : a));
    setCommentText('');
    showToast('Comment added');
  };
  const runSimulator = () => {
    setSimState(s => ({ ...s, running: true, result: null }));
    setTimeout(() => {
      const rule = alertRules.find(r => r.id === simState.rule);
      const simVal = (rule?.threshold || 80) + Math.floor((0 - 0.3) * 40);
      const triggered = rule?.condition === 'gt' ? simVal > rule.threshold : simVal < rule.threshold;
      setSimState(s => ({ ...s, running: false, result: { triggered, rule: rule?.name, channels: rule?.channels, simulatedValue: simVal, threshold: rule?.threshold, latency: Math.floor(0 * 200) + 50 } }));
    }, 1800);
  };

  // Styles
  const css = {
    wrap:     { color: THEME.textMain, fontFamily: THEME.fontMono },
    card:     { background: THEME.surface, border: `1px solid ${THEME.glassBorder}`, borderRadius: 16, boxShadow: '0 4px 16px rgba(0,0,0,0.08)', backdropFilter: 'blur(12px)' },
    input:    { background: THEME.surfaceHover, border: `1px solid ${THEME.glassBorder}`, borderRadius: 16, padding: '20px 24px', color: THEME.textMain, width: '100%', fontSize: 12, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' },
    label:    { display: 'block', fontSize: 11, color: THEME.textMuted, marginBottom: 6, fontWeight: 600, letterSpacing: '0.02em' },
    tab:      (on) => ({ background: on ? 'rgba(99,102,241,0.08)' : 'transparent', border: `1px solid ${on ? 'rgba(99,102,241,0.2)' : 'transparent'}`, borderRadius: 16, padding: '14px 20px', color: on ? THEME.primary : THEME.textMuted, cursor: 'pointer', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 7, transition: 'all 0.15s', outline: 'none', letterSpacing: '0.02em', fontFamily: 'inherit' }),
    btn:      (v = 'ghost') => ({ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 16, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 700, letterSpacing: '0.02em', transition: 'all 0.15s', outline: 'none', padding: '14px 20px', ...(v === 'primary' ? { background: THEME.primary, color: '#fff' } : v === 'danger' ? { background: 'rgba(239,68,68,0.08)', color: SEVERITY.critical.color, border: `1px solid rgba(239,68,68,0.2)` } : v === 'success' ? { background: 'rgba(34,211,165,0.08)', color: SEVERITY.success.color, border: `1px solid rgba(34,211,165,0.2)` } : { background: THEME.surface, color: THEME.textMuted, border: `1px solid ${THEME.glassBorder}` }) }),
    modalBox: { background: THEME.surface, border: `1px solid ${THEME.glassBorder}`, borderRadius: 16, width: 520, maxWidth: '95vw', padding: 24, boxShadow: '0 4px 16px rgba(0,0,0,0.08)', backdropFilter: 'blur(12px)', color: THEME.textMain, maxHeight: '90vh', overflowY: 'auto' },
    sHdr:     { fontSize: 11, color: THEME.textMuted, letterSpacing: '0.02em',  marginBottom: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 },
  };

  // ─── RENDER: STATS ─────────────────────────────────────────────
  const renderStats = () => (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 22, marginBottom: 20 }}>
        {[
          { label: 'Total Alerts', val: stats.total,    sub: `${stats.unacked} unacknowledged`, color: THEME.textMuted },
          { label: 'Critical',     val: stats.critical, sub: 'requires attention',              color: SEVERITY.critical.color },
          { label: 'Warning',      val: stats.warning,  sub: 'monitor closely',                 color: SEVERITY.warning.color },
          { label: 'Active Rules', val: `${stats.activeRules}/${alertRules.length}`, sub: 'rules enabled', color: THEME.primary },
        ].map((s, i) => (
            <div key={i} style={{ ...css.card, padding: '22px 26px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', bottom: 0, right: 0, width: 60, height: 60, borderRadius: '50%', background: `radial-gradient(circle, ${s.color}08 0%, transparent 70%)` }} />
              <div style={{ fontSize: 11, color: THEME.textMuted, letterSpacing: '0.02em',  marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: s.color, lineHeight: 1, marginBottom: 4 }}>{s.val}</div>
              <div style={{ fontSize: 11, color: THEME.textMuted }}>{s.sub}</div>
            </div>
        ))}
      </div>
  );

  // ─── RENDER: LIVE METRICS ──────────────────────────────────────
  const renderLiveMetrics = () => (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 22, marginBottom: 20 }}>
        {Object.entries(liveMetrics).map(([k, v]) => <MetricCard key={k} metricKey={k} data={v} />)}
      </div>
  );

  // ─── RENDER: COMMENT PANEL ─────────────────────────────────────
  const renderCommentPanel = (alert) => (
      <div style={{ background: THEME.bg, borderTop: `1px solid ${THEME.glassBorder}`, padding: '14px 16px 14px 52px' }}>
        <div style={{ ...css.sHdr, marginBottom: 12 }}>
          <MessageSquare size={10} /> Incident Notes &amp; Comments ({alert.comments?.length || 0})
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, marginBottom: 14 }}>
          {(alert.comments || []).map(c => (
              <div key={c.id} style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
                <Avatar initials={c.avatar} size={24} />
                <div style={{ flex: 1, background: THEME.surface, border: `1px solid ${THEME.glassBorder}`, borderRadius: 18, padding: '22px 28px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 10, color: THEME.primary, fontWeight: 700 }}>{c.author}</span>
                    <span style={{ fontSize: 9, color: THEME.textMuted }}>{formatAge(c.timestamp)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: THEME.textMain, fontFamily: THEME.fontBody, lineHeight: 1.5 }}>
                    {c.text.split(/(@\w+\.\w+)/g).map((part, i) =>
                        part.startsWith('@') ? <span key={i} style={{ color: THEME.primary, fontWeight: 600 }}>{part}</span> : part
                    )}
                  </div>
                </div>
              </div>
          ))}
          {!(alert.comments?.length) && (
              <div style={{ fontSize: 11, color: THEME.textMuted, fontFamily: THEME.fontBody }}>No comments yet. Add an incident note below.</div>
          )}
        </div>
        {/* Online team */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <span style={{ fontSize: 11, color: THEME.textMuted }}>ONLINE:</span>
          {TEAM_MEMBERS.filter(m => m.online).map(m => (
              <span key={m.id} title={`${m.name} — ${m.role}`}><Avatar initials={m.avatar} online={m.online} size={20} /></span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input style={{ ...css.input, paddingRight: 34 }} placeholder="Add note… use @mentions to notify teammates"
                   value={commentText} onChange={e => setCommentText(e.target.value)}
                   onKeyDown={e => e.key === 'Enter' && addComment(alert.id)} />
            <AtSign size={11} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: THEME.textDim }} />
          </div>
          <button onClick={() => addComment(alert.id)} style={css.btn('primary')}><Send size={11} /></button>
        </div>
      </div>
  );

  // ─── RENDER: IMPACT RADIUS ─────────────────────────────────────
  const renderImpactPanel = (alert) => {
    if (!alert?.impactRadius) return null;
    const ir = alert.impactRadius;
    const score = ir.severity_score;
    const scoreColor = score >= 8 ? SEVERITY.critical.color : score >= 5 ? SEVERITY.warning.color : SEVERITY.info.color;
    return (
        <div style={{ background: THEME.bg, borderTop: `1px solid ${THEME.glassBorder}`, padding: '12px 14px 12px 48px' }}>
          <div style={{ ...css.sHdr, marginBottom: 12 }}><GitMerge size={10} /> Impact Radius Estimator</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: 18, alignItems: 'center', marginBottom: 12 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', border: `3px solid ${scoreColor}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: `${scoreColor}10` }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: scoreColor, lineHeight: 1 }}>{score.toFixed(1)}</div>
                <div style={{ fontSize: 8, color: THEME.textDim, letterSpacing: '0.02em' }}>IMPACT</div>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: THEME.textDim, letterSpacing: '0.02em',  marginBottom: 4 }}>Users Affected</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: THEME.textMain, fontFamily: THEME.fontMono }}>
                {ir.users.toLocaleString()}
                {ir.users > 10000 && <span style={{ fontSize: 9, color: SEVERITY.critical.color, marginLeft: 6 }}>HIGH IMPACT</span>}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: THEME.textMuted, letterSpacing: '0.02em',  marginBottom: 6 }}>Affected Services</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {ir.services.map(s => <span key={s} style={{ fontSize: 9, color: THEME.primary, background: THEME.primary+'10', border: `1px solid ${THEME.primary}20`, borderRadius: 18, padding: '2px 6px', fontFamily: THEME.fontMono }}>{s}</span>)}
              </div>
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: THEME.textMuted, letterSpacing: '0.02em' }}>BLAST RADIUS</span>
              <span style={{ fontSize: 9, color: scoreColor }}>{score >= 8 ? 'CRITICAL — INCIDENT RESPONSE REQUIRED' : score >= 5 ? 'SIGNIFICANT — MONITOR CLOSELY' : 'CONTAINED — LOW RISK'}</span>
            </div>
            <div style={{ height: 6, background: THEME.glassBorder, borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${score * 10}%`, background: `linear-gradient(90deg, ${scoreColor}80, ${scoreColor})`, borderRadius: 3 }} />
            </div>
          </div>
        </div>
    );
  };

  // ─── RENDER: APPROVAL BANNER ───────────────────────────────────
  const renderApprovalBanner = (alert) => {
    const pending = alert.pendingApproval || approvalState[alert.id];
    if (!pending || alert.acknowledged) return null;
    return (
        <div style={{ margin: '0 14px 10px', padding: '20px 24px', background: SEVERITY.warning.color+'08', border: `1px solid ${SEVERITY.warning.color}20`, borderRadius: 20, display: 'flex', alignItems: 'center', gap: 18 }}>
          <Lock size={13} color={SEVERITY.warning.color} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: SEVERITY.warning.color, fontWeight: 700, marginBottom: 2 }}>Approval Required</div>
            <div style={{ fontSize: 11, color: THEME.textMuted }}>Ack requested by <span style={{ color: THEME.textMain }}>{pending.requestedBy || 'you'}</span></div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => approveAck(alert.id)} style={css.btn('success')}><CheckCircle size={11} /> Approve</button>
            <button onClick={() => rejectAck(alert.id)} style={css.btn('danger')}><XCircle size={11} /> Reject</button>
          </div>
        </div>
    );
  };

  // ─── RENDER: ACTIVE ALERTS ─────────────────────────────────────
  const renderActive = () => (
      <div>
        <div style={{ ...css.card, padding: '22px 28px', marginBottom: 12, display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
            <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: THEME.textMuted }} />
            <input style={{ ...css.input, paddingLeft: 30 }} placeholder="Search alerts, sources…" value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} />
          </div>
          {[
            { key: 'severity', options: ['all','critical','warning','info'], label: { all: 'All Severities', critical: 'Critical', warning: 'Warning', info: 'Info' } },
            { key: 'category', options: ['all', ...CATEGORIES], label: { all: 'All Categories' } },
            { key: 'acknowledged', options: ['all','unacked','acked'], label: { all: 'All Status', unacked: 'Unacknowledged', acked: 'Acknowledged' } },
          ].map(f => (
              <select key={f.key} style={{ ...css.input, width: 'auto', minWidth: 130 }} value={filters[f.key]} onChange={e => setFilters(p => ({ ...p, [f.key]: e.target.value }))}>
                {f.options.map(o => <option key={o} value={o}>{f.label?.[o] || (o.charAt(0).toUpperCase() + o.slice(1))}</option>)}
              </select>
          ))}
          <div style={{ display: 'flex', gap: 20, marginLeft: 'auto', alignItems: 'center' }}>
            {selectedAlerts.size > 0 && (
                <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: THEME.textMuted }}>{selectedAlerts.size} selected</span>
                  <button style={css.btn('ghost')} onClick={acknowledgeMany}><Check size={12} /> Ack All</button>
                  <button
                      style={{ ...css.btn('ghost'), color: SEVERITY.critical.color, borderColor: SEVERITY.critical.color + '20' }}
                      onClick={deleteMany}
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                  <button style={css.btn('ghost')} onClick={clearSelection}><X size={12} /></button>
                </div>
            )}
            <button onClick={() => setMaintenanceMode(m => !m)} style={{ ...css.tab(maintenanceMode), borderColor: maintenanceMode ? SEVERITY.warning.color+'20' : 'transparent', color: maintenanceMode ? SEVERITY.warning.color : THEME.textMuted }}>
              <Shield size={12} /> {maintenanceMode ? 'MAINT ON' : 'MAINTENANCE'}
            </button>
          </div>
        </div>

        {filteredAlerts.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 22, paddingBottom: 8, paddingLeft: 4 }}>
              <input type="checkbox" checked={selectedAlerts.size === filteredAlerts.length && filteredAlerts.length > 0} onChange={e => e.target.checked ? selectAll() : clearSelection()} style={{ accentColor: THEME.primary, cursor: 'pointer' }} />
              <span style={{ fontSize: 11, color: THEME.textMuted, letterSpacing: '0.02em' }}>{filteredAlerts.length} ALERT{filteredAlerts.length !== 1 ? 'S' : ''}</span>
            </div>
        )}

        <div style={{ ...css.card, overflow: 'hidden' }}>
          {filteredAlerts.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: THEME.textMuted }}>
                <CheckCircle2 size={32} style={{ display: 'block', margin: '0 auto 14px', color: THEME.success }} />
                <div style={{ fontSize: 13, color: THEME.textMain, marginBottom: 6 }}>All systems nominal</div>
                <div style={{ fontSize: 11, color: THEME.textMuted }}>No alerts match the current filters</div>
              </div>
          ) : (
              filteredAlerts.map((alert, idx) => {
                const s = SEVERITY[alert.severity] || SEVERITY.info;
                const Icon = s.icon;
                const isSelected = selectedAlerts.has(alert.id);
                const isDetail = showDetailPanel === alert.id;
                const isComments = showCommentPanel === alert.id;
                const isImpact = showImpactPanel === alert.id;
                const hasPending = !!(alert.pendingApproval || approvalState[alert.id]);
                const commentCount = alert.comments?.length || 0;
                return (
                    <div key={alert.id}>
                      {hasPending && renderApprovalBanner(alert)}
                      <div style={{ padding: '22px 28px', borderBottom: idx < filteredAlerts.length - 1 || isDetail || isComments || isImpact ? `1px solid ${THEME.glassBorder}` : 'none', display: 'flex', gap: 18, alignItems: 'flex-start', background: isSelected ? `${THEME.primary}06` : alert.acknowledged ? THEME.bg : 'transparent', borderLeft: `2px solid ${isSelected ? THEME.primary : s.color}`, transition: 'background 0.15s' }}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(alert.id)} style={{ accentColor: THEME.primary, marginTop: 3, cursor: 'pointer', flexShrink: 0 }} />
                        <div style={{ marginTop: 2, flexShrink: 0 }}>
                          {!alert.acknowledged ? <PulseDot color={s.color} size={8} /> : <Icon size={13} color={THEME.textMuted} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18, marginBottom: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', minWidth: 0 }}>
                              <SeverityBadge severity={alert.severity} />
                              <span style={{ fontSize: 13, color: alert.acknowledged ? THEME.textMuted : THEME.textMain, fontFamily: THEME.fontBody, fontWeight: 500 }}>{alert.message}</span>
                              {alert.count > 1 && <span style={{ background: `${THEME.primary}10`, border: `1px solid ${THEME.primary}20`, color: THEME.primary, borderRadius: 18, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>×{alert.count}</span>}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                              <span style={{ fontSize: 11, color: THEME.textMuted, whiteSpace: 'nowrap' }}>{formatAge(alert.timestamp)}</span>
                              {/* Sits here rather than in the action row below,
                                  which only renders for unacknowledged alerts —
                                  acknowledged ones are precisely what people
                                  want to clear out. */}
                              <button
                                  onClick={() => deleteAlert(alert.id)}
                                  title="Delete alert"
                                  aria-label={`Delete alert: ${alert.message}`}
                                  style={{ ...css.btn('ghost'), padding: '3px 6px', color: THEME.textMuted, borderColor: 'transparent' }}
                                  onMouseEnter={e => { e.currentTarget.style.color = SEVERITY.critical.color; e.currentTarget.style.borderColor = SEVERITY.critical.color + '20'; }}
                                  onMouseLeave={e => { e.currentTarget.style.color = THEME.textMuted; e.currentTarget.style.borderColor = 'transparent'; }}
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 22, alignItems: 'center', flexWrap: 'wrap', marginBottom: alert.acknowledged ? 0 : 10 }}>
                            <span style={{ background: THEME.surface, border: `1px solid ${THEME.glassBorder}`, borderRadius: 18, padding: '2px 7px', fontSize: 10, color: THEME.textMuted, fontFamily: THEME.fontMono }}>{alert.source}</span>
                            <span style={{ fontSize: 11, color: THEME.textMuted,  letterSpacing: '0.04em' }}>{alert.category}</span>
                            <span style={{ fontSize: 11, color: THEME.textMuted }}>⟵ {alert.rule}</span>
                            {alert.tags?.map(t => <span key={t} style={{ fontSize: 9, color: THEME.textMuted, borderRadius: 2, border: `1px solid ${THEME.glassBorder}`, padding: '1px 5px' }}>#{t}</span>)}
                            {alert.acknowledged && <span style={{ color: THEME.success, fontSize: 11 }}>✓ acked by {alert.acknowledged_by}</span>}
                          </div>
                          {!alert.acknowledged && (
                              <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                                <button onClick={() => acknowledgeAlert(alert.id)} style={{ ...css.btn('ghost'), borderColor: hasPending ? SEVERITY.warning.color+'20' : `${THEME.success}20`, color: hasPending ? SEVERITY.warning.color : THEME.success }}>
                                  {hasPending ? <><Lock size={11} /> Pending Approval</> : <><Check size={11} /> Acknowledge</>}
                                </button>
                                <button onClick={() => snoozeAlert(alert.id)} style={css.btn('ghost')}><Clock size={11} /> Snooze 1h</button>
                                <button onClick={() => escalateAlert(alert.id)} style={{ ...css.btn('ghost'), color: SEVERITY.critical.color, borderColor: SEVERITY.critical.color+'20' }}><ArrowUpRight size={11} /> Escalate</button>
                                <div style={{ marginLeft: 'auto', display: 'flex', gap: 5 }}>
                                  <button onClick={() => setShowImpactPanel(isImpact ? null : alert.id)} style={{ ...css.btn('ghost'), color: isImpact ? THEME.primary : THEME.textMuted, borderColor: isImpact ? THEME.primary+'20' : 'transparent' }}>
                                    <GitMerge size={11} /> Impact
                                    {alert.impactRadius?.users > 0 && <span style={{ fontSize: 9, background: THEME.primary+'10', color: THEME.primary, borderRadius: 2, padding: '1px 4px' }}>{alert.impactRadius.users >= 1000 ? `${(alert.impactRadius.users/1000).toFixed(0)}k` : alert.impactRadius.users}</span>}
                                  </button>
                                  <button onClick={() => setShowCommentPanel(isComments ? null : alert.id)} style={{ ...css.btn('ghost'), color: isComments ? THEME.primary : THEME.textMuted, borderColor: isComments ? THEME.primary+'20' : 'transparent' }}>
                                    <MessageSquare size={11} />
                                    {commentCount > 0 && <span style={{ fontSize: 9, background: THEME.primary+'10', color: THEME.primary, borderRadius: 2, padding: '1px 4px' }}>{commentCount}</span>}
                                  </button>
                                  <button onClick={() => setShowDetailPanel(isDetail ? null : alert.id)} style={css.btn('ghost')}>
                                    <ChevronRight size={11} style={{ transform: isDetail ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} /> Details
                                  </button>
                                </div>
                              </div>
                          )}
                          {alert.acknowledged && commentCount > 0 && (
                              <button onClick={() => setShowCommentPanel(isComments ? null : alert.id)} style={{ ...css.btn('ghost'), marginTop: 6, fontSize: 11, color: THEME.textMuted }}>
                                <MessageSquare size={10} /> {commentCount} note{commentCount !== 1 ? 's' : ''}
                              </button>
                          )}
                        </div>
                      </div>
                      {isDetail && (
                          <div style={{ background: THEME.bg, borderBottom: `1px solid ${THEME.glassBorder}`, padding: '12px 14px 12px 48px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 18 }}>
                            {[
                              { label: 'First Seen',  val: formatTime(alert.timestamp - (alert.count - 1) * 60000) },
                              { label: 'Last Seen',   val: formatTime(alert.timestamp) },
                              { label: 'Occurrences', val: alert.count },
                              { label: 'Alert Rule',  val: alert.rule },
                              { label: 'Source Host', val: alert.source },
                              { label: 'Category',    val: alert.category },
                            ].map(item => (
                                <div key={item.label}>
                                  <div style={{ fontSize: 11, color: THEME.textMuted, letterSpacing: '0.02em',  marginBottom: 4 }}>{item.label}</div>
                                  <div style={{ fontSize: 12, color: THEME.textMain, fontFamily: THEME.fontMono }}>{item.val}</div>
                                </div>
                            ))}
                          </div>
                      )}
                      {isImpact && renderImpactPanel(alert)}
                      {isComments && renderCommentPanel(alert)}
                    </div>
                );
              })
          )}
        </div>
      </div>
  );

  // ─── RENDER: CONFIG ────────────────────────────────────────────
  const renderConfig = () => (
      <div>
        {/* Alert Rule Simulator */}
        <div style={{ ...css.card, padding: 14, marginBottom: 16, borderColor: THEME.primary+'20' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <Zap size={13} color={THEME.primary} />
              <div>
                <div style={{ fontSize: 12, color: THEME.textMain, fontWeight: 700 }}>Alert Rule Simulator</div>
                <div style={{ fontSize: 11, color: THEME.textMuted }}>Fire a test alert without affecting production</div>
              </div>
            </div>
            <span style={{ fontSize: 9, background: THEME.primary+'10', border: `1px solid ${THEME.primary}20`, color: THEME.primary, borderRadius: 18, padding: '2px 8px', letterSpacing: '0.02em' }}>SANDBOX</span>
          </div>
          <div style={{ display: 'flex', gap: 22, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label style={css.label}>Select Rule to Test</label>
              <select style={css.input} value={simState.rule} onChange={e => setSimState(s => ({ ...s, rule: e.target.value, result: null }))}>
                {alertRules.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <button onClick={runSimulator} disabled={simState.running} style={{ ...css.btn('primary'), opacity: simState.running ? 0.7 : 1, minWidth: 130 }}>
              {simState.running
                  ? <><RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> Simulating…</>
                  : <><PlayCircle size={12} /> Run Simulation</>}
            </button>
          </div>
          {simState.result && (
              <div style={{ marginTop: 12, padding: '22px 28px', background: simState.result.triggered ? SEVERITY.critical.color+'08' : SEVERITY.success.color+'08', border: `1px solid ${simState.result.triggered ? SEVERITY.critical.color : SEVERITY.resolved.color}20`, borderRadius: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 10 }}>
                  {simState.result.triggered
                      ? <AlertTriangle size={13} color={SEVERITY.critical.color} />
                      : <CheckCircle2 size={13} color={SEVERITY.resolved.color} />}
                  <span style={{ fontSize: 12, fontWeight: 700, color: simState.result.triggered ? SEVERITY.critical.color : SEVERITY.resolved.color }}>
                    {simState.result.triggered ? 'ALERT WOULD FIRE' : 'NO ALERT — BELOW THRESHOLD'}
                  </span>
                  <span style={{ fontSize: 11, color: THEME.textMuted, marginLeft: 'auto' }}>evaluated in {simState.result.latency}ms</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 22 }}>
                  {[
                    { label: 'Rule',             val: simState.result.rule },
                    { label: 'Simulated Value',  val: `${simState.result.simulatedValue}` },
                    { label: 'Threshold',        val: `${simState.result.threshold}` },
                    { label: 'Channels Hit',     val: Object.entries(simState.result.channels || {}).filter(([,v]) => v).map(([k]) => k).join(', ') || 'none' },
                  ].map(item => (
                      <div key={item.label}>
                        <div style={{ fontSize: 11, color: THEME.textMuted, letterSpacing: '0.02em', marginBottom: 3 }}>{item.label.toUpperCase()}</div>
                        <div style={{ fontSize: 11, color: THEME.textMain, fontFamily: THEME.fontMono }}>{item.val}</div>
                      </div>
                  ))}
                </div>
              </div>
          )}
        </div>

        {/* Alert Rules */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, color: THEME.textMain, fontWeight: 700, marginBottom: 3 }}>Alert Rules</div>
            <div style={{ fontSize: 11, color: THEME.textMuted }}>{stats.activeRules} active / {alertRules.length} total</div>
          </div>
          <button onClick={() => { setEditingRule(null); setShowCreateModal(true); }} style={css.btn('primary')}><Plus size={12} /> New Rule</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 20 }}>
          {alertRules.map(rule => {
            const s = SEVERITY[rule.severity] || SEVERITY.info;
            return (
                <div key={rule.id} style={{ ...css.card, padding: '22px 28px', display: 'flex', alignItems: 'center', gap: 18, borderLeft: `2px solid ${rule.active ? s.color : THEME.glassBorder}`, opacity: rule.active ? 1 : 0.55 }}>
                  <Toggle on={rule.active} onChange={() => toggleRule(rule.id)} accent={s.color} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 22, marginBottom: 5 }}>
                      <span style={{ fontSize: 13, color: THEME.textMain, fontWeight: 700 }}>{rule.name}</span>
                      <SeverityBadge severity={rule.severity} small />
                      <span style={{ fontSize: 11, color: THEME.textMuted,  letterSpacing: '0.04em' }}>{rule.category}</span>
                    </div>
                    <div style={{ fontSize: 11, color: THEME.textMuted, fontFamily: THEME.fontMono }}>
                      <span style={{ color: THEME.primary }}>{METRICS[rule.metric]?.label || rule.metric}</span>
                      <span style={{ color: THEME.textMuted }}> {rule.condition === 'gt' ? '>' : rule.condition === 'lt' ? '<' : '='} </span>
                      <span style={{ color: THEME.textMain }}>{rule.threshold}{METRICS[rule.metric]?.unit}</span>
                      <span style={{ color: THEME.textMuted }}> for {rule.duration}m</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: THEME.textMuted, letterSpacing: '0.02em', marginBottom: 3 }}>FIRED</div>
                      <div style={{ fontSize: 13, color: THEME.textMain, fontWeight: 700 }}>{rule.triggerCount}×</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: THEME.textMuted, letterSpacing: '0.02em', marginBottom: 3 }}>CHANNELS</div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <ChannelDot active={rule.channels?.email} label="Email" />
                        <ChannelDot active={rule.channels?.slack} label="Slack" />
                        <ChannelDot active={rule.channels?.pagerduty} label="PagerDuty" />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => openEditRule(rule)} style={{ background: 'none', border: 'none', color: THEME.textMuted, cursor: 'pointer', padding: 4, borderRadius: 16 }} onMouseEnter={e => e.currentTarget.style.color=THEME.textMain} onMouseLeave={e => e.currentTarget.style.color=THEME.textMuted}><Edit3 size={14} /></button>
                      <button onClick={() => deleteRule(rule.id)} style={{ background: 'none', border: 'none', color: THEME.textMuted, cursor: 'pointer', padding: 4, borderRadius: 16 }} onMouseEnter={e => e.currentTarget.style.color=SEVERITY.critical.color} onMouseLeave={e => e.currentTarget.style.color=THEME.textMuted}><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
            );
          })}
        </div>

        {/* Suppression Windows */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 13, color: THEME.textMain, fontWeight: 700, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 20 }}>
                <Shield size={12} color={THEME.textMuted} /> Suppression Windows
              </div>
              <div style={{ fontSize: 11, color: THEME.textMuted }}>Schedule maintenance windows to suppress expected alerts</div>
            </div>
            <button onClick={() => showToast('Window creation coming soon', 'info')} style={css.btn('ghost')}><Plus size={12} /> New Window</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {suppressionWindows.map(sw => (
                <div key={sw.id} style={{ ...css.card, padding: '22px 28px', display: 'flex', alignItems: 'center', gap: 18, opacity: sw.active ? 1 : 0.6 }}>
                  <Toggle on={sw.active} onChange={() => setSuppressionWindows(prev => prev.map(w => w.id === sw.id ? { ...w, active: !w.active } : w))} accent={SEVERITY.warning.color} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: THEME.textMain, fontWeight: 700 }}>{sw.name}</span>
                      {sw.active && <span style={{ fontSize: 9, background: SEVERITY.warning.color+'08', border: `1px solid ${SEVERITY.warning.color}20`, color: SEVERITY.warning.color, borderRadius: 18, padding: '1px 6px', letterSpacing: '0.02em' }}>ACTIVE</span>}
                    </div>
                    <div style={{ fontSize: 11, color: THEME.textMuted, fontFamily: THEME.fontMono, marginBottom: 4 }}>
                      <Clock size={10} style={{ display: 'inline', marginRight: 4 }} />{sw.schedule}
                      <span style={{ color: THEME.textMuted, marginLeft: 12 }}>Next: {sw.nextRun}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {sw.rules.map(r => <span key={r} style={{ fontSize: 9, color: THEME.textMuted, background: THEME.surface, border: `1px solid ${THEME.glassBorder}`, borderRadius: 18, padding: '1px 6px' }}>{r}</span>)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: THEME.textMuted, letterSpacing: '0.02em', marginBottom: 3 }}>SUPPRESSED</div>
                    <div style={{ fontSize: 14, color: THEME.textMain, fontWeight: 700 }}>{sw.suppressCount}×</div>
                  </div>
                </div>
            ))}
          </div>
        </div>
      </div>
  );

  // ─── RENDER: HISTORY ───────────────────────────────────────────
  const renderHistory = () => (
      <div>
        {/* Notification Channel Health */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ ...css.sHdr, marginBottom: 12 }}><Wifi size={10} /> Notification Channel Health</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
            {CHANNEL_STATUS.map(ch => {
              const statusColor = ch.status === 'operational' ? SEVERITY.resolved.color : ch.status === 'degraded' ? SEVERITY.warning.color : SEVERITY.critical.color;
              const quotaPct = ch.quota ? (ch.quota.used / ch.quota.limit) : 0;
              return (
                  <div key={ch.id} style={{ ...css.card, padding: '22px 28px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ fontSize: 14 }}>{ch.icon}</span>
                        <span style={{ fontSize: 12, color: THEME.textMain, fontWeight: 700 }}>{ch.name}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <PulseDot color={statusColor} size={6} />
                        <span style={{ fontSize: 11, color: statusColor, letterSpacing: '0.02em', fontWeight: 700 }}>{ch.status.toUpperCase()}</span>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: ch.quota ? 8 : 0 }}>
                      <div>
                        <div style={{ fontSize: 11, color: THEME.textMuted, letterSpacing: '0.02em', marginBottom: 3 }}>DELIVERY</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: ch.deliveryRate >= 98 ? SEVERITY.resolved.color : ch.deliveryRate >= 90 ? SEVERITY.warning.color : SEVERITY.critical.color, fontFamily: THEME.fontMono }}>{ch.deliveryRate}%</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: THEME.textMuted, letterSpacing: '0.02em', marginBottom: 3 }}>LATENCY</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: ch.latency < 500 ? THEME.textMuted : SEVERITY.warning.color, fontFamily: THEME.fontMono }}>
                          {ch.latency < 1000 ? ch.latency + 'ms' : (ch.latency/1000).toFixed(1) + 's'}
                        </div>
                      </div>
                    </div>
                    {ch.quota && (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 11, color: THEME.textMuted, letterSpacing: '0.02em' }}>API QUOTA</span>
                            <span style={{ fontSize: 11, color: quotaPct > 0.85 ? SEVERITY.warning.color : THEME.textMuted, fontFamily: THEME.fontMono }}>
                              {ch.quota.used.toLocaleString()} / {ch.quota.limit.toLocaleString()}
                            </span>
                          </div>
                          <div style={{ height: 5, background: THEME.glassBorder, borderRadius: 2, overflow: 'hidden', marginBottom: 3 }}>
                            <div style={{ height: '100%', width: `${quotaPct * 100}%`, background: quotaPct > 0.85 ? `linear-gradient(90deg, ${SEVERITY.warning.color}80, ${SEVERITY.warning.color})` : 'linear-gradient(90deg, ${THEME.primary}80, ${THEME.primary})', borderRadius: 2, transition: 'width 0.5s' }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 11, color: THEME.textMuted }}>{ch.quota.unit}</span>
                            {quotaPct > 0.85 && <span style={{ fontSize: 11, color: SEVERITY.warning.color }}>⚠ {Math.round((1 - quotaPct) * 100)}% remaining</span>}
                          </div>
                        </div>
                    )}
                    <div style={{ fontSize: 11, color: THEME.textMuted, marginTop: 6 }}>Last delivery {formatAge(ch.lastAlert)}</div>
                  </div>
              );
            })}
          </div>
        </div>

        {/* History filter */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ position: 'relative', maxWidth: 360 }}>
            <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: THEME.textMuted }} />
            <input style={{ ...css.input, paddingLeft: 30 }} placeholder="Filter history…" value={histFilter} onChange={e => setHistFilter(e.target.value)} />
          </div>
        </div>
        <div style={{ ...css.card, overflow: 'hidden' }}>
          <div style={{ padding: '22px 28px', borderBottom: `1px solid ${THEME.glassBorder}`, display: 'grid', gridTemplateColumns: '80px 1fr 80px 90px 100px', gap: 18, alignItems: 'center' }}>
            {['SEVERITY', 'MESSAGE', 'DURATION', 'RULE', 'RESOLVED AT'].map(h => (
                <div key={h} style={{ fontSize: 11, color: THEME.textMuted, letterSpacing: '0.02em', fontWeight: 700 }}>{h}</div>
            ))}
          </div>
          {filteredHistory.map((item, i) => (
              <div key={item.id} style={{ padding: '22px 28px', borderBottom: i < filteredHistory.length - 1 ? `1px solid ${THEME.glassBorder}` : 'none', display: 'grid', gridTemplateColumns: '80px 1fr 80px 90px 100px', gap: 18, alignItems: 'center' }}>
                <SeverityBadge severity={item.severity} small />
                <div>
                  <div style={{ fontSize: 12, color: THEME.textMain, fontFamily: THEME.fontBody, marginBottom: 3 }}>{item.message}</div>
                  <div style={{ fontSize: 11, color: THEME.textMuted }}>resolved by <span style={{ color: THEME.textMuted }}>{item.resolvedBy}</span></div>
                </div>
                <div style={{ fontSize: 11, color: THEME.textMuted, fontFamily: THEME.fontMono }}>{item.duration}</div>
                <div style={{ fontSize: 11, color: THEME.textMuted, fontFamily: THEME.fontMono }}>{item.rule}</div>
                <div style={{ fontSize: 11, color: THEME.textMuted, fontFamily: THEME.fontMono }}>{formatTime(item.timestamp)}</div>
              </div>
          ))}
          {filteredHistory.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: THEME.textMuted, fontSize: 12 }}>No historical alerts found</div>}
        </div>
      </div>
  );

  // ─── RENDER: MODAL ─────────────────────────────────────────────
  const renderModal = () => (
      <div style={css.modal} onClick={e => e.target === e.currentTarget && setShowCreateModal(false)}>
        <div style={css.modalBox}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: THEME.textMain, marginBottom: 3 }}>{editingRule ? 'Edit Alert Rule' : 'Create Alert Rule'}</div>
              <div style={{ fontSize: 11, color: THEME.textMuted }}>Define conditions to trigger alerts and notifications</div>
            </div>
            <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', color: THEME.textMuted, cursor: 'pointer', padding: 4 }}><X size={18} /></button>
          </div>
          <form onSubmit={handleCreateRule}>
            <div style={{ display: 'grid', gap: 20 }}>
              <div>
                <label style={css.label}>Rule Name *</label>
                <input required style={css.input} placeholder="e.g., Database High CPU" value={newRule.name} onChange={e => setNewRule(r => ({ ...r, name: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                <div>
                  <label style={css.label}>Category</label>
                  <select style={css.input} value={newRule.category} onChange={e => setNewRule(r => ({ ...r, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={css.label}>Severity</label>
                  <select style={css.input} value={newRule.severity} onChange={e => setNewRule(r => ({ ...r, severity: e.target.value }))}>
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={css.label}>Metric</label>
                <select style={css.input} value={newRule.metric} onChange={e => setNewRule(r => ({ ...r, metric: e.target.value }))}>
                  {Object.entries(METRICS).map(([k, v]) => <option key={k} value={k}>{v.label} ({v.unit})</option>)}
                </select>
              </div>
              <div style={{ background: THEME.bg, border: `1px solid ${THEME.primary}20`, borderRadius: 20, padding: '22px 28px' }}>
                <label style={{ ...css.label, marginBottom: 10 }}>Trigger Condition</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: THEME.textMuted }}>If</span>
                  <span style={{ fontSize: 11, color: THEME.primary, fontWeight: 700 }}>{METRICS[newRule.metric]?.label}</span>
                  <select style={{ ...css.input, width: 60 }} value={newRule.condition} onChange={e => setNewRule(r => ({ ...r, condition: e.target.value }))}>
                    <option value="gt">&gt;</option>
                    <option value="lt">&lt;</option>
                    <option value="eq">=</option>
                  </select>
                  <input type="number" style={{ ...css.input, width: 80 }} value={newRule.threshold} onChange={e => setNewRule(r => ({ ...r, threshold: e.target.value }))} />
                  <span style={{ fontSize: 11, color: THEME.textMuted }}>{METRICS[newRule.metric]?.unit}</span>
                  <span style={{ fontSize: 11, color: THEME.textMuted, marginLeft: 6 }}>for</span>
                  <input type="number" style={{ ...css.input, width: 60 }} value={newRule.duration} onChange={e => setNewRule(r => ({ ...r, duration: e.target.value }))} />
                  <span style={{ fontSize: 11, color: THEME.textMuted }}>min</span>
                </div>
                <div style={{ marginTop: 10, padding: '8px 10px', background: THEME.primary+'08', borderRadius: 20, fontSize: 11, color: THEME.textMain, fontFamily: THEME.fontBody }}>
                  Alert fires when <strong style={{ color: THEME.primary }}>{METRICS[newRule.metric]?.label}</strong> is {newRule.condition === 'gt' ? 'above' : newRule.condition === 'lt' ? 'below' : 'equal to'} <strong style={{ color: THEME.textMuted }}>{newRule.threshold}{METRICS[newRule.metric]?.unit}</strong> for <strong style={{ color: THEME.textMuted }}>{newRule.duration} minutes</strong>
                </div>
              </div>
              <div>
                <label style={css.label}>Notification Channels</label>
                <div style={{ display: 'flex', gap: 18 }}>
                  {[{ key: 'email', label: 'Email', icon: '✉' }, { key: 'slack', label: 'Slack', icon: '#' }, { key: 'pagerduty', label: 'PagerDuty', icon: '⚡' }].map(ch => (
                      <label key={ch.key} style={{ display: 'flex', alignItems: 'center', gap: 20, cursor: 'pointer', padding: '20px 24px', background: newRule.channels[ch.key] ? THEME.primary+'10' : THEME.surface, border: `1px solid ${newRule.channels[ch.key] ? THEME.primary+'20' : THEME.glassBorder}`, borderRadius: 18, transition: 'all 0.15s' }}>
                        <input type="checkbox" checked={!!newRule.channels[ch.key]} style={{ accentColor: THEME.primary }} onChange={e => setNewRule(r => ({ ...r, channels: { ...r.channels, [ch.key]: e.target.checked } }))} />
                        <span style={{ fontSize: 12, color: newRule.channels[ch.key] ? THEME.primary : THEME.textMuted }}>{ch.icon} {ch.label}</span>
                      </label>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 22, marginTop: 20, paddingTop: 16, borderTop: `1px solid ${THEME.glassBorder}` }}>
              <button type="button" onClick={() => setShowCreateModal(false)} style={css.btn('ghost')}>Cancel</button>
              <button type="submit" style={css.btn('primary')}><Check size={13} /> {editingRule ? 'Save Changes' : 'Create Rule'}</button>
            </div>
          </form>
        </div>
      </div>
  );

  // ─── RENDER: TOAST ─────────────────────────────────────────────
  const renderToast = () => toast && (
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 2000, background: THEME.surface, border: `1px solid ${toast.type === 'warning' ? SEVERITY.warning.color : toast.type === 'info' ? SEVERITY.info.color : SEVERITY.resolved.color}20`, borderRadius: 20, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 22, boxShadow: '0 4px 20px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)', animation: 'slideUp 0.2s ease', fontSize: 12, color: THEME.textMain, fontFamily: THEME.fontMono }}>
        {toast.type === 'warning' ? <AlertTriangle size={14} color={SEVERITY.warning.color} /> : toast.type === 'info' ? <Info size={14} color={SEVERITY.info.color} /> : <Check size={14} color={SEVERITY.resolved.color} />}
        {toast.msg}
        {toast.action && (
            <button
                onClick={() => { toast.action.onClick(); setToast(null); }}
                style={{ ...css.btn('ghost'), padding: '3px 10px', color: THEME.primary, borderColor: THEME.primary + '30' }}
            >
              {toast.action.label}
            </button>
        )}
      </div>
  );

  // ─── MAIN RENDER ───────────────────────────────────────────────
  return (
      <div style={css.wrap}>
        <style>{`
          @keyframes pulse-ring { 0%,100%{transform:scale(1);opacity:0.3} 50%{transform:scale(1.7);opacity:0} }
          @keyframes slideUp { from{transform:translateY(10px);opacity:0} to{transform:translateY(0);opacity:1} }
          @keyframes fadeSlide { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
          @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
          * { box-sizing: border-box; }
          ::-webkit-scrollbar { width: 6px; height: 6px; }
          ::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
          ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }
          ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }
          select option { background: var(--theme-bgAlt); color: #fff; }
          input[type=number] { -moz-appearance: textfield; }
          input[type=number]::-webkit-outer-spin-button, input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
          .alert-card {
              background: linear-gradient(180deg, ${THEME.surface} 0%, ${THEME.surface}f8 100%);
              border: 1px solid ${THEME.glassBorder};
              border-radius: 20px;
              padding: 24px;
              position: relative;
              overflow: hidden;
              box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
              backdrop-filter: blur(12px);
              transition: all 0.25s ease;
          }
          .alert-card:hover {
              box-shadow: 0 12px 40px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.08);
              transform: translateY(-4px);
          }
          .alert-card::after {
              content: '';
              position: absolute;
              bottom: 0;
              left: 0;
              right: 0;
              height: 3px;
              background: var(--tile-accent, ${THEME.primary});
              opacity: 0.7;
          }
        `}</style>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 22, marginBottom: 4 }}>
              <Terminal size={16} color={THEME.primary} />
              <span style={{ fontSize: 16, fontWeight: 700, color: THEME.textMain, letterSpacing: '0.02em' }}>PulseDB</span>
              <span style={{ fontSize: 9, color: THEME.textMuted, border: `1px solid ${THEME.glassBorder}`, borderRadius: 18, padding: '2px 6px', letterSpacing: '0.02em' }}>v3.0</span>
              {maintenanceMode && <span style={{ fontSize: 9, background: 'rgba(255,170,0,0.06)', border: `1px solid ${SEVERITY.warning.color}20`, color: SEVERITY.warning.color, borderRadius: 18, padding: '2px 8px', letterSpacing: '0.02em', fontWeight: 700 }}>MAINTENANCE WINDOW</span>}
            </div>
            <div style={{ fontSize: 11, color: THEME.textMuted, display: 'flex', alignItems: 'center', gap: 18 }}>
              <span style={{ display: 'flex', alignItems: 'center' }}><PulseDot color={SEVERITY.resolved.color} size={6} /><span style={{ marginLeft: 6 }}>Connected · Last sync {formatAge(Date.now() - 8000)}</span></span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Users size={10} />
                <span>{TEAM_MEMBERS.filter(m => m.online).length}/{TEAM_MEMBERS.length} online</span>
                {TEAM_MEMBERS.filter(m => m.online).slice(0, 3).map(m => <Avatar key={m.id} initials={m.avatar} online={m.online} size={16} />)}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <button onClick={() => setSoundEnabled(s => !s)} title={soundEnabled ? 'Mute alerts' : 'Enable sounds'} style={{ background: THEME.surface, border: `1px solid ${THEME.glassBorder}`, borderRadius: 18, color: THEME.textMuted, cursor: 'pointer', padding: '6px 8px' }}>
              {soundEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
            </button>
          </div>
        </div>

        {renderStats()}

        <div style={{ marginBottom: 6 }}>
          <div style={{ ...css.sHdr }}>▸ Live Metrics</div>
          {renderLiveMetrics()}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, paddingBottom: 12, borderBottom: `1px solid ${THEME.glassBorder}`, marginBottom: 16 }}>
          <button onClick={() => setActiveTab('active')} style={css.tab(activeTab === 'active')}>
            <Bell size={12} /> ACTIVE
            {stats.unacked > 0 && <span style={{ background: SEVERITY.critical.color, color: '#fff', borderRadius: 18, padding: '1px 5px', fontSize: 9, fontWeight: 700 }}>{stats.unacked}</span>}
          </button>
          <button onClick={() => setActiveTab('config')} style={css.tab(activeTab === 'config')}>
            <SlidersHorizontal size={12} /> CONFIG
          </button>
          <button onClick={() => setActiveTab('history')} style={css.tab(activeTab === 'history')}>
            <History size={12} /> HISTORY
            {CHANNEL_STATUS.some(c => c.status !== 'operational') && <span style={{ fontSize: 9, color: SEVERITY.warning.color }}>⚠</span>}
          </button>
        </div>

        <div style={{ animation: 'fadeSlide 0.2s ease' }} key={activeTab}>
          {activeTab === 'active'  && renderActive()}
          {activeTab === 'config'  && renderConfig()}
          {activeTab === 'history' && renderHistory()}
        </div>

        {showCreateModal && renderModal()}
        {renderToast()}
      </div>
  );
};

const AlertsComponent = PULSEDBDashboard;
export default AlertsComponent;