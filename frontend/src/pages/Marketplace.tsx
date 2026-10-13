import React, { useState, useEffect, useCallback } from 'react';
import { THEME, useAdaptiveTheme } from '../utils/theme';
import { fetchData, postData } from '../utils/api';
import { Search, Download, CheckCircle, Shield, Star, Package, ChevronRight, Loader2, AlertTriangle, X, ExternalLink } from 'lucide-react';

const Styles = () => (
    <style>{`
        @keyframes mpFade { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes mpSpin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
        .mp-card { background: ${THEME.surface}; border: 1px solid ${THEME.glassBorder}; border-radius: 16px; padding: 20px; transition: all 0.2s ease; animation: mpFade 0.3s ease; cursor: pointer; }
        .mp-card:hover { border-color: ${THEME.primary}60; box-shadow: 0 4px 20px rgba(0,0,0,0.12); transform: translateY(-2px); }
        .mp-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; }
        .mp-input { background: ${THEME.surface}; border: 1px solid ${THEME.glassBorder}; border-radius: 10px; color: ${THEME.textMain}; font-size: 13px; outline: none; padding: 10px 14px 10px 38px; width: 100%; transition: border-color 0.2s ease; }
        .mp-input:focus { border-color: ${THEME.primary}; }
        .mp-spin { animation: mpSpin 1s linear infinite; }
        .mp-tab { padding: 7px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid transparent; transition: all 0.2s ease; }
        .mp-tab.active { background: ${THEME.primary}20; color: ${THEME.primary}; border-color: ${THEME.primary}40; }
        .mp-tab:not(.active) { color: ${THEME.textMuted}; }
        .mp-tab:not(.active):hover { color: ${THEME.textMain}; background: ${THEME.surfaceLight}; }
    `}</style>
);

/* ── Plugin Detail Modal ──────────────────────────────────────────────────── */
const PluginModal = ({ plugin, onClose, onInstall, installing }) => {
    if (!plugin) return null;
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }} onClick={onClose}>
            <div style={{ background: THEME.surface, border: `1px solid ${THEME.glassBorder}`, borderRadius: '20px', padding: '28px', width: '520px', maxWidth: '90vw', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: `${THEME.primary}20`, border: `1px solid ${THEME.primary}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Package size={22} color={THEME.primary} />
                        </div>
                        <div>
                            <div style={{ fontSize: '16px', fontWeight: 800, color: THEME.textMain }}>{plugin.name}</div>
                            <div style={{ fontSize: '12px', color: THEME.textMuted, marginTop: '2px' }}>by {plugin.author} · v{plugin.version}</div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: THEME.textMuted, padding: '4px' }}><X size={18} /></button>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                    {plugin.verified && <span className="mp-badge" style={{ background: `${THEME.success}15`, color: THEME.success, border: `1px solid ${THEME.success}30` }}><Shield size={11} /> Verified</span>}
                    <span className="mp-badge" style={{ background: `${THEME.primary}15`, color: THEME.primary, border: `1px solid ${THEME.primary}30` }}>{plugin.category || 'Plugin'}</span>
                    <span className="mp-badge" style={{ background: `${THEME.textMuted}15`, color: THEME.textMuted, border: `1px solid ${THEME.textMuted}20` }}><Download size={11} /> {(plugin.downloads || 0).toLocaleString()} installs</span>
                </div>

                <p style={{ fontSize: '13px', color: THEME.textMuted, lineHeight: '1.6', marginBottom: '20px' }}>{plugin.description}</p>

                {plugin.manifest?.permissions?.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: THEME.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Permissions</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {plugin.manifest.permissions.map(p => (
                                <span key={p} className="mp-badge" style={{ background: `${THEME.warning}10`, color: THEME.warning, border: `1px solid ${THEME.warning}20` }}>{p}</span>
                            ))}
                        </div>
                    </div>
                )}

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={{ padding: '9px 18px', background: THEME.surfaceLight, color: THEME.textMuted, border: `1px solid ${THEME.glassBorder}`, borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>Cancel</button>
                    <button onClick={() => onInstall(plugin.slug)} disabled={installing === plugin.slug}
                        style={{ padding: '9px 18px', background: THEME.primary, color: THEME.void, border: 'none', borderRadius: '10px', cursor: installing === plugin.slug ? 'wait' : 'pointer', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', opacity: installing === plugin.slug ? 0.7 : 1 }}>
                        {installing === plugin.slug ? <Loader2 size={14} className="mp-spin" /> : <Download size={14} />}
                        {installing === plugin.slug ? 'Installing…' : 'Install Plugin'}
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ── Plugin Card ──────────────────────────────────────────────────────────── */
const PluginCard = ({ plugin, onSelect, installed }) => (
    <div className="mp-card" onClick={() => onSelect(plugin)} style={{ '--tile-accent': THEME.primary } as React.CSSProperties}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: `${THEME.primary}15`, border: `1px solid ${THEME.primary}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Package size={18} color={THEME.primary} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: THEME.textMain }}>{plugin.name}</span>
                    {plugin.verified && <Shield size={12} color={THEME.success} />}
                    {installed && <CheckCircle size={12} color={THEME.success} />}
                </div>
                <div style={{ fontSize: '11px', color: THEME.textMuted }}>by {plugin.author} · v{plugin.version}</div>
            </div>
            <ChevronRight size={16} color={THEME.textMuted} />
        </div>
        <p style={{ fontSize: '12px', color: THEME.textMuted, lineHeight: '1.5', margin: '0 0 12px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{plugin.description}</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="mp-badge" style={{ background: `${THEME.primary}10`, color: THEME.primary, border: `1px solid ${THEME.primary}20` }}>{plugin.category || 'Plugin'}</span>
            <span style={{ fontSize: '11px', color: THEME.textMuted, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Download size={11} />{(plugin.downloads || 0).toLocaleString()}
            </span>
        </div>
    </div>
);

/* ═══════════════════════════════════════════════════════════════════════════
   MARKETPLACE PAGE
   ═══════════════════════════════════════════════════════════════════════════ */
export default function Marketplace() {
    useAdaptiveTheme();
    const [plugins, setPlugins] = useState<any[]>([]);
    const [installed, setInstalled] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [tab, setTab] = useState<'all' | 'verified' | 'installed'>('all');
    const [selected, setSelected] = useState<any>(null);
    const [installing, setInstalling] = useState<string | null>(null);
    const [toast, setToast] = useState<string | null>(null);

    const loadPlugins = useCallback(async (q = '') => {
        setLoading(true); setError(null);
        try {
            const [pub, ws] = await Promise.allSettled([
                fetchData(`/api/marketplace/plugins?q=${encodeURIComponent(q)}&limit=100`),
                fetchData('/api/marketplace/plugins/installed').catch(() => ({ plugins: [] })),
            ]);
            const pubPlugins = pub.status === 'fulfilled' ? (pub.value?.plugins || []) : [];
            const wsPlugins = ws.status === 'fulfilled' ? (ws.value?.plugins || []) : [];
            setPlugins(pubPlugins);
            setInstalled(wsPlugins.map((p: any) => p.slug));
        } catch (err: any) {
            setError(err.message || 'Failed to load marketplace');
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { loadPlugins(); }, [loadPlugins]);

    // Debounce search
    useEffect(() => {
        const t = setTimeout(() => loadPlugins(search), 400);
        return () => clearTimeout(t);
    }, [search, loadPlugins]);

    const handleInstall = useCallback(async (slug: string) => {
        setInstalling(slug);
        try {
            await postData(`/api/marketplace/plugins/${slug}/install`, {});
            setInstalled(prev => [...prev, slug]);
            setSelected(null);
            setToast(`Plugin installed successfully!`);
            setTimeout(() => setToast(null), 3000);
        } catch (err: any) {
            setToast(`Install failed: ${err.message}`);
            setTimeout(() => setToast(null), 4000);
        } finally { setInstalling(null); }
    }, []);

    const filtered = plugins.filter(p => {
        if (tab === 'verified') return p.verified;
        if (tab === 'installed') return installed.includes(p.slug);
        return true;
    });

    return (
        <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>
            <Styles />

            {/* Toast */}
            {toast && (
                <div style={{ position: 'fixed', top: '20px', right: '20px', background: THEME.surface, border: `1px solid ${THEME.glassBorder}`, borderRadius: '12px', padding: '12px 18px', fontSize: '13px', color: THEME.textMain, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 2000, display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <CheckCircle size={14} color={THEME.success} />{toast}
                </div>
            )}

            {/* Header */}
            <div style={{ marginBottom: '28px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 800, color: THEME.textMain, margin: '0 0 6px' }}>Plugin Marketplace</h1>
                <p style={{ fontSize: '13px', color: THEME.textMuted, margin: 0 }}>Extend PulseDB with community and verified plugins</p>
            </div>

            {/* Search + Filter */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                    <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: THEME.textMuted }} />
                    <input className="mp-input" placeholder="Search plugins…" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                    {(['all', 'verified', 'installed'] as const).map(t => (
                        <button key={t} className={`mp-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                            {t === 'all' ? `All (${plugins.length})` : t === 'verified' ? `Verified` : `Installed (${installed.length})`}
                        </button>
                    ))}
                </div>
            </div>

            {/* States */}
            {loading && (
                <div style={{ textAlign: 'center', padding: '60px', color: THEME.textMuted }}>
                    <Loader2 size={28} className="mp-spin" style={{ marginBottom: '12px', display: 'block', margin: '0 auto 12px' }} />
                    <div style={{ fontSize: '13px' }}>Loading marketplace…</div>
                </div>
            )}

            {error && (
                <div style={{ background: `${THEME.danger}10`, border: `1px solid ${THEME.danger}30`, borderRadius: '12px', padding: '16px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <AlertTriangle size={16} color={THEME.danger} />
                    <div style={{ fontSize: '13px', color: THEME.danger }}>{error}</div>
                </div>
            )}

            {!loading && !error && filtered.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 20px', background: `${THEME.surface}80`, border: `1px solid ${THEME.glassBorder}`, borderRadius: '16px' }}>
                    <Package size={40} color={THEME.textMuted} style={{ opacity: 0.4, marginBottom: '12px' }} />
                    <div style={{ fontSize: '14px', fontWeight: 600, color: THEME.textMain, marginBottom: '6px' }}>
                        {tab === 'installed' ? 'No plugins installed yet' : 'No plugins found'}
                    </div>
                    <div style={{ fontSize: '12px', color: THEME.textMuted }}>
                        {tab === 'installed' ? 'Browse the marketplace to find plugins to install' : 'Try a different search term'}
                    </div>
                </div>
            )}

            {/* Grid */}
            {!loading && !error && filtered.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                    {filtered.map(plugin => (
                        <PluginCard key={plugin.slug} plugin={plugin} onSelect={setSelected} installed={installed.includes(plugin.slug)} />
                    ))}
                </div>
            )}

            {/* Modal */}
            <PluginModal plugin={selected} onClose={() => setSelected(null)} onInstall={handleInstall} installing={installing} />
        </div>
    );
}
