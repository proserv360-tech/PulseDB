// Top-level error boundary.
// Extracted from App.tsx.
import { AlertCircle } from 'lucide-react';
import React from 'react';
import { DS } from '../config/designTokens';
import { THEME } from '../utils/theme';

/* ─────────────────────────────────────────────────────────────────
   ERROR BOUNDARY
   ───────────────────────────────────────────────────────────────── */
export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, showStackTrace: false, errorInfo: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
        console.error('Error Boundary caught:', error, errorInfo);
        this.setState({ errorInfo });
    }
    render() {
        if (this.state.hasError)
            return (
                <div
                    style={{
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'column',
                        gap: 20,
                        padding: 40,
                        color: DS.textPrimary,
                        background: DS.bg,
                    }}
                >
                    <div
                        style={{
                            width: 72,
                            height: 72,
                            borderRadius: 18,
                            background: 'rgba(251,113,133,0.1)',
                            border: '1px solid rgba(251,113,133,0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <AlertCircle size={36} color={DS.rose} />
                    </div>
                    <div style={{ textAlign: 'center', maxWidth: 520 }}>
                        <h2 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 12px', letterSpacing: '-0.02em' }}>
                            Something went wrong
                        </h2>
                        <p style={{ color: DS.textSub, margin: '0 0 24px', lineHeight: 1.6, fontSize: 14 }}>
                            {this.state.error?.message || 'An unexpected error occurred in this view.'}
                        </p>

                        {/* Stack trace section (collapsible) */}
                        {this.state.errorInfo && (
                            <div
                                style={{
                                    textAlign: 'left',
                                    background: `${DS.surface}dd`,
                                    border: `1px solid ${DS.border}`,
                                    borderRadius: 8,
                                    padding: '12px 16px',
                                    marginBottom: 20,
                                    maxHeight: this.state.showStackTrace ? 200 : 0,
                                    overflow: 'hidden',
                                    transition: 'max-height 0.3s ease',
                                }}
                            >
                                <button
                                    onClick={() => this.setState((s) => ({ showStackTrace: !s.showStackTrace }))}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: DS.cyan,
                                        fontWeight: 600,
                                        fontSize: 12,
                                        marginBottom: this.state.showStackTrace ? 12 : 0,
                                        fontFamily: DS.fontMono,
                                        letterSpacing: '0.02em',
                                    }}
                                >
                                    {this.state.showStackTrace ? '▼ Hide' : '▶ Show'} Developer Info
                                </button>
                                {this.state.showStackTrace && (
                                    <pre
                                        style={{
                                            margin: 0,
                                            fontSize: 10,
                                            color: DS.textMuted,
                                            fontFamily: DS.fontMono,
                                            overflow: 'auto',
                                            maxHeight: 160,
                                        }}
                                    >
                                        {this.state.errorInfo.componentStack}
                                    </pre>
                                )}
                            </div>
                        )}

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                            <button
                                onClick={() => {
                                    try {
                                        localStorage.removeItem('fathom_active_tab');
                                        localStorage.removeItem('fathom_sidebar_collapsed');
                                    } catch {}
                                    window.location.href = '/';
                                }}
                                style={{
                                    padding: '11px 24px',
                                    borderRadius: 8,
                                    border: `1px solid ${DS.cyan}`,
                                    cursor: 'pointer',
                                    background: `${DS.cyan}15`,
                                    color: DS.cyan,
                                    fontWeight: 600,
                                    fontSize: 13,
                                    fontFamily: DS.fontUI,
                                    transition: 'all 0.15s',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = `${DS.cyan}25`;
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = `${DS.cyan}15`;
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            >
                                Go to Overview
                            </button>
                            <button
                                onClick={() => window.location.reload()}
                                style={{
                                    padding: '11px 24px',
                                    borderRadius: 8,
                                    border: 'none',
                                    cursor: 'pointer',
                                    background: `linear-gradient(135deg, ${DS.rose}, ${DS.violet})`,
                                    color: THEME.textInverse,
                                    fontWeight: 600,
                                    fontSize: 13,
                                    fontFamily: DS.fontUI,
                                    transition: 'all 0.15s',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                                onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                            >
                                Reload Page
                            </button>
                        </div>

                        {/* Help text */}
                        <p style={{ color: DS.textMuted, margin: '20px 0 0', fontSize: 11, lineHeight: 1.5 }}>
                            If this error persists, please{' '}
                            <a
                                href="mailto:support@fathom.io"
                                style={{ color: DS.cyan, textDecoration: 'none', fontWeight: 600 }}
                            >
                                contact support
                            </a>{' '}
                            or check the browser console for more details.
                        </p>
                    </div>
                </div>
            );
        return this.props.children;
    }
}
