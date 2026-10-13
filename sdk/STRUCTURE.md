# SDK Package Structure

```
sdk/
├── package.json              # NPM package metadata
├── build.cjs                 # Build script (ESM → CJS conversion)
├── .gitignore                # Git ignore rules
├── README.md                 # Comprehensive documentation
├── STRUCTURE.md              # This file
│
├── src/
│   ├── index.js              # Main SDK class (ESM) - 400+ lines
│   └── index.d.ts            # TypeScript definitions
│
├── dist/
│   └── index.cjs             # CommonJS build (generated)
│
├── examples/
│   ├── basic-usage.js        # Simple usage example
│   └── express-server.js     # Express middleware integration example
│
└── tests/
    └── fathom.test.js         # Unit tests
```

## File Descriptions

### `package.json`

- Declares the package as `@fathom/sdk` v1.0.0
- Configures both ESM and CJS exports
- Specifies Node.js 18+ requirement
- Includes build and test scripts

### `src/index.js` (Main SDK)

The complete FATHOM SDK implementation with:

- **FathomSDK class**: Main entry point
- **Inline EventEmitter**: Zero-dependency event system
- **Core Methods**:
    - `trackAPI()` - Track HTTP requests
    - `trackError()` - Track exceptions and errors
    - `trackAudit()` - Track audit trail events
    - `trackMetric()` - Track numeric metrics
    - `track()` - Track custom events
- **Auto-Capture**:
    - `expressMiddleware()` - Auto-track all Express requests
    - `captureUncaughtExceptions()` - Catch uncaught errors
- **Batching & Transport**:
    - `_enqueue()` - Queue events with auto-flush
    - `flush()` - Send batched events to FATHOM
    - `heartbeat()` - Send health checks
    - `start()` / `shutdown()` - Lifecycle management
- **Utilities**:
    - `_generateId()` - Session ID generation
    - `_log()` - Debug logging

### `src/index.d.ts`

TypeScript type definitions for:

- FathomSDK class and all method signatures
- Configuration interfaces
- Event tracking options
- EventEmitter interface

### `build.cjs`

Simple Node.js build script that:

1. Reads `src/index.js` (ESM)
2. Converts exports to CommonJS
3. Writes to `dist/index.cjs`

Usage: `npm run build`

### `examples/basic-usage.js`

Standalone example demonstrating:

- SDK initialization
- All tracking methods (API, error, audit, metric, custom)
- Graceful shutdown

### `examples/express-server.js`

Full Express.js integration example with:

- FATHOM middleware setup
- Auto-tracking of all routes
- Error handling
- Graceful shutdown on SIGTERM

### `tests/fathom.test.js`

Unit tests for:

- SDK initialization validation
- Event queueing
- Error tracking
- Event listeners
- Graceful shutdown

Run with: `npm test`

### `README.md`

Comprehensive 400+ line documentation including:

- Quick start guide
- Configuration reference
- Usage examples for all tracking methods
- Express middleware guide
- MuleSoft integration pattern
- Salesforce Apex callout example
- Batching & performance tuning
- Error handling strategies
- Environment setup
- Complete API reference
- Event types documentation

## Key Features

### Zero Dependencies

- No external packages required
- Inline EventEmitter for browser/Node.js compatibility
- Native `fetch` for HTTP (Node 18+)

### Event Batching

- Queue events until `batchSize` reached (default 50)
- Auto-flush every `flushInterval` ms (default 10000)
- Manual flush with `await fathom.flush()`
- Failed events re-queued on network errors

### Express Integration

- Single middleware call
- Automatic tracking of all routes
- Captures method, path, status, duration, user-agent, IP

### Error Handling

- Graceful network failure recovery
- Console warnings without crashes
- Event re-queueing on send failure

### Production Ready

- Session tracking across events
- Severity levels (info, warning, error, critical)
- Metadata support on all event types
- Timestamp included automatically
- Debug logging available

## Usage

### Install from npm

```bash
npm install @fathom/sdk
```

### ESM Import

```javascript
import FathomSDK from '@fathom/sdk';
```

### CJS Require

```javascript
const FathomSDK = require('@fathom/sdk');
```

### Build for Distribution

```bash
npm run build
```

### Run Tests

```bash
npm test
```
