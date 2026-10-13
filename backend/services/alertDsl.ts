// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * services/alertDsl.js
 * ────────────────────
 * A small, safe expression language for user-authored alert rules.
 *
 * Grammar:
 *   expr     := orExpr
 *   orExpr   := andExpr ('||' andExpr)*
 *   andExpr  := cmp ('&&' cmp)*
 *   cmp      := term OP term
 *   term     := funcCall | NUMBER | IDENT | '(' expr ')'
 *   funcCall := IDENT '(' IDENT ',' NUMBER? ')'    // avg(metric, windowSeconds)
 *   OP       := '>' | '>=' | '<' | '<=' | '==' | '!='
 *
 * Supported functions:
 *   avg(metric, windowSeconds)        rolling average over a window
 *   max(metric, windowSeconds)        rolling max
 *   min(metric, windowSeconds)        rolling min
 *   rate(metric, windowSeconds)       change / windowSeconds (per-second rate)
 *   delta(metric, windowSeconds)      last - first over the window
 *   pct_change(metric, windowSeconds) (last - first) / first
 *   sustained(metric, op, threshold, durationSeconds)
 *                                     true iff every sample in the window
 *                                     satisfied op(metric, threshold)
 *   anomaly(metric, windowSeconds, threshold?)
 *                                     EWMA anomaly score (sigmas) of the latest
 *                                     sample, baselined over the window.
 *   is_anomaly(metric, windowSeconds, threshold?)
 *                                     boolean: anomaly score >= threshold (default 3).
 *
 * Bare identifiers resolve to the most-recent value of that metric.
 *
 * Examples:
 *   cpu_pct > 90
 *   avg(connection_count, 300) >= 0.8 * max_connections
 *   pct_change(replica_lag_ms, 600) > 0.5 && replica_lag_ms > 5000
 *   sustained(cpu_pct, '>', 85, 300)
 *
 * The parser is intentionally small and produces a JSON AST that can be
 * persisted alongside the rule. The evaluator is pure and takes a
 * `metricsProvider` function so it can be unit-tested without a database.
 */

import { EwmaDetector } from './anomaly/ewma.js';

// ─────────────────────────────────────────────────────────────────────────────
// Tokenizer
// ─────────────────────────────────────────────────────────────────────────────
const TOK = {
    NUM: 'NUM', IDENT: 'IDENT', STR: 'STR',
    LP: 'LP', RP: 'RP', COMMA: 'COMMA',
    OP: 'OP', AND: 'AND', OR: 'OR',
    STAR: '*', SLASH: '/', PLUS: '+', MINUS: '-',
    EOF: 'EOF',
};

const OPS = new Set(['>', '>=', '<', '<=', '==', '!=']);

function tokenize(src) {
    const tokens = [];
    let i = 0;
    while (i < src.length) {
        const c = src[i];
        if (/\s/.test(c)) { i++; continue; }
        if (c === '(') { tokens.push({ t: TOK.LP }); i++; continue; }
        if (c === ')') { tokens.push({ t: TOK.RP }); i++; continue; }
        if (c === ',') { tokens.push({ t: TOK.COMMA }); i++; continue; }
        if (c === '*') { tokens.push({ t: TOK.STAR }); i++; continue; }
        if (c === '/') { tokens.push({ t: TOK.SLASH }); i++; continue; }
        if (c === '+') { tokens.push({ t: TOK.PLUS }); i++; continue; }
        if (c === '-') { tokens.push({ t: TOK.MINUS }); i++; continue; }
        if (c === '&' && src[i + 1] === '&') { tokens.push({ t: TOK.AND }); i += 2; continue; }
        if (c === '|' && src[i + 1] === '|') { tokens.push({ t: TOK.OR }); i += 2; continue; }
        if (c === '"' || c === "'") {
            const quote = c; let j = i + 1; let s = '';
            while (j < src.length && src[j] !== quote) { s += src[j++]; }
            if (src[j] !== quote) throw new Error('Unterminated string');
            tokens.push({ t: TOK.STR, v: s });
            i = j + 1; continue;
        }
        if (/[0-9.]/.test(c)) {
            let j = i; while (j < src.length && /[0-9.]/.test(src[j])) j++;
            tokens.push({ t: TOK.NUM, v: parseFloat(src.slice(i, j)) });
            i = j; continue;
        }
        if (/[a-zA-Z_]/.test(c)) {
            let j = i; while (j < src.length && /[a-zA-Z0-9_]/.test(src[j])) j++;
            tokens.push({ t: TOK.IDENT, v: src.slice(i, j) });
            i = j; continue;
        }
        // 2-char operators before single-char.
        const two = src.slice(i, i + 2);
        if (OPS.has(two)) { tokens.push({ t: TOK.OP, v: two }); i += 2; continue; }
        if (OPS.has(c)) { tokens.push({ t: TOK.OP, v: c }); i++; continue; }
        throw new Error(`Unexpected character: ${c}`);
    }
    tokens.push({ t: TOK.EOF });
    return tokens;
}

// ─────────────────────────────────────────────────────────────────────────────
// Parser (recursive descent → JSON AST)
// ─────────────────────────────────────────────────────────────────────────────
export function parse(src) {
    const tokens = tokenize(src);
    let pos = 0;
    const peek = () => tokens[pos];
    const eat = (t) => {
        if (tokens[pos].t !== t) {
            throw new Error(`Expected ${t}, got ${tokens[pos].t}`);
        }
        return tokens[pos++];
    };

    function parseExpr() { return parseOr(); }
    function parseOr() {
        let left = parseAnd();
        while (peek().t === TOK.OR) { pos++; left = { type: 'or', left, right: parseAnd() }; }
        return left;
    }
    function parseAnd() {
        let left = parseCmp();
        while (peek().t === TOK.AND) { pos++; left = { type: 'and', left, right: parseCmp() }; }
        return left;
    }
    function parseCmp() {
        const left = parseSum();
        if (peek().t === TOK.OP) {
            const op = eat(TOK.OP).v;
            const right = parseSum();
            return { type: 'cmp', op, left, right };
        }
        return left;
    }
    function parseSum() {
        let left = parseMul();
        while (peek().t === TOK.PLUS || peek().t === TOK.MINUS) {
            const op = tokens[pos++].t === TOK.PLUS ? '+' : '-';
            left = { type: 'bin', op, left, right: parseMul() };
        }
        return left;
    }
    function parseMul() {
        let left = parseAtom();
        while (peek().t === TOK.STAR || peek().t === TOK.SLASH) {
            const op = tokens[pos++].t === TOK.STAR ? '*' : '/';
            left = { type: 'bin', op, left, right: parseAtom() };
        }
        return left;
    }
    function parseAtom() {
        const t = peek();
        if (t.t === TOK.NUM) { pos++; return { type: 'num', value: t.v }; }
        if (t.t === TOK.STR) { pos++; return { type: 'str', value: t.v }; }
        if (t.t === TOK.LP) { pos++; const e = parseExpr(); eat(TOK.RP); return e; }
        if (t.t === TOK.MINUS) { pos++; return { type: 'neg', expr: parseAtom() }; }
        if (t.t === TOK.IDENT) {
            pos++;
            if (peek().t === TOK.LP) {
                pos++;
                const args = [];
                if (peek().t !== TOK.RP) {
                    args.push(parseExpr());
                    while (peek().t === TOK.COMMA) { pos++; args.push(parseExpr()); }
                }
                eat(TOK.RP);
                return { type: 'call', name: t.v, args };
            }
            return { type: 'ident', name: t.v };
        }
        throw new Error(`Unexpected token: ${t.t}`);
    }

    const ast = parseExpr();
    if (peek().t !== TOK.EOF) throw new Error(`Trailing tokens at ${pos}`);
    return ast;
}

// ─────────────────────────────────────────────────────────────────────────────
// Evaluator
// metricsProvider: {
//     current(name): number,
//     series(name, windowSeconds): Array<{ t: number, v: number }>,
// }
// ─────────────────────────────────────────────────────────────────────────────
export function evaluate(ast, metricsProvider) {
    return evalNode(ast, metricsProvider);
}

function evalNode(n, mp) {
    switch (n.type) {
        case 'num': return n.value;
        case 'str': return n.value;
        case 'neg': return -evalNode(n.expr, mp);
        case 'ident': return mp.current(n.name);
        case 'bin': {
            const a = evalNode(n.left, mp);
            const b = evalNode(n.right, mp);
            switch (n.op) {
                case '+': return a + b;
                case '-': return a - b;
                case '*': return a * b;
                case '/': return b === 0 ? NaN : a / b;
            }
            break;
        }
        case 'cmp': {
            const a = evalNode(n.left, mp);
            const b = evalNode(n.right, mp);
            return compare(a, n.op, b);
        }
        case 'and': return evalNode(n.left, mp) && evalNode(n.right, mp);
        case 'or':  return evalNode(n.left, mp) || evalNode(n.right, mp);
        case 'call': return callFn(n.name, n.args, mp);
    }
    throw new Error(`Unknown AST node: ${n.type}`);
}

function compare(a, op, b) {
    switch (op) {
        case '>':  return a >  b;
        case '>=': return a >= b;
        case '<':  return a <  b;
        case '<=': return a <= b;
        case '==': return a === b;
        case '!=': return a !== b;
    }
    return false;
}

function callFn(name, args, mp) {
    switch (name) {
        case 'avg': case 'max': case 'min':
        case 'rate': case 'delta': case 'pct_change': {
            const metric = literalIdentOrString(args[0]);
            const windowSec = Number(evalNode(args[1], mp));
            const series = mp.series(metric, windowSec);
            if (!series.length) return 0;
            const values = series.map(p => p.v);
            if (name === 'avg') return values.reduce((a, b) => a + b, 0) / values.length;
            if (name === 'max') return Math.max(...values);
            if (name === 'min') return Math.min(...values);
            const first = values[0], last = values[values.length - 1];
            if (name === 'delta') return last - first;
            if (name === 'rate')  return (last - first) / Math.max(windowSec, 1);
            if (name === 'pct_change') return first === 0 ? 0 : (last - first) / first;
            break;
        }
        case 'sustained': {
            const metric = literalIdentOrString(args[0]);
            const op = String(evalNode(args[1], mp));
            const threshold = Number(evalNode(args[2], mp));
            const windowSec = Number(evalNode(args[3], mp));
            const series = mp.series(metric, windowSec);
            if (!series.length) return false;
            return series.every(p => compare(p.v, op, threshold));
        }
        case 'anomaly':
        case 'is_anomaly': {
            const metric = literalIdentOrString(args[0]);
            const windowSec = Number(evalNode(args[1], mp));
            const threshold = args.length > 2 ? Number(evalNode(args[2], mp)) : 3.0;
            const series = mp.series(metric, windowSec);
            if (!series.length) return name === 'is_anomaly' ? false : 0;
            // Replay the window through a fresh EWMA detector so the evaluator
            // stays pure (no shared detector state across calls). The score of
            // the final sample is what the rule reasons about.
            const detector = new EwmaDetector({ threshold });
            let last = { anomaly: false, score: 0 };
            for (const point of series) last = detector.push(point.v);
            return name === 'is_anomaly' ? !!last.anomaly : Number(last.score) || 0;
        }
        default:
            throw new Error(`Unknown function: ${name}`);
    }
}

function literalIdentOrString(n) {
    if (n.type === 'ident') return n.name;
    if (n.type === 'str') return n.value;
    throw new Error('Expected metric name as identifier or string');
}

/**
 * Quick validation helper used by the CRUD route before saving a rule.
 */
export function validate(expression) {
    try { parse(expression); return { ok: true }; }
    catch (err) { return { ok: false, error: err.message }; }
}
