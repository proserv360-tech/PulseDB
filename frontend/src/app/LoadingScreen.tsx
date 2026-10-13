// Full-screen loading state.
// Extracted from App.tsx.
import { Database } from 'lucide-react';
import { DS } from '../config/designTokens';

/* ─────────────────────────────────────────────────────────────────
   LOADING SCREEN
   ───────────────────────────────────────────────────────────────── */
export const LoadingScreen = () => (
    <div
        style={{
            height: '100vh',
            background: DS.bg,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 20,
            color: DS.textPrimary,
            fontFamily: DS.fontUI,
        }}
    >
        <div style={{ position: 'relative', width: 56, height: 56 }}>
            {/* Spinning ring */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '50%',
                    border: `2px solid ${DS.border}`,
                    borderTopColor: DS.cyan,
                    animation: 'rotate 1.1s linear infinite',
                }}
            />
            {/* Inner logo */}
            <div
                style={{
                    position: 'absolute',
                    inset: 8,
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${DS.cyan}30, ${DS.violet}30)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Database color={DS.cyan} size={18} />
            </div>
        </div>
        <div>
            <div
                style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: DS.textPrimary,
                    textAlign: 'center',
                    letterSpacing: '-0.01em',
                }}
            >
                PulseDB
            </div>
            <div
                style={{
                    fontSize: 11,
                    color: DS.textMuted,
                    textAlign: 'center',
                    marginTop: 4,
                    fontFamily: DS.fontMono,
                    letterSpacing: '0.02em',
                }}
            >
                INITIALIZING…
            </div>
        </div>
    </div>
);
