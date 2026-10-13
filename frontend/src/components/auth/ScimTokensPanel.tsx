/**
 * components/auth/ScimTokensPanel.tsx
 * A8 — SCIM provisioning token management panel.
 *
 * Mounted at the bottom of SsoSettings. Owner role required for mint /
 * rotate / revoke; admin can read. Tokens are shown once at issue time;
 * a rotate call atomically revokes the old token and mints a new one
 * with the same TTL, so IdPs can rotate without an SCIM-sync outage
 * window. Tokens within 14 days of expiry are flagged in the table.
 */

import { useEffect, useState } from 'react';
import { getData, postData } from '../../utils/api';
import { THEME } from '../../utils/theme';

type ScimToken = {
    id: number;
    token_prefix: string;
    created_at: string;
    last_used_at: string | null;
    revoked_at: string | null;
    expires_at: string | null;
};

type Props = { workspaceId: number };

export default function ScimTokensPanel({ workspaceId }: Props) {
    const [tokens, setTokens] = useState<ScimToken[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState<number | null>(null);
    const [revealed, setRevealed] = useState<{ id: number; token: string } | null>(null);

    async function refresh() {
        setLoading(true);
        try {
            const data = await getData<{ tokens: ScimToken[] }>(
                '/api/governance/scim-tokens',
                { headers: { 'x-workspace-id': String(workspaceId) } }
            );
            setTokens(data?.tokens || []);
        } catch (e: any) {
            setError(e?.message || 'Failed to load SCIM tokens');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { void refresh(); }, [workspaceId]);

    async function mint() {
        setBusy(-1);
        setError(null);
        try {
            const res = await postData<{ id: number; token: string }>(
                '/api/governance/scim-tokens',
                { ttlDays: 365 },
                { headers: { 'x-workspace-id': String(workspaceId) } }
            );
            if (res?.token) setRevealed({ id: res.id, token: res.token });
            await refresh();
        } catch (e: any) {
            setError(e?.message || 'Mint failed');
        } finally {
            setBusy(null);
        }
    }

    async function rotate(id: number) {
        if (!confirm('Rotate this SCIM token? The old token stops working immediately.')) return;
        setBusy(id);
        setError(null);
        try {
            const res = await postData<{ id: number; token: string }>(
                `/api/governance/scim-tokens/${id}/rotate`,
                {},
                { headers: { 'x-workspace-id': String(workspaceId) } }
            );
            if (res?.token) setRevealed({ id: res.id, token: res.token });
            await refresh();
        } catch (e: any) {
            setError(e?.message || 'Rotate failed');
        } finally {
            setBusy(null);
        }
    }

    function daysUntil(iso: string | null): number | null {
        if (!iso) return null;
        return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
    }

    const cardField: React.CSSProperties = { marginBottom: 14 };
    const cardInput: React.CSSProperties = {
        width: '100%', padding: '8px 10px', borderRadius: 6,
        border: '1px solid #1a3878', fontFamily: 'monospace', fontSize: 12,
    };

    return (
        <div>
            <h2 style={{ margin: '0 0 4px' }}>SCIM provisioning tokens</h2>
            <p style={{ color: THEME.textMuted, marginTop: 0 }}>
                Used by your IdP (Okta, Entra ID, OneLogin) to provision and
                deprovision users. Tokens are shown once at issue time. The
                rotate button atomically revokes the old token and mints a
                new one with the same TTL — copy the new token, update the
                IdP, done.
            </p>

            {error && <div style={{ color: THEME.dangerDark, marginBottom: 12 }}>{error}</div>}

            {revealed && (
                <div style={{ background: THEME.warningLight, border: '1px solid #fcd34d', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>
                        New token #{revealed.id} — copy now, you will not see this again
                    </div>
                    <div style={cardField}>
                        <textarea readOnly style={{ ...cardInput, height: 60 }} value={revealed.token} />
                    </div>
                    <button onClick={() => setRevealed(null)} style={{ background: '#fff', border: '1px solid #1a3878', padding: '6px 12px', borderRadius: 6, cursor: 'pointer' }}>
                        I have stored it
                    </button>
                </div>
            )}

            <button onClick={mint} disabled={busy !== null} style={{ background: THEME.surfaceRaised, color: '#fff', border: 0, padding: '8px 14px', borderRadius: 6, fontSize: 13, cursor: busy !== null ? 'wait' : 'pointer', marginBottom: 14 }}>
                {busy === -1 ? 'Minting…' : 'Mint new token'}
            </button>

            {loading ? <div>Loading tokens…</div> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '1px solid #1a3878' }}>
                            <th style={{ padding: '8px 6px' }}>Prefix</th>
                            <th style={{ padding: '8px 6px' }}>Created</th>
                            <th style={{ padding: '8px 6px' }}>Last used</th>
                            <th style={{ padding: '8px 6px' }}>Expires</th>
                            <th style={{ padding: '8px 6px' }}>Status</th>
                            <th style={{ padding: '8px 6px' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {tokens.map(t => {
                            const days = daysUntil(t.expires_at);
                            const expiringSoon = !t.revoked_at && days !== null && days <= 14 && days >= 0;
                            const expired = days !== null && days < 0;
                            return (
                                <tr key={t.id} style={{ borderBottom: '1px solid #0d1e42' }}>
                                    <td style={{ padding: '8px 6px', fontFamily: 'monospace' }}>{t.token_prefix}…</td>
                                    <td style={{ padding: '8px 6px' }}>{new Date(t.created_at).toLocaleDateString()}</td>
                                    <td style={{ padding: '8px 6px' }}>{t.last_used_at ? new Date(t.last_used_at).toLocaleDateString() : '—'}</td>
                                    <td style={{ padding: '8px 6px', color: expiringSoon ? THEME.warningDark : expired ? THEME.dangerDark : 'inherit' }}>
                                        {t.expires_at ? new Date(t.expires_at).toLocaleDateString() : '—'}
                                        {expiringSoon && ` (${days}d)`}
                                    </td>
                                    <td style={{ padding: '8px 6px' }}>
                                        {t.revoked_at ? <span style={{ color: THEME.textDim }}>revoked</span>
                                            : expired ? <span style={{ color: THEME.dangerDark }}>expired</span>
                                            : expiringSoon ? <span style={{ color: THEME.warningDark }}>expires soon</span>
                                            : <span style={{ color: THEME.successDark }}>active</span>}
                                    </td>
                                    <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                                        {!t.revoked_at && (
                                            <button onClick={() => rotate(t.id)} disabled={busy !== null} style={{ background: '#fff', border: '1px solid #1a3878', padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: busy !== null ? 'wait' : 'pointer' }}>
                                                {busy === t.id ? 'Rotating…' : 'Rotate'}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        {tokens.length === 0 && (
                            <tr><td colSpan={6} style={{ padding: 16, color: THEME.textMuted }}>No SCIM tokens yet.</td></tr>
                        )}
                    </tbody>
                </table>
            )}
        </div>
    );
}
