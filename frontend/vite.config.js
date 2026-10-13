import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/ — cache bust: 2026-06-16T2
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
            '@fathom/types': path.resolve(__dirname, '../shared/types/index.ts'),
            '@fathom/validators': path.resolve(__dirname, '../shared/validators/index.ts'),
        },
    },
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:5000',
                changeOrigin: true,
                secure: false,
            },
            '/ws': {
                target: 'ws://localhost:5000',
                ws: true,
            },
        },
    },
    build: {
        target: 'es2022',
        cssCodeSplit: true,
        sourcemap: false,
        minify: 'esbuild',
        rollupOptions: {
            output: {
                // Only list packages the app actually imports. A manualChunks
                // entry for an uninstalled package makes rollup fail the build
                // with "Cannot resolve", so this list and the dependencies in
                // package.json have to move together.
                //
                // Removed alongside their dependencies: react-is, date-fns,
                // zod, @xyflow/react, @uiw/react-codemirror and
                // @codemirror/lang-sql — none had a single import site.
                manualChunks: {
                    'vendor-react': ['react', 'react-dom'],
                    'vendor-router': ['react-router-dom'],
                    'vendor-charts': ['recharts'],
                    'vendor-ui': ['lucide-react'],
                    // Heavy libs that previously landed in the main index chunk.
                    // Splitting them out shrinks the eager bundle and lets the
                    // browser cache them independently across deploys.
                    'vendor-query': ['@tanstack/react-query'],
                    'vendor-sentry': ['@sentry/react'],
                    'vendor-sanitize': ['dompurify'],
                },
            },
        },
        chunkSizeWarningLimit: 600,
    },
    optimizeDeps: {
        include: [
            'react',
            'react-dom',
            'react-router-dom',
            'recharts',
            'lucide-react',
            '@tanstack/react-query',
            'dompurify',
        ],
    },
    test: {
        globals: true,
        environment: 'jsdom',
        include: ['src/**/*.test.{js,ts,tsx}', 'src/**/*.spec.{js,ts,tsx}'],
        setupFiles: ['./src/test/setup.ts'],
    },
});
