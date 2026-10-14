import React, { useState } from 'react';
import { AlertTriangle, Check, Lightbulb, Sparkles } from 'lucide-react';
import { THEME } from '../../../utils/theme';
import { AiAdviceBox, Badge, C, Panel, Recommendation, ScriptBlock, SEVERITY_COLOR, useAiAdvice, ViewResult } from './shared';

/**
 * Recommendations panel for a SQL Server screen: the advisor's rule-based
 * findings (each with a script to review) plus an "Ask AI" review of
 * everything on the screen.
 */
export default function Advisor({
    result,
    advice,
    title = 'Recommendations',
}: {
    result: ViewResult;
    advice: ReturnType<typeof useAiAdvice>;
    title?: string;
}) {
    const recs: Recommendation[] = result.data.recommendations || [];
    const [open, setOpen] = useState<Record<string, boolean>>({});
    const colors = SEVERITY_COLOR();
    const counts = recs.reduce((a: Record<string, number>, r) => ({ ...a, [r.severity]: (a[r.severity] || 0) + 1 }), {});
    const ai = result.ai;
    const severities: Recommendation['severity'][] = ['high', 'medium', 'low'];

    return (
        <Panel
            title={title}
            icon={Lightbulb}
            color={C.amber}
            pad={false}
            right={
                <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {severities.map((s) =>
                        counts[s] ? (
                            <Badge key={s} color={colors[s]}>
                                {counts[s]} {s}
                            </Badge>
                        ) : null,
                    )}
                    <button
                        className="mss-btn"
                        type="button"
                        disabled={advice.loading || !ai?.available}
                        onClick={() => advice.run('AI review of this screen')}
                        title={ai?.available ? 'Ask AI to review everything on this screen' : 'AI is not configured on the server'}
                        style={{ color: C.purple, padding: '4px 10px' }}
                    >
                        <Sparkles size={13} /> Ask AI
                    </button>
                </span>
            }
        >
            <div style={{ padding: '12px 16px', display: 'grid', gap: 10 }}>
                <AiAdviceBox advice={advice} />
                {ai && !ai.available && !advice.text && (
                    <div className="mss-sub">
                        AI review is off: set <code>GROQ_API_KEY</code> (free), <code>ANTHROPIC_API_KEY</code> or <code>OPENAI_API_KEY</code> in
                        the server environment. The recommendations below work without it.
                    </div>
                )}
                {recs.length === 0 ? (
                    <div className="mss-sub" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Check size={14} color={THEME.success} /> Nothing to recommend for this screen right now.
                    </div>
                ) : (
                    recs.map((r) => (
                        <div
                            key={r.id}
                            style={{
                                display: 'grid',
                                gap: 6,
                                padding: '10px 12px',
                                borderRadius: 10,
                                border: `1px solid ${THEME.glassBorder}`,
                                borderLeft: `3px solid ${colors[r.severity]}`,
                                background: THEME.surface,
                                minWidth: 0,
                            }}
                        >
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                <Badge color={colors[r.severity]}>{r.severity}</Badge>
                                <span className="mss-sub">{r.category}</span>
                                <strong style={{ fontSize: 13, color: THEME.textMain }}>{r.title}</strong>
                                {r.sql && (
                                    <button
                                        className="mss-btn"
                                        type="button"
                                        style={{ marginLeft: 'auto', padding: '3px 9px', fontSize: 11 }}
                                        onClick={() => setOpen((o) => ({ ...o, [r.id]: !o[r.id] }))}
                                    >
                                        {open[r.id] ? 'Hide script' : 'Show script'}
                                    </button>
                                )}
                            </div>
                            {r.detail && <div style={{ fontSize: 12.5, color: THEME.textMuted, lineHeight: 1.55 }}>{r.detail}</div>}
                            {r.sql && open[r.id] && <ScriptBlock sql={r.sql} />}
                            {r.caution && (open[r.id] || !r.sql) && (
                                <div style={{ fontSize: 12, color: THEME.warning, display: 'flex', gap: 6 }}>
                                    <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 2 }} /> {r.caution}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </Panel>
    );
}
