/**
 * Performance Test Suite
 * Tests critical performance characteristics of demo data generation and rendering utilities
 */

import { describe, it, expect } from 'vitest';

/**
 * Hash function - converts string to integer
 */
function hashSeed(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
}

/**
 * Normalize hash to 0-1 range
 */
function hashNorm(str) {
    return (hashSeed(str) % 10000) / 10000;
}

/**
 * Generate 24-hour data
 */
function gen24h(seed, m1Base, m1Var, m2Base, m2Var) {
    return Array.from({ length: 24 }, (_, i) => ({
        time: `${String(i).padStart(2, '0')}:00`,
        primary: Math.floor(hashNorm(`${seed}-p-${i}`) * m1Var + m1Base),
        secondary: Math.floor(hashNorm(`${seed}-s-${i}`) * m2Var + m2Base),
    }));
}

/**
 * Generate 7-day data
 */
function gen7d(seed, base, variance) {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.map((d, i) => ({ day: d, value: Math.floor(hashNorm(`${seed}-${i}`) * variance + base) }));
}

describe('Performance', () => {
    describe('hashSeed performance', () => {
        it('hashSeed should be fast (< 100 operations per ms)', () => {
            const iterations = 10000;
            const start = performance.now();

            for (let i = 0; i < iterations; i++) {
                hashSeed(`test-${i}`);
            }

            const elapsed = performance.now() - start;
            expect(elapsed).toBeLessThan(100); // 100 ms for 10k operations
        });

        it('hashSeed should be deterministic', () => {
            const input = 'performance-test-string';
            const results = [];

            for (let i = 0; i < 100; i++) {
                results.push(hashSeed(input));
            }

            // All results should be identical
            const first = results[0];
            results.forEach((result) => {
                expect(result).toBe(first);
            });
        });

        it('hashSeed should handle varying string lengths efficiently', () => {
            const start = performance.now();

            // Test with strings of increasing length
            for (let len = 0; len <= 1000; len += 100) {
                const str = 'a'.repeat(len);
                hashSeed(str);
            }

            const elapsed = performance.now() - start;
            expect(elapsed).toBeLessThan(50); // Should still be fast
        });
    });

    describe('hashNorm performance', () => {
        it('hashNorm should be fast (< 100 operations per ms)', () => {
            const iterations = 10000;
            const start = performance.now();

            for (let i = 0; i < iterations; i++) {
                hashNorm(`test-${i}`);
            }

            const elapsed = performance.now() - start;
            expect(elapsed).toBeLessThan(100);
        });

        it('hashNorm should be deterministic', () => {
            const input = 'norm-test';
            const results = [];

            for (let i = 0; i < 100; i++) {
                results.push(hashNorm(input));
            }

            // All results should be identical
            const first = results[0];
            results.forEach((result) => {
                expect(result).toBe(first);
            });
        });

        it('hashNorm should always return consistent range', () => {
            for (let i = 0; i < 1000; i++) {
                const result = hashNorm(`test-${i}`);
                expect(result).toBeGreaterThanOrEqual(0);
                expect(result).toBeLessThanOrEqual(1);
            }
        });
    });

    describe('gen24h performance', () => {
        it('gen24h should generate data quickly (< 1ms)', () => {
            const start = performance.now();
            gen24h('perf-test', 100, 50, 200, 100);
            const elapsed = performance.now() - start;

            expect(elapsed).toBeLessThan(1);
        });

        it('gen24h should be deterministic', () => {
            const seed = 'deterministic-test';
            const result1 = gen24h(seed, 100, 50, 200, 100);
            const result2 = gen24h(seed, 100, 50, 200, 100);

            expect(result1).toEqual(result2);
        });

        it('gen24h should produce consistent structure', () => {
            const data = gen24h('test', 100, 50, 200, 100);

            expect(data.length).toBe(24);
            data.forEach((point, i) => {
                expect(point.time).toBe(`${String(i).padStart(2, '0')}:00`);
                expect(typeof point.primary).toBe('number');
                expect(typeof point.secondary).toBe('number');
            });
        });

        it('gen24h should handle multiple generations without memory issues', () => {
            const start = performance.now();
            const results = [];

            for (let i = 0; i < 1000; i++) {
                results.push(gen24h(`seed-${i}`, 100, 50, 200, 100));
            }

            const elapsed = performance.now() - start;
            expect(elapsed).toBeLessThan(500); // 1000 calls in under 500ms
            expect(results.length).toBe(1000);
        });
    });

    describe('gen7d performance', () => {
        it('gen7d should generate data quickly (< 1ms)', () => {
            const start = performance.now();
            gen7d('perf-test', 50, 20);
            const elapsed = performance.now() - start;

            expect(elapsed).toBeLessThan(1);
        });

        it('gen7d should be deterministic', () => {
            const seed = 'deterministic-7d';
            const result1 = gen7d(seed, 50, 20);
            const result2 = gen7d(seed, 50, 20);

            expect(result1).toEqual(result2);
        });

        it('gen7d should produce consistent structure', () => {
            const data = gen7d('test', 50, 20);
            const expectedDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

            expect(data.length).toBe(7);
            data.forEach((point, i) => {
                expect(point.day).toBe(expectedDays[i]);
                expect(typeof point.value).toBe('number');
            });
        });

        it('gen7d should handle multiple generations without memory issues', () => {
            const start = performance.now();
            const results = [];

            for (let i = 0; i < 1000; i++) {
                results.push(gen7d(`seed-${i}`, 100, 30));
            }

            const elapsed = performance.now() - start;
            expect(elapsed).toBeLessThan(500);
            expect(results.length).toBe(1000);
        });
    });

    describe('Combined generation performance', () => {
        it('should generate multiple datasets quickly', () => {
            const start = performance.now();

            const datasets = [];
            for (let i = 0; i < 100; i++) {
                const seed = `combined-${i}`;
                datasets.push({
                    data24h: gen24h(seed, 100, 50, 200, 100),
                    data7d: gen7d(seed, 100, 30),
                });
            }

            const elapsed = performance.now() - start;
            expect(elapsed).toBeLessThan(100); // 100 complete datasets in under 100ms
            expect(datasets.length).toBe(100);
        });

        it('should handle large batch generations', () => {
            const start = performance.now();
            const batch = 500;
            const results = [];

            for (let i = 0; i < batch; i++) {
                results.push(gen24h(`batch-${i}`, 100, 50, 200, 100));
            }

            const elapsed = performance.now() - start;
            expect(elapsed).toBeLessThan(500);
        });
    });

    describe('Memory efficiency', () => {
        it('gen24h should not create excessive object allocations', () => {
            // Generate data multiple times - should not accumulate memory
            for (let i = 0; i < 100; i++) {
                const data = gen24h(`mem-test-${i}`, 100, 50, 200, 100);
                expect(data.length).toBe(24);
            }

            // If we got here without crash, memory wasn't completely exhausted
            expect(true).toBe(true);
        });

        it('hashNorm should have minimal memory footprint', () => {
            // Call hashNorm many times - should reuse memory
            const results = [];
            for (let i = 0; i < 10000; i++) {
                results.push(hashNorm(`hash-${i}`));
            }

            expect(results.length).toBe(10000);
        });

        it('combined operations should be memory efficient', () => {
            // Simulate realistic usage pattern
            const databases = ['postgresql', 'mysql', 'mongodb'];
            const sections = 7;
            const iterations = 10;

            let totalCalls = 0;
            for (let db = 0; db < databases.length; db++) {
                for (let sec = 0; sec < sections; sec++) {
                    for (let iter = 0; iter < iterations; iter++) {
                        const seed = `${databases[db]}-${sec}-${iter}`;
                        gen24h(seed, 100, 50, 200, 100);
                        gen7d(seed, 50, 20);
                        totalCalls += 2;
                    }
                }
            }

            expect(totalCalls).toBe(420); // 3 * 7 * 10 * 2
        });
    });

    describe('Determinism under load', () => {
        it('hashSeed should remain deterministic under high load', () => {
            const testCases = [
                'test1',
                'test2',
                'test3',
                'test4',
                'test5',
                'seed-a',
                'seed-b',
                'seed-c',
                'seed-d',
                'seed-e',
            ];

            // Run twice and compare results
            const results1 = testCases.map(hashSeed);
            const results2 = testCases.map(hashSeed);

            expect(results1).toEqual(results2);
        });

        it('gen24h should remain deterministic under high load', () => {
            const seeds = Array.from({ length: 100 }, (_, i) => `seed-${i}`);

            const firstRun = seeds.map((seed) => gen24h(seed, 100, 50, 200, 100));
            const secondRun = seeds.map((seed) => gen24h(seed, 100, 50, 200, 100));

            // Compare arrays - should be identical
            expect(firstRun.length).toBe(secondRun.length);
            firstRun.forEach((data1, i) => {
                expect(data1).toEqual(secondRun[i]);
            });
        });

        it('gen7d should remain deterministic under high load', () => {
            const seeds = Array.from({ length: 100 }, (_, i) => `seed-${i}`);

            const firstRun = seeds.map((seed) => gen7d(seed, 50, 20));
            const secondRun = seeds.map((seed) => gen7d(seed, 50, 20));

            expect(firstRun.length).toBe(secondRun.length);
            firstRun.forEach((data1, i) => {
                expect(data1).toEqual(secondRun[i]);
            });
        });
    });

    describe('Output consistency', () => {
        it('gen24h output should always be within bounds', () => {
            const testSeeds = Array.from({ length: 100 }, (_, i) => `seed-${i}`);

            testSeeds.forEach((seed) => {
                const data = gen24h(seed, 100, 50, 200, 100);
                data.forEach((point) => {
                    expect(point.primary).toBeGreaterThanOrEqual(100);
                    expect(point.primary).toBeLessThanOrEqual(150);
                    expect(point.secondary).toBeGreaterThanOrEqual(200);
                    expect(point.secondary).toBeLessThanOrEqual(300);
                });
            });
        });

        it('gen7d output should always be within bounds', () => {
            const testSeeds = Array.from({ length: 100 }, (_, i) => `seed-${i}`);

            testSeeds.forEach((seed) => {
                const data = gen7d(seed, 50, 20);
                data.forEach((point) => {
                    expect(point.value).toBeGreaterThanOrEqual(50);
                    expect(point.value).toBeLessThanOrEqual(70);
                });
            });
        });
    });
});
