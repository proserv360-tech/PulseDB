import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader, AlertCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { THEME } from '../../utils/theme';

const SSOCallback = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { handleSSOCallback } = useAuth();
    const [error, setError] = useState(null);
    const hasProcessed = useRef(false);

    useEffect(() => {
        // Prevent strict-mode double firing
        if (hasProcessed.current) return;
        hasProcessed.current = true;

        const processCallback = async () => {
            try {
                // 1. Extract data from the URL query string
                // Example URL: https://your-app.com/auth/callback?token=eyJ...&user=%7B%22id%22...
                const token = searchParams.get('token');
                const userParam = searchParams.get('user');
                const errorParam = searchParams.get('error');

                // SEC-007: Immediately clean sensitive data from URL to prevent leakage
                // via browser history, referrer headers, and server logs
                window.history.replaceState({}, document.title, window.location.pathname);

                // Handle SSO provider errors (e.g., user denied access)
                if (errorParam) {
                    throw new Error(decodeURIComponent(errorParam));
                }

                if (!token) {
                    throw new Error("Authentication failed: No access token received from the identity provider.");
                }

                // 2. Parse the user object
                let userData;
                if (userParam) {
                    // If backend passes user object explicitly
                    userData = JSON.parse(decodeURIComponent(userParam));
                    // Validate the parsed user data to prevent JSON injection attacks
                    if (!userData || typeof userData !== 'object' || !userData.id || !userData.username) {
                        throw new Error('Invalid user data from SSO');
                    }
                } else {
                    // Fallback: Decode the JWT token payload to get user data
                    const base64Url = token.split('.')[1];
                    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                    userData = JSON.parse(window.atob(base64));
                }

                // 3. Save to AuthContext and localStorage
                handleSSOCallback(token, userData);

                // 4. Clean up the URL and redirect to the dashboard
                // A small timeout ensures the context state updates smoothly before navigating
                setTimeout(() => {
                    navigate('/', { replace: true });
                }, 800);

            } catch (err) {
                console.error("SSO Callback Error:", err);
                setError(err.message || "An unexpected error occurred during authentication.");
            }
        };

        processCallback();
    }, [searchParams, navigate, handleSSOCallback]);

    return (
        <div style={{
            height: '100vh', width: '100vw', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: THEME.bg, fontFamily: THEME.fontBody
        }}>
            <div style={{
                padding: '40px', borderRadius: '24px', background: THEME.surface,
                border: `1px solid ${error ? 'rgba(239,68,68,.3)' : THEME.glassBorder}`,
                boxShadow: THEME.shadowMd, textAlign: 'center', maxWidth: '400px', width: '90%'
            }}>
                {error ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                        <div style={{
                            width: '48px', height: '48px', borderRadius: '50%',
                            background: `${THEME.danger}10`, display: 'flex',
                            alignItems: 'center', justifyContent: 'center'
                        }}>
                            <AlertCircle size={24} color={THEME.danger} />
                        </div>
                        <h2 style={{ margin: 0, color: THEME.textMain, fontSize: '18px' }}>Authentication Failed</h2>
                        <p style={{ color: THEME.textMuted, fontSize: '13px', margin: 0, lineHeight: 1.5 }}>{error}</p>
                        <button
                            onClick={() => navigate('/login')}
                            style={{
                                marginTop: '12px', padding: '10px 20px', borderRadius: THEME.radiusMd,
                                background: THEME.surfaceHover, border: `1px solid ${THEME.glassBorder}`,
                                color: THEME.textMain, cursor: 'pointer', fontWeight: 500
                            }}
                        >
                            Return to Login
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                        <div style={{
                            width: '56px', height: '56px', borderRadius: THEME.radiusMd,
                            background: `${THEME.primary}10`,
                            border: `1px solid ${THEME.primary}20`, display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            boxShadow: `0 0 20px ${THEME.primary}10`
                        }}>
                            <ShieldCheck size={28} color={THEME.primary} />
                        </div>
                        <div>
                            <h2 style={{ margin: '0 0 6px', color: THEME.textMain, fontSize: '18px' }}>Verifying Secure Session</h2>
                            <p style={{ color: THEME.textMuted, fontSize: '13px', margin: 0 }}>Finalizing enterprise authentication...</p>
                        </div>
                        <Loader size={20} color={THEME.primary} style={{ animation: 'spin 1s linear infinite', marginTop: '8px' }} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default SSOCallback;