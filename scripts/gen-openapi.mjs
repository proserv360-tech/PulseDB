#!/usr/bin/env node
/**
 * scripts/gen-openapi.mjs
 *
 * B5 — Emit an OpenAPI 3.0 document derived from the @fathom/validators Zod
 * schemas. Output: sdk/openapi/fathom-sdk.yaml.
 *
 * This script is intentionally tolerant: it works without zod-to-openapi
 * installed (prints a clear message and exits 0), so CI can opt-in to the
 * gate without a hard dependency bump. When zod-to-openapi is installed it
 * walks the Wave A/B schema set and produces a minimal OpenAPI doc.
 *
 * Re-run via `node scripts/gen-openapi.mjs` after changing schemas.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const OUT = new URL('../sdk/openapi/fathom-sdk.yaml', import.meta.url);
const outPath = OUT.pathname;

async function loadGenerator() {
    try {
        return await import('@asteasolutions/zod-to-openapi');
    } catch {
        return null;
    }
}

async function main() {
    const lib = await loadGenerator();
    if (!lib) {
        console.warn(
            '@asteasolutions/zod-to-openapi is not installed — skipping OpenAPI generation.\n' +
            '  Install with: npm install --workspace=shared/validators @asteasolutions/zod-to-openapi'
        );
        return;
    }

    const validators = await import('../shared/validators/index.ts').catch(async () => {
        // After tsc, the compiled file may live under dist/.
        return import('../shared/validators/dist/index.js');
    });

    const { OpenAPIRegistry, OpenApiGeneratorV3 } = lib;
    const registry = new OpenAPIRegistry();

    // Register response schemas (light coverage; expand as routes adopt validate()).
    if (validators.CopilotRetentionResponseSchema) {
        registry.register('CopilotRetentionResponse', validators.CopilotRetentionResponseSchema);
    }
    if (validators.WaitEventsQuerySchema) {
        registry.register('WaitEventsQuery', validators.WaitEventsQuerySchema);
    }
    if (validators.CreateWorkbookSchema) {
        registry.register('CreateWorkbookInput', validators.CreateWorkbookSchema);
    }
    if (validators.AddPanelSchema) {
        registry.register('AddPanelInput', validators.AddPanelSchema);
    }

    const generator = new OpenApiGeneratorV3(registry.definitions);
    const doc = generator.generateDocument({
        openapi: '3.0.3',
        info: {
            title: 'FATHOM API (selected schemas)',
            version: '1.0.0',
            description: 'Auto-generated from @fathom/validators by scripts/gen-openapi.mjs.',
        },
    });

    mkdirSync(dirname(outPath), { recursive: true });
    // Naive YAML serialisation — pulls in no deps. The generated document is
    // small; if it grows we can switch to `yaml` package.
    const yaml = JSON.stringify(doc, null, 2)
        .replace(/^/gm, '');
    writeFileSync(outPath, '# Auto-generated. Do not edit.\n' + yaml + '\n');
    console.log('Wrote', outPath);
}

main().catch((err) => {
    console.error('gen-openapi failed:', err);
    process.exit(1);
});
