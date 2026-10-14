import React, { useState, useEffect } from 'react';
import { THEME } from '../../utils/theme';
import { Eye, EyeOff, Loader, Mail, User, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ByProserv360 from '../ui/ByProserv360';
import { useAdaptiveTheme } from '../../utils/theme';

const API_BASE = import.meta.env.VITE_API_URL || '';

// ─── Palette — Midnight Blue. The three panels step through the surface ramp
// (rail → illustration → form) so the card reads as one object, not three.
const C = {
    indigo: THEME.primary,        // accent: active tab, links, focus ring
    indigoDeep: THEME.primaryDark, // button fill — white label clears AA on it
    indigoInk: THEME.primaryLight, // accent text on a midnight surface
    page: THEME.bg,
    rail: THEME.inkBlack,
    art: THEME.surface,
    form: THEME.bg,
    white: '#ffffff',
    railText: THEME.textMuted,
    ink: THEME.textMain,          // input + label text (was surfaceRaised: invisible)
    sub: THEME.textMuted,
    dim: THEME.textDim,
    inputBg: THEME.surface,
    line: 'rgba(147,180,235,0.16)',
    rose: THEME.danger,
    ok: THEME.success,
};
const FONT = "'Poppins', sans-serif";
const BODY = "'Inter', sans-serif";

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; }

  @keyframes siRise  { from { opacity:0; transform:translateY(18px) scale(.985);} to { opacity:1; transform:translateY(0) scale(1);} }
  @keyframes siSwap  { from { opacity:0; transform:translateY(10px);} to { opacity:1; transform:translateY(0);} }
  @keyframes siShake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-7px)} 40%{transform:translateX(5px)} 60%{transform:translateX(-3px)} 80%{transform:translateX(2px)} }
  @keyframes siSpin  { to { transform:rotate(360deg);} }
  @keyframes siFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-9px)} }
  @keyframes siPop   { from{transform:scale(0)} to{transform:scale(1)} }
  @keyframes siProg  { to { width:100%; } }

  .si-swap { animation: siSwap .35s cubic-bezier(0.16,1,0.3,1) both; }

  .si-field { position:relative; }
  .si-field > .si-lead { position:absolute; right:16px; top:50%; transform:translateY(-50%); color:${C.dim}; transition:color .15s; pointer-events:none; }
  .si-input {
    width:100%; padding:13px 44px 13px 16px; font-size:14px; font-family:${BODY};
    color:${C.ink}; background:${C.inputBg}; border:1.5px solid transparent;
    border-radius:12px; outline:none; transition:border-color .15s, box-shadow .15s, background .15s;
  }
  .si-input::placeholder { color:${C.dim}; }
  .si-input:focus { border-color:${C.indigo}; background:${THEME.surfaceHover}; box-shadow:0 0 0 4px ${C.indigo}33; }
  .si-field:focus-within > .si-lead { color:${C.indigo}; }

  .si-submit { transition:transform .15s, box-shadow .15s, filter .15s; }
  .si-submit:not(:disabled):hover { transform:translateY(-2px); box-shadow:0 14px 30px ${C.indigo}55; filter:brightness(1.05); }
  .si-submit:not(:disabled):active { transform:translateY(0); }

  .si-tab { transition:color .15s; }
  .si-tab:hover { color:${C.indigo}; }
  .si-eye:hover, .si-link:hover { color:${C.indigo} !important; }
  .si-notes { animation: siFloat 4s ease-in-out infinite; transform-origin:center; }

  @media (max-width: 900px) {
    .si-rail { display:none !important; }
    .si-art  { display:none !important; }
    .si-compact { display:flex !important; }
  }
`;

// ─── Flat database-fleet illustration (original artwork) ──────────────────────
// A primary cluster with two replicas, dashed collector links, and a live
// latency trace on the panel above. `si-notes` keeps the gentle float animation
// that the previous artwork used.
const FleetArt: React.FC = () => (
    <svg viewBox="0 0 300 320" width="100%" style={{ display: 'block', maxWidth: 280, margin: '0 auto' }} aria-hidden>
        {/* ground shadow */}
        <ellipse cx="150" cy="288" rx="104" ry="11" fill={THEME.inkBlack} opacity="0.55" />

        {/* replicas */}
        <g opacity="0.9">
            <rect x="30" y="196" width="48" height="46" fill={THEME.surfaceHover} />
            <ellipse cx="54" cy="242" rx="24" ry="8.5" fill={THEME.surfaceHover} />
            <ellipse cx="54" cy="196" rx="24" ry="8.5" fill={THEME.surfaceRaised} />
            <rect x="222" y="196" width="48" height="46" fill={THEME.surfaceHover} />
            <ellipse cx="246" cy="242" rx="24" ry="8.5" fill={THEME.surfaceHover} />
            <ellipse cx="246" cy="196" rx="24" ry="8.5" fill={THEME.surfaceRaised} />
        </g>

        {/* collector links */}
        <path d="M54 186 Q100 150 124 156" fill="none" stroke={THEME.primary} strokeWidth="1.8" strokeDasharray="4 4" opacity="0.55" />
        <path d="M246 186 Q200 150 176 156" fill="none" stroke={THEME.primary} strokeWidth="1.8" strokeDasharray="4 4" opacity="0.55" />
        <path d="M150 124 L150 150" stroke={THEME.primary} strokeWidth="1.8" strokeDasharray="4 4" opacity="0.55" />

        {/* primary cluster */}
        <rect x="110" y="166" width="80" height="76" fill={THEME.primaryDark} />
        <ellipse cx="150" cy="242" rx="40" ry="13" fill={THEME.primaryDark} />
        <ellipse cx="150" cy="204" rx="40" ry="13" fill={THEME.primary} />
        <ellipse cx="150" cy="166" rx="40" ry="13" fill={THEME.primaryLight} />
        <circle cx="150" cy="166" r="4.5" fill={THEME.inkBlack} opacity="0.35" />

        {/* monitor panel + live latency trace */}
        <rect x="58" y="44" width="184" height="72" rx="9" fill={THEME.bg} stroke={THEME.surfaceRaised} strokeWidth="1.5" />
        <circle cx="74" cy="58" r="3.4" fill={THEME.success} />
        <rect x="84" y="55" width="26" height="6" rx="3" fill={THEME.surfaceRaised} />
        <polyline
            className="si-notes"
            points="72,98 94,84 110,90 128,62 146,74 162,54 180,80 198,66 216,86 230,72"
            fill="none"
            stroke={THEME.secondary}
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <circle cx="230" cy="72" r="4.5" fill={THEME.secondary} stroke={THEME.bg} strokeWidth="2.5" />
    </svg>
);

// ─── Brand mark (stacked half-moons, like the reference logo) ─────────────────
const Mark: React.FC<{ size?: number }> = ({ size = 26 }) => (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
        <path d="M4 10 a12 12 0 0 0 24 0 z" fill={C.indigo} />
        <path d="M8 20 a8 8 0 0 0 16 0 z" fill={C.indigo} opacity="0.85" />
    </svg>
);

type Mode = 'signin' | 'signup';

/**
 * Self-serve sign-up is off for now — accounts are created by a workspace admin.
 * Flip to `true` to restore the Sign Up tab, the toggle and the switch link.
 * The signup branches below are left intact so this is a one-line change.
 */
const SIGNUP_ENABLED = false;

/**
 * What to say about the way the last session ended.
 *
 * Three exits land on this screen and they are not the same event. Signing out
 * is something you did and want confirmed. Expiring is something that happened
 * to you and needs explaining, or you assume the app logged you out at random.
 * Revocation is someone else acting on your account, which you should be told
 * about plainly rather than have dressed up as a timeout.
 *
 * Keyed by the EXIT_REASONS values in AuthContext.
 */
const EXIT_BANNERS: Record<string, { tone: 'ok' | 'warn' | 'bad'; title: string; body: string }> = {
    signed_out: {
        tone: 'ok',
        title: "You're signed out",
        body: 'Your session on this device was ended.',
    },
    expired: {
        tone: 'warn',
        title: 'Your session expired',
        body: 'Sign in to pick up where you left off.',
    },
    revoked: {
        tone: 'bad',
        title: 'You were signed out',
        body: 'Your session was ended elsewhere. Sign in again to continue.',
    },
};

const BANNER_TONES = {
    ok:   { fg: THEME.success, ring: `${THEME.success}30`, bg: `${THEME.success}12` },
    warn: { fg: THEME.warning, ring: `${THEME.warning}30`, bg: `${THEME.warning}12` },
    bad:  { fg: THEME.danger, ring: `${THEME.danger}30`, bg: `${THEME.danger}12` },
};

interface LoginPageProps {
    embedded?: boolean;
    onClose?: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ embedded = false, onClose }) => {
    const { login, consumeExitReason, getLastUsername, forgetLastUsername } = useAuth();
    useAdaptiveTheme();

    const [mode, setMode] = useState<Mode>('signin');
    const [name, setName] = useState('');
    // Prefill the last address so a return trip is one field, not two. Read
    // lazily rather than in an effect: the input should never flash empty.
    const [email, setEmail] = useState(() => getLastUsername?.() ?? '');
    const [remembered, setRemembered] = useState(() => Boolean(getLastUsername?.()));

    // Why we're on this screen. Read once on mount — consumeExitReason clears
    // it, so refreshing the login page doesn't keep announcing a sign-out that
    // happened ten minutes ago.
    const [exit, setExit] = useState<string | null>(() => consumeExitReason?.() ?? null);
    const exitBanner = exit ? EXIT_BANNERS[exit] : null;

    const pwRef = React.useRef<HTMLInputElement>(null);
    useEffect(() => {
        // With the address already filled, the cursor belongs in the password
        // field. Only on a return trip — a first-time visitor should start at
        // the top of the form.
        if (remembered && mode === 'signin') pwRef.current?.focus();
    }, [remembered, mode]);

    const forgetUser = () => {
        forgetLastUsername?.();
        setEmail('');
        setRemembered(false);
    };

    const [password, setPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [shake, setShake] = useState(false);
    const [success, setSuccess] = useState(false);
    const [online, setOnline] = useState<boolean | null>(null);

    useEffect(() => {
        let alive = true;
        const check = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/health`, { signal: AbortSignal.timeout(4000) });
                if (alive) setOnline(res.ok);
            } catch {
                if (alive) setOnline(false);
            }
        };
        check();
        const iv = setInterval(check, 30_000);
        return () => {
            alive = false;
            clearInterval(iv);
        };
    }, []);

    useEffect(() => {
        if (!embedded || !onClose) return;
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [embedded, onClose]);

    const switchMode = (m: Mode) => {
        if (m === 'signup' && !SIGNUP_ENABLED) return;
        setMode(m);
        setError('');
        setNotice('');
    };
    const fail = (msg: string) => {
        setError(msg);
        setShake(true);
        setTimeout(() => setShake(false), 600);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setNotice('');
        if (mode === 'signup') {
            if (!name.trim() || !email.trim() || !password) return fail('Please fill in your name, email, and password.');
            if (password.length < 8) return fail('Password must be at least 8 characters.');
            setNotice('Accounts here are created by your workspace admin. Ask them to set one up, then sign in below.');
            return;
        }
        if (!email.trim() || !password) return fail('Enter your email and password.');
        setLoading(true);
        try {
            await login(email.trim(), password);
            setSuccess(true);
        } catch (err: any) {
            fail(err?.message || 'Invalid credentials. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const isSignup = mode === 'signup';

    const form = (
        <div className="si-form" style={styles.formPanel}>
            {embedded && onClose && (
                <button aria-label="Close" onClick={onClose} style={styles.close}>
                    <X size={16} />
                </button>
            )}

            <div style={styles.formInner}>
                {/* compact header (logo + inline toggle) — shows when the rail is hidden */}
                <div className="si-compact" style={styles.compactHead}>
                    <Mark size={30} />
                    {SIGNUP_ENABLED && (
                        <div style={styles.pillWrap}>
                            <button onClick={() => switchMode('signin')} style={{ ...styles.pill, ...(mode === 'signin' ? styles.pillOn : {}) }}>Sign In</button>
                            <button onClick={() => switchMode('signup')} style={{ ...styles.pill, ...(mode === 'signup' ? styles.pillOn : {}) }}>Sign Up</button>
                        </div>
                    )}
                </div>

                {SIGNUP_ENABLED && (
                    <div style={styles.switchLine}>
                        {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
                        <span className="si-link" style={styles.switchLink} onClick={() => switchMode(isSignup ? 'signin' : 'signup')}>
                            {isSignup ? 'Sign In.' : 'Sign Up.'}
                        </span>
                    </div>
                )}

                {success ? (
                    <div style={{ textAlign: 'center', padding: '26px 0 8px' }}>
                        <div style={styles.successRing}>
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                                <path d="M4 12.5l5 5L20 6" stroke={C.ok} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                        <p style={{ fontFamily: FONT, color: C.ink, fontWeight: 600, fontSize: 15, margin: 0 }}>
                            Signed in — entering workspace…
                        </p>
                        <div style={styles.progTrack}><div style={styles.progBar} /></div>
                    </div>
                ) : (
                    <form key={mode} onSubmit={handleSubmit} noValidate className="si-swap" style={{ animation: shake ? 'siShake .5s ease' : undefined }}>
                        {/* Why you're here. Sits above `error` because a failed
                            sign-in attempt is newer news than how you arrived —
                            and dismissing this leaves the error in place. */}
                        {exitBanner && (
                            <div
                                role="status"
                                style={{
                                    ...styles.exitBanner,
                                    background: BANNER_TONES[exitBanner.tone].bg,
                                    border: `1px solid ${BANNER_TONES[exitBanner.tone].ring}`,
                                }}
                            >
                                <div style={{ flex: 1 }}>
                                    <p style={{ ...styles.exitTitle, color: BANNER_TONES[exitBanner.tone].fg }}>
                                        {exitBanner.title}
                                    </p>
                                    <p style={styles.exitBody}>{exitBanner.body}</p>
                                </div>
                                <button
                                    type="button"
                                    aria-label="Dismiss"
                                    onClick={() => setExit(null)}
                                    style={{ ...styles.exitClose, color: BANNER_TONES[exitBanner.tone].fg }}
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        )}
                        {error && <div style={styles.error}>{error}</div>}
                        {notice && <div style={styles.notice}>{notice}</div>}

                        {isSignup && (
                            <>
                                <label style={styles.label}>Full name</label>
                                <div className="si-field" style={{ marginBottom: 16 }}>
                                    <User size={17} className="si-lead" />
                                    <input className="si-input" type="text" autoComplete="name" placeholder="Ada Lovelace" value={name} onChange={(e) => setName(e.target.value)} />
                                </div>
                            </>
                        )}

                        <div style={styles.labelRow}>
                            <label style={styles.label}>Email</label>
                            {remembered && !isSignup && (
                                <span className="si-link" onClick={forgetUser} style={styles.forgot}>
                                    Not you?
                                </span>
                            )}
                        </div>
                        <div className="si-field" style={{ marginBottom: 16 }}>
                            <Mail size={17} className="si-lead" />
                            <input
                                className="si-input"
                                type="text"
                                autoComplete={isSignup ? 'email' : 'username'}
                                placeholder="youremail@gmail.com"
                                value={email}
                                onChange={(e) => {
                                    setEmail(e.target.value);
                                    // Once they start editing, the prefill is no
                                    // longer a prefill — drop the "Not you?".
                                    if (remembered) setRemembered(false);
                                }}
                            />
                        </div>

                        <label style={styles.label}>Password</label>
                        <div className="si-field" style={{ marginBottom: isSignup ? 20 : 12 }}>
                            <input ref={pwRef} className="si-input" type={showPw ? 'text' : 'password'} autoComplete={isSignup ? 'new-password' : 'current-password'} placeholder="••••••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
                            <button type="button" className="si-eye" aria-label="Toggle password" onClick={() => setShowPw((s) => !s)} style={styles.eye}>
                                {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                            </button>
                        </div>

                        {!isSignup && (
                            <div style={{ textAlign: 'right', marginBottom: 18 }}>
                                <span className="si-link" style={styles.forgot}>Forgot password?</span>
                            </div>
                        )}

                        <button type="submit" className="si-submit" disabled={loading} style={styles.submit}>
                            {loading ? <Loader size={16} style={{ animation: 'siSpin 1s linear infinite' }} /> : isSignup ? 'Create Account' : 'Sign In'}
                        </button>

                        <p style={styles.terms}>
                            By clicking {isSignup ? 'Create Account' : 'Sign In'} you agree to our terms and conditions, privacy policy and reusability rules.
                        </p>

                        <div style={styles.statusRow}>
                            <span style={{ ...styles.dot, background: online === false ? C.rose : C.ok, boxShadow: `0 0 7px ${online === false ? C.rose : C.ok}` }} />
                            <span style={styles.statusText}>
                                {online === null ? 'CHECKING API…' : online ? 'API ONLINE' : 'API OFFLINE'}
                            </span>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );

    const card = (
        <div style={styles.card}>
            {/* left nav rail */}
            <div className="si-rail" style={styles.rail}>
                <div style={{ position: 'absolute', top: 28 }}><Mark size={30} /></div>
                {((SIGNUP_ENABLED ? ['signin', 'signup'] : ['signin']) as Mode[]).map((m) => {
                    const on = mode === m;
                    return (
                        <button key={m} className="si-tab" onClick={() => switchMode(m)} style={{ ...styles.tab, color: on ? C.indigo : C.railText }}>
                            {on && <span style={styles.tabMark} />}
                            <User size={20} strokeWidth={on ? 2 : 1.6} />
                            <span style={{ fontWeight: on ? 600 : 500 }}>{m === 'signin' ? 'Sign In' : 'Sign Up'}</span>
                        </button>
                    );
                })}
            </div>

            {/* middle illustration panel */}
            <div className="si-art" style={styles.art}>
                <div key={mode} className="si-swap">
                    <h1 style={styles.artTitle}>{isSignup ? 'Join PulseDB.' : 'Welcome Back.'}</h1>
                    <p style={styles.artSub}>{isSignup ? 'Create your account to get started.' : 'Please enter your credentials.'}</p>
                </div>
                <div style={{ marginTop: 18 }}><FleetArt /></div>
                <div style={{ marginTop: 22, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: BODY, fontSize: 13, fontWeight: 700, color: THEME.textMain }}>PulseDB</span>
                    <ByProserv360 height={12} color={THEME.textMuted} />
                </div>
            </div>

            {/* right form panel */}
            {form}
        </div>
    );

    if (embedded) {
        return (
            <>
                <style>{CSS}</style>
                {card}
            </>
        );
    }

    return (
        <div style={styles.page}>
            <style>{CSS}</style>
            {card}
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    page: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 20px',
        background: `radial-gradient(120% 120% at 50% 0%, ${THEME.surface} 0%, ${C.page} 62%)`,
        fontFamily: BODY,
    },
    card: {
        position: 'relative',
        display: 'flex',
        width: '100%',
        maxWidth: 940,
        minHeight: 540,
        background: C.rail,
        borderRadius: 28,
        border: `1px solid ${C.line}`,
        boxShadow: '0 30px 70px rgba(2,8,23,0.55)',
        animation: 'siRise .6s cubic-bezier(0.16,1,0.3,1) both',
    },
    rail: {
        position: 'relative',
        width: 118,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 26,
        borderRight: `1px solid ${C.line}`,
    },
    tab: {
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 7,
        width: '100%',
        padding: '6px 0',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontFamily: FONT,
        fontSize: 13,
    },
    tabMark: { position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 4, height: 34, borderRadius: '0 4px 4px 0', background: C.indigo },
    art: {
        width: 336,
        flexShrink: 0,
        margin: '-1px 0',
        padding: '44px 34px',
        background: C.art,
        borderRadius: 28,
        boxShadow: '0 24px 50px rgba(2,8,23,0.45)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        color: THEME.textMain,
        zIndex: 2,
    },
    artTitle: { fontFamily: FONT, fontSize: 28, fontWeight: 700, margin: 0, letterSpacing: '-0.01em', color: THEME.textMain },
    artSub: { fontFamily: BODY, fontSize: 13.5, color: THEME.textMuted, margin: '8px 0 0' },
    formPanel: {
        position: 'relative',
        flex: 1,
        minWidth: 0,
        padding: '46px 6% 34px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        background: C.form,
        borderRadius: 28,
    },
    formInner: { width: '100%', maxWidth: 380, margin: '0 auto' },
    close: { position: 'absolute', top: 16, right: 16, width: 34, height: 34, borderRadius: '50%', border: `1px solid ${C.line}`, background: C.inputBg, color: C.sub, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5 },
    compactHead: { display: 'none', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 },
    pillWrap: { display: 'flex', gap: 4, background: C.inputBg, padding: 4, borderRadius: 12 },
    pill: { border: 'none', background: 'none', cursor: 'pointer', padding: '7px 14px', borderRadius: 9, fontFamily: FONT, fontSize: 13, fontWeight: 600, color: C.sub },
    pillOn: { background: C.art, color: C.indigoInk, boxShadow: '0 2px 8px rgba(2,8,23,0.35)' },
    switchLine: { fontFamily: BODY, fontSize: 13.5, color: C.sub, marginBottom: 26 },
    switchLink: { color: C.indigoInk, fontWeight: 600, cursor: 'pointer', transition: 'color .15s' },
    label: { display: 'block', fontFamily: FONT, fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 7 },
    labelRow: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' },
    exitBanner: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 10, marginBottom: 16, animation: 'siSwap .35s cubic-bezier(0.16,1,0.3,1) both' },
    exitTitle: { fontFamily: FONT, fontSize: 13.5, fontWeight: 600, margin: 0 },
    exitBody: { fontFamily: BODY, fontSize: 12.5, lineHeight: 1.45, color: C.sub, margin: '2px 0 0' },
    exitClose: { background: 'none', border: 'none', padding: 0, cursor: 'pointer', opacity: 0.7, display: 'flex', flexShrink: 0 },
    eye: { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.dim, display: 'flex' },
    forgot: { fontFamily: BODY, fontSize: 12.5, color: C.indigoInk, cursor: 'pointer', transition: 'color .15s' },
    submit: { width: '100%', padding: '14px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: 15, fontWeight: 600, color: '#fff', background: C.indigoDeep, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: `0 10px 24px ${THEME.inkBlack}80` },
    terms: { fontFamily: BODY, fontSize: 12, lineHeight: 1.55, color: C.dim, margin: '18px 0 0' },
    error: { padding: '10px 14px', borderRadius: 10, marginBottom: 16, background: `${C.rose}12`, border: `1px solid ${C.rose}30`, color: C.rose, fontFamily: BODY, fontSize: 13 },
    notice: { padding: '11px 14px', borderRadius: 10, marginBottom: 16, background: `${C.indigo}12`, border: `1px solid ${C.indigo}30`, color: C.indigoInk, fontFamily: BODY, fontSize: 12.5, lineHeight: 1.5 },
    successRing: { width: 54, height: 54, borderRadius: '50%', margin: '0 auto 14px', background: `${C.ok}1f`, border: `1px solid ${C.ok}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'siPop .4s cubic-bezier(0.34,1.56,0.64,1)' },
    progTrack: { height: 3, background: THEME.surfaceRaised, borderRadius: 2, marginTop: 16, overflow: 'hidden' },
    progBar: { height: '100%', width: 0, borderRadius: 2, background: `linear-gradient(90deg, ${C.indigo}, ${THEME.primaryLight})`, animation: 'siProg 1.2s ease forwards' },
    statusRow: { display: 'flex', alignItems: 'center', gap: 7, marginTop: 16 },
    dot: { width: 6, height: 6, borderRadius: '50%' },
    statusText: { fontFamily: BODY, fontSize: 10.5, letterSpacing: '.1em', color: C.dim },
};

export default LoginPage;
