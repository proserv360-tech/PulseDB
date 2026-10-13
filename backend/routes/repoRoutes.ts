// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
// ==========================================================================
//  FATHOM — Repository API Endpoints
// ==========================================================================
import express from 'express';
import fs from 'fs/promises';
import { constants as fsConstants } from 'fs';
import path from 'path';

const router = express.Router();

/* ═══════════════════════════════════════════════════════════════════════════
   HELPER FUNCTIONS
   ═══════════════════════════════════════════════════════════════════════════ */

const IGNORE_PATTERNS = [
    'node_modules', '.git', '.next', 'dist', 'build', '.DS_Store',
    'Thumbs.db', '__pycache__', '*.pyc', '.venv', 'venv', '.env',
    '.idea', '.vscode', 'coverage', '.cache'
];

const shouldIgnore = (name) => {
    return IGNORE_PATTERNS.some(pattern => {
        if (pattern.startsWith('*')) return name.endsWith(pattern.substring(1));
        return name === pattern || name.startsWith(pattern);
    });
};

const readDirectoryRecursive = async (dirPath, basePath = dirPath, depth = 0, maxDepth = 5) => {
    if (depth > maxDepth) return [];

    const files = [];

    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            if (shouldIgnore(entry.name)) continue;

            const fullPath = path.join(dirPath, entry.name);
            const relativePath = path.relative(basePath, fullPath);

            if (entry.isDirectory()) {
                files.push({ path: relativePath, name: entry.name, type: 'dir' });
                const subFiles = await readDirectoryRecursive(fullPath, basePath, depth + 1, maxDepth);
                files.push(...subFiles);
            } else if (entry.isFile()) {
                const stats = await fs.stat(fullPath);
                files.push({
                    path: relativePath,
                    name: entry.name,
                    type: 'file',
                    size: stats.size,
                    modified: stats.mtime
                });
            }
        }
    } catch (error) {
        console.error(`Error reading directory ${dirPath}:`, error);
    }

    return files;
};

/**
 * Validates that a path is safe and doesn't escape the repository root.
 * @param {string} requestedPath - The path to validate
 * @param {string} repoRoot - The repository root directory (optional)
 * @returns {string} The validated path
 * @throws {Error} If path traversal is detected or path is outside repo root
 */
const validatePath = (requestedPath, repoRoot = null) => {
    const normalized = path.normalize(requestedPath);
    if (normalized.includes('..')) {
        throw new Error('Invalid path: directory traversal not allowed');
    }

    // If a repo root is specified, verify the resolved path stays within it
    if (repoRoot) {
        // Resolve to absolute paths for comparison
        const absoluteRepo = path.resolve(repoRoot);
        const absoluteResolved = path.resolve(normalized);

        // Ensure the resolved path starts with the repo root
        if (!absoluteResolved.startsWith(absoluteRepo + path.sep) && absoluteResolved !== absoluteRepo) {
            throw new Error('Access denied: path is outside repository root');
        }
    }

    return normalized;
};

const checkPathAccess = async (filePath) => {
    try {
        await fs.access(filePath, fsConstants.R_OK);
        return true;
    } catch {
        return false;
    }
};

/* ═══════════════════════════════════════════════════════════════════════════
   API ENDPOINTS
   ═══════════════════════════════════════════════════════════════════════════ */

router.post('/read-directory', async (req, res) => {
    try {
        const { path: dirPath, repoRoot } = req.body;

        if (!dirPath) {
            return res.status(400).json({ error: 'Path is required', message: 'Please provide a directory path' });
        }

        const validatedPath = validatePath(dirPath, repoRoot);
        const exists = await checkPathAccess(validatedPath);

        if (!exists) {
            return res.status(404).json({ error: 'Path not found', message: `Directory "${dirPath}" does not exist or is not accessible` });
        }

        const stats = await fs.stat(validatedPath);
        if (!stats.isDirectory()) {
            return res.status(400).json({ error: 'Not a directory', message: `Path "${dirPath}" is not a directory` });
        }

        const files = await readDirectoryRecursive(validatedPath);
        res.json({ data: files, count: files.length, path: validatedPath });

    } catch (error) {
        console.error('Error reading directory:', error);
        if (error.message.includes('Access denied')) {
            return res.status(403).json({ error: 'Forbidden', message: 'Access denied: path is outside repository root' });
        }
        res.status(500).json({ error: 'Failed to read directory', requestId: req.id });
    }
});

router.post('/read-file', async (req, res) => {
    try {
        const { path: filePath, repoRoot } = req.body;

        if (!filePath) {
            return res.status(400).json({ error: 'Path is required', message: 'Please provide a file path' });
        }

        const validatedPath = validatePath(filePath, repoRoot);
        const exists = await checkPathAccess(validatedPath);

        if (!exists) {
            return res.status(404).json({ error: 'File not found', message: `File "${filePath}" does not exist or is not accessible` });
        }

        const stats = await fs.stat(validatedPath);
        if (!stats.isFile()) {
            return res.status(400).json({ error: 'Not a file', message: `Path "${filePath}" is not a file` });
        }

        const maxSize = 10 * 1024 * 1024;
        if (stats.size > maxSize) {
            return res.status(413).json({ error: 'File too large', message: `File size (${stats.size} bytes) exceeds maximum allowed size (${maxSize} bytes)` });
        }

        const content = await fs.readFile(validatedPath, 'utf-8');
        res.json({ data: { content, size: stats.size, modified: stats.mtime, path: validatedPath } });

    } catch (error) {
        console.error('Error reading file:', error);
        if (error.message.includes('Access denied')) {
            return res.status(403).json({ error: 'Forbidden', message: 'Access denied: path is outside repository root' });
        }
        if (error.code === 'ERR_INVALID_ARG_VALUE') {
            return res.status(415).json({ error: 'File encoding not supported', message: 'This file appears to be binary or uses an unsupported encoding' });
        }
        res.status(500).json({ error: 'Failed to read file', requestId: req.id });
    }
});

router.post('/write-file', async (req, res) => {
    try {
        const { path: filePath, content, repoRoot } = req.body;

        if (!filePath) {
            return res.status(400).json({ error: 'Path is required', message: 'Please provide a file path' });
        }
        if (content === undefined || content === null) {
            return res.status(400).json({ error: 'Content is required', message: 'Please provide file content' });
        }

        const validatedPath = validatePath(filePath, repoRoot);
        const dir = path.dirname(validatedPath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(validatedPath, content, 'utf-8');

        const stats = await fs.stat(validatedPath);
        res.json({ data: { success: true, path: validatedPath, size: stats.size, modified: stats.mtime }, message: 'File saved successfully' });

    } catch (error) {
        console.error('Error writing file:', error);
        if (error.message.includes('Access denied')) {
            return res.status(403).json({ error: 'Forbidden', message: 'Access denied: path is outside repository root' });
        }
        res.status(500).json({ error: 'Failed to write file', requestId: req.id });
    }
});

router.post('/delete-file', async (req, res) => {
    try {
        const { path: filePath, repoRoot } = req.body;

        if (!filePath) {
            return res.status(400).json({ error: 'Path is required', message: 'Please provide a file path' });
        }

        const validatedPath = validatePath(filePath, repoRoot);
        const exists = await checkPathAccess(validatedPath);

        if (!exists) {
            return res.status(404).json({ error: 'File not found', message: `File "${filePath}" does not exist` });
        }

        await fs.unlink(validatedPath);
        res.json({ data: { success: true, path: validatedPath }, message: 'File deleted successfully' });

    } catch (error) {
        console.error('Error deleting file:', error);
        if (error.message.includes('Access denied')) {
            return res.status(403).json({ error: 'Forbidden', message: 'Access denied: path is outside repository root' });
        }
        res.status(500).json({ error: 'Failed to delete file', requestId: req.id });
    }
});

router.post('/create-file', async (req, res) => {
    try {
        const { path: filePath, content = '', repoRoot } = req.body;

        if (!filePath) {
            return res.status(400).json({ error: 'Path is required', message: 'Please provide a file path' });
        }

        const validatedPath = validatePath(filePath, repoRoot);
        const exists = await checkPathAccess(validatedPath);

        if (exists) {
            return res.status(409).json({ error: 'File already exists', message: `File "${filePath}" already exists` });
        }

        const dir = path.dirname(validatedPath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(validatedPath, content, 'utf-8');

        res.json({ data: { success: true, path: validatedPath }, message: 'File created successfully' });

    } catch (error) {
        console.error('Error creating file:', error);
        if (error.message.includes('Access denied')) {
            return res.status(403).json({ error: 'Forbidden', message: 'Access denied: path is outside repository root' });
        }
        res.status(500).json({ error: 'Failed to create file', requestId: req.id });
    }
});

router.post('/git-status', async (req, res) => {
    try {
        const { path: repoPath, repoRoot } = req.body;

        if (!repoPath) {
            return res.status(400).json({ error: 'Path is required', message: 'Please provide a repository path' });
        }

        const validatedPath = validatePath(repoPath, repoRoot);
        const gitPath = path.join(validatedPath, '.git');
        const isGitRepo = await checkPathAccess(gitPath);

        if (!isGitRepo) {
            return res.json({ data: { isGitRepo: false, message: 'Not a git repository' } });
        }

        res.json({ data: { isGitRepo: true, branch: 'main', status: 'clean', message: 'Git status check requires git integration' } });

    } catch (error) {
        console.error('Error checking git status:', error);
        if (error.message.includes('Access denied')) {
            return res.status(403).json({ error: 'Forbidden', message: 'Access denied: path is outside repository root' });
        }
        res.status(500).json({ error: 'Failed to check git status', requestId: req.id });
    }
});

export default router;