import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

// Design-token enforcement.
// Hardcoded hex colors should come from src/config/designTokens.ts instead of
// being inlined. ~1,100 legacy occurrences exist, so this is a *warning* (not an
// error) to avoid blocking the build during migration. CI runs lint with
// `--max-warnings 50`, so net-new violations surface in review without failing
// existing code. designTokens.ts is exempt -- it is the source of truth.
const designTokenRule = {
    selector: 'Literal[value=/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]',
    message:
        'Hardcoded hex color - use a design token from src/config/designTokens.ts (DS_LIGHT / DS_DARK / DS_ACCENTS).',
};

const sharedRules = {
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-debugger': 'error',
    eqeqeq: ['error', 'always'],
    'prefer-const': 'error',
    'no-var': 'error',
    'no-restricted-syntax': ['warn', designTokenRule],
};

const sharedLangOptions = {
    ecmaVersion: 2020,
    globals: globals.browser,
    parserOptions: { ecmaVersion: 'latest', ecmaFeatures: { jsx: true }, sourceType: 'module' },
};

// Plain flat-config array (no defineConfig/extends). Using
// extends:[reactRefresh.configs.vite] injected a config whose `files`
// restriction shadowed the TS/TSX block, leaving .tsx files unlinted.
export default [
    { ignores: ['dist'] },

    {
        files: ['**/*.{js,jsx}'],
        plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
        languageOptions: { ...sharedLangOptions },
        rules: {
            ...js.configs.recommended.rules,
            ...reactHooks.configs.recommended.rules,
            'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
            'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
            ...sharedRules,
        },
    },

    {
        files: ['**/*.{ts,tsx}'],
        ignores: ['src/config/designTokens.ts'],
        plugins: { '@typescript-eslint': tseslint, 'react-hooks': reactHooks },
        languageOptions: { ...sharedLangOptions, parser: tsparser },
        rules: {
            ...js.configs.recommended.rules,
            ...reactHooks.configs.recommended.rules,
            'no-unused-vars': 'off',
            'no-undef': 'off',
            ...sharedRules,
        },
    },
];
