import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ThemeProvider } from './context/ThemeContext'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { initErrorTracking, ErrorTrackingBoundary } from './utils/errorTracking'

// ── Clean up stale demo mode flag (no longer used) ────────────────────────
try { localStorage.removeItem('fathom_demo_mode'); } catch {}

// ── Initialize error tracking ──────────────────────────────────────────────
initErrorTracking({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  release: import.meta.env.VITE_APP_VERSION || '1.0.0',
  enabled: import.meta.env.PROD,
})

const root = document.getElementById('root')

// Remove pre-loader (CSS-only spinner shown before React mounts)
const preLoader = document.getElementById('pre-loader')
if (preLoader) preLoader.remove()

createRoot(root).render(
  <StrictMode>
    <ErrorTrackingBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorTrackingBoundary>
  </StrictMode>,
)

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      // Silent in production (the PWA simply degrades to a normal SPA), but
      // surface failures in dev so they don't go unnoticed.
      if (import.meta.env.DEV) {
        console.warn('[SW] Service worker registration failed:', err);
      }
    });
  });
}
