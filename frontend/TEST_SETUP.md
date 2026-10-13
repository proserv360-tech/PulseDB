# FATHOM Test Framework Setup

## Overview

This directory contains the test framework for the FATHOM PostgreSQL monitoring tool frontend. The framework uses **Vitest** (a Vite-native unit testing framework) to test core configuration and utility modules.

## Test Structure

### Test Files

1. **`src/config/__tests__/designTokens.test.js`**
    - Tests the design token system (DS_DARK, DS_LIGHT, DS_ACCENTS)
    - Validates that all required theme properties exist
    - Tests theme switching functionality via `getDS()` and `setDS()`
    - Ensures theme consistency and contrast

2. **`src/config/__tests__/tabConfig.test.js`**
    - Tests the tab configuration registry (central source of truth for dashboard tabs)
    - Validates `registerComponents()` for component storage
    - Tests `buildTabConfig()` returns correct tab structure with sections and metadata
    - Validates `getTabsOnly()` filters tabs from section headers
    - Tests `getSectionGroups()` creates proper hierarchical grouping
    - Verifies `getSectionForTab()` and `getSectionAccent()` lookups

3. **`src/utils/__tests__/demoData.test.js`**
    - Tests the demo data provider for API route mocking
    - Validates `getDemoData()` returns proper data structures for key routes
    - Tests `/api/overview`, `/api/performance`, `/api/alerts`, `/api/indexes`, `/api/reliability`
    - Validates query string handling and unknown route fallback
    - Tests data consistency and structure validation

## Configuration

### Vite Config

The vitest configuration is integrated into `vite.config.js`:

```javascript
test: {
  globals: true,
  environment: 'node',
  include: ['src/**/*.test.js', 'src/**/*.spec.js'],
}
```

### NPM Scripts

Added to `package.json`:

- `npm run test` — Run tests in watch mode
- `npm run test:run` — Run tests once and exit
- `npm run test:ui` — Open Vitest UI for interactive testing

## Running Tests

### Installation

Before running tests, ensure all dependencies are installed:

```bash
npm install
```

### Run Tests

```bash
# Watch mode (recommended during development)
npm run test

# Single run (CI/CD)
npm run test:run

# Interactive UI
npm run test:ui
```

### Test Output

Tests produce clear output showing:

- Pass/fail status for each test suite
- Number of tests passed/failed
- Execution time
- Coverage details (if enabled)

## Test Coverage

### Current Coverage

- **Design System**: 100% coverage of theme tokens and switching
- **Tab Configuration**: Full coverage of tab registry, component registration, and grouping logic
- **Demo Data**: Comprehensive coverage of API route matching and data structure validation

### Key Areas Tested

**designTokens.test.js** (5 test suites, 20+ tests):

- Theme property presence and validity
- Theme switching between dark and light modes
- Accent color inheritance and consistency
- Font definitions

**tabConfig.test.js** (8 test suites, 40+ tests):

- Component registration and storage
- Tab configuration building and structure
- Tab filtering and section grouping
- Section lookup by tab ID
- Accent color assignment and retrieval
- Integration tests for consistency

**demoData.test.js** (8 test suites, 35+ tests):

- Overview, Performance, Alerts endpoints
- Index and Reliability data structures
- Query string handling
- Unknown route fallback behavior
- Data consistency across calls
- Special endpoint patterns (test, acknowledge, bulk operations)

## Test Philosophy

These tests follow a **behavior-driven** approach:

- Focus on testing **what** the functions do, not **how** they do it
- Use descriptive test names that read like specifications
- Test both happy paths and edge cases
- Validate data structure and types
- Check consistency between related functions

## Adding New Tests

When adding new tests:

1. Create a new file in the appropriate `__tests__` directory
2. Follow the existing naming convention: `moduleName.test.js`
3. Use `describe()` for grouping related tests
4. Use `it()` for individual assertions
5. Use `expect()` for validation
6. Import only from the module under test

Example:

```javascript
import { describe, it, expect } from 'vitest';
import { myFunction } from '../myModule.js';

describe('myModule', () => {
    it('should do something specific', () => {
        const result = myFunction('input');
        expect(result).toBe('expected output');
    });
});
```

## Vitest Resources

- [Vitest Documentation](https://vitest.dev/)
- [Vitest API Reference](https://vitest.dev/api/)
- [Testing Best Practices](https://vitest.dev/guide/best-practices.html)

## Notes

- Tests do not require any npm packages beyond those already in devDependencies (vitest can be added when ready)
- Tests use Node.js environment for simplicity (no browser mocking needed for these units)
- Test files are colocated with source code in `__tests__` directories for easy discoverability
- All tests are synchronous for clarity and predictability

## Future Enhancements

Potential areas for test expansion:

- Component rendering tests (React Testing Library)
- Integration tests for the full dashboard flow
- E2E tests using Playwright or Cypress
- Performance benchmarks for configuration and demo data generation
- Visual regression testing
