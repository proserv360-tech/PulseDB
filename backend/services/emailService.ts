// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
// ==========================================================================
//  FATHOM — Email Notification Service
//  Supports multiple providers: Gmail, SendGrid, AWS SES, Generic SMTP
// ==========================================================================

import nodemailer from 'nodemailer';

function log(level, message, meta = {}) {
    const entry = { ts: new Date().toISOString(), level, msg: message, ...meta };
    const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
    fn(JSON.stringify(entry));
}

class EmailNotificationService {
    constructor(config) {
        this.config      = config;
        this.transporter = null;
        this.enabled     = config.enabled || false;
        this.initialize();
    }

    initialize() {
        if (!this.enabled) {
            log('INFO', 'Email notifications disabled');
            return;
        }

        const provider = this.config.provider || 'smtp';

        try {
            switch (provider) {
                case 'gmail':    this.transporter = this.createGmailTransporter();    break;
                case 'sendgrid': this.transporter = this.createSendGridTransporter(); break;
                case 'ses':      this.transporter = this.createSESTransporter();      break;
                default:         this.transporter = this.createSMTPTransporter();     break;
            }

            log('INFO', `Email notification service initialized (${provider})`);
            this.verifyConnection();
        } catch (error) {
            log('ERROR', 'Failed to initialize email service', { error: error.message });
            this.enabled = false;
        }
    }

    createGmailTransporter() {
        return nodemailer.createTransport({
            service: 'gmail',
            auth: { user: this.config.gmail.user, pass: this.config.gmail.appPassword },
        });
    }

    createSendGridTransporter() {
        return nodemailer.createTransport({
            host: 'smtp.sendgrid.net', port: 587, secure: false,
            auth: { user: 'apikey', pass: this.config.sendgrid.apiKey },
        });
    }

    createSESTransporter() {
        return nodemailer.createTransport({
            host: `email-smtp.${this.config.ses.region}.amazonaws.com`,
            port: 587, secure: false,
            auth: {
                user: this.config.ses.accessKeyId,
                pass: this.config.ses.secretAccessKey,
            },
        });
    }

    createSMTPTransporter() {
        return nodemailer.createTransport({
            host:   this.config.smtp.host,
            port:   this.config.smtp.port || 587,
            secure: this.config.smtp.secure || false,
            auth:   { user: this.config.smtp.user, pass: this.config.smtp.password },
            tls:    { rejectUnauthorized: this.config.smtp.rejectUnauthorized !== false },
        });
    }

    async verifyConnection() {
        if (!this.transporter) return false;
        try {
            await this.transporter.verify();
            log('INFO', 'Email server connection verified');
            return true;
        } catch (error) {
            log('WARN', 'Email server connection failed', { error: error.message });
            return false;
        }
    }

    getSeverityColor(severity) {
        return { critical: '#dc2626', warning: '#f59e0b', info: '#3b82f6' }[severity] || '#6b7280';
    }

    getSeverityEmoji(severity) {
        return { critical: '🔴', warning: '⚠️', info: 'ℹ️' }[severity] || '📢';
    }

    generateHTMLEmail(alert) {
        const color = this.getSeverityColor(alert.severity);
        const emoji = this.getSeverityEmoji(alert.severity);

        const metricsHtml = alert.data?.metrics
            ? `<div style="background-color:#f9fafb;padding:15px;border-radius:8px;margin:20px 0;">
                <h3 style="margin:0 0 10px 0;color:#374151;font-size:16px;">Key Metrics</h3>
                <table style="width:100%;border-collapse:collapse;">
                    ${Object.entries(alert.data.metrics)
                        .filter(([k]) => !k.includes('Queries') && !k.includes('Tables'))
                        .slice(0, 6)
                        .map(([k, v]) => `
                            <tr>
                                <td style="padding:8px 0;color:#6b7280;font-size:14px;">${this.formatMetricName(k)}</td>
                                <td style="padding:8px 0;color:#1f2937;font-weight:600;text-align:right;font-size:14px;">${this.formatMetricValue(k, v)}</td>
                            </tr>`).join('')}
                </table>
               </div>`
            : '';

        const criticalBanner = alert.severity === 'critical'
            ? `<div style="margin-top:20px;padding:15px;background-color:#fef2f2;border-left:4px solid #dc2626;border-radius:6px;">
                <p style="margin:0;color:#991b1b;font-size:14px;font-weight:600;">⚠️ Critical Alert — Immediate Action Required</p>
                <p style="margin:5px 0 0 0;color:#7f1d1d;font-size:13px;">This alert requires your immediate attention to prevent potential service disruption.</p>
               </div>`
            : '';

        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FATHOM Alert</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f3f4f6;">
    <div style="max-width:600px;margin:0 auto;padding:20px;">
        <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:30px;border-radius:10px 10px 0 0;text-align:center;">
            <h1 style="margin:0;font-size:28px;font-weight:bold;">FATHOM Alert System</h1>
            <p style="margin:10px 0 0 0;opacity:0.9;">Database Monitoring Alert</p>
        </div>
        <div style="background-color:white;padding:30px;border-radius:0 0 10px 10px;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
            <div style="text-align:center;margin-bottom:20px;">
                <span style="display:inline-block;background-color:${color};color:white;padding:8px 20px;border-radius:20px;font-size:14px;font-weight:bold;text-transform:uppercase;">
                    ${emoji} ${alert.severity}
                </span>
            </div>
            <div style="border-left:4px solid ${color};padding-left:20px;margin:20px 0;">
                <h2 style="margin:0 0 10px 0;color:#1f2937;font-size:20px;">${alert.message}</h2>
                <p style="margin:5px 0;color:#6b7280;font-size:14px;"><strong>Category:</strong> ${alert.category}</p>
                <p style="margin:5px 0;color:#6b7280;font-size:14px;"><strong>Time:</strong> ${new Date(alert.timestamp).toLocaleString()}</p>
                ${alert.data?.rule ? `<p style="margin:5px 0;color:#6b7280;font-size:14px;"><strong>Rule:</strong> ${alert.data.rule}</p>` : ''}
            </div>
            ${metricsHtml}
            <div style="margin-top:30px;padding-top:20px;border-top:1px solid #e5e7eb;text-align:center;">
                <p style="margin:0 0 15px 0;color:#6b7280;font-size:14px;">Take action on this alert:</p>
                <a href="${this.config.dashboardUrl || 'http://localhost:5173'}/alerts"
                   style="display:inline-block;background-color:#3b82f6;color:white;padding:12px 30px;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">
                    View in Dashboard
                </a>
            </div>
            <div style="margin-top:30px;padding-top:20px;border-top:1px solid #e5e7eb;text-align:center;">
                <p style="margin:0;color:#9ca3af;font-size:12px;">Automated alert from FATHOM Database Monitoring System</p>
                <p style="margin:5px 0 0 0;color:#9ca3af;font-size:12px;">Database: ${this.config.databaseName || 'PostgreSQL'}</p>
            </div>
        </div>
        ${criticalBanner}
    </div>
</body>
</html>`;
    }

    generatePlainTextEmail(alert) {
        let text = `
═══════════════════════════════════════════════════════
  FATHOM Database Monitoring Alert
═══════════════════════════════════════════════════════

${this.getSeverityEmoji(alert.severity)} SEVERITY: ${alert.severity.toUpperCase()}

MESSAGE:  ${alert.message}
CATEGORY: ${alert.category}
TIME:     ${new Date(alert.timestamp).toLocaleString()}
${alert.data?.rule ? `RULE:     ${alert.data.rule}\n` : ''}`;

        if (alert.data?.metrics) {
            text += '\nKEY METRICS:\n───────────────────────────────────────────────────────\n';
            Object.entries(alert.data.metrics)
                .filter(([k]) => !k.includes('Queries') && !k.includes('Tables'))
                .slice(0, 6)
                .forEach(([k, v]) => {
                    text += `${this.formatMetricName(k).padEnd(25)} ${this.formatMetricValue(k, v)}\n`;
                });
        }

        text += `
───────────────────────────────────────────────────────
View details: ${this.config.dashboardUrl || 'http://localhost:5173'}/alerts
Database: ${this.config.databaseName || 'PostgreSQL'}
═══════════════════════════════════════════════════════`;

        return text.trim();
    }

    formatMetricName(key) {
        return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
    }

    formatMetricValue(key, value) {
        if (key.includes('Connections') || key.includes('Count'))  return String(value);
        if (key.includes('Ratio') || key.includes('Pct'))          return `${parseFloat(value).toFixed(1)}%`;
        if (key.includes('GB')    || key.includes('Size'))         return `${parseFloat(value).toFixed(2)} GB`;
        if (key.includes('Seconds') || key.includes('Uptime'))     return `${Math.floor(value / 3600)}h`;
        return String(value);
    }

    async sendAlert(alert, recipients) {
        if (!this.enabled || !this.transporter) {
            return { success: false, reason: 'disabled' };
        }

        const severityLevels = { info: 1, warning: 2, critical: 3 };
        const minLevel   = severityLevels[this.config.minSeverity || 'warning'];
        const alertLevel = severityLevels[alert.severity];

        if (alertLevel < minLevel) {
            return { success: false, reason: 'below_threshold' };
        }

        const to = recipients || this.config.recipients || [];
        if (!to.length) {
            log('WARN', 'No email recipients configured');
            return { success: false, reason: 'no_recipients' };
        }

        try {
            const info = await this.transporter.sendMail({
                from: this.config.from,
                to:   to.join(', '),
                subject: `${this.getSeverityEmoji(alert.severity)} [${alert.severity.toUpperCase()}] FATHOM Alert — ${alert.message.substring(0, 60)}${alert.message.length > 60 ? '…' : ''}`,
                text: this.generatePlainTextEmail(alert),
                html: this.generateHTMLEmail(alert),
                priority: alert.severity === 'critical' ? 'high' : 'normal',
            });

            log('INFO', 'Alert email sent', { messageId: info.messageId });
            return { success: true, messageId: info.messageId, recipients: to };
        } catch (error) {
            log('ERROR', 'Failed to send alert email', { error: error.message });
            return { success: false, error: error.message };
        }
    }

    async sendTestEmail(recipient) {
        return this.sendAlert({
            id:        'test-alert',
            timestamp: new Date().toISOString(),
            severity:  'info',
            category:  'maintenance',
            message:   'This is a test email from FATHOM Alert System',
            data: {
                rule:    'test_email',
                metrics: { activeConnections: 15, maxConnections: 100, cacheHitRatio: 95.5, diskUsedGB: 42.3 },
            },
        }, [recipient]);
    }

    async sendDigest(alertList, recipients) {
        if (!this.enabled || !this.transporter) {
            return { success: false, reason: 'disabled' };
        }

        const to = recipients || this.config.recipients || [];
        if (!to.length) return { success: false, reason: 'no_recipients' };

        const critical = alertList.filter(a => a.severity === 'critical').length;
        const warning  = alertList.filter(a => a.severity === 'warning').length;
        const info     = alertList.filter(a => a.severity === 'info').length;

        const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>FATHOM Alert Digest</title></head>
<body style="margin:0;padding:20px;font-family:Arial,sans-serif;background-color:#f3f4f6;">
    <div style="max-width:600px;margin:0 auto;background-color:white;border-radius:10px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
        <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:30px;text-align:center;">
            <h1 style="margin:0;font-size:24px;">FATHOM Alert Digest</h1>
            <p style="margin:10px 0 0 0;">Summary of Recent Alerts</p>
        </div>
        <div style="padding:30px;">
            <div style="display:flex;justify-content:space-around;margin-bottom:30px;">
                <div style="text-align:center;"><div style="font-size:32px;font-weight:bold;color:#dc2626;">${critical}</div><div style="color:#6b7280;font-size:14px;">Critical</div></div>
                <div style="text-align:center;"><div style="font-size:32px;font-weight:bold;color:#f59e0b;">${warning}</div><div style="color:#6b7280;font-size:14px;">Warning</div></div>
                <div style="text-align:center;"><div style="font-size:32px;font-weight:bold;color:#3b82f6;">${info}</div><div style="color:#6b7280;font-size:14px;">Info</div></div>
            </div>
            <h2 style="color:#1f2937;font-size:18px;margin-bottom:15px;">Recent Alerts</h2>
            ${alertList.slice(0, 10).map(a => `
                <div style="border-left:4px solid ${this.getSeverityColor(a.severity)};padding:10px 15px;margin-bottom:10px;background-color:#f9fafb;border-radius:0 6px 6px 0;">
                    <div style="font-weight:600;color:#1f2937;margin-bottom:5px;">${a.message}</div>
                    <div style="font-size:12px;color:#6b7280;">${new Date(a.timestamp).toLocaleString()}</div>
                </div>`).join('')}
            <div style="text-align:center;margin-top:30px;">
                <a href="${this.config.dashboardUrl || 'http://localhost:5173'}/alerts"
                   style="display:inline-block;background-color:#3b82f6;color:white;padding:12px 30px;text-decoration:none;border-radius:6px;font-weight:600;">
                    View All Alerts
                </a>
            </div>
        </div>
    </div>
</body>
</html>`;

        try {
            const result = await this.transporter.sendMail({
                from:    this.config.from,
                to:      to.join(', '),
                subject: `📊 FATHOM Alert Digest — ${critical} Critical, ${warning} Warning, ${info} Info`,
                html,
            });

            log('INFO', 'Digest email sent', { messageId: result.messageId });
            return { success: true, messageId: result.messageId };
        } catch (error) {
            log('ERROR', 'Failed to send digest email', { error: error.message });
            return { success: false, error: error.message };
        }
    }
}

export default EmailNotificationService;
