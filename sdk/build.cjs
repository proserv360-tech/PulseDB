/**
 * SDK build — produce a CommonJS copy of src/ under dist/ so that consumers
 * who require('@fathom/sdk') (older bundlers, plain Node CJS) get a working
 * module. ESM consumers continue to use src/ directly via the "import"
 * branch of package.json#exports.
 */
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const distDir = path.join(__dirname, 'dist');

function walk(dir, out) {
    out = out || [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(p, out);
        else if (entry.isFile() && p.endsWith('.js')) out.push(p);
    }
    return out;
}

function transform(code) {
    const trailingExports = [];

    // bare-module named imports: import { X } from 'pkg'  →  const { X } = require('pkg');
    code = code.replace(
        /^\s*import\s*\{([^}]+)\}\s*from\s*['"]([^.'"][^'"]*)['"]\s*;?\s*$/gm,
        function (_, names, source) {
            const rewritten = names.split(',').map(s => s.trim()).filter(Boolean)
                .map(s => s.replace(/\s+as\s+/g, ': ')).join(', ');
            return "const { " + rewritten + " } = require('" + source + "');";
        }
    );

    // bare-module default imports: import X from 'pkg'  →  const X = require('pkg');
    code = code.replace(
        /^\s*import\s+([A-Za-z_$][\w$]*)\s+from\s+['"]([^.'"][^'"]*)['"]\s*;?\s*$/gm,
        function (_, name, source) {
            return "const " + name + " = require('" + source + "');";
        }
    );

    code = code.replace(
        /^\s*import\s*\{([^}]+)\}\s*from\s*['"](\.[^'"]+?)\.js['"]\s*;?\s*$/gm,
        function (_, names, source) {
            const rewritten = names.split(',').map(s => s.trim()).filter(Boolean)
                .map(s => s.replace(/\s+as\s+/g, ': ')).join(', ');
            return "const { " + rewritten + " } = require('" + source + ".cjs');";
        }
    );

    code = code.replace(
        /^\s*import\s+([A-Za-z_$][\w$]*)\s+from\s+['"](\.[^'"]+?)\.js['"]\s*;?\s*$/gm,
        function (_, name, source) {
            return "const " + name + " = require('" + source + ".cjs');";
        }
    );

    code = code.replace(
        /^\s*import\s*\*\s*as\s+([A-Za-z_$][\w$]*)\s+from\s+['"](\.[^'"]+?)\.js['"]\s*;?\s*$/gm,
        function (_, name, source) {
            return "const " + name + " = require('" + source + ".cjs');";
        }
    );

    code = code.replace(
        /^\s*export\s+default\s+([A-Za-z_$][\w$]*)\s*;?\s*$/gm,
        function (_, name) { return "module.exports = " + name + ";"; }
    );

    code = code.replace(
        /^\s*export\s*\{([^}]+)\}\s*;?\s*$/gm,
        function (_, list) {
            return list.split(',').map(s => s.trim()).filter(Boolean)
                .map(function (s) {
                    const parts = s.split(/\s+as\s+/).map(x => x.trim());
                    const local = parts[0];
                    const exported = parts[1] || local;
                    return "module.exports." + exported + " = " + local + ";";
                }).join('\n');
        }
    );

    code = code.replace(
        /^\s*export\s+(async\s+function|function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm,
        function (_, keyword, name) {
            trailingExports.push(name);
            return keyword + " " + name;
        }
    );

    if (trailingExports.length) {
        const unique = Array.from(new Set(trailingExports));
        code += '\n\n' + unique.map(n => "module.exports." + n + " = " + n + ";").join('\n') + '\n';
    }
    return code;
}

// Ensure dist exists. We don't clear it — fs.writeFileSync below overwrites
// in place, and some sandboxes refuse to unlink files we previously wrote.
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

const files = walk(srcDir);
for (const src of files) {
    const rel = path.relative(srcDir, src);
    const out = path.join(distDir, rel.replace(/\.js$/, '.cjs'));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const code = fs.readFileSync(src, 'utf-8');
    fs.writeFileSync(out, transform(code), 'utf-8');
}

const dtsCandidate = path.join(__dirname, 'src', 'index.d.ts');
if (fs.existsSync(dtsCandidate)) {
    fs.copyFileSync(dtsCandidate, path.join(distDir, 'index.d.ts'));
}

console.log("Built " + files.length + " files into dist/");
