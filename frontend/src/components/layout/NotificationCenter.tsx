import React, { useState } from 'react';
import { AlertCircle, Bell, X } from 'lucide-react';
import { DS } from '../../config/designTokens';
import { THEME } from '../../utils/theme';

const SEV_COLORS = {
    critical: DS.rose,
    warning: DS.amber,
    info: DS.cyan,
};

export const NotificationCenter = ({ notifications, onDismiss, onClearAll }) => {
    const [isOpen, setIsOpen] = useState(false);
    const unread = notifications.filter((n) => !n.read).length;

    return (
        <div style={{ position: 'relative' }}>
            <button
                onClick={() => setIsOpen((o) => !o)}
                style={{
                    position: 'relative',
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: isOpen ? DS.cyanDim : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${isOpen ? DS.cyan + '60' : DS.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    boxShadow: isOpen ? DS.glowCyan : 'none',
                }}
                aria-label="Notifications"
            >
                <Bell size={17} color={isOpen ? DS.cyan : DS.textSub} />
                {unread > 0 && (
                    <span
                        className="badge-new"
                        style={{
                            position: 'absolute',
                            top: -5,
                            right: -5,
                            minWidth: 18,
                            height: 18,
                            borderRadius: 9,
                            background: DS.rose,
                            color: THEME.textInverse,
                            fontSize: 10,
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0 4px',
                            border: `2px solid ${DS.bg}`,
                            fontFamily: DS.fontMono,
                        }}
                    >
                        {unread > 9 ? '9+' : unread}
                    </span>
                )}
            </button>

            {isOpen && (
                <>
                    <div onClick={() => setIsOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 999 }} />
                    <div
                        className="notif-panel"
                        style={{
                            position: 'absolute',
                            top: 'calc(100% + 10px)',
                            right: 0,
                            width: 390,
                            maxHeight: 520,
                            background: DS.surface,
                            border: `1px solid ${DS.borderAccent}`,
                            borderRadius: 14,
                            boxShadow: `${DS.shadowDeep}, ${DS.glowCyan}`,
                            zIndex: 1000,
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                        }}
                    >
                        {/* Rainbow top bar */}
                        <div
                            style={{
                                height: 2,
                                background: `linear-gradient(90deg, ${DS.cyan}, ${DS.violet})`,
                                flexShrink: 0,
                            }}
                        />

                        <div
                            style={{
                                padding: '14px 18px',
                                borderBottom: `1px solid ${DS.border}`,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                flexShrink: 0,
                            }}
                        >
                            <div
                                style={{
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: DS.textPrimary,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                }}
                            >
                                <Bell size={14} color={DS.cyan} />
                                Notifications
                                {notifications.length > 0 && (
                                    <span
                                        style={{
                                            fontSize: 10,
                                            background: DS.cyanDim,
                                            color: DS.cyan,
                                            padding: '2px 7px',
                                            borderRadius: 20,
                                            fontFamily: DS.fontMono,
                                        }}
                                    >
                                        {notifications.length}
                                    </span>
                                )}
                            </div>
                            {notifications.length > 0 && (
                                <button
                                    onClick={onClearAll}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: DS.textMuted,
                                        fontSize: 11,
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        padding: '4px 8px',
                                        borderRadius: 6,
                                        transition: 'color 0.15s',
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.color = DS.rose)}
                                    onMouseLeave={(e) => (e.currentTarget.style.color = DS.textMuted)}
                                >
                                    Clear all
                                </button>
                            )}
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            {notifications.length === 0 ? (
                                <div style={{ padding: '48px 20px', textAlign: 'center', color: DS.textMuted }}>
                                    <Bell size={28} style={{ opacity: 0.2, marginBottom: 10 }} />
                                    <div style={{ fontSize: 12 }}>All caught up</div>
                                </div>
                            ) : (
                                notifications.map((n, idx) => {
                                    const col = SEV_COLORS[n.severity] || DS.cyan;
                                    return (
                                        <div
                                            key={n.id}
                                            className="notif-item"
                                            style={{
                                                padding: '13px 18px',
                                                borderBottom: `1px solid ${DS.border}`,
                                                display: 'flex',
                                                gap: 12,
                                                alignItems: 'flex-start',
                                                background: !n.read ? `${col}06` : 'transparent',
                                                cursor: 'default',
                                                animation: `notifPop 0.25s ${idx * 0.04}s ease-out both`,
                                            }}
                                        >
                                            {/* Severity dot + icon */}
                                            <div
                                                style={{
                                                    width: 34,
                                                    height: 34,
                                                    borderRadius: 8,
                                                    flexShrink: 0,
                                                    background: `${col}12`,
                                                    border: `1px solid ${col}30`,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }}
                                            >
                                                <AlertCircle size={15} color={col} />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div
                                                    style={{
                                                        fontSize: 12,
                                                        fontWeight: 700,
                                                        color: DS.textPrimary,
                                                        marginBottom: 3,
                                                    }}
                                                >
                                                    {n.title}
                                                </div>
                                                <div style={{ fontSize: 11, color: DS.textSub, lineHeight: 1.5 }}>
                                                    {n.message}
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: 10,
                                                        color: DS.textMuted,
                                                        marginTop: 5,
                                                        fontFamily: DS.fontMono,
                                                    }}
                                                >
                                                    {new Date(n.timestamp).toLocaleTimeString()}
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDismiss(n.id);
                                                }}
                                                style={{
                                                    width: 22,
                                                    height: 22,
                                                    borderRadius: 5,
                                                    border: 'none',
                                                    background: 'transparent',
                                                    color: DS.textMuted,
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    flexShrink: 0,
                                                    transition: 'all 0.15s',
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.background = 'rgba(251,113,133,0.12)';
                                                    e.currentTarget.style.color = DS.rose;
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.background = 'transparent';
                                                    e.currentTarget.style.color = DS.textMuted;
                                                }}
                                            >
                                                <X size={13} />
                                            </button>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};