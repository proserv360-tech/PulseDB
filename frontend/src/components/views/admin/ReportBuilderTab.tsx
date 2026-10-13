import React, { useState, useEffect } from 'react';
import { THEME, useAdaptiveTheme } from '../../../utils/theme';
import { fetchData, postData } from '../../../utils/api';
import {
  FileText, Download, Eye, Calendar, Settings, CheckCircle,
  AlertTriangle, TrendingUp, Database, Lock, Zap, HardDrive,
  Clock, ChevronDown, ChevronUp
} from 'lucide-react';

/* ── Styles ───────────────────────────────────────────────────────────────── */
const Styles = () => (
    <style>{`
        @keyframes rbFade { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .rb-container { padding:20px; max-width:1400px; }
        .rb-layout { display:grid; grid-template-columns:350px 1fr; gap:20px; }
        .rb-panel {
            background:${THEME.surface};
            border:1px solid ${THEME.glassBorder};
            border-radius: 20px;
            padding:20px;
            animation:rbFade .3s ease;
            max-height:calc(100vh - 100px);
            overflow-y:auto;
            box-shadow:0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04);
            backdrop-filter:blur(12px);
            transition:all 0.2s ease;
        }
        .rb-panel:hover {
            transform:translateY(-4px);
            box-shadow:0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06);
        }
        .rb-preview { background:${THEME.surfaceRaised}; border-radius: 20px; }
        .rb-section-title {
            font-size:14px;
            font-weight:700;
            color:${THEME.textMuted};
            text-transform:uppercase;
            letter-spacing:0.5px;
            margin:20px 0 12px 0;
        }
        .rb-input {
            width:100%;
            background:${THEME.bg};
            border:1px solid ${THEME.glassBorder};
            border-radius: 20px;
            padding:10px 12px;
            color:${THEME.textMain};
            font-size:13px;
            margin-bottom:12px;
            font-family:inherit;
        }
        .rb-input:focus { outline:none; border-color:${THEME.primary}; box-shadow:0 0 0 2px ${THEME.primary}20; }
        .rb-checkbox-group {
            display:grid;
            gap: 20px;
            margin-bottom:12px;
        }
        .rb-checkbox-item {
            display:flex;
            align-items:center;
            gap: 20px;
            padding:10px;
            background:${THEME.bg};
            border-radius: 22px;
            cursor:pointer;
            transition:background .2s;
        }
        .rb-checkbox-item:hover { background:${THEME.surfaceHover}; }
        .rb-checkbox-item input { cursor:pointer; }
        .rb-label {
            font-size:13px;
            font-weight:600;
            color:${THEME.textMain};
            margin-bottom:8px;
            display:block;
        }
        .rb-select {
            width:100%;
            background:${THEME.bg};
            border:1px solid ${THEME.glassBorder};
            border-radius: 20px;
            padding:10px 12px;
            color:${THEME.textMain};
            font-size:13px;
            cursor:pointer;
            margin-bottom:12px;
        }
        .rb-button {
            width:100%;
            background:${THEME.primary};
            color:${THEME.textInverse};
            border:none;
            border-radius: 20px;
            padding:12px;
            font-weight:700;
            font-size:13px;
            cursor:pointer;
            display:flex;
            align-items:center;
            justify-content:center;
            gap: 20px;
            transition:background .2s;
        }
        .rb-button:hover { background:${THEME.primaryLight}; }
        .rb-button:disabled { opacity:0.5; cursor:not-allowed; }
        .rb-button-secondary { background:${THEME.secondary}; color:${THEME.textInverse}; }
        .rb-button-secondary:hover { background:${THEME.secondaryLight}; }
        .rb-preview-scroll { max-height:calc(100vh - 200px); overflow-y:auto; padding:20px; }
        .rb-report-card {
            background:${THEME.surface};
            border:1px solid ${THEME.glassBorder};
            border-radius: 20px;
            padding:0;
            margin-bottom:20px;
            overflow:hidden;
            box-shadow:0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04);
            transition:all 0.2s ease;
            backdrop-filter:blur(12px);
        }
        .rb-report-card:hover {
            border-color:${THEME.primary}30;
            transform:translateY(-4px);
            box-shadow:0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06);
        }
        .rb-report-card > * {
            padding:20px;
            border-bottom:1px solid ${THEME.glassBorder};
        }
        .rb-report-card > *:last-child {
            border-bottom:none;
        }
        .rb-report-header {
            font-size:16px;
            font-weight:700;
            color:${THEME.textMain};
            margin-bottom:12px;
            display:flex;
            align-items:center;
            gap: 20px;
            background:${THEME.bg}06;
            padding:14px 20px;
            margin:-20px -20px 12px -20px;
        }
        .rb-report-metric {
            display:grid;
            grid-template-columns:1fr 1fr;
            gap:18px;
            margin-bottom:12px;
        }
        .rb-metric-item {
            background:${THEME.bg};
            border-radius: 22px;
            padding:16px;
        }
        .rb-metric-label {
            font-size:11px;
            color:${THEME.textMuted};
            text-transform:uppercase;
            font-weight:700;
            margin-bottom:4px;
        }
        .rb-metric-value {
            font-size:18px;
            font-weight:700;
            color:${THEME.primary};
        }
        .rb-metric-unit {
            font-size:12px;
            color:${THEME.textMuted};
            margin-left:4px;
        }
        .rb-status-badge {
            display:inline-block;
            padding:4px 8px;
            border-radius: 20px;
            font-size:11px;
            font-weight:700;
            text-transform:uppercase;
        }
        .rb-status-good { background:${THEME.success}20; color:${THEME.success}; }
        .rb-status-warning { background:${THEME.warning}20; color:${THEME.warning}; }
        .rb-status-critical { background:${THEME.danger}20; color:${THEME.danger}; }
        .rb-table {
            width:100%;
            border-collapse:collapse;
            margin-top:12px;
            font-size:12px;
        }
        .rb-table th {
            background:${THEME.bg};
            color:${THEME.textMuted};
            padding:8px;
            text-align:left;
            font-weight:700;
            border-bottom:1px solid ${THEME.glassBorder};
        }
        .rb-table td {
            padding:8px;
            border-bottom:1px solid ${THEME.glassBorder};
            color:${THEME.textMain};
        }
        .rb-table tr:hover { background:${THEME.bg}; }
        .rb-divider { height:1px; background:${THEME.glassBorder}; margin:16px 0; }
        .rb-spinner {
            display:inline-block;
            width:12px;
            height:12px;
            border:2px solid ${THEME.primary}20;
            border-top:2px solid ${THEME.primary};
            border-radius:50%;
            animation:spin .6s linear infinite;
        }
        @keyframes spin { to { transform:rotate(360deg); } }
        .rb-error {
            background:${THEME.danger}15;
            border:1px solid ${THEME.danger};
            color:${THEME.danger};
            border-radius: 20px;
            padding:12px;
            margin-bottom:12px;
            font-size:12px;
        }
        .rb-success {
            background:${THEME.success}15;
            border:1px solid ${THEME.success};
            color:${THEME.success};
            border-radius: 20px;
            padding:12px;
            margin-bottom:12px;
            font-size:12px;
        }
        .rb-template-card {
            background:${THEME.bg};
            border:1px solid ${THEME.glassBorder};
            border-radius: 22px;
            padding:14px;
            margin-bottom:8px;
            cursor:pointer;
            transition:all .2s;
            box-shadow:0 2px 6px rgba(0,0,0,0.04);
        }
        .rb-template-card:hover {
            border-color:${THEME.primary};
            background:${THEME.primary}08;
            transform:translateY(-3px);
            box-shadow:0 4px 12px rgba(0,0,0,0.08);
        }
        .rb-template-card.active {
            border-color:${THEME.primary};
            background:${THEME.primary}15;
        }
        .rb-template-name {
            font-size:13px;
            font-weight:700;
            color:${THEME.textMain};
        }
        .rb-template-desc {
            font-size:11px;
            color:${THEME.textDim};
            margin-top:4px;
        }
        .rb-toggle-btn {
            background:none;
            border:none;
            color:${THEME.primary};
            cursor:pointer;
            padding:4px;
            display:flex;
            align-items:center;
            font-size:12px;
        }
        @media (max-width:1024px) {
            .rb-layout { grid-template-columns:1fr; }
        }
    `}</style>
);

/* ── Report Templates ──────────────────────────────────────────────────────── */
const TEMPLATES = {
    executive: {
        name: 'Executive Summary',
        description: 'High-level KPIs and trends',
        sections: ['overview']
    },
    dba: {
        name: 'DBA Daily Report',
        description: 'Full technical metrics and diagnostics',
        sections: ['overview', 'performance', 'resources', 'query', 'replication']
    },
    security: {
        name: 'Security Audit',
        description: 'Compliance and access logs',
        sections: ['security', 'alerts']
    },
    capacity: {
        name: 'Capacity Report',
        description: 'Storage and growth projections',
        sections: ['resources', 'overview']
    },
    incident: {
        name: 'Incident Report',
        description: 'Alerts, downtime, and resolution',
        sections: ['alerts', 'performance', 'reliability']
    }
};

const SECTION_METADATA = {
    overview: { icon: Database, label: 'Overview KPIs', color: THEME.primary },
    performance: { icon: Zap, label: 'Performance Metrics', color: THEME.primary },
    resources: { icon: HardDrive, label: 'Resource Utilization', color: THEME.secondaryDark },
    query: { icon: TrendingUp, label: 'Query Analysis', color: THEME.aiLight },
    alerts: { icon: AlertTriangle, label: 'Alert Summary', color: THEME.warning },
    replication: { icon: CheckCircle, label: 'Replication Status', color: THEME.info },
    security: { icon: Lock, label: 'Security & Compliance', color: THEME.danger },
    capacity: { icon: TrendingUp, label: 'Capacity Planning', color: THEME.primary },
    reliability: { icon: CheckCircle, label: 'Reliability', color: THEME.success },
};

/* ═══════════════════════════════════════════════════════════════════════════
   REPORT BUILDER TAB
   ═══════════════════════════════════════════════════════════════════════════ */
export default function ReportBuilderTab() {
    useAdaptiveTheme();

    const [reportName, setReportName] = useState('FATHOM Report');
    const [dateRange, setDateRange] = useState('7d');
    const [selectedSections, setSelectedSections] = useState(['overview', 'performance', 'resources']);
    const [selectedTemplate, setSelectedTemplate] = useState('dba');
    const [schedule, setSchedule] = useState('once');
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [showAdvanced, setShowAdvanced] = useState(false);

    const sectionKeys = Object.keys(SECTION_METADATA);

    const handleTemplateSelect = (templateKey) => {
        setSelectedTemplate(templateKey);
        setSelectedSections(TEMPLATES[templateKey].sections);
    };

    const handleSectionToggle = (section) => {
        setSelectedSections(prev =>
            prev.includes(section)
                ? prev.filter(s => s !== section)
                : [...prev, section]
        );
        setSelectedTemplate(null);
    };

    const generatePreview = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchData(
                `/api/reports/data?sections=${selectedSections.join(',')}&range=${dateRange}`
            );
            setReportData(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateReport = async () => {
        setLoading(true);
        setError(null);
        setSuccess(null);
        try {
            const response = await fetch('/api/reports/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: reportName,
                    sections: selectedSections,
                    dateRange,
                    schedule,
                })
            });
            if (!response.ok) throw new Error('Failed to generate report');
            const blob = await response.blob();

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            setSuccess('Report generated and opened in new window');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="rb-container">
            <Styles />

            <div className="rb-layout">
                {/* ── Configuration Panel ────────────────────────────────────── */}
                <div className="rb-panel">
                    <div style={{ fontSize: 16, fontWeight: 700, color: THEME.textMain, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20 }}>
                        <Settings size={18} color={THEME.primary} />
                        Report Configuration
                    </div>

                    {/* Report Name */}
                    <label className="rb-label">Report Name</label>
                    <input
                        type="text"
                        className="rb-input"
                        value={reportName}
                        onChange={(e) => setReportName(e.target.value)}
                        placeholder="e.g. Weekly Database Report"
                    />

                    {/* Date Range */}
                    <label className="rb-label">Date Range</label>
                    <select className="rb-select" value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
                        <option value="24h">Last 24 Hours</option>
                        <option value="7d">Last 7 Days</option>
                        <option value="30d">Last 30 Days</option>
                        <option value="90d">Last 90 Days</option>
                        <option value="custom">Custom Range</option>
                    </select>

                    {/* Templates */}
                    <div className="rb-section-title">Templates</div>
                    <div style={{ display: 'grid', gap: 20, marginBottom: 20 }}>
                        {Object.entries(TEMPLATES).map(([key, template]) => (
                            <div
                                key={key}
                                className={`rb-template-card ${selectedTemplate === key ? 'active' : ''}`}
                                onClick={() => handleTemplateSelect(key)}
                            >
                                <div className="rb-template-name">{template.name}</div>
                                <div className="rb-template-desc">{template.description}</div>
                            </div>
                        ))}
                    </div>

                    {/* Metric Sections */}
                    <div className="rb-section-title">Metric Sections</div>
                    <div className="rb-checkbox-group">
                        {sectionKeys.map(section => {
                            const meta = SECTION_METADATA[section];
                            const Icon = meta.icon;
                            return (
                                <label key={section} className="rb-checkbox-item">
                                    <input
                                        type="checkbox"
                                        checked={selectedSections.includes(section)}
                                        onChange={() => handleSectionToggle(section)}
                                    />
                                    <Icon size={14} color={meta.color} />
                                    <span>{meta.label}</span>
                                </label>
                            );
                        })}
                    </div>

                    {/* Advanced Options */}
                    <button
                        className="rb-toggle-btn"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                    >
                        {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        Advanced Options
                    </button>

                    {showAdvanced && (
                        <>
                            <div className="rb-divider" />
                            <label className="rb-label">Schedule</label>
                            <select className="rb-select" value={schedule} onChange={(e) => setSchedule(e.target.value)}>
                                <option value="once">One-Time</option>
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                            </select>
                        </>
                    )}

                    <div className="rb-divider" />

                    {error && <div className="rb-error">{error}</div>}
                    {success && <div className="rb-success">{success}</div>}

                    <button
                        className="rb-button"
                        onClick={generatePreview}
                        disabled={loading || selectedSections.length === 0}
                    >
                        {loading ? (
                            <>
                                <span className="rb-spinner" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <Eye size={14} />
                                Preview Report
                            </>
                        )}
                    </button>

                    <button
                        className="rb-button rb-button-secondary"
                        onClick={handleGenerateReport}
                        disabled={loading || selectedSections.length === 0}
                        style={{ marginTop: 8 }}
                    >
                        {loading ? (
                            <>
                                <span className="rb-spinner" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <Download size={14} />
                                Generate & Download
                            </>
                        )}
                    </button>
                </div>

                {/* ── Preview Panel ────────────────────────────────────────── */}
                <div className="rb-panel rb-preview">
                    <div style={{ fontSize: 16, fontWeight: 700, color: THEME.textMain, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20 }}>
                        <Eye size={18} color={THEME.secondary} />
                        Report Preview
                    </div>

                    <div className="rb-preview-scroll">
                        {!reportData ? (
                            <div style={{ color: THEME.textDim, textAlign: 'center', padding: 40 }}>
                                Select sections and click "Preview Report" to see the report
                            </div>
                        ) : (
                            <ReportPreview
                                data={reportData}
                                name={reportName}
                                dateRange={dateRange}
                                selectedSections={selectedSections}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ── Report Preview Component ──────────────────────────────────────────────── */
function ReportPreview({ data, name, dateRange, selectedSections }) {
    return (
        <>
            <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: THEME.textMain, marginBottom: 8 }}>
                    {name}
                </div>
                <div style={{ fontSize: 12, color: THEME.textMuted }}>
                    Generated: {new Date().toLocaleString()}
                </div>
            </div>

            {selectedSections.includes('overview') && data.overview && (
                <ReportSection
                    title="Overview KPIs"
                    icon={SECTION_METADATA.overview.icon}
                    color={SECTION_METADATA.overview.color}
                >
                    <div className="rb-report-metric">
                        <div className="rb-metric-item">
                            <div className="rb-metric-label">Active Connections</div>
                            <div>
                                <span className="rb-metric-value">{data.overview.activeConnections || 0}</span>
                                <span className="rb-metric-unit">/ {data.overview.maxConnections || 100}</span>
                            </div>
                            <div className="rb-status-badge rb-status-good">Healthy</div>
                        </div>
                        <div className="rb-metric-item">
                            <div className="rb-metric-label">Avg Query Time</div>
                            <div>
                                <span className="rb-metric-value">{data.overview.avgQueryTime || 0}</span>
                                <span className="rb-metric-unit">ms</span>
                            </div>
                        </div>
                        <div className="rb-metric-item">
                            <div className="rb-metric-label">Cache Hit Ratio</div>
                            <div>
                                <span className="rb-metric-value">{data.overview.cacheHitRatio || 0}</span>
                                <span className="rb-metric-unit">%</span>
                            </div>
                        </div>
                        <div className="rb-metric-item">
                            <div className="rb-metric-label">Total Transactions</div>
                            <div>
                                <span className="rb-metric-value">{data.overview.totalTransactions || 0}</span>
                            </div>
                        </div>
                    </div>
                </ReportSection>
            )}

            {selectedSections.includes('performance') && data.performance && (
                <ReportSection
                    title="Performance Metrics"
                    icon={SECTION_METADATA.performance.icon}
                    color={SECTION_METADATA.performance.color}
                >
                    <table className="rb-table">
                        <thead>
                            <tr>
                                <th>Metric</th>
                                <th>Value</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Read Latency</td>
                                <td>{data.performance.readLatency || 0} ms</td>
                                <td><span className="rb-status-badge rb-status-good">Good</span></td>
                            </tr>
                            <tr>
                                <td>Write Latency</td>
                                <td>{data.performance.writeLatency || 0} ms</td>
                                <td><span className="rb-status-badge rb-status-good">Good</span></td>
                            </tr>
                            <tr>
                                <td>Sequential Scans</td>
                                <td>{data.performance.seqScans || 0}</td>
                                <td><span className="rb-status-badge rb-status-warning">Monitor</span></td>
                            </tr>
                            <tr>
                                <td>Index Scans</td>
                                <td>{data.performance.indexScans || 0}</td>
                                <td><span className="rb-status-badge rb-status-good">Good</span></td>
                            </tr>
                        </tbody>
                    </table>
                </ReportSection>
            )}

            {selectedSections.includes('resources') && data.resources && (
                <ReportSection
                    title="Resource Utilization"
                    icon={SECTION_METADATA.resources.icon}
                    color={SECTION_METADATA.resources.color}
                >
                    <div className="rb-report-metric">
                        <div className="rb-metric-item">
                            <div className="rb-metric-label">Memory Usage</div>
                            <div>
                                <span className="rb-metric-value">{data.resources.memoryUsage || 0}</span>
                                <span className="rb-metric-unit">%</span>
                            </div>
                            <ProgressBar value={data.resources.memoryUsage || 0} />
                        </div>
                        <div className="rb-metric-item">
                            <div className="rb-metric-label">CPU Usage</div>
                            <div>
                                <span className="rb-metric-value">{data.resources.cpuUsage || 0}</span>
                                <span className="rb-metric-unit">%</span>
                            </div>
                            <ProgressBar value={data.resources.cpuUsage || 0} />
                        </div>
                        <div className="rb-metric-item">
                            <div className="rb-metric-label">Disk Space</div>
                            <div>
                                <span className="rb-metric-value">{data.resources.diskUsage || 0}</span>
                                <span className="rb-metric-unit">GB</span>
                            </div>
                        </div>
                        <div className="rb-metric-item">
                            <div className="rb-metric-label">Connections</div>
                            <div>
                                <span className="rb-metric-value">{data.resources.connectionCount || 0}</span>
                            </div>
                            <ProgressBar value={(data.resources.connectionCount || 0) / 10} />
                        </div>
                    </div>
                </ReportSection>
            )}

            {selectedSections.includes('query') && data.query && (
                <ReportSection
                    title="Query Analysis"
                    icon={SECTION_METADATA.query.icon}
                    color={SECTION_METADATA.query.color}
                >
                    <table className="rb-table">
                        <thead>
                            <tr>
                                <th>Query Type</th>
                                <th>Count</th>
                                <th>Avg Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>SELECT</td>
                                <td>{data.query.selects || 0}</td>
                                <td>{data.query.avgSelectTime || 0} ms</td>
                            </tr>
                            <tr>
                                <td>INSERT</td>
                                <td>{data.query.inserts || 0}</td>
                                <td>{data.query.avgInsertTime || 0} ms</td>
                            </tr>
                            <tr>
                                <td>UPDATE</td>
                                <td>{data.query.updates || 0}</td>
                                <td>{data.query.avgUpdateTime || 0} ms</td>
                            </tr>
                            <tr>
                                <td>DELETE</td>
                                <td>{data.query.deletes || 0}</td>
                                <td>{data.query.avgDeleteTime || 0} ms</td>
                            </tr>
                        </tbody>
                    </table>
                </ReportSection>
            )}

            {selectedSections.includes('alerts') && data.alerts && (
                <ReportSection
                    title="Alert Summary"
                    icon={SECTION_METADATA.alerts.icon}
                    color={SECTION_METADATA.alerts.color}
                >
                    <div className="rb-report-metric">
                        <div className="rb-metric-item">
                            <div className="rb-metric-label">Critical Alerts</div>
                            <div>
                                <span className="rb-metric-value">{data.alerts.critical || 0}</span>
                            </div>
                            <div className="rb-status-badge rb-status-critical">Critical</div>
                        </div>
                        <div className="rb-metric-item">
                            <div className="rb-metric-label">Warning Alerts</div>
                            <div>
                                <span className="rb-metric-value">{data.alerts.warning || 0}</span>
                            </div>
                            <div className="rb-status-badge rb-status-warning">Warning</div>
                        </div>
                        <div className="rb-metric-item">
                            <div className="rb-metric-label">Info Alerts</div>
                            <div>
                                <span className="rb-metric-value">{data.alerts.info || 0}</span>
                            </div>
                            <div className="rb-status-badge rb-status-good">Info</div>
                        </div>
                        <div className="rb-metric-item">
                            <div className="rb-metric-label">Acknowledged</div>
                            <div>
                                <span className="rb-metric-value">{data.alerts.acknowledged || 0}</span>
                            </div>
                        </div>
                    </div>
                </ReportSection>
            )}

            {selectedSections.includes('replication') && data.replication && (
                <ReportSection
                    title="Replication Status"
                    icon={SECTION_METADATA.replication.icon}
                    color={SECTION_METADATA.replication.color}
                >
                    <table className="rb-table">
                        <thead>
                            <tr>
                                <th>Replica</th>
                                <th>Status</th>
                                <th>Lag (bytes)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Replica 1</td>
                                <td><span className="rb-status-badge rb-status-good">Streaming</span></td>
                                <td>{data.replication.lag1 || 0}</td>
                            </tr>
                            <tr>
                                <td>Replica 2</td>
                                <td><span className="rb-status-badge rb-status-good">Streaming</span></td>
                                <td>{data.replication.lag2 || 0}</td>
                            </tr>
                        </tbody>
                    </table>
                </ReportSection>
            )}

            {selectedSections.includes('security') && data.security && (
                <ReportSection
                    title="Security & Compliance"
                    icon={SECTION_METADATA.security.icon}
                    color={SECTION_METADATA.security.color}
                >
                    <div className="rb-report-metric">
                        <div className="rb-metric-item">
                            <div className="rb-metric-label">Active Users</div>
                            <div>
                                <span className="rb-metric-value">{data.security.activeUsers || 0}</span>
                            </div>
                        </div>
                        <div className="rb-metric-item">
                            <div className="rb-metric-label">Failed Login Attempts</div>
                            <div>
                                <span className="rb-metric-value">{data.security.failedLogins || 0}</span>
                            </div>
                            <div className="rb-status-badge rb-status-good">Normal</div>
                        </div>
                        <div className="rb-metric-item">
                            <div className="rb-metric-label">Audit Events</div>
                            <div>
                                <span className="rb-metric-value">{data.security.auditEvents || 0}</span>
                            </div>
                        </div>
                        <div className="rb-metric-item">
                            <div className="rb-metric-label">Role Changes</div>
                            <div>
                                <span className="rb-metric-value">{data.security.roleChanges || 0}</span>
                            </div>
                        </div>
                    </div>
                </ReportSection>
            )}

            {selectedSections.includes('reliability') && data.reliability && (
                <ReportSection
                    title="Reliability"
                    icon={SECTION_METADATA.reliability.icon}
                    color={SECTION_METADATA.reliability.color}
                >
                    <div className="rb-report-metric">
                        <div className="rb-metric-item">
                            <div className="rb-metric-label">Uptime</div>
                            <div>
                                <span className="rb-metric-value">{data.reliability.uptime || 99.9}</span>
                                <span className="rb-metric-unit">%</span>
                            </div>
                            <div className="rb-status-badge rb-status-good">Excellent</div>
                        </div>
                        <div className="rb-metric-item">
                            <div className="rb-metric-label">Incidents</div>
                            <div>
                                <span className="rb-metric-value">{data.reliability.incidents || 0}</span>
                            </div>
                        </div>
                        <div className="rb-metric-item">
                            <div className="rb-metric-label">MTBF (hours)</div>
                            <div>
                                <span className="rb-metric-value">{data.reliability.mtbf || 0}</span>
                            </div>
                        </div>
                        <div className="rb-metric-item">
                            <div className="rb-metric-label">MTTR (minutes)</div>
                            <div>
                                <span className="rb-metric-value">{data.reliability.mttr || 0}</span>
                            </div>
                        </div>
                    </div>
                </ReportSection>
            )}

            {selectedSections.includes('capacity') && data.capacity && (
                <ReportSection
                    title="Capacity Planning"
                    icon={SECTION_METADATA.capacity.icon}
                    color={SECTION_METADATA.capacity.color}
                >
                    <div className="rb-report-metric">
                        <div className="rb-metric-item">
                            <div className="rb-metric-label">Storage Capacity</div>
                            <div>
                                <span className="rb-metric-value">{data.capacity.storageCapacity || 0}</span>
                                <span className="rb-metric-unit">TB</span>
                            </div>
                            <ProgressBar value={(data.capacity.storageUsed || 0) / (data.capacity.storageCapacity || 1) * 100} />
                        </div>
                        <div className="rb-metric-item">
                            <div className="rb-metric-label">Growth Rate</div>
                            <div>
                                <span className="rb-metric-value">{data.capacity.growthRate || 0}</span>
                                <span className="rb-metric-unit">GB/day</span>
                            </div>
                        </div>
                        <div className="rb-metric-item">
                            <div className="rb-metric-label">Projected Capacity (90d)</div>
                            <div>
                                <span className="rb-metric-value">{data.capacity.projectedCapacity || 0}</span>
                                <span className="rb-metric-unit">TB</span>
                            </div>
                        </div>
                        <div className="rb-metric-item">
                            <div className="rb-metric-label">Days to Full</div>
                            <div>
                                <span className="rb-metric-value">{data.capacity.daysToFull || 999}</span>
                                <span className="rb-metric-unit">days</span>
                            </div>
                        </div>
                    </div>
                </ReportSection>
            )}
        </>
    );
}

function ReportSection({ title, icon: Icon, color, children }) {
    return (
        <div className="rb-report-card">
            <div className="rb-report-header">
                <Icon size={16} color={color} />
                {title}
            </div>
            {children}
        </div>
    );
}

function ProgressBar({ value }) {
    const barColor = value > 80 ? THEME.danger : value > 60 ? THEME.warning : THEME.secondaryDark;
    return (
        <div style={{
            width: '100%',
            height: 6,
            background: THEME.bg,
            borderRadius: 16,
            marginTop: 6,
            overflow: 'hidden'
        }}>
            <div style={{
                width: `${Math.min(value, 100)}%`,
                height: '100%',
                background: barColor,
                transition: 'width .3s ease'
            }} />
        </div>
    );
}