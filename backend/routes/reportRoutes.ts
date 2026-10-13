// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * routes/reportRoutes.js
 * ──────────────────────
 * Report generation and management endpoints.
 * Mount with:
 *   app.use('/api', reportRoutes(pool, authenticate, requireScreen));
 */

import { Router } from 'express';

function log(level, message, meta = {}) {
    const fn = level === 'ERROR' ? console.error : console.log;
    fn(JSON.stringify({ ts: new Date().toISOString(), level, msg: message, ...meta }));
}

/**
 * Mock report data generator
 * In production, this would query actual database metrics
 */
function generateMockMetrics(sections, range) {
    const metrics = {};

    if (sections.includes('overview')) {
        metrics.overview = {
            activeConnections: Math.floor(Math.random() * 50) + 10,
            maxConnections: 100,
            avgQueryTime: Math.floor(Math.random() * 150) + 20,
            cacheHitRatio: Math.floor(Math.random() * 40) + 85,
            totalTransactions: Math.floor(Math.random() * 10000) + 5000,
        };
    }

    if (sections.includes('performance')) {
        metrics.performance = {
            readLatency: (Math.random() * 30).toFixed(2),
            writeLatency: (Math.random() * 50).toFixed(2),
            seqScans: Math.floor(Math.random() * 1000) + 100,
            indexScans: Math.floor(Math.random() * 5000) + 1000,
        };
    }

    if (sections.includes('resources')) {
        metrics.resources = {
            memoryUsage: Math.floor(Math.random() * 60) + 20,
            cpuUsage: Math.floor(Math.random() * 50) + 15,
            diskUsage: Math.floor(Math.random() * 500) + 100,
            connectionCount: Math.floor(Math.random() * 50) + 20,
        };
    }

    if (sections.includes('query')) {
        metrics.query = {
            selects: Math.floor(Math.random() * 50000) + 10000,
            avgSelectTime: (Math.random() * 100).toFixed(2),
            inserts: Math.floor(Math.random() * 5000) + 1000,
            avgInsertTime: (Math.random() * 50).toFixed(2),
            updates: Math.floor(Math.random() * 3000) + 500,
            avgUpdateTime: (Math.random() * 75).toFixed(2),
            deletes: Math.floor(Math.random() * 1000) + 100,
            avgDeleteTime: (Math.random() * 60).toFixed(2),
        };
    }

    if (sections.includes('alerts')) {
        metrics.alerts = {
            critical: Math.floor(Math.random() * 3),
            warning: Math.floor(Math.random() * 10) + 2,
            info: Math.floor(Math.random() * 20) + 10,
            acknowledged: Math.floor(Math.random() * 15) + 5,
        };
    }

    if (sections.includes('replication')) {
        metrics.replication = {
            lag1: Math.floor(Math.random() * 1000),
            lag2: Math.floor(Math.random() * 2000),
        };
    }

    if (sections.includes('security')) {
        metrics.security = {
            activeUsers: Math.floor(Math.random() * 50) + 10,
            failedLogins: Math.floor(Math.random() * 5),
            auditEvents: Math.floor(Math.random() * 100) + 50,
            roleChanges: Math.floor(Math.random() * 5),
        };
    }

    if (sections.includes('reliability')) {
        metrics.reliability = {
            uptime: (99.9 + Math.random() * 0.1).toFixed(2),
            incidents: Math.floor(Math.random() * 2),
            mtbf: Math.floor(Math.random() * 500) + 100,
            mttr: Math.floor(Math.random() * 30) + 5,
        };
    }

    if (sections.includes('capacity')) {
        metrics.capacity = {
            storageCapacity: Math.floor(Math.random() * 10) + 5,
            storageUsed: Math.floor(Math.random() * 3) + 1,
            growthRate: (Math.random() * 5).toFixed(2),
            projectedCapacity: Math.floor(Math.random() * 15) + 8,
            daysToFull: Math.floor(Math.random() * 500) + 100,
        };
    }

    return metrics;
}

/**
 * Generate HTML report document for printing/PDF export
 */
function generateHTMLReport(reportConfig, metrics) {
    const {
        name,
        sections,
        dateRange,
        timestamp,
    } = reportConfig;

    const rangeLabelMap = {
        '24h': 'Last 24 Hours',
        '7d': 'Last 7 Days',
        '30d': 'Last 30 Days',
        '90d': 'Last 90 Days',
    };

    const rangeLabel = rangeLabelMap[dateRange] || dateRange;

    const tableOfContents = sections
        .map((s, i) => {
            const labels = {
                overview: 'Overview KPIs',
                performance: 'Performance Metrics',
                resources: 'Resource Utilization',
                query: 'Query Analysis',
                alerts: 'Alert Summary',
                replication: 'Replication Status',
                security: 'Security & Compliance',
                reliability: 'Reliability',
                capacity: 'Capacity Planning',
            };
            return `<li><a href="#section-${i}">${labels[s] || s}</a></li>`;
        })
        .join('');

    let sectionsHTML = '';

    sections.forEach((section, idx) => {
        const data = metrics[section] || {};
        const sectionId = `section-${idx}`;

        if (section === 'overview') {
            sectionsHTML += `
                <div class="report-section" id="${sectionId}">
                    <h2>Overview KPIs</h2>
                    <p style="color: #666; font-size: 12px; margin-bottom: 16px;">Period: ${rangeLabel}</p>
                    <table class="data-table">
                        <tr>
                            <td class="metric-label">Active Connections</td>
                            <td class="metric-value">${data.activeConnections || 0} / ${data.maxConnections || 100}</td>
                        </tr>
                        <tr>
                            <td class="metric-label">Average Query Time</td>
                            <td class="metric-value">${data.avgQueryTime || 0} ms</td>
                        </tr>
                        <tr>
                            <td class="metric-label">Cache Hit Ratio</td>
                            <td class="metric-value">${data.cacheHitRatio || 0}%</td>
                        </tr>
                        <tr>
                            <td class="metric-label">Total Transactions</td>
                            <td class="metric-value">${data.totalTransactions || 0}</td>
                        </tr>
                    </table>
                </div>
            `;
        } else if (section === 'performance') {
            sectionsHTML += `
                <div class="report-section" id="${sectionId}">
                    <h2>Performance Metrics</h2>
                    <table class="data-table">
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
                                <td>${data.readLatency || 0} ms</td>
                                <td><span class="badge good">Good</span></td>
                            </tr>
                            <tr>
                                <td>Write Latency</td>
                                <td>${data.writeLatency || 0} ms</td>
                                <td><span class="badge good">Good</span></td>
                            </tr>
                            <tr>
                                <td>Sequential Scans</td>
                                <td>${data.seqScans || 0}</td>
                                <td><span class="badge warning">Monitor</span></td>
                            </tr>
                            <tr>
                                <td>Index Scans</td>
                                <td>${data.indexScans || 0}</td>
                                <td><span class="badge good">Good</span></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            `;
        } else if (section === 'resources') {
            sectionsHTML += `
                <div class="report-section" id="${sectionId}">
                    <h2>Resource Utilization</h2>
                    <table class="data-table">
                        <tr>
                            <td class="metric-label">Memory Usage</td>
                            <td><span class="metric-value">${data.memoryUsage || 0}%</span> ${makeProgressBar(data.memoryUsage || 0)}</td>
                        </tr>
                        <tr>
                            <td class="metric-label">CPU Usage</td>
                            <td><span class="metric-value">${data.cpuUsage || 0}%</span> ${makeProgressBar(data.cpuUsage || 0)}</td>
                        </tr>
                        <tr>
                            <td class="metric-label">Disk Space</td>
                            <td class="metric-value">${data.diskUsage || 0} GB</td>
                        </tr>
                        <tr>
                            <td class="metric-label">Active Connections</td>
                            <td><span class="metric-value">${data.connectionCount || 0}</span> ${makeProgressBar((data.connectionCount || 0) / 100 * 100)}</td>
                        </tr>
                    </table>
                </div>
            `;
        } else if (section === 'query') {
            sectionsHTML += `
                <div class="report-section" id="${sectionId}">
                    <h2>Query Analysis</h2>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Query Type</th>
                                <th>Count</th>
                                <th>Avg Time (ms)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>SELECT</td>
                                <td>${data.selects || 0}</td>
                                <td>${data.avgSelectTime || 0}</td>
                            </tr>
                            <tr>
                                <td>INSERT</td>
                                <td>${data.inserts || 0}</td>
                                <td>${data.avgInsertTime || 0}</td>
                            </tr>
                            <tr>
                                <td>UPDATE</td>
                                <td>${data.updates || 0}</td>
                                <td>${data.avgUpdateTime || 0}</td>
                            </tr>
                            <tr>
                                <td>DELETE</td>
                                <td>${data.deletes || 0}</td>
                                <td>${data.avgDeleteTime || 0}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            `;
        } else if (section === 'alerts') {
            sectionsHTML += `
                <div class="report-section" id="${sectionId}">
                    <h2>Alert Summary</h2>
                    <table class="data-table">
                        <tr>
                            <td class="metric-label">Critical Alerts</td>
                            <td><span class="metric-value critical">${data.critical || 0}</span></td>
                        </tr>
                        <tr>
                            <td class="metric-label">Warning Alerts</td>
                            <td><span class="metric-value warning">${data.warning || 0}</span></td>
                        </tr>
                        <tr>
                            <td class="metric-label">Info Alerts</td>
                            <td><span class="metric-value">${data.info || 0}</span></td>
                        </tr>
                        <tr>
                            <td class="metric-label">Acknowledged</td>
                            <td class="metric-value">${data.acknowledged || 0}</td>
                        </tr>
                    </table>
                </div>
            `;
        } else if (section === 'replication') {
            sectionsHTML += `
                <div class="report-section" id="${sectionId}">
                    <h2>Replication Status</h2>
                    <table class="data-table">
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
                                <td><span class="badge good">Streaming</span></td>
                                <td>${data.lag1 || 0}</td>
                            </tr>
                            <tr>
                                <td>Replica 2</td>
                                <td><span class="badge good">Streaming</span></td>
                                <td>${data.lag2 || 0}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            `;
        } else if (section === 'security') {
            sectionsHTML += `
                <div class="report-section" id="${sectionId}">
                    <h2>Security & Compliance</h2>
                    <table class="data-table">
                        <tr>
                            <td class="metric-label">Active Users</td>
                            <td class="metric-value">${data.activeUsers || 0}</td>
                        </tr>
                        <tr>
                            <td class="metric-label">Failed Login Attempts</td>
                            <td class="metric-value">${data.failedLogins || 0}</td>
                        </tr>
                        <tr>
                            <td class="metric-label">Audit Events</td>
                            <td class="metric-value">${data.auditEvents || 0}</td>
                        </tr>
                        <tr>
                            <td class="metric-label">Role Changes</td>
                            <td class="metric-value">${data.roleChanges || 0}</td>
                        </tr>
                    </table>
                </div>
            `;
        } else if (section === 'reliability') {
            sectionsHTML += `
                <div class="report-section" id="${sectionId}">
                    <h2>Reliability</h2>
                    <table class="data-table">
                        <tr>
                            <td class="metric-label">Uptime</td>
                            <td><span class="metric-value good">${data.uptime || 99.9}%</span></td>
                        </tr>
                        <tr>
                            <td class="metric-label">Incidents</td>
                            <td class="metric-value">${data.incidents || 0}</td>
                        </tr>
                        <tr>
                            <td class="metric-label">MTBF (hours)</td>
                            <td class="metric-value">${data.mtbf || 0}</td>
                        </tr>
                        <tr>
                            <td class="metric-label">MTTR (minutes)</td>
                            <td class="metric-value">${data.mttr || 0}</td>
                        </tr>
                    </table>
                </div>
            `;
        } else if (section === 'capacity') {
            sectionsHTML += `
                <div class="report-section" id="${sectionId}">
                    <h2>Capacity Planning</h2>
                    <table class="data-table">
                        <tr>
                            <td class="metric-label">Storage Capacity</td>
                            <td class="metric-value">${data.storageCapacity || 0} TB</td>
                        </tr>
                        <tr>
                            <td class="metric-label">Growth Rate</td>
                            <td class="metric-value">${data.growthRate || 0} GB/day</td>
                        </tr>
                        <tr>
                            <td class="metric-label">Projected (90d)</td>
                            <td class="metric-value">${data.projectedCapacity || 0} TB</td>
                        </tr>
                        <tr>
                            <td class="metric-label">Days to Full</td>
                            <td class="metric-value">${data.daysToFull || 999}</td>
                        </tr>
                    </table>
                </div>
            `;
        }
    });

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${name}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #1f2937;
            background: #fff;
            padding: 20px;
            line-height: 1.6;
        }
        .report-container {
            max-width: 210mm;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .report-header {
            border-bottom: 3px solid #0ea5e9;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .report-title {
            font-size: 28px;
            font-weight: 700;
            color: #111827;
            margin-bottom: 8px;
        }
        .report-meta {
            font-size: 12px;
            color: #6b7280;
        }
        .report-meta p {
            margin: 4px 0;
        }
        .table-of-contents {
            background: #f3f4f6;
            padding: 20px;
            border-radius: 6px;
            margin-bottom: 30px;
            page-break-inside: avoid;
        }
        .table-of-contents h3 {
            font-size: 14px;
            font-weight: 700;
            margin-bottom: 12px;
            color: #111827;
        }
        .table-of-contents ul {
            list-style: none;
        }
        .table-of-contents li {
            margin: 6px 0;
            font-size: 12px;
        }
        .table-of-contents a {
            color: #0ea5e9;
            text-decoration: none;
            cursor: pointer;
        }
        .report-section {
            margin-bottom: 30px;
            page-break-inside: avoid;
        }
        .report-section h2 {
            font-size: 18px;
            font-weight: 700;
            color: #111827;
            border-left: 4px solid #0ea5e9;
            padding-left: 12px;
            margin-bottom: 16px;
            margin-top: 0;
        }
        .data-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 12px;
            font-size: 12px;
        }
        .data-table thead {
            background: #f3f4f6;
        }
        .data-table th {
            padding: 10px 12px;
            text-align: left;
            font-weight: 700;
            color: #374151;
            border-bottom: 2px solid #e5e7eb;
        }
        .data-table td {
            padding: 10px 12px;
            border-bottom: 1px solid #e5e7eb;
        }
        .data-table tbody tr:hover {
            background: #fafafa;
        }
        .metric-label {
            font-weight: 600;
            color: #374151;
            width: 40%;
        }
        .metric-value {
            font-weight: 700;
            color: #0ea5e9;
            font-size: 14px;
        }
        .metric-value.critical {
            color: #dc2626;
        }
        .metric-value.warning {
            color: #d97706;
        }
        .metric-value.good {
            color: #16a34a;
        }
        .badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
        }
        .badge.good {
            background: #dcfce7;
            color: #166534;
        }
        .badge.warning {
            background: #fef3c7;
            color: #92400e;
        }
        .badge.critical {
            background: #fee2e2;
            color: #991b1b;
        }
        .progress-bar {
            display: inline-block;
            width: 100px;
            height: 6px;
            background: #e5e7eb;
            border-radius: 3px;
            overflow: hidden;
            vertical-align: middle;
            margin-left: 8px;
        }
        .progress-fill {
            height: 100%;
            display: inline-block;
        }
        .report-footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            font-size: 11px;
            color: #6b7280;
            text-align: center;
        }
        @media print {
            body { padding: 0; }
            .report-container { box-shadow: none; padding: 0; }
            .report-section { page-break-inside: avoid; }
        }
        @page {
            margin: 2cm;
        }
    </style>
</head>
<body>
    <div class="report-container">
        <div class="report-header">
            <div class="report-title">FATHOM Report</div>
            <div class="report-meta">
                <p><strong>${name}</strong></p>
                <p>Generated: ${timestamp}</p>
                <p>Period: ${rangeLabel}</p>
            </div>
        </div>

        <div class="table-of-contents">
            <h3>Table of Contents</h3>
            <ul>
                ${tableOfContents}
            </ul>
        </div>

        ${sectionsHTML}

        <div class="report-footer">
            <p>This report was automatically generated by FATHOM Database Monitoring Tool.</p>
            <p>For questions or concerns, contact your DBA.</p>
        </div>
    </div>
</body>
</html>
    `;
}

function makeProgressBar(percentage) {
    const color = percentage > 80 ? '#dc2626' : percentage > 60 ? '#d97706' : '#16a34a';
    return `<span class="progress-bar"><span class="progress-fill" style="width: ${Math.min(percentage, 100)}%; background: ${color};"></span></span>`;
}

export default function reportRoutes(pool, authenticate, requireScreen) {
    const router = Router();
    const isAdmin = [authenticate, requireScreen('admin')];

    /* ── GET /api/reports/data
       Returns aggregated metrics for selected sections
       Query: sections=overview,performance&range=7d                           */
    router.get('/reports/data', ...isAdmin, async (req, res) => {
        try {
            const { sections = 'overview,performance', range = '7d' } = req.query;
            const sectionList = sections.split(',').filter(Boolean);

            if (sectionList.length === 0) {
                return res.status(400).json({ error: 'No sections specified' });
            }

            const metrics = generateMockMetrics(sectionList, range);
            res.json(metrics);
        } catch (err) {
            log('ERROR', 'Failed to fetch report data', { error: err.message });
            res.status(500).json({ error: err.message });
        }
    });

    /* ── GET /api/reports/templates
       Returns available report templates                                       */
    router.get('/reports/templates', ...isAdmin, async (req, res) => {
        try {
            const templates = {
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
            res.json(templates);
        } catch (err) {
            log('ERROR', 'Failed to fetch report templates', { error: err.message });
            res.status(500).json({ error: err.message });
        }
    });

    /* ── POST /api/reports/generate
       Generate and return report HTML for print/PDF export
       Body: { name, sections[], dateRange, schedule }                         */
    router.post('/reports/generate', ...isAdmin, async (req, res) => {
        try {
            const { name, sections = [], dateRange = '7d', schedule = 'once' } = req.body;

            if (!name || !Array.isArray(sections) || sections.length === 0) {
                return res.status(400).json({
                    error: 'Missing required fields: name, sections[]'
                });
            }

            const metrics = generateMockMetrics(sections, dateRange);
            const timestamp = new Date().toLocaleString();

            const reportConfig = {
                name,
                sections,
                dateRange,
                timestamp,
            };

            const htmlContent = generateHTMLReport(reportConfig, metrics);

            // Send as HTML document for rendering/printing
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="report-${Date.now()}.html"`);
            res.send(htmlContent);

            log('INFO', 'Report generated successfully', {
                reportName: name,
                sectionsCount: sections.length,
                schedule,
            });
        } catch (err) {
            log('ERROR', 'Failed to generate report', { error: err.message });
            res.status(500).json({ error: err.message });
        }
    });

    /* ── GET /api/reports/scheduled
       List scheduled reports (mock implementation)                            */
    router.get('/reports/scheduled', ...isAdmin, async (req, res) => {
        try {
            const scheduledReports = [
                {
                    id: 1,
                    name: 'Daily DBA Report',
                    schedule: 'daily',
                    time: '09:00',
                    recipients: ['dba@company.com'],
                    sections: ['overview', 'performance', 'resources'],
                    nextRun: new Date(Date.now() + 86400000).toISOString(),
                },
                {
                    id: 2,
                    name: 'Weekly Security Audit',
                    schedule: 'weekly',
                    day: 'Monday',
                    time: '08:00',
                    recipients: ['security@company.com'],
                    sections: ['security', 'alerts'],
                    nextRun: new Date(Date.now() + 604800000).toISOString(),
                },
                {
                    id: 3,
                    name: 'Monthly Capacity Report',
                    schedule: 'monthly',
                    day: '1st',
                    time: '10:00',
                    recipients: ['ops@company.com'],
                    sections: ['resources', 'capacity'],
                    nextRun: new Date(Date.now() + 2592000000).toISOString(),
                }
            ];
            res.json({ reports: scheduledReports });
        } catch (err) {
            log('ERROR', 'Failed to fetch scheduled reports', { error: err.message });
            res.status(500).json({ error: err.message });
        }
    });

    return router;
}
