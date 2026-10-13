// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * scimFilterParser.js
 * ────────────────────
 * Parser for the SCIM 2.0 filter grammar (RFC 7644 §3.4.2.2).
 *
 * Supported operators:
 *   Comparison: eq, ne, co, sw, ew, pr, gt, ge, lt, le
 *   Logical:    and, or, not
 *   Grouping:   ( … )
 *
 * Complex-attribute value filters like userName eq "x" and emails[type eq "work"]
 * are NOT supported in this first cut — they are rare in Okta / Entra provisioning
 * traffic and introduce considerable grammar complexity. The parser throws a
 * structured `ScimFilterError` if it sees one, so the caller can respond with a
 * proper SCIM 400 instead of a 500.
 *
 * The parser produces a simple AST:
 *   { op: 'eq' | 'co' | … , attr: 'userName', value: '…' }
 *   { op: 'and' | 'or', left: AST, right: AST }
 *   { op: 'not', child: AST }
 *
 * Attribute names are validated against an allowlist so callers can't filter
 * on sensitive internal fields.
 */

export class ScimFilterError extends Error {
    constructor(message, { status = 400, scimType = 'invalidFilter' } = {}) {
        super(message);
        this.name = 'ScimFilterError';
        this.status = status;
        this.scimType = scimType;
    }
}

const COMPARISON_OPS = new Set(['eq', 'ne', 'co', 'sw', 'ew', 'gt', 'ge', 'lt', 'le']);

// ── Tokeniser ─────────────────────────────────────────────────────────────
function tokenise(input) {
    const tokens = [];
    let i = 0;
    const n = input.length;

    while (i < n) {
        const c = input[i];
        if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
        if (c === '(') { tokens.push({ type: 'lparen' }); i++; continue; }
        if (c === ')') { tokens.push({ type: 'rparen' }); i++; continue; }
        if (c === '"') {
            // Quoted string; SCIM allows backslash escapes.
            let v = '';
            i++;
            while (i < n && input[i] !== '"') {
                if (input[i] === '\\' && i + 1 < n) {
                    v += input[i + 1]; i += 2;
                } else {
                    v += input[i]; i++;
                }
            }
            if (i >= n) throw new ScimFilterError('unterminated string literal');
            i++; // consume closing quote
            tokens.push({ type: 'string', value: v });
            continue;
        }
        // Word: attribute name, operator, boolean literal, or number
        if (/[A-Za-z0-9_\-.]/.test(c)) {
            let v = '';
            while (i < n && /[A-Za-z0-9_\-.:]/.test(input[i])) { v += input[i]; i++; }
            const lower = v.toLowerCase();
            if (lower === 'and' || lower === 'or' || lower === 'not') {
                tokens.push({ type: 'logical', value: lower });
            } else if (COMPARISON_OPS.has(lower) || lower === 'pr') {
                tokens.push({ type: 'op', value: lower });
            } else if (lower === 'true' || lower === 'false') {
                tokens.push({ type: 'boolean', value: lower === 'true' });
            } else if (/^-?\d+(\.\d+)?$/.test(v)) {
                tokens.push({ type: 'number', value: Number(v) });
            } else {
                // Treat as attribute path.
                if (v.includes('[')) {
                    throw new ScimFilterError(`complex attribute filter not supported: ${v}`);
                }
                tokens.push({ type: 'attr', value: v });
            }
            continue;
        }
        throw new ScimFilterError(`unexpected character at offset ${i}: '${c}'`);
    }
    return tokens;
}

// ── Parser (recursive descent) ────────────────────────────────────────────
//
// Grammar (subset):
//   expr    := term ( OR term )*
//   term    := factor ( AND factor )*
//   factor  := NOT factor | '(' expr ')' | comp
//   comp    := ATTR OP ( STRING | NUMBER | BOOLEAN ) | ATTR 'pr'
//
function parseFilter(input, { allowedAttributes } = {}) {
    if (typeof input !== 'string' || !input.trim()) {
        throw new ScimFilterError('filter must be a non-empty string');
    }
    const tokens = tokenise(input);
    let pos = 0;

    const peek = () => tokens[pos];
    const consume = (pred) => {
        const t = tokens[pos];
        if (!t || !pred(t)) {
            throw new ScimFilterError(`unexpected token at position ${pos}: ${t ? JSON.stringify(t) : 'EOF'}`);
        }
        pos++; return t;
    };

    const parseComp = () => {
        const attrTok = consume((t) => t.type === 'attr');
        if (allowedAttributes && !allowedAttributes.has(attrTok.value)) {
            throw new ScimFilterError(`attribute not permitted in filter: ${attrTok.value}`, { scimType: 'invalidPath' });
        }
        const opTok = consume((t) => t.type === 'op');
        if (opTok.value === 'pr') {
            return { op: 'pr', attr: attrTok.value };
        }
        const valTok = consume((t) => t.type === 'string' || t.type === 'number' || t.type === 'boolean');
        return { op: opTok.value, attr: attrTok.value, value: valTok.value };
    };

    const parseFactor = () => {
        const t = peek();
        if (!t) throw new ScimFilterError('unexpected end of filter');
        if (t.type === 'logical' && t.value === 'not') {
            pos++;
            return { op: 'not', child: parseFactor() };
        }
        if (t.type === 'lparen') {
            pos++;
            const inner = parseExpr();
            consume((tk) => tk.type === 'rparen');
            return inner;
        }
        return parseComp();
    };

    const parseTerm = () => {
        let left = parseFactor();
        while (peek()?.type === 'logical' && peek().value === 'and') {
            pos++;
            const right = parseFactor();
            left = { op: 'and', left, right };
        }
        return left;
    };

    const parseExpr = () => {
        let left = parseTerm();
        while (peek()?.type === 'logical' && peek().value === 'or') {
            pos++;
            const right = parseTerm();
            left = { op: 'or', left, right };
        }
        return left;
    };

    const ast = parseExpr();
    if (pos !== tokens.length) {
        throw new ScimFilterError(`trailing tokens starting at position ${pos}`);
    }
    return ast;
}

// ── Evaluation ────────────────────────────────────────────────────────────
function getPath(obj, path) {
    const parts = path.split('.');
    let cur = obj;
    for (const p of parts) {
        if (cur === null || cur === undefined) return undefined;
        cur = cur[p];
    }
    return cur;
}

function cmp(op, a, b) {
    switch (op) {
        case 'eq': {
            if (typeof a === 'string' && typeof b === 'string') return a.toLowerCase() === b.toLowerCase();
            return a === b;
        }
        case 'ne': {
            if (typeof a === 'string' && typeof b === 'string') return a.toLowerCase() !== b.toLowerCase();
            return a !== b;
        }
        case 'co': return typeof a === 'string' && typeof b === 'string'
            && a.toLowerCase().includes(b.toLowerCase());
        case 'sw': return typeof a === 'string' && typeof b === 'string'
            && a.toLowerCase().startsWith(b.toLowerCase());
        case 'ew': return typeof a === 'string' && typeof b === 'string'
            && a.toLowerCase().endsWith(b.toLowerCase());
        case 'gt': return a > b;
        case 'ge': return a >= b;
        case 'lt': return a < b;
        case 'le': return a <= b;
        default: return false;
    }
}

export function evaluateFilter(ast, obj) {
    if (!ast) return true;
    switch (ast.op) {
        case 'and': return evaluateFilter(ast.left, obj) && evaluateFilter(ast.right, obj);
        case 'or':  return evaluateFilter(ast.left, obj) || evaluateFilter(ast.right, obj);
        case 'not': return !evaluateFilter(ast.child, obj);
        case 'pr': {
            const v = getPath(obj, ast.attr);
            return v !== undefined && v !== null && v !== '';
        }
        default: {
            const v = getPath(obj, ast.attr);
            return cmp(ast.op, v, ast.value);
        }
    }
}

export { parseFilter };
export default { parseFilter, evaluateFilter, ScimFilterError };
