/**
 * Vitest global test setup
 * Extends matchers with @testing-library/jest-dom
 */
import { expect } from 'vitest';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - jest-dom ships types that don't always line up with vitest 4
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers as Record<string, unknown>);
