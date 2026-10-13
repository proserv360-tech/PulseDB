# Component Index - FATHOM Phase 1

Quick reference for Phase 1 components.

## Components

### shared/NoConnectionBanner.jsx

- **Purpose:** Display when no database connection is active
- **Props:** `title`, `description`, `showAddButton`
- **Key Feature:** Animated pulsing border, glass effect, info chips
- **Usage:** Wrapper component for dashboard fallback state

```jsx
import NoConnectionBanner from '@/components/shared/NoConnectionBanner';
<NoConnectionBanner title="Get Started" />;
```

### shared/ConnectionStringParser.jsx

- **Purpose:** Parse connection strings into structured fields
- **Props:** `onChange`, `onError`
- **Supported:** PostgreSQL, MySQL, MongoDB (+SRV)
- **Returns:** Object with type, host, port, username, password, database, ssl
- **Usage:** Part of connection flow or standalone parser

```jsx
import ConnectionStringParser from '@/components/shared/ConnectionStringParser';
<ConnectionStringParser onChange={(parsed) => setForm(parsed)} />;
```

### views/onboarding/ConnectionWizard.jsx

- **Purpose:** Complete multi-step database connection flow
- **Steps:** Type → Details → Options → Test → Success
- **Features:**
    - 3 database types
    - 5 provider templates
    - Connection string parsing
    - Real-time testing
    - Error recovery
- **Usage:** Mount on onboarding page or connection creation flow

```jsx
import ConnectionWizard from '@/components/views/onboarding/ConnectionWizard';
<ConnectionWizard />;
```

## File Locations

```
src/components/
├── shared/
│   ├── NoConnectionBanner.jsx
│   └── ConnectionStringParser.jsx
└── views/onboarding/
    └── ConnectionWizard.jsx
```

## API Endpoints

- `POST /api/connections/test` - Verify connection credentials
- `POST /api/connections` - Create new connection record

## Context Dependencies

- **NavigationContext** - `useNavigation()` → `goToTab()`
- **ConnectionContext** - `useConnection()` → `connections`, `refreshConnections()`

## Design Tokens Used

- Colors: `#00D4FF` (cyan), `#2AFFD4` (aquamarine), `#2EE89C` (success), `#FF4560` (danger)
- Theme values: `THEME.textMain`, `THEME.textMuted`, `THEME.fontBody`, `THEME.fontMono`
- Effects: `backdrop-filter: blur(8px)`, `rgba(0, 212, 255, 0.12)` borders
- Animations: `cubic-bezier(0.22, 1, 0.36, 1)` transitions

## Import Paths

### From Sibling Components

```jsx
import NoConnectionBanner from '../shared/NoConnectionBanner';
import ConnectionStringParser from '../shared/ConnectionStringParser';
```

### From Views/Other Tabs

```jsx
import NoConnectionBanner from '@/components/shared/NoConnectionBanner';
import ConnectionWizard from '@/components/views/onboarding/ConnectionWizard';
```

### Aliases (if configured)

```jsx
import NoConnectionBanner from 'components/shared/NoConnectionBanner';
import ConnectionWizard from 'components/views/onboarding/ConnectionWizard';
```

## Common Integration Patterns

### Check Connection Status

```jsx
import { useConnection } from '@/context/ConnectionContext';
import NoConnectionBanner from '@/components/shared/NoConnectionBanner';

function MyTab() {
    const { activeConnection, loading } = useConnection();

    if (loading) return <Spinner />;
    if (!activeConnection) return <NoConnectionBanner />;

    return <TabContent />;
}
```

### Handle Connection String Input

```jsx
import ConnectionStringParser from '@/components/shared/ConnectionStringParser';

function CustomForm() {
    const [form, setForm] = useState({});

    return (
        <>
            <ConnectionStringParser onChange={setForm} />
            <button onClick={() => submitForm(form)}>Connect</button>
        </>
    );
}
```

### Complete Onboarding Flow

```jsx
import ConnectionWizard from '@/components/views/onboarding/ConnectionWizard';
import { useConnection } from '@/context/ConnectionContext';

function OnboardingPage() {
    const { connections } = useConnection();

    return connections.length === 0 ? <ConnectionWizard /> : <DashboardContent />;
}
```

## Error Handling Examples

### Connection String Parse Error

```jsx
<ConnectionStringParser
    onError={(error) => {
        console.error('Parse failed:', error);
        // Show toast/snackbar
    }}
/>
```

### Test Connection Failure

```jsx
// Built into ConnectionWizard - shows error on step 4
// User can review details and retry
// Back button allows form editing
```

## Performance Tips

1. **NoConnectionBanner** - Lightweight, safe to mount/unmount frequently
2. **ConnectionStringParser** - Parsing happens on input change (debounce if needed)
3. **ConnectionWizard** - Async operations only on explicit user action (test, submit)

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Testing Considerations

- **NoConnectionBanner:** Mock `useNavigation`, `useConnection`
- **ConnectionStringParser:** Test all URL formats, error cases
- **ConnectionWizard:** Mock API endpoints, test wizard flow, error states

## Documentation

See `PHASE1_COMPONENTS.md` for comprehensive integration guide and examples.
