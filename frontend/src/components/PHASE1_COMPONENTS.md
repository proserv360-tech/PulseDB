# FATHOM Phase 1 Components

This document describes the Phase 1 components built for FATHOM database monitoring platform.

## Overview

Phase 1 introduces three critical onboarding and connection management components that follow FATHOM's design system (glassmorphism, cyan/teal accents, inline styles, lucide-react icons).

## Components

### 1. NoConnectionBanner.jsx

**Location:** `/components/shared/NoConnectionBanner.jsx`

A reusable banner component shown when no database connection is active.

**Features:**

- Animated gradient border with pulsing glow effect
- Glass-effect card with `backdrop-filter: blur(8px)`
- Customizable title and description
- Four info chips (Host & Port, Database Name, Credentials, SSL Optional)
- "Add Connection" button that navigates to pool tab
- Responsive design with hover animations
- Semi-transparent backgrounds matching FATHOM theme (rgba values)

**Props:**

```jsx
{
  title?: string          // Default: "No Database Connected"
  description?: string    // Default: onboarding message
  showAddButton?: boolean  // Default: true
}
```

**Usage:**

```jsx
import NoConnectionBanner from '@/components/shared/NoConnectionBanner';

export function MyPage() {
    return <NoConnectionBanner />;
}
```

**Dependencies:**

- React, useState, useEffect
- lucide-react: Database, Plus, Shield, Key, Wifi, Zap
- NavigationContext (useNavigation)
- ConnectionContext (useConnection)
- THEME from utils/theme.jsx

---

### 2. ConnectionStringParser.jsx

**Location:** `/components/shared/ConnectionStringParser.jsx`

A utility component that parses database connection strings and extracts individual fields.

**Features:**

- Supports multiple connection string formats:
    - PostgreSQL: `postgresql://user:pass@host:port/database?sslmode=require`
    - MySQL: `mysql://user:pass@host:port/database`
    - MongoDB SRV: `mongodb+srv://user:pass@cluster.mongodb.net/database`
    - MongoDB Standard: `mongodb://user:pass@host:port/database`
- Real-time parsing with validation
- Displays parsed breakdown below textarea
- Copy-to-clipboard buttons for each field
- Error handling with helpful messages
- SSL mode detection from query parameters

**Props:**

```jsx
{
  onChange?: (parsed: ParsedConnectionData) => void
  onError?: (error: string) => void
}
```

**Returned Data Structure:**

```javascript
{
    type: 'postgresql' | 'mysql' | 'mongodb';
    host: string;
    port: string | number;
    username: string;
    password: string;
    database: string;
    ssl: boolean;
    sslmode: string; // e.g., 'require', 'true'
    rawParams: object; // All query parameters
}
```

**Usage:**

```jsx
import ConnectionStringParser from '@/components/shared/ConnectionStringParser';

function MyWizard() {
  const handleParsed = (data) => {
    console.log('Parsed connection:', data);
    setFormFields({
      host: data.host,
      port: data.port,
      ...
    });
  };

  return <ConnectionStringParser onChange={handleParsed} />;
}
```

**Dependencies:**

- React, useState, useCallback
- lucide-react: Copy, Check, AlertCircle
- THEME from utils/theme.jsx

---

### 3. ConnectionWizard.jsx

**Location:** `/components/views/onboarding/ConnectionWizard.jsx`

A comprehensive multi-step wizard for creating new database connections.

**Features:**

- 5-step wizard:
    1. **Type Selection** - Choose PostgreSQL/MySQL/MongoDB with provider templates
    2. **Connection Details** - Manual entry or connection string parsing
    3. **Options** - SSL/TLS, SSH tunnel configuration
    4. **Test Connection** - Real-time connection verification
    5. **Success Screen** - Confirmation with dashboard navigation

- Provider Templates (pre-configured):
    - AWS RDS
    - Neon
    - Supabase
    - PlanetScale
    - MongoDB Atlas

- Built-in Features:
    - Step indicator with progress tracking
    - Connection string parsing via ConnectionStringParser
    - Real-time form validation
    - Loading states during testing
    - Error handling with retry capability
    - Automatic connection activation on success
    - Context integration for connection management

**DB Types Configuration:**

```javascript
{
  postgresql: { label: 'PostgreSQL', defaultPort: 5432, color: '#336791', icon: '🐘' }
  mysql: { label: 'MySQL', defaultPort: 3306, color: '#f29111', icon: '🐬' }
  mongodb: { label: 'MongoDB', defaultPort: 27017, color: '#13aa52', icon: '🍃' }
}
```

**API Endpoints Used:**

- `POST /api/connections/test` - Test connection with provided credentials
- `POST /api/connections` - Create new connection (called on test success)

**Usage:**

```jsx
import ConnectionWizard from '@/components/views/onboarding/ConnectionWizard';

export function OnboardingPage() {
    return <ConnectionWizard />;
}
```

**Dependencies:**

- React, useState, useEffect, useCallback
- lucide-react: ChevronRight, ChevronLeft, CheckCircle, Loader, AlertCircle, Database, etc.
- postData from utils/api
- NavigationContext (useNavigation)
- ConnectionContext (useConnection)
- ConnectionStringParser component
- THEME from utils/theme.jsx

---

## Design System Integration

All components follow FATHOM's design conventions:

### Colors & Tokens (from THEME)

- **Primary:** `#00D4FF` (Electric Cyan)
- **Secondary:** `#2AFFD4` (Aquamarine)
- **Success:** `#2EE89C` (Emerald)
- **Danger:** `#FF4560` (Infrared)
- **Warning:** `#FFB520` (Solar)
- **Text Main:** `#F0ECF8` (Warm Violet)
- **Text Muted:** `#9888B4` (Orchid)
- **Glass:** `rgba(18, 10, 31, 0.65)` (Dark with transparency)

### Styling Patterns

- **Inline styles only** (no CSS modules or classNames)
- **Glassmorphism:** `backdrop-filter: blur(8px)` on dark backgrounds
- **Borders:** `rgba(0, 212, 255, 0.12)` to `0.4)` with hover states
- **Animations:** Smooth transitions using `cubic-bezier(0.22, 1, 0.36, 1)`
- **Icons:** lucide-react with consistent sizing (12-32px)

### Typography

- **Display:** `THEME.fontBody` ('Exo 2', sans-serif)
- **Monospace:** `THEME.fontMono` (JetBrains Mono)
- **Font Weights:** 500 (normal), 600 (labels), 700 (titles)

---

## Integration Examples

### Using NoConnectionBanner in a Dashboard Tab

```jsx
import NoConnectionBanner from '@/components/shared/NoConnectionBanner';
import { useConnection } from '@/context/ConnectionContext';

function DashboardTab() {
    const { activeConnection, loading } = useConnection();

    if (loading) return <div>Loading...</div>;

    if (!activeConnection) {
        return <NoConnectionBanner />;
    }

    // Render normal dashboard content
    return <Dashboard connection={activeConnection} />;
}
```

### Using ConnectionWizard in Onboarding Flow

```jsx
import ConnectionWizard from '@/components/views/onboarding/ConnectionWizard';
import { useConnection } from '@/context/ConnectionContext';

function OnboardingFlow() {
    const { connections } = useConnection();

    // Show wizard if no connections exist
    if (connections.length === 0) {
        return <ConnectionWizard />;
    }

    return <SelectExistingConnection />;
}
```

### Using ConnectionStringParser in Custom Form

```jsx
import ConnectionStringParser from '@/components/shared/ConnectionStringParser';

function CustomConnectionForm() {
    const [formData, setFormData] = useState({
        host: '',
        port: '',
        username: '',
        password: '',
        database: '',
    });

    const handleStringParsed = (parsed) => {
        // Auto-populate form from connection string
        setFormData({
            host: parsed.host,
            port: parsed.port,
            username: parsed.username,
            password: parsed.password,
            database: parsed.database,
        });
    };

    return (
        <div>
            <ConnectionStringParser onChange={handleStringParsed} />
            {/* Rest of form... */}
        </div>
    );
}
```

---

## Error Handling

### ConnectionWizard

- **Test Failure:** Shows error message with retry button
- **Connection Creation Failure:** Allows backtracking to fix details
- **Validation:** Empty field checks before submission

### ConnectionStringParser

- **Invalid Format:** Displays error message below textarea
- **Unsupported Protocol:** Shows specific protocol error
- **Malformed URL:** Provides user-friendly error description

### NoConnectionBanner

- **No visible errors:** Component is resilient and always renders
- **Context fallback:** Uses default props if context unavailable

---

## Browser Compatibility

All components use modern CSS and React features:

- CSS Backdrop Filters (supported in all modern browsers)
- CSS Grid and Flexbox layouts
- React Hooks (useState, useEffect, useCallback, useContext)
- ES6+ JavaScript

Tested with:

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

---

## Performance Considerations

- **NoConnectionBanner:** Single setState in useEffect (animation toggle)
- **ConnectionStringParser:** onChange debounced via user input
- **ConnectionWizard:** Lazy validation, API calls only on explicit action

---

## Future Enhancements

- [ ] Multi-pool connections (connect to multiple databases simultaneously)
- [ ] Connection pooling configuration panel
- [ ] Connection health monitoring
- [ ] Credential encryption storage
- [ ] OAuth/SSO integration templates
- [ ] Bulk connection import from YAML/JSON
- [ ] Connection duplicate detection
- [ ] Connection history and rollback

---

## File Structure

```
frontend/src/components/
├── shared/
│   ├── NoConnectionBanner.jsx          ← Connection status banner
│   ├── ConnectionStringParser.jsx      ← String parsing utility
│   └── ... (existing components)
├── views/
│   ├── onboarding/
│   │   ├── ConnectionWizard.jsx        ← Multi-step wizard
│   │   └── ... (future onboarding screens)
│   └── ... (other view tabs)
└── ... (other structure)
```

---

## Author Notes

- All components are **production-ready**
- Code follows existing FATHOM patterns and conventions
- Each component is self-contained and independently testable
- API integration uses existing `postData` and `fetchData` utilities
- Context providers (NavigationContext, ConnectionContext) are required in parent
