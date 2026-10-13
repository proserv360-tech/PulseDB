# FATHOM frontend

React 19 + Vite SPA. Run `npm run dev` (proxies `/api` and `/ws` to the
backend on port 5000), `npm run build`, `npm run test:run`.

## Source layout (`src/`)

| Path | Contents |
| --- | --- |
| `main.tsx`, `App.tsx` | Entry point and the provider tree |
| `app/` | App shell: `AuthConsumer` (routing between landing, login and dashboard), `Dashboard`, `tabRegistry` (lazy tab components + tab/section config), `ErrorBoundary`, `LoadingScreen`, `queryClient` |
| `components/layout/` | Shell chrome: `Sidebar`, `ConnectionSelector`, `NotificationCenter`, `ProfileModal`, `FeedbackModal`, `AppStyles`, header controls, connection/database switchers |
| `components/ui/` | Shared UI: `SharedComponents`, `tremor/` primitives, `CommandPalette`, `SectionErrorBoundary`, banners, skeletons |
| `components/auth/` | Login, SSO callback, forced password change |
| `components/views/<area>/` | One folder per product area: `monitoring`, `database`, `operations`, `security`, `observability`, `analytics`, `admin`, `usermanagement`, `mysql`, `mongodb`, `console`, `onboarding`, `demo` |
| `config/` | Design tokens and `tabConfig` |
| `context/` | Auth, connection, theme, navigation and demo providers |
| `enterprise/` | License/org features (not mounted yet) |
| `hooks/`, `utils/` | Shared hooks; API client, theme, formatting and engine catalogs |
| `pages/` | Standalone pages (landing, marketplace) |

To add a tab: create the view under `components/views/<area>/`, add a lazy
import in `app/tabRegistry.tsx`, and register it in `config/tabConfig.ts`.
