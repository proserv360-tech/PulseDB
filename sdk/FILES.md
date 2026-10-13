# FATHOM SDK - File Reference Guide

## Quick Navigation

### Getting Started

- **README.md** - Start here! Comprehensive usage guide
- **DEPLOYMENT.md** - Integration patterns and deployment guide
- **STRUCTURE.md** - Package structure and architecture

### Implementation Files

- **package.json** - NPM package metadata and configuration
- **src/index.js** - Main SDK implementation (400 lines)
- **src/index.d.ts** - TypeScript type definitions
- **build.cjs** - Build script for CommonJS conversion

### Examples

- **examples/basic-usage.js** - Simple SDK usage example
- **examples/express-server.js** - Express.js integration example

### Testing

- **tests/fathom.test.js** - Unit tests (run: npm test)

### Configuration

- **.gitignore** - Git ignore patterns

---

## File Contents Summary

### README.md (595 lines)

**Primary documentation for SDK users**

Sections:

1. Quick Start - Installation and basic setup
2. Configuration Options - All config parameters explained
3. Usage - Examples for each tracking method:
    - trackAPI() - HTTP request tracking
    - trackError() - Error tracking
    - trackAudit() - Audit event tracking
    - trackMetric() - Metric tracking
    - track() - Custom event tracking
4. Auto-Capture - Express middleware, exception handling
5. Advanced Usage - Manual flush, heartbeat, listeners, shutdown
6. Integration Patterns:
    - MuleSoft XML integration
    - Salesforce Apex REST callout
7. Batching & Performance - Configuration tuning
8. Error Handling - Graceful failure strategies
9. Environment Variables - .env setup
10. Browser Support - Client-side usage
11. API Reference - Complete method documentation with type tables
12. Event Types - Explanation of all event categories

### DEPLOYMENT.md (400+ lines)

**Integration and deployment guide for system architects**

Sections:

1. Package Overview - Key specs
2. Quick Integration Guide - 4-step startup
3. Core Methods Reference - All methods with examples
4. Environment Configuration - .env file setup
5. Performance Tuning:
    - High-volume applications (larger batches)
    - Real-time monitoring (smaller batches)
6. Integration Patterns:
    - Express.js (complete example)
    - Fastify (with hooks)
    - Database operations (tracking queries)
    - AWS Lambda (serverless example)
7. Deployment Checklist - 10-item verification list
8. Troubleshooting:
    - Events not appearing
    - High network usage
    - Memory concerns
9. API Endpoint Specification:
    - Event ingestion endpoint details
    - Heartbeat endpoint details
10. Support & Resources

### STRUCTURE.md (300+ lines)

**Package architecture and file structure guide**

Sections:

1. File directory tree
2. Detailed file descriptions
3. Key Features overview
4. Usage instructions (install, import, build, test)

### src/index.js (400 lines)

**Main SDK implementation**

Contains:

- EventEmitter class (inline, zero-dependency)
- FathomSDK class with all methods:
    - Core methods: trackAPI, trackError, trackAudit, trackMetric, track
    - Auto-capture: expressMiddleware, captureUncaughtExceptions
    - Batching: \_enqueue, flush
    - Lifecycle: start, shutdown
    - Health: heartbeat
    - Utilities: \_generateId, \_log

Features:

- Event queuing with auto-flush
- Batch management
- Network error recovery
- Full event listener API
- Debug logging

### src/index.d.ts (98 lines)

**TypeScript definitions**

Exports:

- FathomSDK class definition
- FathomOptions interface
- TrackAPIOptions interface
- TrackErrorOptions interface
- TrackAuditOptions interface
- TrackMetricOptions interface
- TrackCustomOptions interface
- Event interface

### package.json (35 lines)

**NPM package configuration**

Specifies:

- Package name: @fathom/sdk
- Version: 1.0.0
- Main entry: dist/index.js (CJS)
- Module entry: src/index.js (ESM)
- Exports: dual ESM/CJS support
- Keywords: fathom, monitoring, observability
- Scripts: build, test
- Node requirement: >=18.0.0
- License: MIT

### build.cjs (30 lines)

**Build script for ESM to CJS conversion**

Function:

1. Reads src/index.js (ESM)
2. Converts exports to CommonJS
3. Writes dist/index.cjs
4. Logs completion status

Usage:

```bash
npm run build
```

### examples/basic-usage.js (71 lines)

**Simple SDK usage example**

Demonstrates:

- SDK initialization with options
- trackAPI() usage
- trackError() with try/catch
- trackAudit() usage
- trackMetric() usage
- track() custom event
- Graceful shutdown

### examples/express-server.js (73 lines)

**Express.js integration example**

Demonstrates:

- Express app creation
- FATHOM middleware setup
- Exception capture configuration
- Multiple route handlers:
    - GET /api/users - Basic route
    - POST /api/users - Create with audit
    - GET /api/error - Error demonstration
    - GET /api/metric - Metric tracking
- SIGTERM signal handling
- Server startup with auto-flush

### tests/fathom.test.js (94 lines)

**Unit test suite**

Tests:

1. SDK initialization validation
    - Requires apiKey
    - Requires endpoint
    - Sets defaults correctly
2. Event queueing mechanism
    - Events added to queue
    - Queue length tracking
    - Type validation
3. Error tracking
    - Error object extraction
    - Message parsing
4. Event listeners
    - on() method
    - emit() method
5. Graceful shutdown
    - Timer cleanup
    - Shutdown flag
    - Queue preservation

Run:

```bash
npm test
```

### .gitignore

**Git configuration file**

Ignores:

- node_modules/
- dist/ (build artifacts)
- .env files
- .vscode/ and .idea/ (IDE configs)
- coverage/ (test coverage)
- OS files (.DS_Store, Thumbs.db)
- Temporary files

### FILES.md (this file)

**Quick reference guide for all files**

---

## Implementation Statistics

| File                       | Lines | Size   | Purpose             |
| -------------------------- | ----- | ------ | ------------------- |
| src/index.js               | 400   | 15 KB  | Main SDK code       |
| src/index.d.ts             | 98    | 3 KB   | Type definitions    |
| README.md                  | 595   | 20 KB  | Usage documentation |
| DEPLOYMENT.md              | 400+  | 18 KB  | Deployment guide    |
| STRUCTURE.md               | 300+  | 12 KB  | Architecture guide  |
| examples/basic-usage.js    | 71    | 1.5 KB | Simple example      |
| examples/express-server.js | 73    | 1.8 KB | Express example     |
| tests/fathom.test.js       | 94    | 2.1 KB | Unit tests          |
| package.json               | 35    | 0.7 KB | Package config      |
| build.cjs                  | 30    | 0.8 KB | Build script        |
| .gitignore                 | 25    | 0.5 KB | Git config          |

**Total: 1,366 lines, 75 KB of code + documentation**

---

## How to Use This Package

### For End Users

1. Read: **README.md** - Learn how to use the SDK
2. Reference: **DEPLOYMENT.md** - See integration examples
3. Code: **examples/** - Copy patterns for your use case

### For Integrators

1. Read: **DEPLOYMENT.md** - Understand integration options
2. Study: **examples/** - See practical implementations
3. Reference: **src/index.js** - Review implementation details

### For Developers

1. Study: **src/index.js** - Main implementation
2. Check: **tests/fathom.test.js** - Test suite
3. Review: **src/index.d.ts** - Type definitions
4. Build: Run `npm run build` to generate CJS version

### For Package Maintainers

1. Review: **package.json** - Package configuration
2. Run: **build.cjs** - Generate distribution files
3. Test: **tests/fathom.test.js** - Verify functionality
4. Publish: `npm publish` to release

---

## File Dependencies

```
package.json
  └─> src/index.js (main implementation)
      └─> src/index.d.ts (type definitions)

build.cjs
  └─> src/index.js (input)
      └─> dist/index.cjs (output)

examples/
  └─> basic-usage.js (imports src/index.js)
  └─> express-server.js (imports src/index.js + express)

tests/
  └─> fathom.test.js (imports src/index.js)
```

---

## Quick Commands

```bash
# Install dependencies (none required!)
npm install

# Build CommonJS version
npm run build

# Run tests
npm test

# Publish to npm
npm publish
```

---

## Next Steps

1. **Install**: `npm install @fathom/sdk`
2. **Read**: Start with README.md
3. **Integrate**: Follow DEPLOYMENT.md patterns
4. **Test**: Check examples/ for working code
5. **Deploy**: Use deployment checklist from DEPLOYMENT.md
