import React, { useState, useEffect } from 'react';
import { THEME, useAdaptiveTheme } from '../../../utils/theme';
import { fetchData } from '../../../utils/api';
import { FileCode, Download, Copy, Package, Settings, Code, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';

/* ── Styles ───────────────────────────────────────────────────────────────── */
const Styles = () => (
    <style>{`
        @keyframes tfFade { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .tf-card { background:${THEME.surface}; border:1px solid ${THEME.glassBorder}; border-radius: 20px; padding:20px; overflow:hidden; box-shadow:0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04); animation:tfFade .3s ease; transition:all 0.2s ease; backdrop-filter:blur(12px); }
        .tf-card:hover { border-color:${THEME.primary}30; transform:translateY(-4px); box-shadow:0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06); }
        .tf-card-section { padding:14px 20px; border-bottom:1px solid ${THEME.glassBorder}; background:${THEME.bg}06; }
        .tf-card-section:last-child { border-bottom:none; }
        .tf-export-card { background:${THEME.surfaceHover}; border:1px solid ${THEME.glassBorder}; border-radius: 22px; padding:20px; margin-bottom:16px; display:grid; grid-template-columns:1fr auto; gap: 22px; align-items:start; }
        .tf-button { background:${THEME.primary}; color:${THEME.textInverse}; border:none; border-radius: 22px; padding:12px 18px; font-weight:700; font-size:13px; cursor:pointer; }
        .tf-button:hover { background:${THEME.primaryLight}; }
        .tf-button-secondary { background:${THEME.secondary}; }
        .tf-button-secondary:hover { background:${THEME.secondaryLight}; }
        .tf-code-block { background:${THEME.bg}; border:1px solid ${THEME.glassBorder}; border-radius: 22px; padding:20px; margin:16px 0; max-height:300px; overflow-y:auto; position:relative; }
        .tf-code { font-family:monospace; font-size:12px; color:${THEME.textMain}; line-height:1.5; white-space:pre-wrap; word-break:break-word; }
        .tf-code-copy { position:absolute; top:8px; right:8px; cursor:pointer; padding:8px; background:${THEME.primary}20; border-radius: 20px; border:1px solid ${THEME.primary}40; color:${THEME.primary}; }
        .tf-code-copy:hover { background:${THEME.primary}40; }
        .tf-label { font-size:12px; font-weight:700; color:${THEME.textMuted}; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px; }
        .tf-select { background:${THEME.surfaceHover}; border:1px solid ${THEME.glassBorder}; border-radius: 22px; padding:12px 14px; color:${THEME.textMain}; font-size:13px; width:100%; cursor:pointer; }
    `}</style>
);

/* ── Code Preview Component ──────────────────────────────────────────────────── */
const CodePreview = ({ code, format = 'hcl' }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="tf-code-block">
            <div className="tf-code-copy" onClick={handleCopy} title="Copy to clipboard">
                {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
            </div>
            <div className="tf-code">{code}</div>
        </div>
    );
};

/* ── Export Card Component ──────────────────────────────────────────────────── */
const ExportCard = ({ title, description, icon: Icon, format, onPreview, onDownload }) => {
    return (
        <div className="tf-export-card">
            <div>
                <div style={{ display:'flex', alignItems:'center', gap: 22, marginBottom:8 }}>
                    <Icon size={18} color={THEME.primary} />
                    <div style={{ fontSize:14, fontWeight:700, color:THEME.textMain }}>{title}</div>
                </div>
                <div style={{ fontSize:12, color:THEME.textDim, marginBottom:12 }}>{description}</div>
                <div style={{ display:'flex', gap: 22 }}>
                    <button className="tf-button" onClick={onPreview} style={{ fontSize:12, padding:'8px 12px' }}>
                        <FileCode size={12} style={{ marginRight:4 }} />
                        Preview
                    </button>
                    <button className="tf-button tf-button-secondary" onClick={onDownload} style={{ fontSize:12, padding:'8px 12px' }}>
                        <Download size={12} style={{ marginRight:4 }} />
                        Download
                    </button>
                </div>
            </div>
            <div style={{ fontSize:11, color:THEME.textMuted, fontWeight:700,  }}>
                {format}
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   TERRAFORM EXPORT TAB
   ═══════════════════════════════════════════════════════════════════════════ */
export default function TerraformExportTab() {
    useAdaptiveTheme();
    const [exports, setExports] = useState({
        alertRules: null,
        connections: null,
        retention: null,
        users: null,
    });
    const [previewType, setPreviewType] = useState(null);
    const [previewCode, setPreviewCode] = useState('');
    const [exportFormat, setExportFormat] = useState('hcl');
    const [loading, setLoading] = useState(false);
    const [bundleLoading, setBundleLoading] = useState(false);
    const [error, setError] = useState(null);

    const handlePreview = async (type) => {
        setLoading(true);
        try {
            const data = await fetchData(`/api/export/${type}?format=${exportFormat}`);
            setPreviewCode(data?.code || '');
            setPreviewType(type);
            setError(null);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async (type) => {
        try {
            const data = await fetchData(`/api/export/${type}?format=${exportFormat}`);
            const code = data?.code || '';
            const filename = `${type}.${exportFormat === 'hcl' ? 'tf' : 'json'}`;
            const element = document.createElement('a');
            element.setAttribute('href', `data:text/plain;charset=utf-8,${encodeURIComponent(code)}`);
            element.setAttribute('download', filename);
            element.style.display = 'none';
            document.body.appendChild(element);
            element.click();
            document.body.removeChild(element);
            setError(null);
        } catch (e) {
            setError(e.message);
        }
    };

    const handleDownloadBundle = async () => {
        setBundleLoading(true);
        try {
            const data = await fetchData(`/api/export/bundle?format=${exportFormat}`);
            const code = data?.code || '';
            const filename = `fathom-infrastructure.${exportFormat === 'hcl' ? 'tf' : 'json'}`;
            const element = document.createElement('a');
            element.setAttribute('href', `data:text/plain;charset=utf-8,${encodeURIComponent(code)}`);
            element.setAttribute('download', filename);
            element.style.display = 'none';
            document.body.appendChild(element);
            element.click();
            document.body.removeChild(element);
            setError(null);
        } catch (e) {
            setError(e.message);
        } finally {
            setBundleLoading(false);
        }
    };

    return (
        <div style={{ padding:'0 0 20px 0' }}>
            <Styles />

            {error && (
                <div style={{
                    background:`${THEME.danger}15`,
                    border:`1px solid ${THEME.danger}40`,
                    borderRadius: 16,
                    padding:'12px 16px',
                    marginBottom:20,
                    color:THEME.danger,
                    fontSize:13
                }}>
                    <AlertTriangle size={16} style={{ display:'inline-block', marginRight:8, verticalAlign:'middle' }} />
                    {error}
                </div>
            )}

            {/* Format Selector */}
            <div className="tf-card" style={{ marginBottom:20 }}>
                <div style={{ fontSize:16, fontWeight:700, color:THEME.textMain, marginBottom:16 }}>
                    <Code size={18} style={{ display:'inline-block', marginRight:10, verticalAlign:'middle' }} />
                    Export Format
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap: 18 }}>
                    <div>
                        <div className="tf-label">Format</div>
                        <select className="tf-select" value={exportFormat} onChange={(e) => setExportFormat(e.target.value)}>
                            <option value="hcl">HCL (Terraform)</option>
                            <option value="json">JSON (Pulumi/CDK)</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Export Cards */}
            <div className="tf-card" style={{ marginBottom:20 }}>
                <div style={{ fontSize:16, fontWeight:700, color:THEME.textMain, marginBottom:20 }}>
                    <FileCode size={18} style={{ display:'inline-block', marginRight:10, verticalAlign:'middle' }} />
                    Individual Exports
                </div>

                <ExportCard
                    title="Alert Rules"
                    description="Export all configured alert rules for monitoring policies"
                    icon={AlertTriangle}
                    format={exportFormat === 'hcl' ? 'Terraform' : 'JSON'}
                    onPreview={() => handlePreview('alert-rules')}
                    onDownload={() => handleDownload('alert-rules')}
                />

                <ExportCard
                    title="Database Connections"
                    description="Export connection configurations and credentials (secured)"
                    icon={Settings}
                    format={exportFormat === 'hcl' ? 'Terraform' : 'JSON'}
                    onPreview={() => handlePreview('connections')}
                    onDownload={() => handleDownload('connections')}
                />

                <ExportCard
                    title="Retention Policies"
                    description="Export data retention settings for backup and archival"
                    icon={Package}
                    format={exportFormat === 'hcl' ? 'Terraform' : 'JSON'}
                    onPreview={() => handlePreview('retention')}
                    onDownload={() => handleDownload('retention')}
                />

                <ExportCard
                    title="User Management"
                    description="Export RBAC configuration and user roles"
                    icon={Settings}
                    format={exportFormat === 'hcl' ? 'Terraform' : 'JSON'}
                    onPreview={() => handlePreview('users')}
                    onDownload={() => handleDownload('users')}
                />
            </div>

            {/* Full Bundle Export */}
            <div className="tf-card" style={{ marginBottom:20 }}>
                <div style={{ fontSize:16, fontWeight:700, color:THEME.textMain, marginBottom:16 }}>
                    <Package size={18} style={{ display:'inline-block', marginRight:10, verticalAlign:'middle' }} />
                    Complete Bundle Export
                </div>
                <p style={{ color:THEME.textDim, fontSize:13, marginBottom:16 }}>
                    Download all configurations as a single infrastructure-as-code file. Includes all alert rules, connections, retention policies, and user settings.
                </p>
                <button className="tf-button" onClick={handleDownloadBundle} disabled={bundleLoading}>
                    {bundleLoading ? <RefreshCw size={14} style={{ marginRight:6 }} /> : <Download size={14} style={{ marginRight:6 }} />}
                    {bundleLoading ? 'Generating...' : 'Download Complete Bundle'}
                </button>
            </div>

            {/* Code Preview */}
            {previewCode && (
                <div className="tf-card">
                    <div style={{ fontSize:16, fontWeight:700, color:THEME.textMain, marginBottom:12 }}>
                        <Code size={18} style={{ display:'inline-block', marginRight:10, verticalAlign:'middle' }} />
                        Code Preview: {previewType}
                    </div>
                    {loading ? (
                        <div style={{ textAlign:'center', padding:'40px 20px' }}>
                            <RefreshCw size={32} color={THEME.primary} style={{ margin:'0 auto 16px', animation:'spin 1s linear infinite' }} />
                            <div style={{ color:THEME.textMuted }}>Generating preview...</div>
                        </div>
                    ) : (
                        <CodePreview code={previewCode} format={exportFormat} />
                    )}
                </div>
            )}

            {/* Info Box */}
            <div style={{ marginTop:20, padding:'16px', background:`${THEME.info}15`, border:`1px solid ${THEME.info}40`, borderRadius: 16 }}>
                <div style={{ fontSize:12, color:THEME.info, fontWeight:700, marginBottom:8 }}>
                    Tips for IaC Integration:
                </div>
                <ul style={{ fontSize:12, color:THEME.textDim, lineHeight:1.6, margin:0, paddingLeft:20 }}>
                    <li>Use HCL format for Terraform, JSON for Pulumi or AWS CDK</li>
                    <li>Credentials are stored in secret management systems - never committed to version control</li>
                    <li>Update exports periodically to keep infrastructure definitions in sync</li>
                    <li>Test changes in a staging environment before applying to production</li>
                </ul>
            </div>
        </div>
    );
}