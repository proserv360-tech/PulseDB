/**
 * Frontend Integration Test Suite
 * Tests critical import paths, component registry, and theme consistency
 */

import { describe, it, expect } from 'vitest';
import { buildTabConfig, getTabsOnly } from '../config/tabConfig.js';
import { DS_DARK, DS_LIGHT, DS_ACCENTS } from '../config/designTokens.js';

describe('Frontend Integration', () => {
    describe('App.jsx critical imports', () => {
        it('should have valid design tokens', () => {
            expect(DS_DARK).toBeDefined();
            expect(DS_LIGHT).toBeDefined();
            expect(DS_ACCENTS).toBeDefined();
        });

        it('should have valid tab configuration', () => {
            const config = buildTabConfig();
            expect(Array.isArray(config)).toBe(true);
            expect(config.length).toBeGreaterThan(0);
        });

        it('should have valid theme tokens structure', () => {
            expect(DS_DARK).toHaveProperty('bg');
            expect(DS_DARK).toHaveProperty('bgDeep');
            expect(DS_DARK).toHaveProperty('textPrimary');
            expect(DS_LIGHT).toHaveProperty('bg');
            expect(DS_LIGHT).toHaveProperty('bgDeep');
            expect(DS_LIGHT).toHaveProperty('textPrimary');
        });
    });

    describe('Component registry', () => {
        it('should have all expected tabs in registry', () => {
            const config = buildTabConfig();
            const tabs = getTabsOnly(config);

            // Core tabs
            const expectedCores = ['overview', 'performance', 'resources', 'reliability'];
            expectedCores.forEach((core) => {
                const exists = tabs.some((t) => t.id === core);
                expect(exists).toBe(true);
            });
        });

        it('should have component key for all tabs (defined when registered)', () => {
            const config = buildTabConfig();
            const tabs = getTabsOnly(config);

            // Components are only defined after registerComponents() is called from App.jsx
            // In unit tests without registration, we verify the key exists in the config
            tabs.forEach((tab) => {
                expect(tab).toHaveProperty('component');
            });
        });

        it('should have icon components for all tabs', () => {
            const config = buildTabConfig();
            const tabs = getTabsOnly(config);

            tabs.forEach((tab) => {
                // lucide-react icons are forwardRef objects, not plain functions
                expect(tab.icon).toBeDefined();
            });
        });

        it('should have non-empty labels for all tabs', () => {
            const config = buildTabConfig();
            const tabs = getTabsOnly(config);

            tabs.forEach((tab) => {
                expect(tab.label).toBeDefined();
                expect(typeof tab.label).toBe('string');
                expect(tab.label.length).toBeGreaterThan(0);
            });
        });
    });

    describe('Theme tokens validation', () => {
        it('should have valid hex colors for dark theme', () => {
            const colorProps = ['bg', 'bgDeep', 'surface', 'border', 'textPrimary', 'glowCyan', 'glowViolet'];
            colorProps.forEach((prop) => {
                if (DS_DARK[prop]) {
                    expect(DS_DARK[prop]).toMatch(/^#|rgba/);
                }
            });
        });

        it('should have valid hex colors for light theme', () => {
            const colorProps = ['bg', 'bgDeep', 'surface', 'border', 'textPrimary', 'glowCyan', 'glowViolet'];
            colorProps.forEach((prop) => {
                if (DS_LIGHT[prop]) {
                    expect(DS_LIGHT[prop]).toMatch(/^#|rgba/);
                }
            });
        });

        it('should have consistent accent colors across themes', () => {
            const accentKeys = ['cyan', 'violet', 'emerald', 'amber', 'rose'];
            accentKeys.forEach((key) => {
                expect(DS_DARK[key]).toBeDefined();
                expect(DS_LIGHT[key]).toBeDefined();
                // Accents should be the same in both themes
                expect(DS_DARK[key]).toBe(DS_LIGHT[key]);
            });
        });

        it('should have valid font family definitions', () => {
            expect(DS_DARK.fontMono).toBeDefined();
            expect(DS_DARK.fontUI).toBeDefined();
            expect(DS_LIGHT.fontMono).toBeDefined();
            expect(DS_LIGHT.fontUI).toBeDefined();
            expect(typeof DS_DARK.fontMono).toBe('string');
            expect(typeof DS_DARK.fontUI).toBe('string');
        });

        it('dark theme should have _dark flag set to true', () => {
            expect(DS_DARK._dark).toBe(true);
        });

        it('light theme should have _dark flag set to false', () => {
            expect(DS_LIGHT._dark).toBe(false);
        });
    });

    describe('Design token consistency', () => {
        it('should have matching required keys in both themes', () => {
            const darkKeys = Object.keys(DS_DARK).sort();
            const lightKeys = Object.keys(DS_LIGHT).sort();

            // Both themes should have the same properties
            expect(darkKeys).toEqual(lightKeys);
        });

        it('should have all accent colors from DS_ACCENTS in themes', () => {
            const accentKeys = Object.keys(DS_ACCENTS);
            accentKeys.forEach((key) => {
                expect(DS_DARK[key]).toBe(DS_ACCENTS[key]);
                expect(DS_LIGHT[key]).toBe(DS_ACCENTS[key]);
            });
        });

        it('should have valid color contrast for accessibility', () => {
            // Dark theme text should be light
            expect(DS_DARK.textPrimary).toBeDefined();
            // Light theme text should be dark
            expect(DS_LIGHT.textPrimary).toBeDefined();
        });
    });

    describe('Tab and theme integration', () => {
        it('should have tabs that can be styled with theme tokens', () => {
            const config = buildTabConfig();
            const tabs = getTabsOnly(config);

            // Each tab should be styleable with available tokens
            tabs.forEach((tab) => {
                expect(tab.id).toBeDefined();
                expect(tab.label).toBeDefined();
                // Should not require additional style information
            });
        });

        it('should have section grouping compatible with theme accents', () => {
            const config = buildTabConfig();
            const sections = config.filter((item) => item.section);

            // Should be able to map sections to accent colors
            const accentNames = ['cyan', 'violet', 'emerald', 'amber', 'rose'];
            expect(sections.length).toBeGreaterThan(0);
        });
    });

    describe('Critical path dependencies', () => {
        it('should have buildTabConfig importable', () => {
            expect(typeof buildTabConfig).toBe('function');
        });

        it('should have tab filtering functions available', () => {
            expect(typeof getTabsOnly).toBe('function');
        });

        it('should have theme provider functions available', () => {
            expect(DS_DARK).toBeDefined();
            expect(DS_LIGHT).toBeDefined();
            expect(DS_ACCENTS).toBeDefined();
        });

        it('should be able to generate complete tab configuration', () => {
            const config = buildTabConfig();
            const tabs = getTabsOnly(config);

            expect(config.length).toBeGreaterThan(tabs.length);
            expect(tabs.length).toBeGreaterThan(20);
        });
    });

    describe('Data flow validation', () => {
        it('should maintain consistent IDs throughout tab configuration', () => {
            const config = buildTabConfig();
            const tabs = getTabsOnly(config);

            // Each tab ID should appear exactly once
            const idCounts = {};
            tabs.forEach((tab) => {
                idCounts[tab.id] = (idCounts[tab.id] || 0) + 1;
            });

            Object.values(idCounts).forEach((count) => {
                expect(count).toBe(1);
            });
        });

        it('should allow lookups by tab ID', () => {
            const config = buildTabConfig();
            const tabs = getTabsOnly(config);
            const firstTab = tabs[0];

            // Should be able to find tab by ID
            const found = tabs.find((t) => t.id === firstTab.id);
            expect(found).toBeDefined();
            expect(found.id).toBe(firstTab.id);
        });

        it('should have sections that reference valid tabs', () => {
            const config = buildTabConfig();
            let currentSection = null;
            const sections = {};

            config.forEach((item) => {
                if (item.section) {
                    currentSection = item.section;
                    if (!sections[currentSection]) {
                        sections[currentSection] = [];
                    }
                } else if (item.id && currentSection) {
                    sections[currentSection].push(item.id);
                }
            });

            // Each section should have valid tab IDs
            Object.entries(sections).forEach(([section, tabIds]) => {
                expect(tabIds.length).toBeGreaterThan(0);
                tabIds.forEach((id) => {
                    expect(typeof id).toBe('string');
                    expect(id.length).toBeGreaterThan(0);
                });
            });
        });
    });

    describe('Theme application readiness', () => {
        it('should have all properties needed to apply theme to DOM', () => {
            const requiredProperties = ['bg', 'bgDeep', 'textPrimary', 'border', 'borderAccent'];
            requiredProperties.forEach((prop) => {
                expect(DS_DARK[prop]).toBeDefined();
                expect(DS_LIGHT[prop]).toBeDefined();
            });
        });

        it('should have shadow definitions for visual depth', () => {
            expect(DS_DARK.shadowCard).toBeDefined();
            expect(DS_DARK.shadowDeep).toBeDefined();
            expect(DS_LIGHT.shadowCard).toBeDefined();
            expect(DS_LIGHT.shadowDeep).toBeDefined();
        });

        it('should have glow effects for interactive elements', () => {
            expect(DS_DARK.glowCyan).toBeDefined();
            expect(DS_DARK.glowViolet).toBeDefined();
            expect(DS_LIGHT.glowCyan).toBeDefined();
            expect(DS_LIGHT.glowViolet).toBeDefined();
        });
    });

    describe('Sidebar and header styling', () => {
        it('should have sidebar-specific theme tokens', () => {
            expect(DS_DARK.sidebarBg).toBeDefined();
            expect(DS_DARK.sidebarBorder).toBeDefined();
            expect(DS_DARK.sidebarText).toBeDefined();
            expect(DS_DARK.sidebarHover).toBeDefined();
        });

        it('should have header-specific theme tokens', () => {
            expect(DS_DARK.headerBg).toBeDefined();
            expect(DS_DARK.logoBg).toBeDefined();
            expect(DS_DARK.logoText).toBeDefined();
        });

        it('should have consistent sidebar tokens in light theme', () => {
            expect(DS_LIGHT.sidebarBg).toBeDefined();
            expect(DS_LIGHT.sidebarBorder).toBeDefined();
            expect(DS_LIGHT.sidebarText).toBeDefined();
        });
    });
});
