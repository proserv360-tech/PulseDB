# FATHOM Frontend Test Framework Index

## Quick Links

- **Getting Started**: Read [TESTING_QUICK_START.md](TESTING_QUICK_START.md) (2 min)
- **Full Documentation**: See [TEST_SETUP.md](TEST_SETUP.md) (10 min)
- **Implementation Details**: Check [../TESTING_FRAMEWORK_SUMMARY.txt](../TESTING_FRAMEWORK_SUMMARY.txt)

## Test Files Overview

### 1. Design Tokens (`src/config/__tests__/designTokens.test.js`)

Tests the visual system's theme definitions and switching.

**What it tests:**

- Theme token properties (colors, fonts, shadows)
- Theme switching between dark and light modes
- Accent color consistency
- Required properties presence

**Key functions tested:**

- `getDS()` — Get current theme
- `setDS(theme)` — Switch to a different theme
- `DS_DARK`, `DS_LIGHT`, `DS_ACCENTS` — Theme definitions

**Run only this test:**

```bash
npm run test -- designTokens.test
```

### 2. Tab Configuration (`src/config/__tests__/tabConfig.test.js`)

Tests the dashboard tab registry and component management.

**What it tests:**

- Component registration and lookup
- Tab configuration structure
- Tab filtering and grouping
- Section hierarchy and accent colors
- Tab ID to section mapping

**Key functions tested:**

- `registerComponents(components)` — Store component registry
- `buildTabConfig()` — Build full tab configuration
- `getTabsOnly(config)` — Filter tabs from sections
- `getSectionGroups(config)` — Create section hierarchies
- `getSectionForTab(groups, tabId)` — Find section for tab
- `getSectionAccent(groups, tabId)` — Get section accent color

**Run only this test:**

```bash
npm run test -- tabConfig.test
```

### 3. Demo Data (`src/utils/__tests__/demoData.test.js`)

Tests the API route mocking and demo data generation.

**What it tests:**

- Demo data for all major API routes
- Data structure and type validation
- Query string parameter handling
- Unknown route fallback behavior
- Data consistency across calls

**Key functions tested:**

- `getDemoData(path)` — Get mock data for API route
- `isDemoMode()` — Check if demo mode is enabled
- Route patterns: `/api/overview`, `/api/performance`, `/api/alerts`, `/api/indexes`, `/api/reliability`

**Run only this test:**

```bash
npm run test -- demoData.test
```

## Running Tests

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Run tests (watch mode)
npm run test

# Run tests once
npm run test:run

# Interactive UI
npm run test:ui

# Run specific test file
npm run test -- designTokens.test
```

## Test Statistics

| File                 | Lines   | Suites | Assertions |
| -------------------- | ------- | ------ | ---------- |
| designTokens.test.js | 177     | 8      | 20+        |
| tabConfig.test.js    | 349     | 8      | 40+        |
| demoData.test.js     | 307     | 8      | 35+        |
| **Total**            | **833** | **24** | **100+**   |

## File Structure

```
frontend/
├── vite.config.js                 (Vitest configuration)
├── package.json                   (Test scripts added)
├── TEST_SETUP.md                  (Detailed documentation)
├── TESTING_QUICK_START.md         (Quick reference)
├── TEST_INDEX.md                  (This file)
├── src/
│   ├── config/
│   │   ├── designTokens.js        (Source file)
│   │   ├── tabConfig.js           (Source file)
│   │   └── __tests__/
│   │       ├── designTokens.test.js
│   │       └── tabConfig.test.js
│   └── utils/
│       ├── demoData.js            (Source file)
│       └── __tests__/
│           └── demoData.test.js
└── TESTING_FRAMEWORK_SUMMARY.txt  (Summary document)
```

## Coverage

All tests focus on **behavior validation** rather than implementation details:

- **Design System**: 100% coverage of theme switching and properties
- **Tab Registry**: 100% coverage of registration, building, and grouping
- **Demo Data**: 100% coverage of major API routes and data structures

## Adding New Tests

1. Create test file: `src/module/__tests__/moduleName.test.js`
2. Import vitest utilities:
    ```javascript
    import { describe, it, expect } from 'vitest';
    ```
3. Import module to test:
    ```javascript
    import { myFunction } from '../myModule.js';
    ```
4. Write tests using describe/it pattern:
    ```javascript
    describe('myModule', () => {
        it('should do something', () => {
            expect(myFunction('input')).toBe('expected');
        });
    });
    ```

## Troubleshooting

**Tests won't run?**

- Run `npm install` to get dependencies
- Make sure you're in the `frontend` directory
- Check that test files are in `src/**/__tests__/*.test.js`

**Import errors?**

- Verify relative paths in imports (e.g., `../designTokens.js`)
- Ensure source files export the functions being tested

**Want more details?**

- See [TEST_SETUP.md](TEST_SETUP.md) for comprehensive documentation
- Check [Vitest documentation](https://vitest.dev/)

## Next Steps

1. Run tests: `npm run test:run`
2. Review test coverage by file
3. Add component tests in `src/components/__tests__/`
4. Set up CI/CD integration using `npm run test:run`
5. Configure coverage reporting (optional)
