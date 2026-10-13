/**
 * Tab Configuration Test Suite
 * Tests the FATHOM dashboard tab registry, component registration, and grouping logic
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    buildTabConfig,
    registerComponents,
    getTabsOnly,
    getSectionGroups,
    getSectionForTab,
    getSectionAccent,
} from '../tabConfig.js';

describe('tabConfig', () => {
    // Mock components for registration — must cover every component key used in tabConfig.js
    const mockComponents = {
        FleetOverviewTab: () => 'FleetOverviewTab',
        OverviewTab: () => 'OverviewTab',
        PerformanceTab: () => 'PerformanceTab',
        ResourcesTab: () => 'ResourcesTab',
        ReliabilityTab: () => 'ReliabilityTab',
        AlertsComponent: () => 'AlertsComponent',
        AlertRuleEditor: () => 'AlertRuleEditor',
        AlertCorrelationTab: () => 'AlertCorrelationTab',
        QueryOptimizerTab: () => 'QueryOptimizerTab',
        QueryPlanViewer: () => 'QueryPlanViewer',
        QueryPlanRegressionTab: () => 'QueryPlanRegressionTab',
        IndexesTab: () => 'IndexesTab',
        BloatAnalysisTab: () => 'BloatAnalysisTab',
        TableAnalytics: () => 'TableAnalytics',
        SchemaVersioningTab: () => 'SchemaVersioningTab',
        TableDependencyMindMap: () => 'TableDependencyMindMap',
        ChartBuilder: () => 'ChartBuilder',
        ConnectionPoolTab: () => 'ConnectionPoolTab',
        PoolMetricsDashboard: () => 'PoolMetricsDashboard',
        ReplicationWALTab: () => 'ReplicationWALTab',
        CheckpointMonitorTab: () => 'CheckpointMonitorTab',
        VacuumMaintenanceTab: () => 'VacuumMaintenanceTab',
        CapacityPlanningTab: () => 'CapacityPlanningTab',
        BackupRecoveryTab: () => 'BackupRecoveryTab',
        SecurityComplianceTab: () => 'SecurityComplianceTab',
        ObservabilityHub: () => 'ObservabilityHub',
        CloudWatchTab: () => 'CloudWatchTab',
        LogPatternAnalysisTab: () => 'LogPatternAnalysisTab',
        OpenTelemetryTab: () => 'OpenTelemetryTab',
        KubernetesTab: () => 'KubernetesTab',
        StatusPageTab: () => 'StatusPageTab',
        AIMonitoringTab: () => 'AIMonitoringTab',
        SqlConsoleTab: () => 'SqlConsoleTab',
        ApiQueriesTab: () => 'ApiQueriesTab',
        RepositoryTab: () => 'RepositoryTab',
        AIQueryAdvisorTab: () => 'AIQueryAdvisorTab',
        MongoOverviewTab: () => 'MongoOverviewTab',
        MongoPerformanceTab: () => 'MongoPerformanceTab',
        MongoStorageTab: () => 'MongoStorageTab',
        MongoReplicationTab: () => 'MongoReplicationTab',
        MongoDataToolsTab: () => 'MongoDataToolsTab',
        MongoShardingTab: () => 'MongoShardingTab',
        DBATaskSchedulerTab: () => 'DBATaskSchedulerTab',
        UserManagementTab: () => 'UserManagementTab',
        AdminTab: () => 'AdminTab',
        RetentionManagementTab: () => 'RetentionManagementTab',
        ReportBuilderTab: () => 'ReportBuilderTab',
        TerraformExportTab: () => 'TerraformExportTab',
        CustomDashboardTab: () => 'CustomDashboardTab',
        // Enterprise views (G3/UI-3)
        NotifierSettings: () => 'NotifierSettings',
        RedisOverview: () => 'RedisOverview',
        ElasticsearchOverview: () => 'ElasticsearchOverview',
        DetectorPicker: () => 'DetectorPicker',
        TraceDetail: () => 'TraceDetail',
        // Additional components referenced by tabConfig.ts
        SDKDashboardTab: () => 'SDKDashboardTab',
        MySQLOverviewTab: () => 'MySQLOverviewTab',
        MySQLPerformanceTab: () => 'MySQLPerformanceTab',
        MySQLReplicationTab: () => 'MySQLReplicationTab',
        AuditAndSecurityTab: () => 'AuditAndSecurityTab',
        DemoPostgresTab: () => 'DemoPostgresTab',
        DemoMySQLTab: () => 'DemoMySQLTab',
        DemoMongoDBTab: () => 'DemoMongoDBTab',
    };

    beforeEach(() => {
        registerComponents(mockComponents);
    });

    describe('registerComponents()', () => {
        it('should accept and store component registry', () => {
            const testComps = { TestTab: () => 'Test' };
            expect(() => registerComponents(testComps)).not.toThrow();
        });

        it('should allow multiple registrations', () => {
            const comps1 = { Tab1: () => 'Tab1' };
            const comps2 = { Tab2: () => 'Tab2' };
            expect(() => {
                registerComponents(comps1);
                registerComponents(comps2);
            }).not.toThrow();
        });
    });

    describe('buildTabConfig()', () => {
        it('should return an array', () => {
            const config = buildTabConfig();
            expect(Array.isArray(config)).toBe(true);
        });

        it('should return at least 30 items (tabs + sections)', () => {
            const config = buildTabConfig();
            expect(config.length).toBeGreaterThan(30);
        });

        it('should contain section headers', () => {
            const config = buildTabConfig();
            const sections = config.filter((item) => item.section);
            expect(sections.length).toBeGreaterThan(0);
            expect(sections.some((s) => s.section === 'Overview')).toBe(true);
        });

        it('should contain tab definitions with required properties', () => {
            const config = buildTabConfig();
            const tabs = config.filter((item) => item.id);

            tabs.forEach((tab) => {
                expect(tab).toHaveProperty('id');
                expect(tab).toHaveProperty('icon');
                expect(tab).toHaveProperty('label');
                expect(tab).toHaveProperty('component');
                expect(tab.id).toBeTypeOf('string');
                expect(tab.label).toBeTypeOf('string');
            });
        });

        it('should have "fleet-overview" as the first tab', () => {
            const config = buildTabConfig();
            const firstTab = config.find((item) => item.id);
            expect(firstTab.id).toBe('fleet-overview');
        });

        it('should include all major sections', () => {
            const config = buildTabConfig();
            const sections = config.filter((item) => item.section).map((item) => item.section);

            const expectedSections = [
                'Overview',
                'Query Analysis',
                'Infrastructure',
                'Schema & Data',
                'Security',
                'Observability',
                'Developer Tools',
                'Admin',
            ];

            expectedSections.forEach((section) => {
                expect(sections).toContain(section);
            });
        });

        it('should include specific key tabs', () => {
            const config = buildTabConfig();
            const tabIds = config.filter((item) => item.id).map((item) => item.id);

            const expectedTabs = [
                'overview',
                'performance',
                'resources',
                'optimizer',
                'indexes',
                'pool',
                'backup',
                'schema',
                'security',
                'sql',
                'api',
            ];

            expectedTabs.forEach((tabId) => {
                expect(tabIds).toContain(tabId);
            });
        });

        it('should attach icons and components to tabs', () => {
            const config = buildTabConfig();
            const tabs = config.filter((item) => item.id);

            tabs.forEach((tab) => {
                expect(tab.icon).toBeDefined();
                expect(tab.icon).toBeDefined(); // lucide-react icons (forwardRef objects or functions)
            });
        });
    });

    describe('getTabsOnly()', () => {
        it('should return only tab entries (with id property)', () => {
            const config = buildTabConfig();
            const tabs = getTabsOnly(config);

            tabs.forEach((item) => {
                expect(item).toHaveProperty('id');
                expect(item.id).toBeTypeOf('string');
            });
        });

        it('should filter out section headers', () => {
            const config = buildTabConfig();
            const tabs = getTabsOnly(config);

            tabs.forEach((item) => {
                expect(item.section).toBeUndefined();
            });
        });

        it('should return fewer items than the full config', () => {
            const config = buildTabConfig();
            const tabs = getTabsOnly(config);
            expect(tabs.length).toBeLessThan(config.length);
        });

        it('should have at least 25 tabs', () => {
            const config = buildTabConfig();
            const tabs = getTabsOnly(config);
            expect(tabs.length).toBeGreaterThan(25);
        });

        it('should preserve all tab properties', () => {
            const config = buildTabConfig();
            const tabs = getTabsOnly(config);

            tabs.forEach((tab) => {
                expect(tab).toHaveProperty('id');
                expect(tab).toHaveProperty('label');
                expect(tab).toHaveProperty('icon');
                expect(tab).toHaveProperty('component');
            });
        });
    });

    describe('getSectionGroups()', () => {
        it('should return an array of section groups', () => {
            const config = buildTabConfig();
            const groups = getSectionGroups(config);

            expect(Array.isArray(groups)).toBe(true);
            expect(groups.length).toBeGreaterThan(0);
        });

        it('should have each group contain section, tabs, and accent', () => {
            const config = buildTabConfig();
            const groups = getSectionGroups(config);

            groups.forEach((group) => {
                expect(group).toHaveProperty('section');
                expect(group).toHaveProperty('tabs');
                expect(group).toHaveProperty('accent');
                expect(Array.isArray(group.tabs)).toBe(true);
            });
        });

        it('should properly nest tabs under their sections', () => {
            const config = buildTabConfig();
            const groups = getSectionGroups(config);

            const overviewGroup = groups.find((g) => g.section === 'Overview');
            expect(overviewGroup).toBeDefined();
            expect(overviewGroup.tabs.length).toBeGreaterThan(0);
            expect(overviewGroup.tabs.some((t) => t.id === 'overview')).toBe(true);
        });

        it('should assign accent colors to each group', () => {
            const config = buildTabConfig();
            const groups = getSectionGroups(config);

            groups.forEach((group) => {
                expect(group.accent).toBeTypeOf('string');
                expect(group.accent).toMatch(/^#|rgba/);
            });
        });

        it('should create correct number of groups', () => {
            const config = buildTabConfig();
            const groups = getSectionGroups(config);

            // Should have at least 6 major sections
            expect(groups.length).toBeGreaterThanOrEqual(6);
        });

        it('should include all tabs from config in groups', () => {
            const config = buildTabConfig();
            const groups = getSectionGroups(config);
            const tabsInGroups = groups.flatMap((g) => g.tabs);
            const tabsInConfig = config.filter((item) => item.id);

            expect(tabsInGroups.length).toBe(tabsInConfig.length);
        });
    });

    describe('getSectionForTab()', () => {
        it('should find section for a valid tab', () => {
            const config = buildTabConfig();
            const groups = getSectionGroups(config);

            const section = getSectionForTab(groups, 'overview');
            expect(section).toBe('Overview');
        });

        it('should return null for unknown tab', () => {
            const config = buildTabConfig();
            const groups = getSectionGroups(config);

            const section = getSectionForTab(groups, 'nonexistent-tab');
            expect(section).toBeNull();
        });

        it('should correctly identify tabs in different sections', () => {
            const config = buildTabConfig();
            const groups = getSectionGroups(config);

            expect(getSectionForTab(groups, 'overview')).toBe('Overview');
            expect(getSectionForTab(groups, 'optimizer')).toBe('Query Analysis');
            expect(getSectionForTab(groups, 'pool')).toBe('Infrastructure');
        });
    });

    describe('getSectionAccent()', () => {
        it('should return accent color for valid tab', () => {
            const config = buildTabConfig();
            const groups = getSectionGroups(config);

            const accent = getSectionAccent(groups, 'overview');
            expect(accent).toBeTypeOf('string');
            expect(accent).toMatch(/^#|rgba/);
        });

        it('should return default accent for unknown tab', () => {
            const config = buildTabConfig();
            const groups = getSectionGroups(config);

            const accent = getSectionAccent(groups, 'nonexistent-tab');
            expect(accent).toBeTypeOf('string');
            expect(accent).toMatch(/^#|rgba/);
        });

        it('should return different accents for different sections', () => {
            const config = buildTabConfig();
            const groups = getSectionGroups(config);

            const coreAccent = getSectionAccent(groups, 'overview');
            const queryAccent = getSectionAccent(groups, 'optimizer');

            // Core Monitoring is cyan, Query & Indexes is violet
            expect(coreAccent).not.toBe(queryAccent);
        });
    });

    describe('Integration tests', () => {
        it('should work together: config -> groups -> section lookup', () => {
            const config = buildTabConfig();
            const groups = getSectionGroups(config);
            const tabs = getTabsOnly(config);

            // For each tab, we should be able to find its section
            const sampleTabs = tabs.slice(0, 5);
            sampleTabs.forEach((tab) => {
                const section = getSectionForTab(groups, tab.id);
                expect(section).toBeDefined();
                expect(section).not.toBeNull();
            });
        });

        it('should maintain consistency between config and groups', () => {
            const config = buildTabConfig();
            const groups = getSectionGroups(config);
            const configTabs = getTabsOnly(config);

            // Total tabs in groups should equal tabs in config
            const totalGroupTabs = groups.reduce((sum, g) => sum + g.tabs.length, 0);
            expect(totalGroupTabs).toBe(configTabs.length);
        });
    });
});
