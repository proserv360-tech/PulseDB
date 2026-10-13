// Routes between landing/login, demo mode, and the dashboard.
// Extracted from App.tsx.
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import ForcePasswordChangeModal from '../components/auth/ForcePasswordChangeModal';
import LoginPage from '../components/auth/LoginPage';
import { DS } from '../config/designTokens';
import { useAuth } from '../context/AuthContext';
import { useDemo } from '../context/DemoContext';
import { NavigationContext } from '../context/NavigationContext';
import LandingPage from '../pages/LandingPage';
import { Dashboard } from './Dashboard';
import { ErrorBoundary } from './ErrorBoundary';
import { LoadingScreen } from './LoadingScreen';
import { ConnectionWizard, SSOCallback } from './tabRegistry';

/* ─────────────────────────────────────────────────────────────────
   AUTH CONSUMER + APP ENTRY
   ─────────────────────────────────────────────────────────────────
   Handles the login→dashboard and logout→login transitions.

   Login flow:
     - LoginPage fires login() → AuthContext sets currentUser
     - We hold the route switch for LOGIN_REDIRECT_DELAY ms so the
       "Authenticated / Redirecting…" success animation has time to
       complete before we unmount the login page.

   Logout flow:
     - Dashboard calls handleLogout() → starts a 400 ms fade-out
       overlay, then calls AuthContext logout() which clears the user
       and triggers the route change to /login.
   ───────────────────────────────────────────────────────────────── */

/**
 * LoginModal — dimmed full-screen overlay hosting the embedded LoginPage card.
 * Clicking the backdrop (or Esc / the card's close button) dismisses it. Keeps
 * sign-in on the SAME page as the landing rather than routing to /login.
 */
const LoginModal = ({ onClose }: { onClose: () => void }) => {
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, []);
    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 1000,
                background: 'rgba(7, 11, 20, 0.72)',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px 16px',
            }}
        >
            <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 940 }}>
                <LoginPage embedded onClose={onClose} />
            </div>
        </div>
    );
};

export const AuthConsumer = () => {
    const { currentUser, loading, logout, mustChangePassword, clearMustChangePassword } = useAuth();
    const { isDemo, exitDemo } = useDemo();

    // readyToEnter is true immediately when logged in — no delay needed
    // (the login-success overlay has been removed; we go straight to the dashboard)
    const [readyToEnter, setReadyToEnter] = useState(!!currentUser || isDemo);
    const prevUser = useRef(currentUser);

    // Inline login: open the login form as a modal over the landing page instead
    // of navigating to a separate /login page. On success, AuthContext sets
    // currentUser and the "/" route below redirects straight to /dashboard.
    const [showLogin, setShowLogin] = useState(false);
    useEffect(() => {
        if (currentUser) setShowLogin(false); // close the modal once authenticated
    }, [currentUser]);

    useEffect(() => {
        // User just logged in or demo activated → enter immediately
        if ((!prevUser.current && currentUser) || isDemo) {
            setReadyToEnter(true);
            prevUser.current = currentUser;
            return;
        }
        // User logged out and not demo → reset gate for next login
        if (prevUser.current && !currentUser && !isDemo) {
            setReadyToEnter(false);
        }
        prevUser.current = currentUser;
    }, [currentUser, isDemo]);

    // ── Logout fade-out ──────────────────────────────────────────
    const [loggingOut, setLoggingOut] = useState(false);

    const handleLogout = useCallback(() => {
        setLoggingOut(true);
        // Wait for fade-out animation, then clear auth state
        setTimeout(() => {
            if (isDemo) exitDemo();
            logout();
            setLoggingOut(false);
        }, 400);
    }, [logout, isDemo, exitDemo]);

    if (loading) return <LoadingScreen />;

    return (
        <Router>
            <Suspense fallback={<LoadingScreen />}>
                <Routes>
                    {/* 1. Public Marketing Landing Page — shown to unauthenticated visitors at / */}
                    <Route
                        path="/"
                        element={
                            !currentUser && !isDemo ? (
                                <>
                                    <LandingPage
                                        onEnterDemo={() => setShowLogin(true)}
                                        onLogin={() => setShowLogin(true)}
                                    />
                                    {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
                                </>
                            ) : (
                                <Navigate to="/dashboard" replace />
                            )
                        }
                    />

                    {/* 2. Login Route: redirect immediately to dashboard if already logged in */}
                    <Route
                        path="/login"
                        element={!currentUser && !isDemo ? <LoginPage /> : <Navigate to="/dashboard" replace />}
                    />

                    {/* 3. SSO Callback Route */}
                    <Route path="/auth/callback" element={<SSOCallback />} />

                    {/* 5. Connection Onboarding Wizard */}
                    <Route
                        path="/onboarding"
                        element={
                            currentUser || isDemo ? (
                                <NavigationContext.Provider
                                    value={{ goToTab: () => (window.location.href = '/dashboard') }}
                                >
                                    <ConnectionWizard />
                                </NavigationContext.Provider>
                            ) : (
                                <Navigate to="/login" replace />
                            )
                        }
                    />

                    {/* 6. Protected Dashboard Route */}
                    <Route
                        path="/dashboard/*"
                        element={
                            (currentUser || isDemo) && readyToEnter ? (
                                <ErrorBoundary>
                                    {/* Force password change modal — blocks dashboard access */}
                                    {mustChangePassword && !isDemo && (
                                        <ForcePasswordChangeModal
                                            onSuccess={clearMustChangePassword}
                                            onLogout={handleLogout}
                                        />
                                    )}
                                    {/* Full-screen fade overlay shown during logout */}
                                    {loggingOut && (
                                        <div
                                            style={{
                                                position: 'fixed',
                                                inset: 0,
                                                zIndex: 500,
                                                background: DS.bg,
                                                animation: 'fadeIn 0.4s ease-out both',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexDirection: 'column',
                                                gap: 16,
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: 44,
                                                    height: 44,
                                                    borderRadius: '50%',
                                                    border: `2px solid ${DS.border}`,
                                                    borderTopColor: DS.cyan,
                                                    animation: 'rotate 0.9s linear infinite',
                                                }}
                                            />
                                            <span
                                                style={{
                                                    fontSize: 12,
                                                    color: DS.textMuted,
                                                    fontFamily: DS.fontMono,
                                                    letterSpacing: '0.02em',
                                                }}
                                            >
                                                SIGNING OUT…
                                            </span>
                                        </div>
                                    )}
                                    <Dashboard onLogout={handleLogout} />
                                </ErrorBoundary>
                            ) : (
                                <Navigate to="/login" replace />
                            )
                        }
                    />
                </Routes>
            </Suspense>
        </Router>
    );
};
