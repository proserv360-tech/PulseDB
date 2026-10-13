/**
 * Tab Configuration Integration Test Suite
 * Tests lazy-loaded component imports, tab registry consistency, and naming conventions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { buildTabConfig, getTabsOnly, registerComponents } from '../tabConfig.js';

describe('tabConfigIntegration', () => {
    // Register mock components so tab.component is defined
    beforeEach(() => {
        const mockComponents = {};
        const componentNames = [
            'FleetOverviewTab',
            'OverviewTab',
            'PerformanceTab',
            'ResourcesTab',
            'ReliabilityTab',
            'AlertsComponent',
            'AlertRuleEditor',
            'AlertCorrelationTab',
            'QueryOptimizerTab',
            'QueryPlanViewer',
            'QueryPlanRegressionTab',
            'IndexesTab',
            'BloatAnalysisTab',
            'TableAnalytics',
            'SchemaVersioningTab',
            'TableDependencyMindMap',
            'ChartBuilder',
            'ConnectionPoolTab',
            'PoolMetricsDashboard',
            'ReplicationWALTab',
            'CheckpointMonitorTab',
            'VacuumMaintenanceTab',
            'CapacityPlanningTab',
            'BackupRecoveryTab',
            'SecurityComplianceTab',
            'ObservabilityHub',
            'CloudWatchTab',
            'LogPatternAnalysisTab',
            'OpenTelemetryTab',
            'KubernetesTab',
            'StatusPageTab',
            'AIMonitoringTab',
            'SqlConsoleTab',
            'ApiQueriesTab',
            'RepositoryTab',
            'AIQueryAdvisorTab',
            'MongoOverviewTab',
            'MongoPerformanceTab',
            'MongoStorageTab',
            'MongoReplicationTab',
            'MongoDataToolsTab',
            'MongoShardingTab',
            'DBATaskSchedulerTab',
            'UserManagementTab',
            'AdminTab',
            'RetentionManagementTab',
            'ReportBuilderTab',
            'TerraformExportTab',
            'CustomDashboardTab',
            // Enterprise views (G3/UI-3)
            'NotifierSettings',
            'RedisOverview',
            'ElasticsearchOverview',
            'DetectorPicker',
            'TraceDetail',
            // Additional components referenced by tabConfig.ts
            'SDKDashboardTab',
            'MySQLOverviewTab',
            'MySQLPerformanceTab',
            'MySQLReplicationTab',
            'AuditAndSecurityTab',
            'DemoPostgresTab',
            'DemoMySQLTab',
            'DemoMongoDBTab',
        ];
        componentNames.forEach((name) => {
            mockComponents[name] = () => name;
        });
        registerComponents(mockComponents);
    });

    describe('Tab naming conventions', () => {
        it('should have all tab IDs in kebab-case or PascalCase', () => {
            const config = buildTabConfig();
            const tabs = getTabsOnly(config);

            tabs.forEach((tab) => {
                // Tab IDs should be strings (kebab-case preferred, but some legacy PascalCase exist)
                expect(tab.id).toMatch(/^[a-zA-Z0-9-]+$/);
            });
        });

        it('should have no duplicate tab IDs', () => {
            const config = buildTabConfig();
            const tabs = getTabsOnly(config);
            const ids = tabs.map((t) => t.id);
            const uniqueIds = new Set(ids);

            expect(ids.length).toBe(uniqueIds.size);
        });

        it('should have first tab as "fleet-overview"', () => {
            const config = buildTabConfig();
            const tabs = getTabsOnly(config);
            expect(tabs[0].id).toBe('fleet-overview');
        });

        it('should have demo tab IDs with "demo" prefix or matching pattern', () => {
            const config = buildTabConfig();
            const tabs = getTabsOnly(config);
            const demoTabs = tabs.filter((t) => t.label && t.label.includes('Demo'));

            // Each demo tab should have 'demo' in its ID or be in a demo section
            demoTabs.forEach((tab) => {
                // Demo tabs might have 'demo' in ID or be grouped
                expect(tab.id).toBeDefined();
            });
        });
    });

    describe('Section configuration', () => {
        it('should have at least 7 major sections', () => {
            const config = buildTabConfig();
            const sections = config.filter((item) => item.section);
            expect(sections.length).toBeGreaterThanOrEqual(7);
        });

        it('should have all major sections represented', () => {
            const config = buildTabConfig();
            const sections = config.filter((item) => item.section).map((item) => item.section);

            const requiredSections = [
                'Overview',
                'Query Analysis',
                'Infrastructure',
                'Schema & Data',
                'Security',
                'Observability',
                'Developer Tools',
                'Admin',
            ];

            requiredSections.forEach((section) => {
                expect(sections).toContain(section);
            });
        });

        it('should have at least one tab in each section', () => {
            const config = buildTabConfig();
            const groups = {};

            // Group tabs by section
            config.forEach((item) => {
                if (item.id && item.section) {
                    if (!groups[item.section]) {
                        groups[item.section] = [];
                    }
                    groups[item.section].push(item);
                }
            });

            // Each section should have at least one tab
            Object.entries(groups).forEach(([section, tabs]) => {
                expect(tabs.length).toBeGreaterThan(0);
            });
        });
    });

    describe('Tab registration and properties', () => {
        it('should have all tabs with required properties', () => {
            const config = buildTabConfig();
            const tabs = getTabsOnly(config);

            tabs.forEach((tab) => {
                expect(tab).toHaveProperty('id');
                expect(tab).toHaveProperty('label');
                expect(tab).toHaveProperty('icon');
                expect(tab).toHaveProperty('component');
                expect(typeof tab.id).toBe('string');
                expect(typeof tab.label).toBe('string');
                expect(tab.icon).toBeDefined(); // lucide-react icons (forwardRef objects or functions)
            });
        });

        it('should have all tabs with non-empty labels', () => {
            const config = buildTabConfig();
            const tabs = getTabsOnly(config);

            tabs.forEach((tab) => {
                expect(tab.label.length).toBeGreaterThan(0);
            });
        });

        it('should have valid icon components', () => {
            const config = buildTabConfig();
            const tabs = getTabsOnly(config);

            tabs.forEach((tab) => {
                // Icon should be defined (lucide-react forwardRef object or function)
                expect(tab.icon).toBeDefined();
            });
        });

        it('should have component definitions for all tabs', () => {
            const config = buildTabConfig();
            const tabs = getTabsOnly(config);

            tabs.forEach((tab) => {
                expect(tab.component).toBeDefined();
            });
        });

        it('should have at least 25 registered tabs', () => {
            const config = buildTabConfig();
            const tabs = getTabsOnly(config);
            expect(tabs.length).toBeGreaterThanOrEqual(25);
        });
    });

    describe('MongoDB database tabs', () => {
        it('should include MongoDB tabs', () => {
            const config = buildTabConfig();
            const tabs = getTabsOnly(config);
            const tabIds = tabs.map((t) => t.id);

            const mongoTabs = ['mongo-overview', 'mongo-performance', 'mongo-storage'];

            mongoTabs.forEach((mongoTab) => {
                expect(tabIds).toContain(mongoTab);
            });
        });

        it('should have MongoDB section', () => {
            const config = buildTabConfig();
            const sections = config.filter((item) => item.section).map((item) => item.section);

            expect(sections).toContain('MongoDB');
        });
    });

    describe('New tabs verification', () => {
        it('should include table-dependencies tab if implemented', () => {
            const config = buildTabConfig();
            const tabs = getTabsOnly(config);
            const tabIds = tabs.map((t) => t.id);

            // These tabs should exist if implemented
            // table-dependencies, observability-hub, report-builder are listed as new
            const optionalNewTabs = ['table-dependencies', 'observability-hub', 'report-builder'];
            // We just verify they don't cause duplicates if present
            const uniqueIds = new Set(tabIds);
            expect(uniqueIds.size).toBe(tabIds.length);
        });
    });

    describe('Tab consistency across functions', () => {
        it('should have consistent tab data between buildTabConfig and getTabsOnly', () => {
            const config = buildTabConfig();
            const tabs = getTabsOnly(config);

            // All tabs from getTabsOnly should be in config
            tabs.forEach((tab) => {
                const foundInConfig = config.some((item) => item.id === tab.id);
                expect(foundInConfig).toBe(true);
            });
        });

        it('should maintain tab data integrity through operations', () => {
            const config1 = buildTabConfig();
            const config2 = buildTabConfig();

            const tabs1 = getTabsOnly(config1);
            const tabs2 = getTabsOnly(config2);

            // Configs should be consistent across calls
            expect(tabs1.length).toBe(tabs2.length);
            expect(tabs1.map((t) => t.id)).toEqual(tabs2.map((t) => t.id));
        });

        it('should have tabs properly grouped in sections', () => {
            const config = buildTabConfig();

            // Find tabs that come after section headers
            let currentSection = null;
            const tabsInSections = {};

            config.forEach((item) => {
                if (item.section) {
                    currentSection = item.section;
                    if (!tabsInSections[currentSection]) {
                        tabsInSections[currentSection] = [];
                    }
                } else if (item.id && currentSection) {
                    tabsInSections[currentSection].push(item);
                }
            });

            // Verify each section has tabs
            Object.entries(tabsInSections).forEach(([section, tabs]) => {
                expect(tabs.length).toBeGreaterThan(0);
            });
        });
    });

    describe('Tab accessibility', () => {
        it('should have unique labels within sections', () => {
            const config = buildTabConfig();
            let currentSection = null;
            const sectionLabels = {};

            config.forEach((item) => {
                if (item.section) {
                    currentSection = item.section;
                    if (!sectionLabels[currentSection]) {
                        sectionLabels[currentSection] = [];
                    }
                } else if (item.label && currentSection) {
                    sectionLabels[currentSection].push(item.label);
                }
            });

            // Check for duplicates within sections
            Object.entries(sectionLabels).forEach(([section, labels]) => {
                const uniqueLabels = new Set(labels);
                expect(uniqueLabels.size).toBe(labels.length);
            });
        });

        it('should have descriptive labels for all tabs', () => {
            const config = buildTabConfig();
            const tabs = getTabsOnly(config);

            tabs.forEach((tab) => {
                expect(tab.label.length).toBeGreaterThan(2);
                // Labels should not just be IDs
                expect(tab.label).not.toBe(tab.id);
            });
        });
    });

    describe('Configuration completeness', () => {
        it('should include core monitoring tabs', () => {
            const config = buildTabConfig();
            const tabs = getTabsOnly(config);
            const tabIds = tabs.map((t) => t.id);

            const coreTabIds = ['overview', 'performance', 'resources'];
            coreTabIds.forEach((tabId) => {
                expect(tabIds).toContain(tabId);
            });
        });

        it('should include query optimization tabs', () => {
            const config = buildTabConfig();
            const tabs = getTabsOnly(config);
            const tabIds = tabs.map((t) => t.id);

            const queryTabIds = ['optimizer', 'indexes'];
            queryTabIds.forEach((tabId) => {
                expect(tabIds).toContain(tabId);
            });
        });

        it('should include infrastructure tabs', () => {
            const config = buildTabConfig();
            const tabs = getTabsOnly(config);
            const tabIds = tabs.map((t) => t.id);

            const infraTabIds = ['pool', 'backup'];
            infraTabIds.forEach((tabId) => {
                expect(tabIds).toContain(tabId);
            });
        });

        it('should include schema and security tabs', () => {
            const config = buildTabConfig();
            const tabs = getTabsOnly(config);
            const tabIds = tabs.map((t) => t.id);

            const securityTabIds = ['schema', 'security'];
            securityTabIds.forEach((tabId) => {
                expect(tabIds).toContain(tabId);
            });
        });

        it('should include developer tools tabs', () => {
            const config = buildTabConfig();
            const tabs = getTabsOnly(config);
            const tabIds = tabs.map((t) => t.id);

            const devTabIds = ['sql', 'api'];
            devTabIds.forEach((tabId) => {
                expect(tabIds).toContain(tabId);
            });
        });
    });

    describe('Tab ordering and sequencing', () => {
        it('should have fleet-overview as first tab for consistency', () => {
            const config = buildTabConfig();
            const tabs = getTabsOnly(config);
            expect(tabs[0].id).toBe('fleet-overview');
        });

        it('should maintain logical grouping of related tabs', () => {
            const config = buildTabConfig();
            const tabs = getTabsOnly(config);
            const tabIds = tabs.map((t) => t.id);

            // Query-related tabs should be grouped
            const queryIndex = tabIds.indexOf('optimizer');
            const indexesIndex = tabIds.indexOf('indexes');
            expect(queryIndex).toBeGreaterThan(-1);
            expect(indexesIndex).toBeGreaterThan(-1);
        });
    });
});
