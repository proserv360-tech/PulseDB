# Quick Start: Running FATHOM Tests

## Installation

Ensure you have node modules installed:

```bash
cd frontend
npm install
```

## Running Tests

### Watch Mode (Recommended for Development)

```bash
npm run test
```

Watches for file changes and re-runs affected tests automatically.

### Single Run (For CI/CD)

```bash
npm run test:run
```

Runs all tests once and exits with pass/fail status.

### Interactive UI

```bash
npm run test:ui
```

Opens Vitest's interactive UI in your browser for exploring test results.

## Test Files

Three comprehensive test suites have been created:

| File                     | Location                | Coverage                           |
| ------------------------ | ----------------------- | ---------------------------------- |
| **designTokens.test.js** | `src/config/__tests__/` | Theme system, colors, switching    |
| **tabConfig.test.js**    | `src/config/__tests__/` | Tab registry, components, grouping |
| **demoData.test.js**     | `src/utils/__tests__/`  | API route mocking, data structures |

## Expected Output

Tests should show something like:

```
✓ src/config/__tests__/designTokens.test.js (8 tests)
✓ src/config/__tests__/tabConfig.test.js (40+ tests)
✓ src/utils/__tests__/demoData.test.js (35+ tests)

Test Files  3 passed (3)
     Tests  100+ passed (100+)
```

## Adding More Tests

To add tests for other modules, create a file in the appropriate `__tests__` folder:

```
src/config/__tests__/myModule.test.js
src/utils/__tests__/myModule.test.js
src/components/__tests__/myComponent.test.js
```

Tests use Vitest's simple API:

```javascript
import { describe, it, expect } from 'vitest';

describe('myModule', () => {
    it('should do something', () => {
        expect(result).toBe(expected);
    });
});
```

## Key Test Commands

- `npm run test` — Watch mode, re-run on changes
- `npm run test:run` — Single run, exit after completion
- `npm run test:ui` — Open interactive UI dashboard
- `npm run test -- --coverage` — Generate coverage report (if coverage tools are installed)

## Troubleshooting

**Tests not running?**

- Ensure `npm install` is complete
- Check that `vitest` is available (may need to add to package.json devDependencies)
- Verify test files are in correct location: `src/**/__tests__/*.test.js`

**Import errors?**

- Ensure relative imports use correct path (e.g., `../designTokens.js`)
- Check that source files export the functions being tested

**Module not found?**

- Run `npm install` again
- Check that the frontend directory is the working directory: `cd frontend && npm run test`

## Documentation

For full documentation, see `TEST_SETUP.md` in the frontend directory.
