// ==========================================================================
//  FATHOM — Demo Mode Context
// ==========================================================================
//  When demo mode is active, API calls return realistic sample data
//  without needing a real PostgreSQL connection.
// ==========================================================================

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

const DemoContext = createContext(null);

const DEMO_USER = {
    id: 'demo-user-001',
    username: 'demo',
    name: 'Demo User',
    role: 'super_admin',
    accessLevel: 'write',
    allowedScreens: [
        'overview',
        'performance',
        'resources',
        'reliability',
        'alerts',
        'optimizer',
        'indexes',
        'regression',
        'bloat',
        'Table',
        'pool',
        'replication',
        'checkpoint',
        'maintenance',
        'capacity',
        'backup',
        'schema',
        'security',
        'cloudwatch',
        'log-patterns',
        'alert-correlation',
        'opentelemetry',
        'kubernetes',
        'status-page',
        'ai-monitoring',
        'sql',
        'engine-console',
        'api',
        'repository',
        'ai-advisor',
        'mongo-overview',
        'mongo-performance',
        'mongo-storage',
        'mongo-replication',
        'mongo-data-tools',
        'mongo-sharding',
        'tasks',
        'UserManagement',
        'admin',
        'retention',
        'terraform',
        'custom-dashboard',
        'connections',
        'demo-data',
        'demo-postgres',
        'demo-mysql',
        'demo-mongodb',
        // Phase-5 demo engines — each has the same 11 sub-panels rendered
        // by DemoEngineTab. Tabs use the format demo-<engine>-<panel>.
        'demo-mssql',
        'demo-oracle',
        'demo-redis',
        'demo-elasticsearch',
        'demo-snowflake',
        'demo-bigquery',
        'demo-redshift',
        'demo-cassandra',
        'demo-dynamodb',
    ],
};

export const DemoProvider = ({ children }) => {
    const [isDemo, setIsDemo] = useState(() => {
        try {
            const active = localStorage.getItem('fathom_demo_mode') === 'true';
            // Ensure CloudWatch demo instances are seeded if demo is already active
            if (active && !localStorage.getItem('fathom_cw_instances')) {
                localStorage.setItem(
                    'fathom_cw_instances',
                    JSON.stringify([
                        {
                            id: 'demo-rds-prod',
                            dbId: 'fathom-prod-db',
                            accessKey: 'DEMO_KEY',
                            secretKey: 'DEMO_SECRET',
                            region: 'us-east-1',
                        },
                        {
                            id: 'demo-rds-replica',
                            dbId: 'fathom-replica-db',
                            accessKey: 'DEMO_KEY',
                            secretKey: 'DEMO_SECRET',
                            region: 'us-east-1',
                        },
                    ]),
                );
            }
            return active;
        } catch {
            return false;
        }
    });

    const enterDemo = useCallback(() => {
        localStorage.setItem('fathom_demo_mode', 'true');
        // Seed CloudWatch demo instances so the tab renders metrics instead of "No Instances"
        if (!localStorage.getItem('fathom_cw_instances')) {
            localStorage.setItem(
                'fathom_cw_instances',
                JSON.stringify([
                    {
                        id: 'demo-rds-prod',
                        dbId: 'fathom-prod-db',
                        accessKey: 'DEMO_KEY',
                        secretKey: 'DEMO_SECRET',
                        region: 'us-east-1',
                    },
                    {
                        id: 'demo-rds-replica',
                        dbId: 'fathom-replica-db',
                        accessKey: 'DEMO_KEY',
                        secretKey: 'DEMO_SECRET',
                        region: 'us-east-1',
                    },
                ]),
            );
        }
        setIsDemo(true);
    }, []);

    const exitDemo = useCallback(() => {
        localStorage.removeItem('fathom_demo_mode');
        // Clean up demo CloudWatch instances (only remove if they are the demo ones)
        try {
            const cw = JSON.parse(localStorage.getItem('fathom_cw_instances') || '[]');
            if (cw.length && cw[0]?.id === 'demo-rds-prod') {
                localStorage.removeItem('fathom_cw_instances');
            }
        } catch {
            /* ignore */
        }
        setIsDemo(false);
    }, []);

    const value = useMemo(
        () => ({
            isDemo,
            demoUser: DEMO_USER,
            enterDemo,
            exitDemo,
        }),
        [isDemo, enterDemo, exitDemo],
    );

    return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
};

export const useDemo = () => {
    const ctx = useContext(DemoContext);
    if (!ctx) throw new Error('useDemo must be used within a DemoProvider');
    return ctx;
};

export { DEMO_USER };
export default DemoContext;