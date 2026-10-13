import React from 'react';
import { THEME } from '../../utils/theme';
import { AlertTriangle, AlertCircle, Wifi, Lock, Clock, Server, RotateCcw, Home } from 'lucide-react';

/* ── Error categorization ─────────────────────────────────────────────────── */
const categorizeError = (error) => {
    const msg = error?.message?.toLowerCase() || '';

    if (msg.includes('connection') || msg.includes('network') || msg.includes('timeout')) {
        return { type: 'connection_lost', icon: Wifi };
    }
    if (msg.includes('permission') || msg.includes('forbidden') || msg.includes('401') || msg.includes('403')) {
        return { type: 'permission_denied', icon: Lock };
    }
    if (msg.includes('timeout') || msg.includes('504') || msg.includes('took too long')) {
        return { type: 'query_timeout', icon: Clock };
    }
    if (msg.includes('server') || msg.includes('500') || msg.includes('502') || msg.includes('503')) {
        return { type: 'server_unavailable', icon: Server };
    }

    return { type: 'unknown', icon: AlertTriangle };
};

/* ── Error message and recovery ──────────────────────────────────────────── */
const getErrorInfo = (category) => {
    const info = {
        connection_lost: {
            title: 'Connection Lost',
            message: 'Unable to reach the database. Check your network connection and try again.',
            recovery: 'Check your internet connection and refresh the page.',
        },
        permission_denied: {
            title: 'Permission Denied',
            message: 'You do not have permission to access this resource.',
            recovery: 'Contact your administrator to request access.',
        },
        query_timeout: {
            title: 'Query Timeout',
            message: 'The request took too long to complete.',
            recovery: 'Try again or simplify your query parameters.',
        },
        server_unavailable: {
            title: 'Server Unavailable',
            message: 'The server is temporarily unavailable.',
            recovery: 'Wait a moment and try again. If the issue persists, contact support.',
        },
        unknown: {
            title: 'Something Went Wrong',
            message: 'An unexpected error occurred in this section.',
            recovery: 'Try refreshing or contact support if the problem continues.',
        },
    };
    return info[category] || info.unknown;
};

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION ERROR BOUNDARY (React Class Component)
   ═══════════════════════════════════════════════════════════════════════════ */
class SectionErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
            category: null,
            retryCount: 0,
        };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        const category = categorizeError(error);
        this.setState({
            error,
            errorInfo,
            category: category.type,
        });
        console.error(`[${this.props.sectionName}] Error:`, error, errorInfo);
    }

    handleRetry = () => {
        this.setState(prevState => ({
            hasError: false,
            error: null,
            errorInfo: null,
            category: null,
            retryCount: prevState.retryCount + 1,
        }));
        this.props.onRetry?.();
    };

    handleGoToOverview = () => {
        // Navigate to overview tab
        window.location.hash = '#overview';
    };

    render() {
        if (!this.state.hasError) {
            return this.props.children;
        }

        const errCategory = this.state.category || 'unknown';
        const categoryInfo = categorizeError(this.state.error);
        const ErrorIcon = categoryInfo.icon;
        const info = getErrorInfo(errCategory);

        return (
            <div
                style={{
                    width: '100%',
                    minHeight: '200px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px',
                    background: `linear-gradient(135deg, ${THEME.surface}80, ${THEME.elevated}80)`,
                    border: `1px solid ${THEME.borderHot}`,
                    borderRadius: '12px',
                }}
            >
                <div
                    style={{
                        textAlign: 'center',
                        maxWidth: '400px',
                    }}
                >
                    {/* Error Icon */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '56px',
                            height: '56px',
                            margin: '0 auto 16px',
                            background: `${THEME.danger}15`,
                            borderRadius: '10px',
                            border: `1px solid ${THEME.danger}40`,
                            marginBottom: 16,
                        }}
                    >
                        <ErrorIcon size={28} color={THEME.danger} />
                    </div>

                    {/* Error Title */}
                    <div
                        style={{
                            fontSize: '16px',
                            fontWeight: 700,
                            color: THEME.textMain,
                            marginBottom: '8px',
                            fontFamily: THEME.fontBody,
                        }}
                    >
                        {info.title}
                    </div>

                    {/* Error Message */}
                    <div
                        style={{
                            fontSize: '13px',
                            color: THEME.textMuted,
                            marginBottom: '16px',
                            lineHeight: '1.5',
                            fontFamily: THEME.fontBody,
                        }}
                    >
                        {info.message}
                    </div>

                    {/* Recovery Suggestion */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '8px',
                            background: `${THEME.warning}08`,
                            border: `1px solid ${THEME.warning}20`,
                            borderRadius: '8px',
                            padding: '12px',
                            marginBottom: '20px',
                        }}
                    >
                        <AlertCircle size={16} color={THEME.warning} style={{ flexShrink: 0, marginTop: '2px' }} />
                        <div
                            style={{
                                fontSize: '12px',
                                color: THEME.textMuted,
                                lineHeight: '1.4',
                                textAlign: 'left',
                                fontFamily: THEME.fontBody,
                            }}
                        >
                            {info.recovery}
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div
                        style={{
                            display: 'flex',
                            gap: '10px',
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}
                    >
                        <button
                            onClick={this.handleRetry}
                            style={{
                                padding: '10px 16px',
                                background: THEME.primary,
                                color: THEME.deepTeal,
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                transition: 'all 0.2s ease',
                                fontFamily: THEME.fontBody,
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.background = THEME.borderGlow;
                                e.target.style.boxShadow = `0 0 12px ${THEME.primary}40`;
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.background = THEME.primary;
                                e.target.style.boxShadow = 'none';
                            }}
                        >
                            <RotateCcw size={14} />
                            Retry
                        </button>

                        <button
                            onClick={this.handleGoToOverview}
                            style={{
                                padding: '10px 16px',
                                background: THEME.glassLight,
                                color: THEME.textMain,
                                border: `1px solid ${THEME.border}`,
                                borderRadius: '8px',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                transition: 'all 0.2s ease',
                                fontFamily: THEME.fontBody,
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.background = THEME.border;
                                e.target.style.borderColor = THEME.borderHot;
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.background = THEME.glassLight;
                                e.target.style.borderColor = THEME.border;
                            }}
                        >
                            <Home size={14} />
                            Overview
                        </button>
                    </div>

                    {/* Debug Info (development only) */}
                    {process.env.NODE_ENV === 'development' && this.state.error && (
                        <div
                            style={{
                                marginTop: '16px',
                                padding: '12px',
                                background: THEME.deepTeal,
                                border: `1px solid ${THEME.grid}`,
                                borderRadius: '6px',
                                fontSize: '10px',
                                color: THEME.textMuted,
                                fontFamily: THEME.fontMono,
                                textAlign: 'left',
                                maxHeight: '100px',
                                overflow: 'auto',
                                wordBreak: 'break-word',
                            }}
                        >
                            {this.state.error.message}
                        </div>
                    )}
                </div>
            </div>
        );
    }
}

export default SectionErrorBoundary;
