/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],

    theme: {
        extend: {
            colors: {
                'pulsedb-bg': '#04060f',
                'pulsedb-surface': '#0a0f1e',
                'pulsedb-surface-alt': '#0f1529',
                'pulsedb-elevated': '#15192d',
                'pulsedb-border': 'rgba(255,255,255,0.06)',
                'pulsedb-text': '#f0f4ff',
                'pulsedb-muted': '#94a3b8',
                'pulsedb-accent': '#38bdf8',
                'pulsedb-accent-soft': 'rgba(56, 189, 248, 0.1)',
                'pulsedb-accent-mid': 'rgba(56, 189, 248, 0.25)',
                'pulsedb-cyan': '#22d3ee',
                'pulsedb-emerald': '#34d399',
                'pulsedb-violet': '#a78bfa',
                'pulsedb-rose': '#fb7185',
                'pulsedb-amber': '#fbbf24',
            },

            fontFamily: {
                ui: ['Inter', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },

            borderRadius: {
                xs: '0.25rem',
                sm: '0.375rem',
                md: '0.5rem',
                lg: '0.75rem',
                xl: '1rem',
                '2xl': '1.5rem',
            },

            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                fadeUp: {
                    '0%': { opacity: '0', transform: 'translateY(16px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                slideDown: {
                    '0%': { transform: 'translateY(-100%)' },
                    '100%': { transform: 'translateY(0)' },
                },
                slideInRight: {
                    '0%': { transform: 'translateX(100%)', opacity: '0' },
                    '100%': { transform: 'translateX(0)', opacity: '1' },
                },
                glowPulse: {
                    '0%, 100%': { boxShadow: '0 0 8px rgba(56, 189, 248, 0.4)' },
                    '50%': { boxShadow: '0 0 16px rgba(56, 189, 248, 0.8)' },
                },
                shimmer: {
                    '0%': { backgroundPosition: '-1000px 0' },
                    '100%': { backgroundPosition: '1000px 0' },
                },
                pulseDot: {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0.4' },
                },
                float: {
                    '0%, 100%': { transform: 'translateY(0px)' },
                    '50%': { transform: 'translateY(-8px)' },
                },
            },

            animation: {
                fadeIn: 'fadeIn 0.3s ease-out',
                fadeUp: 'fadeUp 0.5s ease-out',
                slideDown: 'slideDown 0.3s ease-out',
                slideInRight: 'slideInRight 0.4s ease-out',
                glowPulse: 'glowPulse 2s ease-in-out infinite',
                shimmer: 'shimmer 2s infinite',
                pulseDot: 'pulseDot 1.5s ease-in-out infinite',
                float: 'float 3s ease-in-out infinite',
            },

            boxShadow: {
                'glow-sm': '0 0 12px rgba(56, 189, 248, 0.3)',
                'glow-md': '0 0 20px rgba(56, 189, 248, 0.5)',
                'glow-lg': '0 0 32px rgba(56, 189, 248, 0.7)',
                card: '0 4px 16px rgba(0, 0, 0, 0.4)',
                elevated: '0 8px 32px rgba(0, 0, 0, 0.6)',
            },

            backdropBlur: {
                xs: '2px',
                sm: '4px',
                md: '8px',
                lg: '12px',
                xl: '16px',
            },

            transitionTimingFunction: {
                smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
                bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
            },
        },
    },

    darkMode: 'selector',

    plugins: [],
};
