/**
 * pages/SsoSettings.tsx
 * Workspace admin view for configuring SAML 2.0 SSO and managing SCIM
 * provisioning tokens (A8 — SCIM token rotation panel mounted at the
 * bottom of the page).
 */

import { useEffect, useMemo, useState } from 'react';
import { getData, postData } from '../utils/api';
import ScimTokensPanel from '../components/auth/ScimTokensPanel';
import { THEME } from '../utils/theme';

type SamlConfig = {
    entity_id: string;
    sso_url: string;
    slo_url?: string | null;
    idp_cert: string;
    sp_cert?: string | null;
    want_signed_response: boolean;
    want_signed_assertion: boolean;
    name_id_format?: string;
    default_role: 'owner' | 'admin' | 'editor' | 'viewer';
    attribute_mapping?: Record<string, string>;
    enabled: boolean;
};

type Props = { workspaceId: number };

export default function SsoSettings({ workspaceId }: Props) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [ok, setOk] = useState(false);
    const [cfg, setCfg] = useState<SamlConfig>({
        entity_id: '',
        sso_url: '',
        slo_url: '',
        idp_cert: '',
        sp_cert: '',
        want_signed_response: true,
        want_signed_assertion: true,
        name_id_format: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
        default_role: 'viewer',
        attribute_mapping: { email: 'email', name: 'displayName', groups: 'groups' },
        enabled: false,
    });
    const [spPrivateKey, setSpPrivateKey] = useState('');

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const acsUrl = useMemo(() => `${origin}/api/saml/${workspaceId}/acs`, [origin, workspaceId]);
    const metadataUrl = useMemo(() => `${origin}/api/saml/${workspaceId}/metadata`, [origin, workspaceId]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const data = await getData<{ config: SamlConfig | null }>(`/api/saml/${workspaceId}/config`);
                if (!cancelled && data?.config) setCfg(c => ({ ...c, ...data.config! }));
            } catch (e: any) {
                if (!cancelled) setError(e?.message || 'Failed to load config');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [workspaceId]);

    async function save() {
        setSaving(true); setError(null); setOk(false);
        try {
            await postData(`/api/saml/${workspaceId}/config`, {
                entityId: cfg.entity_id,
                ssoUrl: cfg.sso_url,
                sloUrl: cfg.slo_url || null,
                idpCert: cfg.idp_cert,
                spCert: cfg.sp_cert || null,
                spPrivateKey: spPrivateKey || null,
                wantSignedResponse: cfg.want_signed_response,
                wantSignedAssertion: cfg.want_signed_assertion,
                nameIdFormat: cfg.name_id_format,
                defaultRole: cfg.default_role,
                attributeMapping: cfg.attribute_mapping || {},
                enabled: cfg.enabled,
            }, { method: 'PUT' });
            setOk(true);
            setSpPrivateKey('');
        } catch (e: any) {
            setError(e?.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    }

    if (loading) return <div style={{ padding: 24 }}>Loading SSO configuration…</div>;

    const field: React.CSSProperties = { marginBottom: 14 };
    const label: React.CSSProperties = { display: 'block', fontWeight: 600, marginBottom: 4 };
    const input: React.CSSProperties = {
        width: '100%', padding: '8px 10px', borderRadius: 6,
        border: '1px solid #1a3878', fontFamily: 'inherit', fontSize: 14,
    };

    return (
        <div style={{ maxWidth: 760, padding: 24 }}>
            <h2 style={{ margin: '0 0 4px' }}>Single Sign-On (SAML 2.0)</h2>
            <p style={{ color: THEME.textMuted, marginTop: 0 }}>
                Configure an external Identity Provider (Okta, Entra ID, Google Workspace, etc.) for this workspace.
            </p>

            <div style={{ background: THEME.surface, border: '1px solid #1a3878', borderRadius: 8, padding: 16, marginBottom: 24 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Give these URLs to your IdP</div>
                <div style={field}>
                    <span style={label}>ACS / Single sign-on URL</span>
                    <code style={{ background: '#fff', padding: '6px 8px', borderRadius: 4, border: '1px solid #1a3878', display: 'block', wordBreak: 'break-all' }}>{acsUrl}</code>
                </div>
                <div style={{ ...field, marginBottom: 0 }}>
                    <span style={label}>SP metadata URL</span>
                    <code style={{ background: '#fff', padding: '6px 8px', borderRadius: 4, border: '1px solid #1a3878', display: 'block', wordBreak: 'break-all' }}>{metadataUrl}</code>
                </div>
            </div>

            <div style={field}>
                <label style={label}>Entity ID (IdP issuer)</label>
                <input style={input} value={cfg.entity_id} onChange={e => setCfg({ ...cfg, entity_id: e.target.value })} placeholder="https://idp.example.com/saml/metadata" />
            </div>
            <div style={field}>
                <label style={label}>SSO URL (HTTP-Redirect binding)</label>
                <input style={input} value={cfg.sso_url} onChange={e => setCfg({ ...cfg, sso_url: e.target.value })} placeholder="https://idp.example.com/app/saml/sso" />
            </div>
            <div style={field}>
                <label style={label}>Single logout URL (optional)</label>
                <input style={input} value={cfg.slo_url || ''} onChange={e => setCfg({ ...cfg, slo_url: e.target.value })} />
            </div>
            <div style={field}>
                <label style={label}>IdP signing certificate (PEM)</label>
                <textarea style={{ ...input, height: 120, fontFamily: 'monospace', fontSize: 12 }} value={cfg.idp_cert} onChange={e => setCfg({ ...cfg, idp_cert: e.target.value })} placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----" />
            </div>
            <div style={field}>
                <label style={label}>SP private key (optional — for signed AuthnRequest)</label>
                <textarea style={{ ...input, height: 100, fontFamily: 'monospace', fontSize: 12 }} value={spPrivateKey} onChange={e => setSpPrivateKey(e.target.value)} placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----" />
                <div style={{ color: THEME.textMuted, fontSize: 12, marginTop: 4 }}>
                    Leave blank to keep the existing encrypted key. Stored with AES-256-GCM.
                </div>
            </div>
            <div style={field}>
                <label style={label}>Default role for new users</label>
                <select style={input} value={cfg.default_role} onChange={e => setCfg({ ...cfg, default_role: e.target.value as SamlConfig['default_role'] })}>
                    <option value="viewer">viewer</option>
                    <option value="editor">editor</option>
                    <option value="admin">admin</option>
                    <option value="owner">owner</option>
                </select>
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20 }}>
                <input type="checkbox" checked={cfg.enabled} onChange={e => setCfg({ ...cfg, enabled: e.target.checked })} />
                Enable SAML SSO for this workspace
            </label>

            {error && <div style={{ color: THEME.dangerDark, marginBottom: 12 }}>{error}</div>}
            {ok && <div style={{ color: THEME.successDark, marginBottom: 12 }}>Saved.</div>}

            <button onClick={save} disabled={saving} style={{ background: THEME.surfaceRaised, color: '#fff', border: 0, padding: '10px 18px', borderRadius: 6, fontSize: 14, cursor: saving ? 'wait' : 'pointer' }}>
                {saving ? 'Saving…' : 'Save configuration'}
            </button>

            <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #1a3878' }} />
            <ScimTokensPanel workspaceId={workspaceId} />
        </div>
    );
}
