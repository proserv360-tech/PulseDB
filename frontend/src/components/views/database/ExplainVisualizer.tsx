/**
 * components/ExplainVisualizer.tsx
 * ────────────────────────────────
 * Renders a Postgres EXPLAIN JSON as an interactive tree with the most
 * actionable metrics surfaced (cost, rows, actual time, buffers).
 *
 * Two modes:
 *   - single plan view with a node-level card on click
 *   - diff view: pass `diffChanges` to highlight regressed nodes
 *
 * Deliberately inline-styled to match the existing frontend convention.
 */

import { useMemo, useState } from 'react';
import { THEME } from '../../../utils/theme';

type PgNode = {
    'Node Type': string;
    'Relation Name'?: string;
    'Index Name'?: string;
    'Startup Cost'?: number;
    'Total Cost'?: number;
    'Plan Rows'?: number;
    'Actual Rows'?: number;
    'Actual Total Time'?: number;
    'Actual Loops'?: number;
    'Shared Hit Blocks'?: number;
    'Shared Read Blocks'?: number;
    Plans?: PgNode[];
};

type Props = {
    plan: { Plan: PgNode } | PgNode;
    diffChanges?: Array<{ id: string; kind: string; diffs?: Record<string, [any, any]> }>;
    title?: string;
};

export default function ExplainVisualizer({ plan, diffChanges, title }: Props) {
    const root: PgNode = useMemo(
        () => ('Plan' in (plan as any) ? (plan as any).Plan : plan) as PgNode,
        [plan]
    );
    const [selected, setSelected] = useState<{ path: string; node: PgNode } | null>(null);

    const changeMap = useMemo(() => {
        const m = new Map<string, { kind: string; diffs?: any }>();
        (diffChanges || []).forEach(c => m.set(c.id, c));
        return m;
    }, [diffChanges]);

    return (
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
                {title && <h3 style={{ margin: '0 0 8px' }}>{title}</h3>}
                <NodeView
                    node={root}
                    depth={0}
                    path="0"
                    selected={selected?.path}
                    onSelect={(path, node) => setSelected({ path, node })}
                    changes={changeMap}
                />
            </div>
            <aside style={{
                flex: '0 0 320px', background: THEME.surface,
                border: '1px solid #1a3878', borderRadius: 8, padding: 16,
                position: 'sticky', top: 16,
            }}>
                {selected ? (
                    <NodeCard node={selected.node} />
                ) : (
                    <div style={{ color: THEME.textMuted }}>
                        Click any plan node to inspect metrics.
                    </div>
                )}
            </aside>
        </div>
    );
}

function NodeView({
    node, depth, path, selected, onSelect, changes,
}: {
    node: PgNode;
    depth: number;
    path: string;
    selected?: string;
    onSelect: (path: string, node: PgNode) => void;
    changes: Map<string, any>;
}) {
    const change = changes.get(path);
    const borderColor = change
        ? change.kind === 'changed' ? THEME.warning
        : change.kind === 'added' ? THEME.successDark
        : THEME.dangerDark
        : THEME.grid;
    const bg = selected === path ? THEME.surface : '#fff';

    return (
        <div style={{ marginLeft: depth === 0 ? 0 : 20, position: 'relative' }}>
            <button
                onClick={() => onSelect(path, node)}
                style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: 10, marginBottom: 8, borderRadius: 6,
                    border: `1px solid ${borderColor}`, background: bg,
                    cursor: 'pointer',
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <strong>{node['Node Type']}</strong>
                    <span style={{ color: THEME.textMuted, fontSize: 12 }}>
                        {typeof node['Actual Total Time'] === 'number'
                            ? `${node['Actual Total Time']!.toFixed(1)} ms`
                            : ''}
                    </span>
                </div>
                <div style={{ fontSize: 12, color: THEME.textMuted }}>
                    {node['Relation Name'] && <>on <code>{node['Relation Name']}</code> · </>}
                    {node['Index Name'] && <>idx <code>{node['Index Name']}</code> · </>}
                    rows {formatNum(node['Actual Rows'])} (est {formatNum(node['Plan Rows'])}) ·
                    cost {formatNum(node['Total Cost'])}
                </div>
                {change?.diffs && (
                    <div style={{ fontSize: 11, color: THEME.warningDark, marginTop: 4 }}>
                        {Object.entries(change.diffs).map(([k, [a, b]]: any) => (
                            <span key={k} style={{ marginRight: 8 }}>
                                {k}: {formatNum(a)} → {formatNum(b)}
                            </span>
                        ))}
                    </div>
                )}
            </button>
            {(node.Plans || []).map((c, i) => (
                <NodeView
                    key={i}
                    node={c}
                    depth={depth + 1}
                    path={`${path}.${i}`}
                    selected={selected}
                    onSelect={onSelect}
                    changes={changes}
                />
            ))}
        </div>
    );
}

function NodeCard({ node }: { node: PgNode }) {
    const row = (k: string, v: any) =>
        v === undefined || v === null ? null : (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}>
                <span style={{ color: THEME.textMuted }}>{k}</span>
                <span><code>{typeof v === 'number' ? formatNum(v) : String(v)}</code></span>
            </div>
        );
    return (
        <div>
            <h4 style={{ margin: '0 0 8px' }}>{node['Node Type']}</h4>
            {row('Relation', node['Relation Name'])}
            {row('Index', node['Index Name'])}
            {row('Startup Cost', node['Startup Cost'])}
            {row('Total Cost', node['Total Cost'])}
            {row('Est. Rows', node['Plan Rows'])}
            {row('Actual Rows', node['Actual Rows'])}
            {row('Actual Total Time (ms)', node['Actual Total Time'])}
            {row('Loops', node['Actual Loops'])}
            {row('Shared Hit Blocks', node['Shared Hit Blocks'])}
            {row('Shared Read Blocks', node['Shared Read Blocks'])}
        </div>
    );
}

function formatNum(n: any): string {
    if (n === null || n === undefined) return '—';
    const v = Number(n);
    if (!Number.isFinite(v)) return String(n);
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
    if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
    if (Number.isInteger(v)) return v.toString();
    return v.toFixed(2);
}
