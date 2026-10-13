/**
 * Design Tokens Test Suite
 * Tests the FATHOM design system's theme definitions and switching functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DS_DARK, DS_LIGHT, DS_ACCENTS, getDS, setDS, DS } from '../designTokens.js';

describe('designTokens', () => {
    // Store original DS to restore after each test
    let originalDS;

    beforeEach(() => {
        originalDS = getDS();
    });

    afterEach(() => {
        setDS(originalDS);
    });

    describe('DS_DARK', () => {
        it('should have all required color keys', () => {
            const requiredKeys = [
                'bg',
                'bgDeep',
                'surface',
                'surfaceHover',
                'border',
                'borderAccent',
                'textPrimary',
                'textSub',
                'textMuted',
                'glowCyan',
                'glowViolet',
                'shadowCard',
                'shadowDeep',
                'sidebarBg',
                'sidebarBorder',
                'sidebarText',
                'sidebarHover',
                'headerBg',
                'logoBg',
                'logoText',
                'logoSub',
                '_dark',
                'fontMono',
                'fontUI',
            ];

            requiredKeys.forEach((key) => {
                expect(DS_DARK).toHaveProperty(key);
                expect(DS_DARK[key]).toBeDefined();
                expect(DS_DARK[key]).not.toBeNull();
            });
        });

        it('should have _dark flag set to true', () => {
            expect(DS_DARK._dark).toBe(true);
        });

        it('should include all accent colors from DS_ACCENTS', () => {
            const accentKeys = Object.keys(DS_ACCENTS);
            accentKeys.forEach((key) => {
                expect(DS_DARK[key]).toEqual(DS_ACCENTS[key]);
            });
        });
    });

    describe('DS_LIGHT', () => {
        it('should have all required color keys', () => {
            const requiredKeys = [
                'bg',
                'bgDeep',
                'surface',
                'surfaceHover',
                'border',
                'borderAccent',
                'textPrimary',
                'textSub',
                'textMuted',
                'glowCyan',
                'glowViolet',
                'shadowCard',
                'shadowDeep',
                'sidebarBg',
                'sidebarBorder',
                'sidebarText',
                'sidebarHover',
                'headerBg',
                'logoBg',
                'logoText',
                'logoSub',
                '_dark',
                'fontMono',
                'fontUI',
            ];

            requiredKeys.forEach((key) => {
                expect(DS_LIGHT).toHaveProperty(key);
                expect(DS_LIGHT[key]).toBeDefined();
                expect(DS_LIGHT[key]).not.toBeNull();
            });
        });

        it('should have _dark flag set to false', () => {
            expect(DS_LIGHT._dark).toBe(false);
        });

        it('should include all accent colors from DS_ACCENTS', () => {
            const accentKeys = Object.keys(DS_ACCENTS);
            accentKeys.forEach((key) => {
                expect(DS_LIGHT[key]).toEqual(DS_ACCENTS[key]);
            });
        });
    });

    describe('DS_ACCENTS', () => {
        it('should contain all required accent color keys', () => {
            const requiredKeys = [
                'cyan',
                'cyanDim',
                'cyanGlow',
                'violet',
                'violetDim',
                'emerald',
                'amber',
                'rose',
                'fontMono',
                'fontUI',
            ];
            requiredKeys.forEach((key) => {
                expect(DS_ACCENTS).toHaveProperty(key);
                expect(DS_ACCENTS[key]).toBeDefined();
            });
        });

        it('should have valid color values or font families', () => {
            // Colors should be hex or rgba, fonts should be strings
            expect(DS_ACCENTS.cyan).toMatch(/^#|rgba/);
            expect(DS_ACCENTS.fontMono).toBeTypeOf('string');
            expect(DS_ACCENTS.fontUI).toBeTypeOf('string');
        });
    });

    describe('getDS()', () => {
        it('should return a valid theme object', () => {
            const ds = getDS();
            expect(ds).toBeDefined();
            expect(typeof ds).toBe('object');
            expect(ds._dark).toBeTypeOf('boolean');
        });

        it('should return either DS_DARK or DS_LIGHT', () => {
            const ds = getDS();
            const isDark = ds._dark === true;
            const isLight = ds._dark === false;
            expect(isDark || isLight).toBe(true);
        });

        it('should have at least 20 color/style properties', () => {
            const ds = getDS();
            const props = Object.keys(ds);
            expect(props.length).toBeGreaterThan(20);
        });
    });

    describe('setDS()', () => {
        it('should switch to DS_DARK', () => {
            setDS(DS_DARK);
            const current = getDS();
            expect(current._dark).toBe(true);
            expect(current.bg).toBe(DS_DARK.bg);
        });

        it('should switch to DS_LIGHT', () => {
            setDS(DS_LIGHT);
            const current = getDS();
            expect(current._dark).toBe(false);
            expect(current.bg).toBe(DS_LIGHT.bg);
        });

        it('should completely replace the current theme', () => {
            setDS(DS_DARK);
            const dark = getDS();

            setDS(DS_LIGHT);
            const light = getDS();

            expect(dark.bg).not.toBe(light.bg);
            expect(dark.textPrimary).not.toBe(light.textPrimary);
        });

        it('should preserve all required properties after switching', () => {
            const requiredKeys = ['bg', 'surface', 'textPrimary', 'glowCyan', 'shadowCard'];

            setDS(DS_DARK);
            requiredKeys.forEach((key) => {
                expect(getDS()).toHaveProperty(key);
            });

            setDS(DS_LIGHT);
            requiredKeys.forEach((key) => {
                expect(getDS()).toHaveProperty(key);
            });
        });
    });

    describe('Theme contrast', () => {
        it('should have different text colors between dark and light themes', () => {
            expect(DS_DARK.textPrimary).not.toBe(DS_LIGHT.textPrimary);
            expect(DS_DARK.textSub).not.toBe(DS_LIGHT.textSub);
        });

        it('should have different background colors between dark and light themes', () => {
            expect(DS_DARK.bg).not.toBe(DS_LIGHT.bg);
            expect(DS_DARK.surface).not.toBe(DS_LIGHT.surface);
        });
    });
});
