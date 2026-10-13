import React, { useState, useEffect, useCallback } from 'react';
import {
    AlertTriangle,
    CheckCircle,
    ChevronDown,
    Layers,
    Lightbulb,
    MessageSquarePlus,
    PlusCircle,
    Send,
    Star,
    ThumbsUp,
    X,
    Zap,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useConnection } from '../../context/ConnectionContext';
import { DS } from '../../config/designTokens';
import { THEME } from '../../utils/theme';
import { postData } from '../../utils/api';
import { buildTabConfig } from '../../config/tabConfig';

const FEEDBACK_RATE_LIMIT_MS = 5 * 60 * 1000; // 5 minutes

/* ── Data ─────────────────────────────────────────────────────── */
const FB_MODES = [
    { id: 'feature', label: 'Feature Request', icon: Lightbulb, color: DS.cyan },
    { id: 'bug', label: 'Bug Report', icon: AlertTriangle, color: DS.rose },
    { id: 'general', label: 'General', icon: MessageSquarePlus, color: DS.violet },
];

const FB_PRIORITY = [
    { val: 'Low', color: DS.emerald },
    { val: 'Medium', color: DS.amber },
    { val: 'High', color: DS.rose },
];

const STAR_LABELS = ['Terrible', 'Poor', 'Okay', 'Good', 'Excellent'];

/* All screens grouped — mirrors buildTabConfig() exactly */
function getFbGroups() {
    const config = buildTabConfig();
    const groups: { group: string; accent: string; tabs: { id: string; label: string }[] }[] = [];
    let cur: (typeof groups)[number] | null = null;
    for (const item of config) {
        if ('section' in item) {
            cur = { group: item.section, accent: item.accent, tabs: [] };
            groups.push(cur);
        } else if (cur && 'id' in item) {
            cur.tabs.push({ id: item.id, label: item.label });
        }
    }
    return groups;
}
const FB_GROUPS = getFbGroups();
const FB_ALL_TABS = FB_GROUPS.flatMap((g) => g.tabs);

/* Which feedback sections are relevant for each connected DB type.
   Mirrors the sidebar's per-DB section visibility so the feedback picker
   only offers screens that apply to the database the user is connected to. */
const FB_SECTIONS_BY_DBTYPE: Record<string, string[]> = {
    postgresql: [
        'Connections',
        'Overview',
        'Alerts & Rules',
        'Query Analysis',
        'Schema & Data',
        'Infrastructure',
        'Security',
        'Observability',
        'Developer Tools',
        'Admin',
    ],
    mysql: [
        'Connections',
        'MySQL',
        'Overview',
        'Alerts & Rules',
        'Security',
        'Observability',
        'Developer Tools',
        'Admin',
    ],
    mariadb: [
        'Connections',
        'MySQL',
        'Overview',
        'Alerts & Rules',
        'Security',
        'Observability',
        'Developer Tools',
        'Admin',
    ],
    mongodb: ['Connections', 'MongoDB', 'Overview', 'Alerts & Rules', 'Security', 'Observability', 'Admin'],
};

/* Feedback groups filtered to the active connection's DB type.
   Falls back to all groups if the DB type is unknown. */
function fbGroupsForDbType(dbType?: string | null) {
    const key = (dbType || '').toLowerCase();
    const allowed = FB_SECTIONS_BY_DBTYPE[key];
    if (!allowed) return FB_GROUPS;
    return FB_GROUPS.filter((g) => allowed.includes(g.group));
}
const emptyRow = () => ({ rating: 0, comment: '', remarks: '' });

/* ── Shared primitives ────────────────────────────────────────── */
const FbLabel = ({ children, color }: { children?: any; color?: any }) => (
    <div
        style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.02em',
            color: color || DS.textMuted,
            marginBottom: 8,
            fontFamily: DS.fontMono,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
        }}
    >
        {children}
    </div>
);

const FbInput = ({
    value,
    onChange,
    placeholder,
    maxLength,
    style: extraStyle,
}: {
    value?: any;
    onChange?: any;
    placeholder?: string;
    maxLength?: number;
    style?: any;
}) => {
    const [focused, setFocused] = useState(false);
    return (
        <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            maxLength={maxLength}
            className="fb-input"
            style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${focused ? DS.borderAccent : DS.border}`,
                borderRadius: 9,
                padding: '10px 13px',
                color: DS.textPrimary,
                fontSize: 13,
                outline: 'none',
                fontFamily: DS.fontUI,
                transition: 'border-color 0.2s, box-shadow 0.2s',
                ...extraStyle,
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
        />
    );
};

const FbTextarea = ({ value, onChange, placeholder, rows = 3, maxLength = 500, showCount = true }) => {
    const [focused, setFocused] = useState(false);
    return (
        <div>
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                rows={rows}
                maxLength={maxLength}
                className="fb-input"
                style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${focused ? DS.borderAccent : DS.border}`,
                    borderRadius: 9,
                    padding: '10px 13px',
                    color: DS.textPrimary,
                    fontSize: 13,
                    outline: 'none',
                    resize: 'none',
                    fontFamily: DS.fontUI,
                    lineHeight: 1.6,
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
            />
            {showCount && (
                <div
                    style={{
                        fontSize: 10,
                        color: DS.textMuted,
                        textAlign: 'right',
                        marginTop: 3,
                        fontFamily: DS.fontMono,
                    }}
                >
                    {value.length}/{maxLength}
                </div>
            )}
        </div>
    );
};

const FbStarRow = ({ value, onChange, size = 22 }) => {
    const [hov, setHov] = useState(0);
    const d = hov || value;
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {[1, 2, 3, 4, 5].map((s) => (
                <button
                    key={s}
                    type="button"
                    className="star-btn"
                    onClick={() => onChange(s)}
                    onMouseEnter={() => setHov(s)}
                    onMouseLeave={() => setHov(0)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 1 }}
                >
                    <Star
                        size={size}
                        fill={s <= d ? DS.amber : 'transparent'}
                        color={s <= d ? DS.amber : DS.textMuted}
                        strokeWidth={1.5}
                        style={{ display: 'block', transition: 'fill 0.12s' }}
                    />
                </button>
            ))}
            {d > 0 && (
                <span
                    style={{
                        fontSize: 10,
                        color: DS.textMuted,
                        fontFamily: DS.fontMono,
                        marginLeft: 4,
                        userSelect: 'none',
                    }}
                >
                    {STAR_LABELS[d - 1]}
                </span>
            )}
        </div>
    );
};

/* Full grouped dropdown for section picker */
const FbSectionDropdown = ({ value, onChange, includeAll = false }) => {
    const [open, setOpen] = useState(false);
    const ref = React.useRef(null);
    const { activeConnection } = useConnection();
    // Only offer sections relevant to the connected database type.
    const groups = React.useMemo(() => fbGroupsForDbType(activeConnection?.dbType), [activeConnection?.dbType]);
    const label = !value || value === 'all' ? 'All Sections' : FB_ALL_TABS.find((t) => t.id === value)?.label || value;

    useEffect(() => {
        const h = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="fb-input"
                style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${open ? DS.borderAccent : DS.border}`,
                    borderRadius: 9,
                    padding: '10px 13px',
                    color: DS.textPrimary,
                    fontSize: 13,
                    outline: 'none',
                    cursor: 'pointer',
                    fontFamily: DS.fontUI,
                    transition: 'border-color 0.2s',
                }}
            >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Layers size={13} color={DS.cyan} /> {label}
                </span>
                <ChevronDown
                    size={13}
                    color={DS.textMuted}
                    style={{ transform: open ? 'rotate(180deg)' : 'none', transition: '0.2s', flexShrink: 0 }}
                />
            </button>
            {open && (
                <div
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 5px)',
                        left: 0,
                        right: 0,
                        background: DS.surface,
                        border: `1px solid ${DS.borderAccent}`,
                        borderRadius: 10,
                        boxShadow: DS.shadowDeep,
                        zIndex: 30,
                        maxHeight: 260,
                        overflowY: 'auto',
                    }}
                >
                    {includeAll && (
                        <button
                            type="button"
                            className="fb-opt"
                            onClick={() => {
                                onChange('all');
                                setOpen(false);
                            }}
                            style={{
                                width: '100%',
                                textAlign: 'left',
                                padding: '9px 14px',
                                background: !value || value === 'all' ? DS.cyanDim : 'transparent',
                                color: !value || value === 'all' ? DS.cyan : DS.textSub,
                                border: 'none',
                                borderBottom: `1px solid ${DS.border}`,
                                cursor: 'pointer',
                                fontSize: 12,
                                fontWeight: 700,
                                fontFamily: DS.fontUI,
                                transition: 'background 0.15s',
                            }}
                        >
                            All Sections
                        </button>
                    )}
                    {groups.map((g) => (
                        <React.Fragment key={g.group}>
                            <div
                                style={{
                                    padding: '5px 14px 4px',
                                    fontSize: 9,
                                    fontWeight: 700,
                                    color: g.accent,
                                    fontFamily: DS.fontMono,
                                    letterSpacing: '0.02em',
                                    background: `${g.accent}08`,
                                    borderBottom: `1px solid ${DS.border}`,
                                }}
                            >
                                {g.group}
                            </div>
                            {g.tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    className="fb-opt"
                                    onClick={() => {
                                        onChange(tab.id);
                                        setOpen(false);
                                    }}
                                    style={{
                                        width: '100%',
                                        textAlign: 'left',
                                        padding: '8px 14px 8px 22px',
                                        background: value === tab.id ? DS.cyanDim : 'transparent',
                                        color: value === tab.id ? DS.cyan : DS.textSub,
                                        border: 'none',
                                        borderBottom: `1px solid ${DS.border}`,
                                        cursor: 'pointer',
                                        fontSize: 12,
                                        fontWeight: value === tab.id ? 600 : 400,
                                        fontFamily: DS.fontUI,
                                        transition: 'background 0.15s',
                                    }}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </React.Fragment>
                    ))}
                </div>
            )}
        </div>
    );
};

/* Single section card (used in both single + all-sections modes) */
const FbSectionCard = ({ label, data, onChange, compact = false, accent = DS.cyan }) => (
    <div
        style={{
            border: `1px solid ${DS.border}`,
            borderRadius: 10,
            padding: compact ? '12px 14px' : '18px',
            background: 'rgba(255,255,255,0.015)',
            marginBottom: compact ? 8 : 0,
        }}
    >
        {compact && (
            <div
                style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: accent,
                    marginBottom: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontFamily: DS.fontMono,
                    letterSpacing: '0.02em',
                }}
            >
                <Layers size={10} /> {label}
            </div>
        )}
        <div style={{ marginBottom: 12 }}>
            <FbLabel>Rating</FbLabel>
            <FbStarRow value={data.rating} onChange={(v) => onChange('rating', v)} size={compact ? 18 : 22} />
        </div>
        <div style={{ marginBottom: 10 }}>
            <FbLabel>Feedback</FbLabel>
            <FbTextarea
                value={data.comment}
                onChange={(v) => onChange('comment', v)}
                placeholder="What do you love, or what could be better?"
                rows={compact ? 2 : 3}
            />
        </div>
        <div>
            <FbLabel>Suggestions</FbLabel>
            <FbTextarea
                value={data.remarks}
                onChange={(v) => onChange('remarks', v)}
                placeholder="Any specific improvements you'd recommend?"
                rows={compact ? 2 : 2}
                showCount={false}
            />
        </div>
    </div>
);

/* Feature request form */
const FbFeatureForm = ({ data, onChange }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
            <FbLabel>Related Section</FbLabel>
            <FbSectionDropdown value={data.section} onChange={(v) => onChange('section', v)} />
        </div>
        <div>
            <FbLabel>
                Feature Title <span style={{ color: DS.rose }}>*</span>
            </FbLabel>
            <FbInput
                value={data.title}
                onChange={(v) => onChange('title', v)}
                placeholder="Give your feature a short, descriptive name"
                maxLength={120}
            />
        </div>
        <div>
            <FbLabel>
                Description / Use Case <span style={{ color: DS.rose }}>*</span>
            </FbLabel>
            <FbTextarea
                value={data.description}
                onChange={(v) => onChange('description', v)}
                placeholder="Describe the feature and why it would be valuable…"
                rows={3}
            />
        </div>
        <div>
            <FbLabel>Additional Remarks</FbLabel>
            <FbTextarea
                value={data.remarks}
                onChange={(v) => onChange('remarks', v)}
                placeholder="Implementation ideas, references, or further context…"
                rows={2}
                showCount={false}
            />
        </div>
        {/* Suggest new tab */}
        <div
            style={{
                padding: '14px 16px',
                border: `1px dashed ${DS.borderAccent}`,
                borderRadius: 10,
                background: DS.cyanDim,
            }}
        >
            <FbLabel color={DS.cyan}>
                <PlusCircle size={10} /> Suggest a New Tab
                <span
                    style={{
                        color: DS.textMuted,
                        textTransform: 'none',
                        fontWeight: 400,
                        letterSpacing: 0,
                        marginLeft: 2,
                    }}
                >
                    (optional)
                </span>
            </FbLabel>
            <FbInput
                value={data.suggestedTab}
                onChange={(v) => onChange('suggestedTab', v)}
                placeholder="e.g. Query History, Cost Estimator, Live Replication…"
                maxLength={80}
            />
        </div>
        {/* Priority */}
        <div>
            <FbLabel>Priority</FbLabel>
            <div style={{ display: 'flex', gap: 8 }}>
                {FB_PRIORITY.map(({ val, color }) => {
                    const active = data.priority === val;
                    return (
                        <button
                            key={val}
                            type="button"
                            className="fb-prio"
                            onClick={() => onChange('priority', val)}
                            style={{
                                flex: 1,
                                padding: '9px 0',
                                borderRadius: 8,
                                fontSize: 12,
                                fontWeight: 600,
                                border: `1px solid ${active ? color : DS.border}`,
                                background: active ? `${color}15` : 'transparent',
                                color: active ? color : DS.textMuted,
                                cursor: 'pointer',
                                fontFamily: DS.fontUI,
                                transition: 'all 0.18s',
                                opacity: active ? 1 : 0.7,
                            }}
                        >
                            {val}
                        </button>
                    );
                })}
            </div>
        </div>
    </div>
);

/* Bug / General form */
const FbBugGeneralForm = ({ section, onSectionChange, forms, onFieldChange }) => {
    const showAll = section === 'all';
    const accentFor = (id) => FB_GROUPS.find((g) => g.tabs.some((t) => t.id === id))?.accent || DS.cyan;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
                <FbLabel>Screen / Section</FbLabel>
                <FbSectionDropdown value={section} onChange={onSectionChange} includeAll />
            </div>
            {showAll ? (
                <>
                    <div
                        style={{
                            fontSize: 12,
                            color: DS.textSub,
                            padding: '9px 13px',
                            background: DS.cyanDim,
                            border: `1px solid ${DS.borderAccent}`,
                            borderRadius: 8,
                            lineHeight: 1.55,
                        }}
                    >
                        Rate any screens you've used. Leave sections blank to skip them — only filled sections will be
                        submitted.
                    </div>
                    {FB_GROUPS.map((g) => (
                        <div key={g.group}>
                            <div
                                style={{
                                    fontSize: 9,
                                    fontWeight: 700,
                                    color: g.accent,
                                    fontFamily: DS.fontMono,
                                    letterSpacing: '0.02em',
                                    marginBottom: 6,
                                    marginTop: 4,
                                    paddingLeft: 2,
                                }}
                            >
                                {g.group}
                            </div>
                            {g.tabs.map((tab) => (
                                <FbSectionCard
                                    key={tab.id}
                                    label={tab.label}
                                    data={forms[tab.id] || emptyRow()}
                                    onChange={(field, val) => onFieldChange(tab.id, field, val)}
                                    compact
                                    accent={g.accent}
                                />
                            ))}
                        </div>
                    ))}
                </>
            ) : (
                <FbSectionCard
                    label={FB_ALL_TABS.find((t) => t.id === section)?.label || section}
                    data={forms[section] || emptyRow()}
                    onChange={(field, val) => onFieldChange(section, field, val)}
                    accent={accentFor(section)}
                />
            )}
        </div>
    );
};

/* ── Main modal ───────────────────────────────────────────────── */
export const FeedbackModal = ({ onClose, initialSection }) => {
    const { currentUser } = useAuth();

    const [mode, setMode] = useState('feature');
    const [feature, setFeature] = useState({
        section: initialSection || null,
        title: '',
        description: '',
        remarks: '',
        priority: 'Medium',
        suggestedTab: '',
    });
    const [section, setSection] = useState(initialSection || 'all');
    const [forms, setForms] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');

    /* Pre-populate section form when initialSection is provided */
    useEffect(() => {
        if (initialSection && initialSection !== 'all' && !forms[initialSection]) {
            setForms((p) => ({ ...p, [initialSection]: emptyRow() }));
        }
    }, []);

    /* Ensure row exists when section changes */
    useEffect(() => {
        if (section !== 'all' && !forms[section]) {
            setForms((p) => ({ ...p, [section]: emptyRow() }));
        }
    }, [section]);

    /* Rate-limit notice (non-blocking — just a warning) */
    const [rateLimited, setRateLimited] = useState(false);
    useEffect(() => {
        try {
            const last = parseInt(localStorage.getItem('fathom_last_feedback') || '0', 10);
            if (last > 0 && Date.now() - last < FEEDBACK_RATE_LIMIT_MS) setRateLimited(true);
        } catch {}
    }, []);

    /* Esc to close */
    useEffect(() => {
        const h = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [onClose]);

    const updateFeature = (k, v) => setFeature((p) => ({ ...p, [k]: v }));
    const updateFormField = (tabId, field, val) =>
        setForms((p) => ({ ...p, [tabId]: { ...(p[tabId] || emptyRow()), [field]: val } }));

    const canSubmit = useCallback(() => {
        if (sent || submitting) return false;
        if (mode === 'feature') return feature.title.trim().length > 0 && feature.description.trim().length > 0;
        if (section === 'all') return FB_ALL_TABS.some((t) => (forms[t.id]?.comment || '').trim().length > 0);
        return (forms[section]?.comment || '').trim().length > 0;
    }, [sent, submitting, mode, feature, section, forms]);

    /* Build payload — maps 1-to-1 to user_feedback columns.
       username / user_id are resolved server-side from the Bearer token. */
    const buildPayload = useCallback(() => {
        const meta = {
            page: window.location.pathname,
            userAgent: navigator.userAgent,
            screenSize: `${window.screen.width}x${window.screen.height}`,
            timestamp: new Date().toISOString(),
        };

        if (mode === 'feature') {
            const sugTab = feature.suggestedTab.trim() || null;
            return {
                feedback_type: 'feature',
                rating: null,
                comment: feature.description.trim() || '', // NOT NULL column
                remarks: feature.remarks.trim() || null,
                section: feature.section || null,
                feature_title: feature.title.trim(),
                feature_priority: feature.priority,
                suggested_tab: sugTab, // dedicated column (not buried in JSONB)
                section_feedback: null,
                user_metadata: { ...meta },
            };
        }

        if (section === 'all') {
            const sectionFeedback = FB_ALL_TABS.map((tab) => {
                const row = forms[tab.id] || emptyRow();
                return {
                    section_id: tab.id,
                    section_label: tab.label,
                    rating: row.rating || null,
                    comment: row.comment.trim(),
                    remarks: row.remarks.trim() || null,
                };
            }).filter((r) => r.comment || r.rating);
            return {
                feedback_type: mode,
                rating: null,
                comment:
                    sectionFeedback
                        .map((r) => `[${r.section_label}] ${r.comment}`)
                        .filter(Boolean)
                        .join('\n') || '', // NOT NULL column
                remarks: null,
                section: null,
                feature_title: null,
                feature_priority: null,
                suggested_tab: null,
                section_feedback: sectionFeedback,
                user_metadata: { ...meta, mode: 'all-sections' },
            };
        }

        /* Single section */
        const row = forms[section] || emptyRow();
        return {
            feedback_type: mode,
            rating: row.rating || null,
            comment: row.comment.trim() || '', // NOT NULL column
            remarks: row.remarks.trim() || null,
            section: section,
            feature_title: null,
            feature_priority: null,
            suggested_tab: null,
            section_feedback: null,
            user_metadata: meta,
        };
    }, [mode, feature, section, forms]);

    const handleSubmit = async () => {
        if (!canSubmit()) return;
        setSubmitting(true);
        setError('');

        const payload = buildPayload();
        try {
            await postData('/api/feedback', payload);

            /* ✓ Success */
            try {
                localStorage.setItem('fathom_last_feedback', Date.now().toString());
            } catch {}
            setSent(true);
            setTimeout(onClose, 2800);
        } catch (e) {
            console.error('[FeedbackModal] submit error:', e);
            setError(e.message || 'Something went wrong. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const ready = canSubmit();
    const wide = mode !== 'feature' && section === 'all';

    /* Success state */
    if (sent)
        return (
            <div className="feedback-overlay">
                <div
                    className="feedback-modal"
                    style={{
                        background: DS.surface,
                        border: `1px solid ${DS.borderAccent}`,
                        borderRadius: 20,
                        padding: '52px 44px',
                        textAlign: 'center',
                        boxShadow: `${DS.shadowDeep}, ${DS.glowCyan}`,
                        maxWidth: 360,
                        width: '90%',
                    }}
                >
                    <div
                        style={{
                            width: 68,
                            height: 68,
                            margin: '0 auto 22px',
                            borderRadius: '50%',
                            background: 'rgba(52,211,153,0.1)',
                            border: '1px solid rgba(52,211,153,0.35)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            animation: 'glowPulse 2s ease infinite',
                        }}
                    >
                        <ThumbsUp size={30} color={DS.emerald} strokeWidth={1.5} />
                    </div>
                    <h3
                        style={{
                            margin: '0 0 10px',
                            fontSize: 22,
                            fontWeight: 700,
                            color: DS.textPrimary,
                            letterSpacing: '-0.02em',
                        }}
                    >
                        Thank you!
                    </h3>
                    <p style={{ color: DS.textSub, margin: 0, fontSize: 13, lineHeight: 1.7 }}>
                        Your feedback helps us make Fathom better for everyone.
                    </p>
                </div>
            </div>
        );

    return (
        <div className="feedback-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div
                className="feedback-modal"
                style={{
                    background: DS.surface,
                    border: `1px solid ${DS.borderAccent}`,
                    borderRadius: 20,
                    width: wide ? 580 : 490,
                    maxWidth: '94vw',
                    maxHeight: '90vh',
                    boxShadow: `${DS.shadowDeep}, ${DS.glowCyan}`,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1)',
                }}
            >
                {/* Animated rainbow top bar */}
                <div
                    style={{
                        height: 3,
                        flexShrink: 0,
                        background: `linear-gradient(90deg, ${DS.cyan}, ${DS.violet}, ${DS.emerald})`,
                        backgroundSize: '200% 100%',
                        animation: 'waveFlow 3s ease infinite',
                    }}
                />

                {/* Header */}
                <div
                    style={{
                        padding: '20px 26px 18px',
                        borderBottom: `1px solid ${DS.border}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexShrink: 0,
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <h3
                            style={{
                                margin: 0,
                                fontSize: 17,
                                fontWeight: 700,
                                color: DS.textPrimary,
                                letterSpacing: '-0.02em',
                            }}
                        >
                            Send Feedback
                        </h3>
                        <div
                            style={{
                                fontSize: 10,
                                color: DS.textMuted,
                                marginTop: 4,
                                fontFamily: DS.fontMono,
                                letterSpacing: '0.02em',
                            }}
                        >
                            FATHOM · DATABASE MONITOR
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(255,255,255,0.04)',
                            border: `1px solid ${DS.border}`,
                            color: DS.textSub,
                            cursor: 'pointer',
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s',
                            flexShrink: 0,
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(251,113,133,0.12)';
                            e.currentTarget.style.color = DS.rose;
                            e.currentTarget.style.borderColor = 'rgba(251,113,133,0.3)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                            e.currentTarget.style.color = DS.textSub;
                            e.currentTarget.style.borderColor = DS.border;
                        }}
                        aria-label="Close feedback"
                    >
                        <X size={15} strokeWidth={2} />
                    </button>
                </div>

                {/* Mode tabs */}
                <div
                    style={{
                        display: 'flex',
                        gap: 6,
                        padding: '14px 26px 12px',
                        borderBottom: `1px solid ${DS.border}`,
                        flexShrink: 0,
                        background: 'rgba(255,255,255,0.01)',
                    }}
                >
                    {FB_MODES.map((m) => {
                        const Icon = m.icon;
                        const active = mode === m.id;
                        return (
                            <button
                                key={m.id}
                                type="button"
                                className="fb-tab"
                                onClick={() => {
                                    setMode(m.id);
                                    setError('');
                                }}
                                style={{
                                    flex: 1,
                                    padding: '9px 6px',
                                    borderRadius: 9,
                                    border: `1px solid ${active ? `${m.color}50` : DS.border}`,
                                    background: active ? `${m.color}12` : 'transparent',
                                    color: active ? m.color : DS.textMuted,
                                    cursor: 'pointer',
                                    fontSize: 11,
                                    fontWeight: active ? 600 : 400,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: 5,
                                    transition: 'all 0.18s',
                                    fontFamily: DS.fontUI,
                                    opacity: active ? 1 : 0.65,
                                }}
                            >
                                <Icon size={14} strokeWidth={active ? 2 : 1.5} />
                                {m.label}
                            </button>
                        );
                    })}
                </div>

                {/* Scrollable body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 26px' }}>
                    {mode === 'feature' ? (
                        <FbFeatureForm data={feature} onChange={updateFeature} />
                    ) : (
                        <FbBugGeneralForm
                            section={section}
                            onSectionChange={(s) => {
                                setSection(s);
                                setError('');
                            }}
                            forms={forms}
                            onFieldChange={updateFormField}
                        />
                    )}

                    {/* Rate-limit soft notice */}
                    {rateLimited && !error && (
                        <div
                            style={{
                                marginTop: 16,
                                padding: '9px 13px',
                                borderRadius: 9,
                                background: 'rgba(251,191,36,0.08)',
                                border: '1px solid rgba(251,191,36,0.22)',
                                color: DS.amber,
                                fontSize: 11,
                                lineHeight: 1.5,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 8,
                            }}
                        >
                            <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                <AlertTriangle size={12} style={{ flexShrink: 0 }} />
                                You submitted feedback recently — you can still submit again if needed.
                            </span>
                            <button
                                type="button"
                                onClick={() => setRateLimited(false)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: DS.amber,
                                    opacity: 0.6,
                                    padding: 0,
                                    flexShrink: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    transition: 'opacity 0.15s',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
                            >
                                <X size={13} />
                            </button>
                        </div>
                    )}

                    {/* Hard error */}
                    {error && (
                        <div
                            style={{
                                marginTop: 16,
                                padding: '10px 14px',
                                borderRadius: 9,
                                background: 'rgba(251,113,133,0.08)',
                                border: '1px solid rgba(251,113,133,0.25)',
                                color: DS.rose,
                                fontSize: 12,
                                lineHeight: 1.5,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 8,
                            }}
                        >
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                                {error}
                            </span>
                            <button
                                type="button"
                                onClick={() => setError('')}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: DS.rose,
                                    opacity: 0.6,
                                    padding: 0,
                                    flexShrink: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    transition: 'opacity 0.15s',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
                                aria-label="Dismiss error"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '12px 26px 20px', borderTop: `1px solid ${DS.border}`, flexShrink: 0 }}>
                    <div
                        style={{
                            fontSize: 10,
                            color: DS.textMuted,
                            marginBottom: 10,
                            fontFamily: DS.fontMono,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                        }}
                    >
                        <span style={{ color: DS.rose }}>*</span>
                        {mode === 'feature'
                            ? 'Title and description are required'
                            : 'At least one section comment is required'}
                    </div>
                    <button
                        type="button"
                        className="fb-submit"
                        onClick={handleSubmit}
                        disabled={!ready}
                        style={{
                            width: '100%',
                            padding: '13px 0',
                            borderRadius: 10,
                            border: 'none',
                            background: ready
                                ? `linear-gradient(135deg, ${DS.cyan}, ${DS.violet})`
                                : 'rgba(255,255,255,0.05)',
                            color: ready ? THEME.textInverse : DS.textMuted,
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: ready ? 'pointer' : 'not-allowed',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            letterSpacing: '0.03em',
                            fontFamily: DS.fontUI,
                            transition: 'filter 0.2s, transform 0.15s, box-shadow 0.2s',
                            opacity: submitting ? 0.7 : 1,
                            boxShadow: ready ? '0 4px 20px rgba(99,102,241,0.22)' : 'none',
                        }}
                    >
                        {submitting ? (
                            <>
                                <Zap size={14} /> Sending…
                            </>
                        ) : mode === 'feature' ? (
                            <>
                                <PlusCircle size={14} /> Submit Feature Request
                            </>
                        ) : (
                            <>
                                <Send size={14} /> Send Feedback
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
