/**
 * Demo Data Test Suite
 * Tests the FATHOM demo data provider and route matching for all key API endpoints
 */

import { describe, it, expect } from 'vitest';
import { getDemoData, isDemoMode } from '../demoData.js';

describe('demoData', () => {
    describe('getDemoData()', () => {
        describe('Overview endpoint - /api/overview', () => {
            it('should return data for /api/overview/stats', () => {
                const data = getDemoData('/api/overview/stats');
                expect(data).toBeDefined();
                expect(typeof data).toBe('object');
                expect(data).toHaveProperty('activeConnections');
                expect(data).toHaveProperty('maxConnections');
                expect(data).toHaveProperty('uptimeSeconds');
            });

            it('should return connection stats with valid ranges', () => {
                const data = getDemoData('/api/overview/stats');
                expect(typeof data.activeConnections).toBe('number');
                expect(data.activeConnections).toBeGreaterThanOrEqual(0);
                expect(data.activeConnections).toBeLessThanOrEqual(200);
            });

            it('should return traffic data for /api/overview/traffic', () => {
                const data = getDemoData('/api/overview/traffic');
                expect(data).toBeDefined();
                expect(data).toHaveProperty('tup_fetched');
                expect(data).toHaveProperty('tup_inserted');
                expect(data).toHaveProperty('tup_updated');
                expect(data).toHaveProperty('tup_deleted');
            });

            it('should return growth data as array for /api/overview/growth', () => {
                const data = getDemoData('/api/overview/growth');
                expect(Array.isArray(data)).toBe(true);
                expect(data.length).toBeGreaterThan(0);

                data.forEach((point) => {
                    expect(point).toHaveProperty('date');
                    expect(point).toHaveProperty('size_gb');
                    expect(typeof point.size_gb).toBe('number');
                });
            });

            it('should return reasonable growth progression', () => {
                const data = getDemoData('/api/overview/growth');
                expect(data.length).toBe(30);
                const firstSize = data[0].size_gb;
                const lastSize = data[data.length - 1].size_gb;
                expect(lastSize).toBeGreaterThanOrEqual(firstSize);
            });
        });

        describe('Performance endpoint - /api/performance', () => {
            it('should return data for /api/performance', () => {
                const data = getDemoData('/api/performance');
                expect(data).toBeDefined();
                expect(data).toHaveProperty('available');
                expect(data).toHaveProperty('slowQueries');
            });

            it('should return slowQueries array', () => {
                const data = getDemoData('/api/performance');
                expect(Array.isArray(data.slowQueries)).toBe(true);
                expect(data.slowQueries.length).toBeGreaterThan(0);
            });

            it('should return slow query with required fields', () => {
                const data = getDemoData('/api/performance');
                const query = data.slowQueries[0];

                expect(query).toHaveProperty('queryid');
                expect(query).toHaveProperty('query');
                expect(query).toHaveProperty('calls');
                expect(query).toHaveProperty('total_exec_time');
                expect(query).toHaveProperty('mean_exec_time');
            });

            it('should return data for /api/performance/stats', () => {
                const data = getDemoData('/api/performance/stats');
                expect(data).toHaveProperty('available');
                expect(data).toHaveProperty('slowQueries');
                expect(Array.isArray(data.slowQueries)).toBe(true);
            });

            it('should return data for /api/performance/table-io', () => {
                const data = getDemoData('/api/performance/table-io');
                expect(Array.isArray(data)).toBe(true);

                data.forEach((row) => {
                    expect(row).toHaveProperty('schemaname');
                    expect(row).toHaveProperty('relname');
                    expect(row).toHaveProperty('heap_blks_read');
                    expect(row).toHaveProperty('heap_blks_hit');
                });
            });
        });

        describe('Alerts endpoint - /api/alerts', () => {
            it('should return data for /api/alerts', () => {
                const data = getDemoData('/api/alerts');
                expect(data).toBeDefined();
                expect(data).toHaveProperty('alerts');
                expect(Array.isArray(data.alerts)).toBe(true);
            });

            it('should return alerts with required fields', () => {
                const data = getDemoData('/api/alerts');
                const alert = data.alerts[0];

                expect(alert).toHaveProperty('id');
                expect(alert).toHaveProperty('severity');
                expect(alert).toHaveProperty('type');
                expect(alert).toHaveProperty('message');
                expect(alert).toHaveProperty('created_at');
            });

            it('should return alerts with valid severity levels', () => {
                const data = getDemoData('/api/alerts');
                const severities = data.alerts.map((a) => a.severity);

                severities.forEach((severity) => {
                    expect(['critical', 'warning', 'info']).toContain(severity);
                });
            });
        });

        describe('Indexes endpoint - /api/indexes', () => {
            it('should return health data for /api/indexes/health', () => {
                const data = getDemoData('/api/indexes/health');
                expect(data).toHaveProperty('score');
                expect(data).toHaveProperty('total');
                expect(data).toHaveProperty('unused');
                expect(typeof data.score).toBe('number');
            });

            it('should return unused indexes as array', () => {
                const data = getDemoData('/api/indexes/unused');
                expect(Array.isArray(data)).toBe(true);

                data.forEach((idx) => {
                    expect(idx).toHaveProperty('indexname');
                    expect(idx).toHaveProperty('tablename');
                    expect(idx).toHaveProperty('size');
                });
            });

            it('should return missing indexes as array', () => {
                const data = getDemoData('/api/indexes/missing');
                expect(Array.isArray(data)).toBe(true);

                data.forEach((suggestion) => {
                    expect(suggestion).toHaveProperty('table');
                    expect(suggestion).toHaveProperty('column');
                    expect(suggestion).toHaveProperty('reason');
                });
            });
        });

        describe('Reliability endpoint - /api/reliability', () => {
            it('should return active connections', () => {
                const data = getDemoData('/api/reliability/active-connections');
                expect(Array.isArray(data)).toBe(true);

                data.forEach((conn) => {
                    expect(conn).toHaveProperty('pid');
                    expect(conn).toHaveProperty('usename');
                    expect(conn).toHaveProperty('state');
                });
            });
        });

        describe('Query patterns', () => {
            it('should handle query strings in URL', () => {
                const data1 = getDemoData('/api/overview/stats');
                const data2 = getDemoData('/api/overview/stats?param=value&other=123');

                expect(data1).toBeDefined();
                expect(data2).toBeDefined();
                expect(typeof data1).toBe(typeof data2);
            });

            it('should match routes without trailing data', () => {
                const data = getDemoData('/api/connections');
                expect(data).toBeDefined();
                expect(Array.isArray(data)).toBe(true);
            });

            it('should return empty object for unknown route', () => {
                const data = getDemoData('/api/unknown-route-xyz');
                expect(data).toBeDefined();
                expect(typeof data).toBe('object');
                expect(Object.keys(data).length).toBe(0);
            });
        });

        describe('Data consistency', () => {
            it('should return consistent data structure across multiple calls for same route', () => {
                const data1 = getDemoData('/api/overview/stats');
                const data2 = getDemoData('/api/overview/stats');

                expect(Object.keys(data1).sort()).toEqual(Object.keys(data2).sort());
            });

            it('should return non-empty data for core routes', () => {
                const routes = ['/api/overview/stats', '/api/performance', '/api/alerts', '/api/indexes/health'];

                routes.forEach((route) => {
                    const data = getDemoData(route);
                    expect(Object.keys(data).length).toBeGreaterThan(0);
                });
            });

            it('should populate slowQueries with proper counts', () => {
                const data = getDemoData('/api/performance');
                expect(data.slowQueries.length).toBe(10);

                data.slowQueries.forEach((query) => {
                    expect(query.calls).toBeGreaterThan(0);
                    expect(query.total_exec_time).toBeGreaterThan(0);
                });
            });
        });

        describe('Special endpoint patterns', () => {
            it('should match connection test endpoints', () => {
                const testPath = '/api/connections/demo-1/test';
                const data = getDemoData(testPath);
                expect(data).toHaveProperty('success');
            });

            it('should match acknowledge endpoints', () => {
                const ackPath = '/api/alerts/1234/acknowledge';
                const data = getDemoData(ackPath);
                expect(data).toHaveProperty('success');
                expect(data.success).toBe(true);
            });

            it('should match bulk operations', () => {
                const bulkPath = '/api/alerts/bulk-acknowledge';
                const data = getDemoData(bulkPath);
                expect(data).toHaveProperty('success');
            });
        });
    });

    describe('isDemoMode()', () => {
        it('should return a boolean', () => {
            const result = isDemoMode();
            expect(typeof result).toBe('boolean');
        });

        it('should return false by default', () => {
            const result = isDemoMode();
            expect(result).toBe(false);
        });

        it('should handle localStorage errors gracefully', () => {
            // This tests the try-catch block
            expect(() => isDemoMode()).not.toThrow();
        });
    });

    describe('Route patterns coverage', () => {
        it('should handle common FATHOM routes', () => {
            const routes = [
                '/api/overview',
                '/api/performance',
                '/api/reliability',
                '/api/alerts',
                '/api/indexes',
                '/api/security',
                '/api/connections',
            ];

            routes.forEach((route) => {
                const data = getDemoData(route);
                expect(data).toBeDefined();
                expect(typeof data).toBe('object');
            });
        });

        it('should return data for nested API endpoints', () => {
            const nestedRoutes = [
                '/api/overview/stats',
                '/api/overview/traffic',
                '/api/performance/stats',
                '/api/indexes/health',
                '/api/indexes/unused',
            ];

            nestedRoutes.forEach((route) => {
                const data = getDemoData(route);
                expect(Object.keys(data).length).toBeGreaterThan(0);
            });
        });
    });
});
