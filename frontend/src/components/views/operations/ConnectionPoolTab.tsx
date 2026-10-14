import React, { useState, useEffect, useCallback } from 'react';
import { THEME, useAdaptiveTheme, useGlobalRefresh } from '../../../utils/theme';
import { API_BASE, postData } from '../../../utils/api';
import { useConnection } from '../../../context/ConnectionContext';
import { encryptConnectionFields } from '../../../utils/cryptoUtils';
import {
    Database, Plus, Edit, Trash2, Eye, EyeOff, Check, X,
    Server, Key, User, AlertCircle, CheckCircle, Link as LinkIcon,
    RefreshCw, ChevronDown, Terminal, Lock, ChevronRight, ShieldCheck,
    Search, MoreVertical, Copy, Zap, Download,
} from 'lucide-react';

// ─── Database type definitions ───────────────────────────────────────────────
// Every engine the backend adapter factory supports (backend/services/dbAdapters/
// index.js → SUPPORTED_DB_TYPES) must appear here, otherwise it cannot be
// selected from the "DATABASE ENGINE" picker in the New Connection modal.
const DB_TYPES = {
    postgresql: {
        label: 'PostgreSQL',
        defaultPort: 5432,
        color: '#336791',
        accent: THEME.primary,
        icon: '🐘',
        fields: ['host', 'port', 'database', 'username', 'password', 'ssl'],
    },
    mysql: {
        label: 'MySQL',
        defaultPort: 3306,
        color: THEME.warning,
        accent: THEME.warning,
        icon: '🐬',
        fields: ['host', 'port', 'database', 'username', 'password', 'ssl'],
    },
    mongodb: {
        label: 'MongoDB',
        defaultPort: 27017,
        color: '#13aa52',
        accent: '#00ed64',
        icon: '🍃',
        fields: ['host', 'port', 'database', 'username', 'password', 'ssl', 'authSource', 'replicaSet'],
    },
    // ── Phase-5 engines ─────────────────────────────────────────────────────
    mssql: {
        label: 'SQL Server',
        defaultPort: 1433,
        color: '#CC2927',
        accent: '#CC2927',
        icon: '🅼',
        fields: ['host', 'port', 'database', 'username', 'password', 'ssl'],
    },
    oracle: {
        label: 'Oracle',
        defaultPort: 1521,
        color: '#F80000',
        accent: '#F80000',
        icon: '🅾',
        fields: ['host', 'port', 'database', 'username', 'password', 'ssl'],
    },
    redis: {
        label: 'Redis',
        defaultPort: 6379,
        color: '#DC382D',
        accent: '#DC382D',
        icon: '🧰',
        fields: ['host', 'port', 'database', 'username', 'password', 'ssl'],
    },
    elasticsearch: {
        label: 'Elasticsearch',
        defaultPort: 9200,
        color: '#00BFB3',
        accent: '#00BFB3',
        icon: '🔍',
        fields: ['host', 'port', 'database', 'username', 'password', 'ssl'],
    },
    snowflake: {
        label: 'Snowflake',
        defaultPort: 443,
        color: '#29B5E8',
        accent: '#29B5E8',
        icon: '❄️',
        // Snowflake uses `host` for the account identifier
        // (e.g. acme-analytics.us-east-1.snowflakecomputing.com).
        fields: ['host', 'port', 'database', 'username', 'password', 'ssl'],
    },
    bigquery: {
        label: 'BigQuery',
        defaultPort: 443,
        color: THEME.primary,
        accent: THEME.primary,
        icon: '🔶',
        // BigQuery: `host` = project ID, `username` = service-account email,
        // `password` = service-account key JSON, `database` = dataset.
        fields: ['host', 'port', 'database', 'username', 'password', 'ssl'],
    },
    redshift: {
        label: 'Redshift',
        defaultPort: 5439,
        color: '#FF9900',
        accent: '#FF9900',
        icon: '🧊',
        fields: ['host', 'port', 'database', 'username', 'password', 'ssl'],
    },
    cassandra: {
        label: 'Cassandra',
        defaultPort: 9042,
        color: '#1287B1',
        accent: '#1287B1',
        icon: '💍',
        // `database` is treated as the default keyspace by the backend.
        fields: ['host', 'port', 'database', 'username', 'password', 'ssl'],
    },
    dynamodb: {
        label: 'DynamoDB',
        defaultPort: 443,
        color: '#4053D6',
        accent: '#4053D6',
        icon: '📦',
        // DynamoDB: `host` = AWS region, `username`/`password` = access-key
        // pair, `database` = optional table-name prefix.
        fields: ['host', 'port', 'database', 'username', 'password', 'ssl'],
    },
};

const FIELD_META = {
    host:         { label: 'Host',              placeholder: 'localhost',               type: 'text' },
    port:         { label: 'Port',              placeholder: '',                         type: 'number' },
    database:     { label: 'Database',          placeholder: 'my_database',             type: 'text' },
    username:     { label: 'Username',          placeholder: 'admin',                   type: 'text' },
    password:     { label: 'Password',          placeholder: '••••••••',               type: 'password' },
    ssl:          { label: 'Enable SSL',        type: 'checkbox' },
    authSource:   { label: 'Auth Source',       placeholder: 'admin',                   type: 'text', optional: true },
    replicaSet:   { label: 'Replica Set',       placeholder: 'rs0',                     type: 'text', optional: true },
};

const defaultFormData = (dbType = 'postgresql') => {
    const meta = DB_TYPES[dbType];
    return {
        name: '',
        dbType,
        host: '',
        port: meta.defaultPort ? String(meta.defaultPort) : '',
        database: '',
        username: '',
        password: '',
        ssl: false,
        isDefault: false,
        authSource: '',
        replicaSet: '',
        // ── SSH Tunnel ───────────────────────────────────────────────
        sshEnabled:    false,
        sshHost:       '',
        sshPort:       '22',
        sshUser:       '',
        sshAuthType:   'key',       // 'key' | 'password'
        sshPrivateKey: '',          // PEM content
        sshPassphrase: '',          // optional key passphrase
        sshPassword:   '',          // SSH password (when sshAuthType==='password')
    };
};

const FONT_UI   = `'Outfit', system-ui, sans-serif`;
const FONT_MONO = `'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace`;

const S = {
    get root() { return {
        fontFamily: FONT_UI,
        minHeight: '100vh',
        background: THEME.bg,
        color: THEME.textMain,
        padding: '32px 28px',
    }; },
    card: (accent) => ({
        background: THEME.surface,
        border: 'none',
        borderLeft: `4px solid ${accent || THEME.primary}`,
        borderRadius: '0 16px 16px 0',
        padding: 24,
        transition: 'all 0.25s ease',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        backdropFilter: 'blur(12px)',
        '--pipe-color': accent,
    }),
    badge: (color) => ({
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
        background: `${color}22`, color: color,
        border: `1px solid ${color}44`, letterSpacing: '0.02em',
    }),
    btn: (bg, border, color) => ({
        background: bg, border: `1px solid ${border}`, borderRadius: 12,
        padding: '12px 18px', color, cursor: 'pointer', fontSize: 13, fontWeight: 600,
        transition: 'all 0.15s', display: 'inline-flex', alignItems: 'center', gap: 8,
        letterSpacing: '0.01em',
    }),
    // Legacy input (kept for non-floating uses like checkbox row labels & textareas inside SSH)
    input: (hasError) => ({
        width: '100%', boxSizing: 'border-box',
        background: THEME.surfaceHover,
        border: `1px solid ${hasError ? THEME.danger : THEME.glassBorder}`,
        borderRadius: 12, padding: '14px 16px', color: THEME.textMain, fontSize: 14,
        outline: 'none', transition: 'border-color 0.2s',
        fontFamily: FONT_UI, lineHeight: 1.4,
    }),
    get label() { return {
        display: 'block', fontSize: 12, fontWeight: 600,
        color: THEME.textDim, marginBottom: 10, letterSpacing: '0.02em',
        fontFamily: FONT_UI,
        lineHeight: 1.4,
    }; },
    // ── Section grouping (flat, no card wrappers) ──────────────────────────
    sectionHeading: {
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 11, fontWeight: 700, color: THEME.textDim,
        textTransform: 'uppercase' as const, letterSpacing: '0.1em',
        marginBottom: 10, marginTop: 0,
        fontFamily: FONT_UI,
    },
    sectionRule: {
        height: 1, background: THEME.glassBorder,
        border: 'none', margin: '14px 0',
        width: '100%',
    },
};

// ─── FormField — conventional layout: small uppercase label, then input ──────
// Renamed-in-place from FloatingField; the floating-label pattern looked like
// a large empty placeholder when the field was unfilled, so we switched to a
// classic above-input label which reads correctly at a glance.
const FloatingField = ({
    label, value, onChange, type = 'text', placeholder, error, required, optional,
    autoFocus, paddingRight, children, inputRef, monospace, rows, helper,
}: any) => {
    const [focused, setFocused] = useState(false);
    const Tag: any = rows ? 'textarea' : 'input';

    return (
        <div style={{ width: '100%', fontFamily: FONT_UI }}>
            <label style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 700,
                color: error ? THEME.danger : focused ? THEME.primary : THEME.textMuted,
                textTransform: 'uppercase' as const,
                letterSpacing: '0.08em',
                marginBottom: 6,
                fontFamily: FONT_UI,
                transition: 'color 0.15s',
            }}>
                {label}
                {required && <span style={{ color: THEME.danger, marginLeft: 4 }}>*</span>}
                {optional && (
                    <span style={{ color: THEME.textMuted, marginLeft: 6, fontSize: 10, textTransform: 'none', fontWeight: 500, letterSpacing: 0 }}>
                        optional
                    </span>
                )}
            </label>
            <div style={{ position: 'relative' }}>
                <Tag
                    ref={inputRef}
                    type={rows ? undefined : type}
                    value={value || ''}
                    onChange={onChange}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    placeholder={placeholder || ''}
                    autoFocus={autoFocus}
                    rows={rows}
                    style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        background: focused ? THEME.surface : THEME.surfaceHover,
                        border: `1.5px solid ${error ? THEME.danger : focused ? THEME.primary : THEME.glassBorder}`,
                        borderRadius: 10,
                        padding: rows ? '10px 14px' : `10px ${paddingRight || 14}px 10px 14px`,
                        color: THEME.textMain,
                        fontSize: 14,
                        outline: 'none',
                        transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
                        fontFamily: monospace ? FONT_MONO : FONT_UI,
                        lineHeight: 1.4,
                        boxShadow: focused ? `0 0 0 4px ${THEME.primary}1a` : 'none',
                        resize: rows ? ('vertical' as const) : undefined,
                    }}
                />
                {children}
            </div>
            {helper && !error && (
                <div style={{ color: THEME.textMuted, fontSize: 11, marginTop: 6, lineHeight: 1.5 }}>
                    {helper}
                </div>
            )}
            {error && (
                <div style={{ color: THEME.danger, fontSize: 11, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertCircle size={11} /> {error}
                </div>
            )}
        </div>
    );
};

// ─── DB Type Selector — compact card grid (no dropdown) ───────────────────────
const DBTypeSelector = ({ value, onChange }) => {
    return (
        <div>
            <div style={S.sectionHeading}>
                <Database size={12} /> Database Engine
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {Object.entries(DB_TYPES).map(([key, db]) => {
                    const selected = key === value;
                    return (
                        <button
                            key={key}
                            type="button"
                            onClick={() => onChange(key)}
                            style={{
                                position: 'relative',
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '12px 14px',
                                background: selected ? `${db.accent}14` : THEME.surfaceHover,
                                border: `1.5px solid ${selected ? db.accent : THEME.glassBorder}`,
                                borderRadius: 12,
                                cursor: 'pointer',
                                transition: 'all 0.18s',
                                fontFamily: FONT_UI,
                                textAlign: 'left' as const,
                                boxShadow: selected ? `0 0 0 3px ${db.accent}22` : 'none',
                            }}
                            onMouseEnter={e => { if (!selected) e.currentTarget.style.borderColor = THEME.textMuted; }}
                            onMouseLeave={e => { if (!selected) e.currentTarget.style.borderColor = THEME.glassBorder; }}
                        >
                            <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{db.icon}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: selected ? db.accent : THEME.textMain, lineHeight: 1.2 }}>
                                    {db.label}
                                </div>
                                <div style={{ fontSize: 10, color: THEME.textMuted, letterSpacing: '0.04em', marginTop: 2 }}>
                                    :{db.defaultPort || '—'}
                                </div>
                            </div>
                            {selected && (
                                <Check size={14} color={db.accent} strokeWidth={3} style={{ flexShrink: 0 }} />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

// ─── Dynamic Form Fields — grouped sections, floating labels ────────────────
const DynamicFields = ({ dbType, formData, setFormData, formErrors, showPassword, togglePasswordVisibility }) => {
    const fields = DB_TYPES[dbType].fields;
    const update = (k, v) => setFormData(p => ({ ...p, [k]: v }));

    // Partition fields into server / auth / extras / checkboxes
    const serverFields = fields.filter(f => ['host', 'port', 'database'].includes(f));
    const authFields   = fields.filter(f => ['username', 'password'].includes(f));
    const extraFields  = fields.filter(f => ['authSource', 'replicaSet'].includes(f));
    const checkFields  = fields.filter(f => FIELD_META[f]?.type === 'checkbox');

    const renderField = (f, extraProps: any = {}) => {
        const meta = FIELD_META[f];
        if (!meta) return null;
        if (meta.type === 'password') {
            return (
                <FloatingField
                    key={f}
                    label={meta.label}
                    type={showPassword ? 'text' : 'password'}
                    value={formData[f]}
                    onChange={e => update(f, e.target.value)}
                    placeholder={meta.placeholder}
                    error={formErrors[f]}
                    required={!meta.optional}
                    optional={meta.optional}
                    paddingRight={48}
                >
                    <button
                        type="button"
                        onClick={togglePasswordVisibility}
                        style={{
                            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                            background: 'none', border: 'none', color: THEME.textMuted, cursor: 'pointer',
                            padding: 6, borderRadius: 8, display: 'flex',
                        }}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                </FloatingField>
            );
        }
        return (
            <FloatingField
                key={f}
                label={meta.label}
                type={meta.type || 'text'}
                value={formData[f]}
                onChange={e => update(f, e.target.value)}
                placeholder={f === 'port' ? (DB_TYPES[dbType].defaultPort || '') : meta.placeholder}
                error={formErrors[f]}
                required={!meta.optional}
                optional={meta.optional}
                {...extraProps}
            />
        );
    };

    // Use margin-based vertical stacking (more robust than flex gap for this layout).
    const fieldRow  = { marginBottom: 10 };
    const lastField = { marginBottom: 0 };

    return (
        <div>
            {/* ── Server section ────────────────────────────────────────────── */}
            {serverFields.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                    <div style={S.sectionHeading}><Server size={12} /> Server</div>
                    {serverFields.includes('host') && serverFields.includes('port') && (
                        <div style={{ ...fieldRow, display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                            {renderField('host')}
                            {renderField('port')}
                        </div>
                    )}
                    {serverFields.includes('database') && (
                        <div style={lastField}>{renderField('database')}</div>
                    )}
                </div>
            )}

            {/* ── Auth section ──────────────────────────────────────────────── */}
            {authFields.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                    <div style={S.sectionHeading}><Key size={12} /> Authentication</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {authFields.map(f => renderField(f))}
                    </div>
                </div>
            )}

            {/* ── Extras (MongoDB authSource / replicaSet) ──────────────────── */}
            {extraFields.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                    <div style={S.sectionHeading}><Zap size={12} /> Options</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {extraFields.map(f => renderField(f))}
                    </div>
                </div>
            )}

            {/* ── Checkbox row (SSL, etc) ───────────────────────────────────── */}
            {checkFields.length > 0 && (
                <div>
                    <div style={S.sectionHeading}><ShieldCheck size={12} /> Security</div>
                    {checkFields.map((f, idx) => {
                        const meta = FIELD_META[f];
                        const on = !!formData[f];
                        return (
                            <label key={f} htmlFor={`chk-${f}`} style={{
                                display: 'flex', alignItems: 'center', gap: 12,
                                padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                                background: on ? `${THEME.primary}10` : 'transparent',
                                border: `1.5px solid ${on ? THEME.primary + '55' : THEME.glassBorder}`,
                                transition: 'all 0.15s',
                                fontFamily: FONT_UI,
                                marginBottom: idx < checkFields.length - 1 ? 10 : 0,
                            }}>
                                <input
                                    type="checkbox"
                                    id={`chk-${f}`}
                                    checked={on}
                                    onChange={e => update(f, e.target.checked)}
                                    style={{ cursor: 'pointer', accentColor: THEME.primary, width: 16, height: 16 }}
                                />
                                <span style={{ fontSize: 13, fontWeight: 600, color: on ? THEME.primary : THEME.textMain }}>
                                    {meta.label}
                                </span>
                                <span style={{
                                    marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: on ? THEME.primary : THEME.textMuted,
                                    letterSpacing: '0.08em', textTransform: 'uppercase',
                                }}>
                                    {on ? 'On' : 'Off'}
                                </span>
                            </label>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ─── SSH Tunnel Section ───────────────────────────────────────────────────────
const SSHTunnelSection = ({ formData, setFormData }) => {
    const [open, setOpen] = useState(!!formData.sshEnabled);
    const [showSshPass, setShowSshPass] = useState(false);
    const [showPassphrase, setShowPassphrase] = useState(false);

    const toggle = (enabled) => {
        setFormData(p => ({ ...p, sshEnabled: enabled }));
        setOpen(enabled);
    };
    const update = (k, v) => setFormData(p => ({ ...p, [k]: v }));

    return (
        <div style={{
            border: `1.5px solid ${formData.sshEnabled ? THEME.primary + '66' : THEME.glassBorder}`,
            borderRadius: 14,
            overflow: 'hidden',
            transition: 'border-color 0.2s',
            background: formData.sshEnabled ? `${THEME.primary}06` : 'transparent',
        }}>
            {/* Header toggle */}
            <button
                type="button"
                onClick={() => toggle(!formData.sshEnabled)}
                style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px', background: formData.sshEnabled ? `${THEME.primary}14` : THEME.surfaceHover,
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                    borderBottom: open ? `1px solid ${THEME.glassBorder}` : 'none',
                    transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = formData.sshEnabled ? `${THEME.primary}1f` : THEME.surface}
                onMouseLeave={e => e.currentTarget.style.background = formData.sshEnabled ? `${THEME.primary}14` : THEME.surfaceHover}
            >
                <Terminal size={15} color={formData.sshEnabled ? THEME.primary : THEME.textMuted} />
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: formData.sshEnabled ? THEME.primary : THEME.textMain }}>
                        SSH Tunnel
                    </div>
                    <div style={{ fontSize: 11, color: THEME.textMuted, marginTop: 1 }}>
                        {formData.sshEnabled
                            ? `Via ${formData.sshHost || 'bastion host'} · ${formData.sshAuthType === 'key' ? 'Private key' : 'Password'} auth`
                            : 'For databases in private subnets without public IP'}
                    </div>
                </div>
                {/* Toggle pill */}
                <div
                    style={{
                        width: 36, height: 20, borderRadius: 16, position: 'relative',
                        background: formData.sshEnabled ? THEME.primary : THEME.glassBorder,
                        transition: 'background 0.2s', flexShrink: 0,
                    }}
                >
                    <div style={{
                        position: 'absolute', top: 3, left: formData.sshEnabled ? 19 : 3,
                        width: 14, height: 14, borderRadius: '50%', background: '#fff',
                        transition: 'left 0.2s', boxShadow: THEME.shadowMd,
                    }} />
                </div>
                <ChevronRight size={14} color={THEME.textMuted}
                    style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', marginLeft: 2 }} />
            </button>

            {/* Expanded fields */}
            {open && (
                <div style={{ padding: '18px 16px 20px', display: 'flex', flexDirection: 'column', gap: 16, background: formData.sshEnabled ? THEME.surface : 'transparent' }}>

                    {/* Info banner */}
                    <div style={{
                        display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 12,
                        background: `${THEME.primary}10`, border: `1px solid ${THEME.primary}30`,
                        fontSize: 12, color: THEME.textDim, lineHeight: 1.55,
                    }}>
                        <Lock size={13} color={THEME.primary} style={{ flexShrink: 0, marginTop: 2 }} />
                        <span>
                            Traffic routes through your bastion via local port-forwarding.
                            The DB host above should be the <strong style={{ color: THEME.textMain }}>private</strong> address
                            reachable from the bastion (e.g. <code style={{ fontFamily: FONT_MONO, color: THEME.primary, fontSize: 11 }}>10.0.1.5</code>).
                        </span>
                    </div>

                    {/* Bastion host + port */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                        <FloatingField
                            label="Bastion Host"
                            value={formData.sshHost}
                            onChange={e => update('sshHost', e.target.value)}
                            placeholder="bastion.example.com"
                            error={!formData.sshHost && formData.sshEnabled ? 'Required' : ''}
                            required
                        />
                        <FloatingField
                            label="SSH Port"
                            type="number"
                            value={formData.sshPort}
                            onChange={e => update('sshPort', e.target.value)}
                            placeholder="22"
                        />
                    </div>

                    {/* SSH user */}
                    <FloatingField
                        label="SSH Username"
                        value={formData.sshUser}
                        onChange={e => update('sshUser', e.target.value)}
                        placeholder="ec2-user"
                        error={!formData.sshUser && formData.sshEnabled ? 'Required' : ''}
                        required
                    />

                    {/* Auth type segmented control */}
                    <div>
                        <div style={{ ...S.sectionHeading, marginBottom: 8 }}>Authentication</div>
                        <div style={{
                            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6,
                            padding: 4, borderRadius: 12, background: THEME.surfaceHover,
                            border: `1px solid ${THEME.glassBorder}`,
                        }}>
                            {[['key', 'Private Key', '🔑'], ['password', 'Password', '🔒']].map(([val, label, emoji]) => {
                                const active = formData.sshAuthType === val;
                                return (
                                    <button key={val} type="button"
                                        onClick={() => update('sshAuthType', val)}
                                        style={{
                                            padding: '10px 14px', borderRadius: 9, fontSize: 13, fontWeight: 600,
                                            cursor: 'pointer', transition: 'all 0.15s',
                                            background: active ? THEME.surface : 'transparent',
                                            border: 'none',
                                            color: active ? THEME.primary : THEME.textMuted,
                                            boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                                            fontFamily: FONT_UI,
                                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                        }}
                                    >
                                        <span>{emoji}</span>{label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Private Key fields */}
                    {formData.sshAuthType === 'key' && (<>
                        <FloatingField
                            label="Private Key (PEM)"
                            rows={5}
                            monospace
                            value={formData.sshPrivateKey}
                            onChange={e => update('sshPrivateKey', e.target.value)}
                            placeholder={'-----BEGIN OPENSSH PRIVATE KEY-----\n...\n-----END OPENSSH PRIVATE KEY-----'}
                            error={!formData.sshPrivateKey && formData.sshEnabled ? 'Required' : ''}
                            required
                        />
                        <div style={{ fontSize: 11, color: THEME.textMuted, marginTop: -8, marginLeft: 4 }}>
                            Paste the contents of your <code style={{ fontFamily: FONT_MONO }}>~/.ssh/id_rsa</code> or <code style={{ fontFamily: FONT_MONO }}>id_ed25519</code>.
                        </div>
                        <FloatingField
                            label="Key Passphrase"
                            type={showPassphrase ? 'text' : 'password'}
                            value={formData.sshPassphrase}
                            onChange={e => update('sshPassphrase', e.target.value)}
                            placeholder="Leave blank if key has no passphrase"
                            optional
                            paddingRight={48}
                        >
                            <button type="button" onClick={() => setShowPassphrase(p => !p)}
                                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: THEME.textMuted, cursor: 'pointer', padding: 6, borderRadius: 8, display: 'flex' }}>
                                {showPassphrase ? <EyeOff size={16}/> : <Eye size={16}/>}
                            </button>
                        </FloatingField>
                    </>)}

                    {/* Password auth field */}
                    {formData.sshAuthType === 'password' && (
                        <FloatingField
                            label="SSH Password"
                            type={showSshPass ? 'text' : 'password'}
                            value={formData.sshPassword}
                            onChange={e => update('sshPassword', e.target.value)}
                            placeholder="••••••••"
                            error={!formData.sshPassword && formData.sshEnabled ? 'Required' : ''}
                            required
                            paddingRight={48}
                        >
                            <button type="button" onClick={() => setShowSshPass(p => !p)}
                                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: THEME.textMuted, cursor: 'pointer', padding: 6, borderRadius: 8, display: 'flex' }}>
                                {showSshPass ? <EyeOff size={16}/> : <Eye size={16}/>}
                            </button>
                        </FloatingField>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────
/* ── ★ Connection Leak Detector ───────────────────────────────────────────────
   Shows pg_stat_activity entries that have been idle for an abnormally long
   time — strong indicator of a connection leak in application code.
   ─────────────────────────────────────────────────────────────────────────── */
const LeakDetector = () => {
    useAdaptiveTheme();
    const [suspects, setSuspects] = useState([]);
    const [threshold, setThreshold] = useState(30); // minutes
    const [loading, setLoading]  = useState(false);
    const [expanded, setExpanded] = useState(false);

    const scan = async () => {
        setLoading(true);
        try {
            const token   = localStorage.getItem('pulsedb_token') || localStorage.getItem('authToken');
            const res     = await fetch(`${API_BASE}/api/reliability/active-connections`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const rows = await res.json();
                // Filter connections idle longer than threshold
                const leaky = (rows || []).filter(r =>
                    (r.state === 'idle' || r.state === 'idle in transaction') &&
                    r.duration_sec > threshold * 60
                );
                setSuspects(leaky);
            }
        } catch {
            // Use sample data when endpoint unavailable
            setSuspects([]);
        } finally {
            setLoading(false);
        }
    };

    const fmtDur = (sec) => {
        if (sec >= 3600) return `${(sec / 3600).toFixed(1)}h`;
        if (sec >= 60)   return `${Math.floor(sec / 60)}m`;
        return `${sec}s`;
    };

    return (
        <div style={{ marginTop: 24, background: THEME.surface, border: `1px solid ${THEME.glassBorder}`, borderRadius: 20, overflow: 'hidden' }}>
            {/* Header / toggle */}
            <div
                onClick={() => { setExpanded(e => !e); if (!expanded) scan(); }}
                style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '14px 20px', cursor: 'pointer',
                    background: suspects.length > 0 ? `rgba(239,68,68,0.07)` : 'transparent',
                    borderBottom: expanded ? `1px solid ${THEME.glassBorder}` : 'none' }}
            >
                <span style={{ fontSize: 18 }}>🔍</span>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: THEME.textMain }}>Connection Leak Detector</div>
                    <div style={{ fontSize: 11, color: THEME.textMuted, marginTop: 2 }}>
                        Idle connections exceeding threshold — potential application leaks
                    </div>
                </div>
                {suspects.length > 0 && (
                    <span style={{ padding: '3px 10px', borderRadius: 16, fontSize: 12, fontWeight: 700,
                        background: 'rgba(239,68,68,0.15)', color: THEME.danger, border: '1px solid rgba(239,68,68,0.3)' }}>
                        {suspects.length} suspect{suspects.length !== 1 ? 's' : ''}
                    </span>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <label style={{ fontSize: 11, color: THEME.textDim, whiteSpace: 'nowrap' }}>Threshold:</label>
                    <select value={threshold} onChange={e => { setThreshold(Number(e.target.value)); e.stopPropagation(); }}
                        onClick={e => e.stopPropagation()}
                        style={{ fontSize: 12, padding: '3px 8px', borderRadius: 16, border: `1px solid ${THEME.glassBorder}`,
                            background: THEME.bg, color: THEME.textMain, cursor: 'pointer' }}>
                        {[5, 15, 30, 60, 120].map(m => <option key={m} value={m}>{m} min</option>)}
                    </select>
                    <button onClick={e => { e.stopPropagation(); scan(); }}
                        style={{ padding: '4px 10px', borderRadius: 16, border: `1px solid ${THEME.glassBorder}`,
                            background: 'transparent', color: THEME.textDim, cursor: 'pointer', fontSize: 12 }}>
                        {loading ? '⟳' : '↻ Scan'}
                    </button>
                    <span style={{ color: THEME.textDim, fontSize: 14 }}>{expanded ? '▲' : '▼'}</span>
                </div>
            </div>

            {expanded && (
                <div style={{ padding: '0 0 4px' }}>
                    {suspects.length === 0 ? (
                        <div style={{ padding: '20px 24px', textAlign: 'center', color: THEME.textMuted, fontSize: 13 }}>
                            {loading ? '🔄 Scanning...' : `✅ No idle connections exceeding ${threshold} minutes`}
                        </div>
                    ) : (
                        <>
                            {/* Column headers */}
                            <div style={{ display: 'grid', gridTemplateColumns: '60px 120px 100px 90px 1fr 140px', gap: 18,
                                padding: '10px 20px', fontSize: 11, color: THEME.textDim, fontWeight: 700,
                                 letterSpacing: .7, borderBottom: `1px solid ${THEME.glassBorder}22` }}>
                                <span>PID</span><span>User</span><span>State</span><span>Idle For</span><span>Last Query</span><span>Application</span>
                            </div>
                            {suspects.map((s, i) => (
                                <div key={i} style={{ display: 'grid', gridTemplateColumns: '60px 120px 100px 90px 1fr 140px', gap: 18,
                                    padding: '10px 20px', alignItems: 'center', fontSize: 12,
                                    borderBottom: `1px solid ${THEME.glassBorder}11`,
                                    background: s.state === 'idle in transaction' ? 'rgba(239,68,68,0.04)' : 'transparent' }}>
                                    <span style={{ color: THEME.textMuted, fontFamily: THEME.fontMono }}>{s.pid}</span>
                                    <span style={{ color: THEME.textMain, fontWeight: 600 }}>{s.usename}</span>
                                    <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                                        background: s.state === 'idle in transaction' ? 'rgba(239,68,68,0.15)' : 'rgba(249,115,22,0.12)',
                                        color: s.state === 'idle in transaction' ? THEME.danger : THEME.warning }}>
                                        {s.state}
                                    </span>
                                    <span style={{ color: THEME.danger, fontWeight: 700, fontFamily: THEME.fontMono }}>{fmtDur(s.duration_sec)}</span>
                                    <span style={{ color: THEME.textDim, fontFamily: THEME.fontMono, fontSize: 11,
                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {s.query?.slice(0, 60) || '—'}
                                    </span>
                                    <span style={{ color: THEME.textMuted, fontSize: 11 }}>{s.application_name || '—'}</span>
                                </div>
                            ))}
                            <div style={{ padding: '12px 20px', fontSize: 11, color: THEME.textDim, borderTop: `1px solid ${THEME.glassBorder}22` }}>
                                💡 Tip: <code style={{ background: THEME.bg, padding: '2px 6px', borderRadius: 20 }}>SELECT pg_terminate_backend(pid)</code> to terminate a leaked connection
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

const ConnectionsTab = () => {
    useAdaptiveTheme();

    // Hydrate from localStorage cache immediately to avoid "No Connections" flash
    const readCached = () => {
        try {
            const raw = localStorage.getItem('pulsedb_cached_connections');
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch { return []; }
    };

    const [connections, setConnections] = useState(readCached);
    // If we have cached data, don't show loading spinner — show cached data while refreshing
    const [connectionsLoading, setConnectionsLoading] = useState(() => readCached().length === 0);
    const [refreshing, setRefreshing] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingConnection, setEditingConnection] = useState(null);
    const [testingConnection, setTestingConnection] = useState(null);
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState(defaultFormData());
    const [formErrors, setFormErrors] = useState({});
    const [errorMsg, setErrorMsg] = useState('');
    const [switchingId, setSwitchingId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Connection context — keeps the header dropdown in sync
    const { refreshConnections: refreshCtxConnections, activeConnectionId, switchConnection } = useConnection();

    const getAuthToken = () => localStorage.getItem('pulsedb_token') || localStorage.getItem('authToken');

    const fetchConnections = useCallback(async () => {
        // If we already have cached connections, show a subtle refresh indicator instead of full loading
        if (connections.length > 0) {
            setRefreshing(true);
        }
        try {
            const res = await fetch(`${API_BASE}/api/connections`, {
                headers: { Authorization: `Bearer ${getAuthToken()}` },
            });
            if (res.ok) {
                const data = await res.json();
                const list = Array.isArray(data) ? data : [];
                setConnections(list);
                // Also update the shared localStorage cache
                try { localStorage.setItem('pulsedb_cached_connections', JSON.stringify(list)); } catch {}
            } else {
                console.error('Failed to fetch connections:', res.status, res.statusText);
            }
        } catch (e) {
            console.error('Network error fetching connections:', e.message);
        } finally {
            setConnectionsLoading(false);
            setRefreshing(false);
        }
    }, [connections.length]);

    useEffect(() => { fetchConnections(); }, [fetchConnections]);

    useGlobalRefresh(fetchConnections);

    const validateForm = () => {
        const errors = {};
        const dbMeta = DB_TYPES[formData.dbType];
        const fields = dbMeta.fields.filter(f => FIELD_META[f].type !== 'checkbox');

        if (!formData.name.trim()) errors.name = 'Name is required';

        fields.forEach(f => {
            const meta = FIELD_META[f];
            if (meta.optional || meta.type === 'checkbox') return;
            if (f === 'password' && editingConnection) return;
            const val = formData[f];
            if (!val || (typeof val === 'string' && !val.trim())) {
                errors[f] = `${meta.label} is required`;
            }
        });

        if (formData.port) {
            const p = parseInt(formData.port);
            if (isNaN(p) || p < 1 || p > 65535) errors.port = 'Port must be 1–65535';
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const saveConnection = async () => {
        if (!validateForm()) return;
        setErrorMsg('');
        setSaving(true);
        try {
            // Encrypt sensitive fields (password, SSH keys) client-side before transit
            const token = getAuthToken();
            const encryptedData = await encryptConnectionFields(API_BASE, token, formData);

            const url = editingConnection
                ? `${API_BASE}/api/connections/${editingConnection.id}`
                : `${API_BASE}/api/connections`;
            const res = await fetch(url, {
                method: editingConnection ? 'PUT' : 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(encryptedData),
            });
            if (res.ok) {
                const result = await res.json();
                await fetchConnections();
                refreshCtxConnections();

                // Show auto-test result if available (new connections)
                if (result.testResult) {
                    if (result.testResult.success) {
                        setSaveSuccess(`Connection "${formData.name}" saved & verified successfully`);
                    } else {
                        setSaveSuccess(`Connection "${formData.name}" saved, but test failed: ${result.testResult.error}`);
                    }
                }
                closeModal();
            } else {
                const text = await res.text();
                let msg = `Server error (${res.status})`;
                try {
                    const json = JSON.parse(text);
                    msg = json.error || json.message || msg;
                } catch { /* empty */ }
                setErrorMsg(msg);
            }
        } catch (e) {
            setErrorMsg(`Network error: ${e.message}`);
        } finally {
            setSaving(false);
        }
    };

    // Allow deleting default connections — auto-promote next connection
    const deleteConnection = async (id) => {
        if (!confirm('Delete this connection?')) return;
        try {
            const wasDefault = connections.find(c => c.id === id)?.isDefault;
            const remaining = connections.filter(c => c.id !== id);

            const res = await fetch(`${API_BASE}/api/connections/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${getAuthToken()}` },
            });

            if (res.ok) {
                // If deleted connection was default and others exist, promote first remaining
                if (wasDefault && remaining.length > 0) {
                    await fetch(`${API_BASE}/api/connections/${remaining[0].id}/default`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${getAuthToken()}` },
                    });
                }
                fetchConnections();
                refreshCtxConnections(); // keep header dropdown in sync
            } else {
                const text = await res.text();
                let msg = 'Failed to delete';
                try { msg = JSON.parse(text).error || msg; } catch { /* empty */ }
                alert(msg);
            }
        } catch (e) {
            alert(`Network error: ${e.message}`);
        }
    };

    const testConnection = async (conn) => {
        setTestingConnection(conn.id);
        try {
            const res = await fetch(`${API_BASE}/api/connections/${conn.id}/test`, {
                method: 'POST', headers: { Authorization: `Bearer ${getAuthToken()}` },
            });
            const text = await res.text();
            let r = {};
            try { r = JSON.parse(text); } catch { /* empty */ }
            alert(r.success ? '✅ Connection successful!' : `❌ Failed: ${r.error || text || res.statusText}`);
        } catch (e) {
            alert(`Network error: ${e.message}`);
        } finally {
            setTestingConnection(null);
        }
    };

    const setDefaultConnection = async (id) => {
        try {
            const res = await fetch(`${API_BASE}/api/connections/${id}/default`, {
                method: 'POST', headers: { Authorization: `Bearer ${getAuthToken()}` },
            });
            if (res.ok) fetchConnections();
        } catch (e) { console.error(e); }
    };

    const openNew = (dbType = null) => {
        setEditingConnection(null);
        setFormData(defaultFormData(dbType || 'postgresql'));
        setFormErrors({});
        setErrorMsg('');
        setShowPassword(false);
        setShowModal(true);
    };

    const openEdit = (conn) => {
        setEditingConnection(conn);
        setFormData({ ...defaultFormData(conn.dbType || 'postgresql'), ...conn, password: '' });
        setFormErrors({});
        setErrorMsg('');
        setShowPassword(false);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingConnection(null);
        setFormData(defaultFormData());
        setFormErrors({});
        setErrorMsg('');
    };

    const handleDbTypeChange = (type) => {
        setFormData(prev => ({
            ...defaultFormData(type),
            name: prev.name,
        }));
        setFormErrors({});
        setErrorMsg('');
    };

    // Auto-dismiss success toast
    useEffect(() => {
        if (!saveSuccess) return;
        const t = setTimeout(() => setSaveSuccess(''), 6000);
        return () => clearTimeout(t);
    }, [saveSuccess]);

    // Listen for "open new connection" event from header + button
    useEffect(() => {
        const handler = () => openNew();
        window.addEventListener('pulsedb:open-new-connection', handler);
        return () => window.removeEventListener('pulsedb:open-new-connection', handler);
    }, []);

    // Filter connections based on search
    const filteredConnections = connections.filter(conn =>
        conn.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conn.host?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conn.database?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Count by type — dynamic so Phase-5 engines are counted too, not only
    // the classic three. Each engine gets its own badge in the fleet tile.
    const TYPE_BADGE = {
        postgresql:    { label: 'PostgreSQL',    color: THEME.primary },
        mysql:         { label: 'MySQL',         color: THEME.warning },
        mongodb:       { label: 'MongoDB',       color: '#00ed64' },
        mssql:         { label: 'SQL Server',    color: '#CC2927' },
        oracle:        { label: 'Oracle',        color: '#F80000' },
        redis:         { label: 'Redis',         color: '#DC382D' },
        elasticsearch: { label: 'Elasticsearch', color: '#00BFB3' },
        snowflake:     { label: 'Snowflake',     color: '#29B5E8' },
        bigquery:      { label: 'BigQuery',      color: THEME.primary },
        redshift:      { label: 'Redshift',      color: '#FF9900' },
        cassandra:     { label: 'Cassandra',     color: '#1287B1' },
        dynamodb:      { label: 'DynamoDB',      color: '#4053D6' },
    };
    const typeStats = connections.reduce((acc, c) => {
        const key = (c.dbType || 'postgresql').toLowerCase();
        const mapped = TYPE_BADGE[key]
            ? key
            : key.includes('maria') ? 'mysql'
            : key.includes('postgres') ? 'postgresql'
            : key;
        acc[mapped] = (acc[mapped] || 0) + 1;
        return acc;
    }, {});

    const isEmpty = connections.length === 0 && !connectionsLoading && !refreshing;

    return (
        <div style={{ ...S.root, padding: isEmpty ? '0' : '32px 28px', minHeight: isEmpty ? 0 : '100vh' }}>
            {/* ── Keyframes ── */}
            <style>{`
                @keyframes cpPulse { 0%,100%{opacity:.6;transform:scale(1)} 50%{opacity:1;transform:scale(1.05)} }
                @keyframes cpFadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
                .cp-pipe-card::before { content:''; position:absolute; top:0; right:0; width:40%; height:100%; background:repeating-linear-gradient(-45deg, transparent, transparent 8px, ${THEME.glassBorder}15 8px, ${THEME.glassBorder}15 9px); pointer-events:none; }
                .cp-pipe-card:hover { border-left-width: 6px; box-shadow: 0 12px 40px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.08); transform: translateY(-4px); }
            `}</style>

            {/* ── Success / Error Toast ── */}
            {saveSuccess && (
                <div style={{
                    position: 'fixed', top: 20, right: 20, zIndex: 600,
                    padding: '12px 18px', borderRadius: 18, maxWidth: 420,
                    background: saveSuccess.includes('failed') ? `${THEME.danger}12` : `${THEME.success}12`,
                    border: `1px solid ${saveSuccess.includes('failed') ? THEME.danger : THEME.success}30`,
                    boxShadow: THEME.shadowLg,
                    display: 'flex', alignItems: 'center', gap: 22,
                    animation: 'fadeUp .3s ease', cursor: 'pointer',
                }} onClick={() => setSaveSuccess('')}>
                    {saveSuccess.includes('failed')
                        ? <AlertCircle size={16} color={THEME.danger} />
                        : <ShieldCheck size={16} color={THEME.success} />}
                    <span style={{ fontSize: 13, fontWeight: 600, color: THEME.textMain }}>{saveSuccess}</span>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════
               EMPTY STATE — Centered compact layout, no scroll
            ═══════════════════════════════════════════════════════════════ */}
            {isEmpty && (
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    height: 'calc(100vh - 114px)', overflow: 'hidden',
                    background: THEME.bg, position: 'relative',
                }}>
                    {/* Subtle radial glow behind center */}
                    <div style={{
                        position: 'absolute', top: '45%', left: '50%', transform: 'translate(-50%,-50%)',
                        width: 400, height: 400, borderRadius: '50%',
                        background: `radial-gradient(circle, ${THEME.primary}0a 0%, transparent 70%)`,
                        pointerEvents: 'none',
                    }} />

                    <div style={{
                        position: 'relative', zIndex: 1, textAlign: 'center',
                        // Widen the empty-state panel so a 4-column grid of
                        // 12 engines fits comfortably without horizontal
                        // overflow. Previous flex-row layout assumed only 3
                        // engines and broke the page once Phase-5 engines
                        // were added.
                        maxWidth: 720, width: '100%', padding: '0 20px',
                        animation: 'cpFadeIn 0.5s ease-out',
                    }}>
                        {/* Icon */}
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 56, height: 56, borderRadius: 16,
                            background: `${THEME.primary}15`,
                            border: `1px solid ${THEME.primary}25`,
                            marginBottom: 16,
                        }}>
                            <Database size={26} color={THEME.primary} strokeWidth={1.5} />
                        </div>

                        <h2 style={{
                            fontSize: 20, fontWeight: 700, color: THEME.textMain,
                            margin: '0 0 6px', letterSpacing: '-0.02em',
                        }}>
                            No connections yet
                        </h2>
                        <p style={{
                            fontSize: 12, color: THEME.textMuted, margin: '0 0 20px', lineHeight: 1.5,
                        }}>
                            Add a database to start monitoring queries and performance.
                        </p>

                        {/* Quick-add DB type grid — compact tiles (icon + label stacked),
                            6 per row on desktop (2 rows for the 12 engines), wrapping to
                            fewer columns on narrow screens. */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))',
                            gap: 10,
                            marginBottom: 20,
                        }}>
                            {Object.entries(DB_TYPES).map(([key, db]) => (
                                <button
                                    key={key}
                                    onClick={() => { openNew(); handleDbTypeChange(key); }}
                                    style={{
                                        display: 'flex', flexDirection: 'column',
                                        alignItems: 'center', justifyContent: 'center', gap: 5,
                                        padding: '10px 6px', borderRadius: 12, cursor: 'pointer',
                                        background: THEME.surface, border: `1px solid ${THEME.glassBorder}`,
                                        color: THEME.textMain, fontSize: 11.5, fontWeight: 600,
                                        transition: 'all 0.2s', fontFamily: FONT_UI,
                                        minHeight: 62,
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.borderColor = db.accent + '66';
                                        e.currentTarget.style.background = `${db.accent}0c`;
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = `0 4px 16px ${db.accent}15`;
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.borderColor = THEME.glassBorder;
                                        e.currentTarget.style.background = THEME.surface;
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
                                >
                                    <span style={{ fontSize: 18, lineHeight: 1 }}>{db.icon}</span>
                                    <span style={{ lineHeight: 1.2, textAlign: 'center' }}>{db.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* Or divider + generic button */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 18,
                            margin: '0 auto 20px', maxWidth: 280,
                        }}>
                            <div style={{ flex: 1, height: 1, background: THEME.glassBorder }} />
                            <span style={{ fontSize: 10, color: THEME.textMuted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em' }}>or</span>
                            <div style={{ flex: 1, height: 1, background: THEME.glassBorder }} />
                        </div>

                        {/* Primary actions side by side (wrap on narrow screens) */}
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <button
                            onClick={() => openNew()}
                            style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                                minWidth: 230, padding: '9px 22px', borderRadius: 16, border: 'none',
                                background: THEME.primary, color: '#fff',
                                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                transition: 'all 0.2s', fontFamily: FONT_UI,
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.transform = 'translateY(-1px)';
                                e.currentTarget.style.boxShadow = `0 4px 16px ${THEME.primary}40`;
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                        >
                            <Plus size={14} strokeWidth={2.5} />
                            Add Connection Manually
                        </button>

                        {/* SQL Server on a PC/LAN the server cannot reach: PulseDB Agent package */}
                        <ConnectAnotherPcButton
                            style={{
                                // Same box as "Add Connection Manually": outline drawn inset
                                // (no border) so both buttons are the same height.
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                                minWidth: 230, padding: '9px 22px', borderRadius: 16, cursor: 'pointer',
                                background: THEME.success + '1F', border: 'none',
                                boxShadow: `inset 0 0 0 1px ${THEME.success}55`,
                                color: THEME.success, fontSize: 12, fontWeight: 600, fontFamily: FONT_UI,
                            }}
                        />
                        </div>
                        <div style={{ marginTop: 10, fontSize: 11, color: THEME.textMuted }}>
                            SQL Server on your PC or office network? Use “Connect another PC” and run setup.cmd there.{' '}
                            <AgentGuideLink />
                        </div>

                        {/* Feature tags */}
                        <div style={{
                            display: 'flex', gap: 20, justifyContent: 'center', marginTop: 24,
                        }}>
                            {[
                                { icon: <Lock size={10} />, text: 'Encrypted' },
                                { icon: <Terminal size={10} />, text: 'SSH Tunnel' },
                                { icon: <ShieldCheck size={10} />, text: 'SSL' },
                                { icon: <Zap size={10} />, text: 'Real-time' },
                            ].map((t, i) => (
                                <span key={i} style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                    fontSize: 10, color: THEME.textMuted, fontWeight: 500,
                                }}>
                                    {t.icon} {t.text}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════
               HAS CONNECTIONS — Standard list view
            ═══════════════════════════════════════════════════════════════ */}
            {!isEmpty && (
                <>
                    {/* ── Header ── */}
                    <div style={{ marginBottom: 32 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                            <div>
                                <h2 style={{ fontSize: 26, fontWeight: 800, color: THEME.textMain, margin: 0, letterSpacing: '-0.02em' }}>
                                    Database Connections
                                </h2>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 8, flexWrap: 'wrap' }}>
                                    <p style={{ fontSize: 13, color: THEME.textMuted, margin: 0, fontWeight: 500 }}>
                                        {connections.length} connection{connections.length !== 1 ? 's' : ''} · Encrypted at rest
                                    </p>
                                    {connections.length > 0 && (
                                        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                                            {Object.entries(typeStats).map(([key, count]) => {
                                                const badge = TYPE_BADGE[key] || { label: key, color: THEME.textDim };
                                                return (count as number) > 0 ? (
                                                    <span key={key} style={{ ...S.badge(badge.color), fontSize: 10 }}>
                                                        {count as number} {badge.label}
                                                    </span>
                                                ) : null;
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 22, alignItems: 'center' }}>
                                {/* Guide link hangs below the button without changing the row's alignment */}
                                <div style={{ position: 'relative' }}>
                                    <ConnectAnotherPcButton style={S.btn(THEME.success + '1F', THEME.success + '55', THEME.success)} />
                                    <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, textAlign: 'center' }}>
                                        <AgentGuideLink />
                                    </div>
                                </div>
                                <button onClick={() => openNew()}
                                    style={S.btn(THEME.primary + '2E', THEME.primary + '66', THEME.primary)}
                                    onMouseEnter={e => e.currentTarget.style.background = THEME.primary + '4D'}
                                    onMouseLeave={e => e.currentTarget.style.background = THEME.primary + '2E'}>
                                    <Plus size={16} /> New Connection
                                </button>
                            </div>
                        </div>

                        {/* Search bar */}
                        {connections.length > 0 && (
                            <div style={{ position: 'relative' }}>
                                <Search size={14} style={{
                                    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                                    color: THEME.textMuted, pointerEvents: 'none',
                                }} />
                                <input type="text" placeholder="Search by name, host, database..."
                                    value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                    style={{
                                        width: '100%', boxSizing: 'border-box',
                                        paddingLeft: 36, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
                                        background: THEME.surfaceHover, border: `1px solid ${THEME.glassBorder}`,
                                        borderRadius: 20, color: THEME.textMain, fontSize: 13,
                                        outline: 'none', transition: 'border-color 0.2s',
                                    }}
                                    onFocus={e => e.currentTarget.style.borderColor = THEME.primary}
                                    onBlur={e => e.currentTarget.style.borderColor = THEME.glassBorder}
                                />
                            </div>
                        )}
                    </div>

                    {/* Loading */}
                    {connectionsLoading && connections.length === 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20, marginBottom: 20 }}>
                            {[0, 1, 2].map(i => (
                                <div key={i} style={{
                                    height: 200, borderRadius: 16, background: THEME.surface,
                                    border: `1px solid ${THEME.glassBorder}`, opacity: 0.4,
                                    animation: `fadeUp 0.3s ease-out, pulse 1.5s ease-in-out infinite`,
                                    animationDelay: `${i * 0.1}s`,
                                }} />
                            ))}
                        </div>
                    )}

                    {/* Cards Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
                        {filteredConnections.map((conn, idx) => {
                            const dbMeta = DB_TYPES[conn.dbType] || DB_TYPES.postgresql;
                            const isActive = conn.id === activeConnectionId;
                            return (
                                <div key={conn.id} className="cp-pipe-card" style={{
                                    ...S.card(dbMeta.accent),
                                    animation: `slideUp 0.4s ease-out ${idx * 0.05}s backwards`,
                                    border: isActive ? `2px solid ${dbMeta.accent}66` : `none`,
                                    borderLeft: `${isActive ? 6 : 4}px solid ${dbMeta.accent}`,
                                    background: isActive ? `${dbMeta.accent}08` : THEME.surface,
                                }}>
                                    <div style={{ position: 'absolute', top: -40, left: -40, width: 120, height: 120, borderRadius: '50%', background: `${dbMeta.accent}12`, pointerEvents: 'none', animation: isActive ? 'pulse 2s ease-in-out infinite' : 'none' }} />
                                    {isActive && <div style={{ position: 'absolute', top: 14, right: 14, width: 10, height: 10, borderRadius: '50%', background: dbMeta.accent, animation: 'pulse 1s ease-in-out infinite' }} />}

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, position: 'relative', zIndex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
                                            <span style={{ fontSize: 28 }}>{dbMeta.icon}</span>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                                                    <span style={{ fontSize: 15, fontWeight: 700, color: THEME.textMain }}>{conn.name}</span>
                                                    {conn.isDefault && <span style={S.badge(THEME.success)}>DEFAULT</span>}
                                                    {isActive && <span style={S.badge(dbMeta.accent)}>ACTIVE</span>}
                                                    {conn.sshEnabled && <span style={{ ...S.badge(THEME.primary), display: 'inline-flex', alignItems: 'center', gap: 4 }}><Terminal size={10} /> SSH</span>}
                                                    {conn.agentAppId && <span style={S.badge(THEME.primary)} title="Served by a PulseDB Agent running next to this database">VIA AGENT</span>}
                                                </div>
                                                <div style={{ fontSize: 12, color: THEME.textMuted, marginTop: 4 }}>
                                                    <span style={{ color: dbMeta.accent, fontWeight: 600 }}>{dbMeta.label}</span>
                                                    {conn.host && ` · ${conn.host}${conn.port ? `:${conn.port}` : ''}`}
                                                    {conn.agentAppId && ' (as seen by the agent)'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ background: THEME.surfaceHover, borderRadius: 18, padding: '18px 22px', marginBottom: 14, fontSize: 11, position: 'relative', zIndex: 1 }}>
                                        {conn.database && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span style={{ color: THEME.textMuted }}>database</span><span style={{ color: THEME.textDim, fontWeight: 500 }}>{conn.database}</span></div>}
                                        {conn.username && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span style={{ color: THEME.textMuted }}>user</span><span style={{ color: THEME.textDim, fontWeight: 500 }}>{conn.username}</span></div>}
                                        {conn.replicaSet && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span style={{ color: THEME.textMuted }}>replica set</span><span style={{ color: THEME.textDim, fontWeight: 500 }}>{conn.replicaSet}</span></div>}
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: THEME.textMuted }}>ssl</span><span style={{ color: conn.ssl ? THEME.success : THEME.textDim, fontWeight: 500 }}>{conn.ssl ? 'enabled' : 'disabled'}</span></div>
                                        {conn.sshEnabled && conn.sshHost && <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, paddingTop: 4, borderTop: `1px solid ${THEME.glassBorder}` }}><span style={{ color: THEME.textMuted }}>tunnel via</span><span style={{ color: THEME.primary, fontWeight: 500 }}>{conn.sshUser ? `${conn.sshUser}@` : ''}{conn.sshHost}:{conn.sshPort || 22}</span></div>}
                                    </div>

                                    {conn.lastTested && (
                                        <div style={{
                                            display: 'flex', alignItems: 'center', gap: 6, padding: '22px 28px', borderRadius: 18, marginBottom: 14,
                                            background: conn.status === 'success' ? 'rgba(74,222,128,0.08)' : 'rgba(239,68,68,0.08)',
                                            border: `1px solid ${conn.status === 'success' ? 'rgba(74,222,128,0.2)' : 'rgba(239,68,68,0.2)'}`,
                                            position: 'relative', zIndex: 1,
                                        }}>
                                            {conn.status === 'success' ? <CheckCircle size={13} color={THEME.success} /> : <AlertCircle size={13} color={THEME.danger} />}
                                            <span style={{ fontSize: 11, color: conn.status === 'success' ? THEME.success : THEME.danger, fontWeight: 600 }}>
                                                {conn.status === 'success' ? 'Test passed' : 'Test failed'}
                                            </span>
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', gap: 20, position: 'relative', zIndex: 1 }}>
                                        <button onClick={() => testConnection(conn)} disabled={testingConnection === conn.id} title="Test connection"
                                            style={{ ...S.btn('rgba(99,102,241,0.12)', 'rgba(99,102,241,0.25)', THEME.primary), flex: 1, justifyContent: 'center', opacity: testingConnection === conn.id ? 0.6 : 1 }}
                                            onMouseEnter={e => testingConnection !== conn.id && (e.currentTarget.style.background = 'rgba(99,102,241,0.22)')}
                                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(99,102,241,0.12)'}>
                                            {testingConnection === conn.id ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <><Zap size={12} /> Test</>}
                                        </button>
                                        {!conn.isDefault && (
                                            <button onClick={() => setDefaultConnection(conn.id)} title="Set as default"
                                                style={S.btn('rgba(74,222,128,0.1)', 'rgba(74,222,128,0.25)', THEME.success)}
                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(74,222,128,0.2)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(74,222,128,0.1)'}>
                                                <Check size={12} />
                                            </button>
                                        )}
                                        <button onClick={async () => { if (conn.id === activeConnectionId) return; setSwitchingId(conn.id); try { await switchConnection(conn.id); await fetchConnections(); } catch (e) { alert('Switch failed: ' + e.message); } finally { setSwitchingId(null); } }}
                                            disabled={conn.id === activeConnectionId || switchingId === conn.id}
                                            title={conn.id === activeConnectionId ? 'Currently active' : 'Switch dashboards to this DB'}
                                            style={{ ...S.btn(isActive ? 'rgba(139,92,246,0.18)' : 'rgba(139,92,246,0.08)', 'rgba(139,92,246,0.3)', THEME.ai), opacity: isActive ? 0.7 : 1, cursor: isActive ? 'default' : 'pointer' }}>
                                            {switchingId === conn.id ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : isActive ? <CheckCircle size={12} /> : <LinkIcon size={12} />}
                                        </button>
                                        <button onClick={() => openEdit(conn)} title="Edit connection"
                                            style={S.btn('rgba(251,191,36,0.1)', 'rgba(251,191,36,0.3)', THEME.warning)}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(251,191,36,0.22)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(251,191,36,0.1)'}><Edit size={12} /></button>
                                        <button onClick={() => deleteConnection(conn.id)} title="Delete connection"
                                            style={{ ...S.btn('rgba(239,68,68,0.1)', 'rgba(239,68,68,0.25)', THEME.danger), cursor: 'pointer' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.22)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}><Trash2 size={12} /></button>
                                    </div>
                                </div>
                            );
                        })}

                        {connections.length > 0 && filteredConnections.length === 0 && (
                            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px 20px', background: THEME.surface, border: `1px dashed ${THEME.glassBorder}`, borderRadius: 20 }}>
                                <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
                                <h3 style={{ fontSize: 16, fontWeight: 700, color: THEME.textMain, marginBottom: 6 }}>No matching connections</h3>
                                <p style={{ fontSize: 12, color: THEME.textMuted }}>Try adjusting your search query</p>
                            </div>
                        )}
                    </div>

                    {/* Connection Leak Detector */}
                    <LeakDetector />
                </>
            )}

            {/* ── Modal ── */}
            {showModal && (
                <>
                    {/* Full-screen backdrop — fully opaque */}
                    <div onClick={closeModal} style={{
                        position: 'fixed', inset: 0,
                        background: THEME.bg,
                        zIndex: 999,
                    }} />

                    {/* Modal container */}
                    <div style={{
                        position: 'fixed', top: '50%', left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '94%', maxWidth: 640, maxHeight: '90vh',
                        display: 'flex', flexDirection: 'column',
                        background: THEME.surface,
                        border: `1px solid ${THEME.glassBorder}`,
                        borderRadius: 20,
                        boxShadow: `0 0 0 1px ${DB_TYPES[formData.dbType].accent}18, 0 32px 80px rgba(0,0,0,0.6), 0 0 160px ${DB_TYPES[formData.dbType].accent}10`,
                        fontFamily: FONT_UI,
                        zIndex: 1000,
                        animation: 'modalIn 0.25s ease-out',
                        overflow: 'hidden',
                    }}>
                        {/* Accent top bar */}
                        <div style={{
                            height: 3,
                            background: `linear-gradient(90deg, ${DB_TYPES[formData.dbType].accent}, ${DB_TYPES[formData.dbType].accent}44)`,
                        }} />

                        {/* Modal header — sticky */}
                        <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '14px 24px 14px',
                            borderBottom: `1px solid ${THEME.glassBorder}`,
                            background: THEME.surface,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                <div style={{
                                    width: 44, height: 44, borderRadius: 14,
                                    background: `${DB_TYPES[formData.dbType].accent}18`,
                                    border: `1px solid ${DB_TYPES[formData.dbType].accent}40`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 22,
                                }}>
                                    {DB_TYPES[formData.dbType].icon}
                                </div>
                                <div>
                                    <h2 style={{ fontSize: 18, fontWeight: 700, color: THEME.textMain, margin: 0, lineHeight: 1.2 }}>
                                        {editingConnection ? 'Edit Connection' : 'New Connection'}
                                    </h2>
                                    <p style={{ fontSize: 12, color: THEME.textMuted, margin: 0, marginTop: 4 }}>
                                        {DB_TYPES[formData.dbType].label} · Port {DB_TYPES[formData.dbType].defaultPort}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={closeModal}
                                style={{
                                    background: 'none', border: `1px solid ${THEME.glassBorder}`,
                                    color: THEME.textMuted, cursor: 'pointer',
                                    width: 36, height: 36, borderRadius: 10,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'all 0.15s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; e.currentTarget.style.color = THEME.danger; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = THEME.glassBorder; e.currentTarget.style.color = THEME.textMuted; }}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Scrollable form body — flat layout, no nested cards */}
                        <div style={{
                            flex: 1, overflowY: 'auto', padding: '18px 24px',
                            background: THEME.surface,
                            fontFamily: FONT_UI,
                        }}>
                            {/* ─── Engine picker ──────────────────────── */}
                            <DBTypeSelector value={formData.dbType} onChange={handleDbTypeChange} />

                            <hr style={S.sectionRule} />

                            {/* ─── Connection identity ─────────────────── */}
                            <div>
                                <div style={S.sectionHeading}><LinkIcon size={12} /> Connection</div>
                                <FloatingField
                                    label="Connection Name"
                                    value={formData.name}
                                    onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                                    placeholder={`My ${DB_TYPES[formData.dbType].label} DB`}
                                    error={formErrors.name}
                                    required
                                    autoFocus
                                    helper="A friendly name shown in connection lists and dashboards."
                                />
                            </div>

                            <hr style={S.sectionRule} />

                            {/* ─── Server + Auth + Security ────────────── */}
                            <DynamicFields
                                dbType={formData.dbType}
                                formData={formData}
                                setFormData={setFormData}
                                formErrors={formErrors}
                                showPassword={showPassword}
                                togglePasswordVisibility={() => setShowPassword(p => !p)}
                            />

                            <hr style={S.sectionRule} />

                            {/* ─── SSH Tunnel ──────────────────────────── */}
                            <SSHTunnelSection formData={formData} setFormData={setFormData} />

                            {/* ─── Set as default ──────────────────────── */}
                            {!editingConnection && (
                                <>
                                    <hr style={S.sectionRule} />
                                    <label htmlFor="isDefault" style={{
                                        display: 'flex', alignItems: 'center', gap: 12,
                                        padding: '14px 16px', borderRadius: 10, cursor: 'pointer',
                                        background: formData.isDefault ? `${THEME.primary}10` : 'transparent',
                                        border: `1.5px solid ${formData.isDefault ? THEME.primary + '55' : THEME.glassBorder}`,
                                        transition: 'all 0.15s',
                                    }}>
                                        <input
                                            type="checkbox"
                                            id="isDefault"
                                            checked={formData.isDefault}
                                            onChange={e => setFormData(p => ({ ...p, isDefault: e.target.checked }))}
                                            style={{ cursor: 'pointer', accentColor: THEME.primary, width: 17, height: 17 }}
                                        />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: formData.isDefault ? THEME.primary : THEME.textMain }}>
                                                Set as default connection
                                            </div>
                                            <div style={{ fontSize: 11, color: THEME.textMuted, marginTop: 2 }}>
                                                Auto-select this connection when the app opens
                                            </div>
                                        </div>
                                    </label>
                                </>
                            )}

                            {errorMsg && (
                                <div style={{
                                    marginTop: 20,
                                    display: 'flex', alignItems: 'flex-start', gap: 10,
                                    padding: '14px 16px', borderRadius: 10,
                                    background: 'rgba(239,68,68,0.08)',
                                    border: '1px solid rgba(239,68,68,0.3)',
                                }}>
                                    <AlertCircle size={16} color={THEME.danger} style={{ flexShrink: 0, marginTop: 1 }} />
                                    <span style={{ fontSize: 13, color: THEME.danger, lineHeight: 1.45, flex: 1 }}>{errorMsg}</span>
                                    <button
                                        onClick={() => setErrorMsg('')}
                                        style={{ background: 'none', border: 'none', color: THEME.danger, cursor: 'pointer', padding: 0, flexShrink: 0, display: 'flex' }}
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Modal footer — sticky */}
                        <div style={{
                            display: 'flex', gap: 18, justifyContent: 'flex-end',
                            padding: '12px 24px',
                            borderTop: `1px solid ${THEME.glassBorder}`,
                            background: THEME.surface,
                        }}>
                            <button
                                onClick={closeModal}
                                style={{
                                    ...S.btn(THEME.surface, THEME.glassBorder, THEME.textMuted),
                                    padding: '10px 20px',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = THEME.surfaceHover}
                                onMouseLeave={e => e.currentTarget.style.background = THEME.surface}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={saveConnection}
                                disabled={saving}
                                style={{
                                    ...S.btn(THEME.primary + '22', THEME.primary + '55', THEME.primary),
                                    padding: '10px 24px',
                                    opacity: saving ? 0.7 : 1,
                                    cursor: saving ? 'wait' : 'pointer',
                                }}
                                onMouseEnter={e => !saving && (e.currentTarget.style.background = THEME.primary + '3D')}
                                onMouseLeave={e => !saving && (e.currentTarget.style.background = THEME.primary + '22')}
                            >
                                {saving ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <ShieldCheck size={16} />}
                                {saving ? 'Encrypting & Saving...' : editingConnection ? 'Update' : 'Encrypt & Save'}
                            </button>
                        </div>
                    </div>
                </>
            )}

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes modalIn { from { opacity: 0; transform: translate(-50%, calc(-50% + 16px)) scale(0.97); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
                * { box-sizing: border-box; }
                ::-webkit-scrollbar { width: 6px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
            `}</style>
        </div>
    );
};

/**
 * "Connect another PC": downloads a PulseDB Agent zip with a fresh key and this
 * PulseDB's address already in it. On the other PC: unzip, run setup.cmd.
 */
/** Step-by-step guide for "Connect another PC" (also linked from agent/README.md). */
const AGENT_GUIDE_URL = 'https://claude.ai/artifact/JxN2XyTJyyVE29gWfppWuN';

function AgentGuideLink() {
    return (
        <a
            href={AGENT_GUIDE_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 11, fontWeight: 600, color: THEME.success, textDecoration: 'underline', whiteSpace: 'nowrap' }}
        >
            Setup guide ↗
        </a>
    );
}

function ConnectAnotherPcButton({ style }: { style: React.CSSProperties }) {
    const [busy, setBusy] = useState(false);
    const download = async () => {
        setBusy(true);
        try {
            const r: any = await postData('/api/agent/package', {});
            const bytes = Uint8Array.from(atob(r.zipBase64), (ch) => ch.charCodeAt(0));
            const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
            const a = document.createElement('a');
            a.href = url;
            a.download = r.fileName || 'PulseDB-Agent.zip';
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 10_000);
            window.alert(
                'PulseDB-Agent.zip downloaded.\n\nOn the PC with the SQL Server:\n' +
                    '1. Copy the zip there and extract it.\n' +
                    '2. Double-click PulseDB-Agent\\setup.cmd.\n\n' +
                    'Its databases then appear here with a VIA AGENT badge. The zip contains a key for this PulseDB — keep it private.\n\n' +
                    `Step-by-step guide: ${AGENT_GUIDE_URL}`,
            );
        } catch (e: any) {
            window.alert(`Could not create the agent package: ${e.message}`);
        } finally {
            setBusy(false);
        }
    };
    return (
        <button onClick={download} disabled={busy} style={{ ...style, opacity: busy ? 0.6 : 1 }} title="Monitor SQL Server on another PC or server through the PulseDB Agent">
            <Download size={16} /> {busy ? 'Preparing…' : 'Connect another PC'}
        </button>
    );
}

export default ConnectionsTab;