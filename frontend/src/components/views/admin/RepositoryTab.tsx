// ==========================================================================
//  FATHOM — RepositoryTab  (v11 — FIXED API INTEGRATION)
// ==========================================================================
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { THEME, useAdaptiveTheme, metricValue } from '../../../utils/theme';
import { postData } from '../../../utils/api';
import {
    GitBranch, FolderOpen, File, FileCode, FileJson, FileText,
    Plus, Trash2, Search, X, Copy, Check, ChevronRight, ChevronDown,
    Code, Eye, Edit3, Save, Loader,
    AlertTriangle, CheckCircle, Shield, Zap, Terminal,
    ArrowRight, Sparkles, Lightbulb,
    Globe, Activity, TrendingUp, TrendingDown, Minus,
    Github, Gitlab, HardDrive,
    GitPullRequest, Database, Workflow, Flame, Gauge, Wrench,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════════
   REAL AI ANALYSIS ENGINE  (routes through backend /api/ai/chat proxy)
   ═══════════════════════════════════════════════════════════════════════════ */
const useAIAnalysis = () => {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [mode, setMode] = useState(null); // 'file' | 'repo'

    const callClaude = async (system, prompt) => {
        const data = await postData('/api/ai/chat', {
            max_tokens: 4000,
            system,
            messages: [{ role: 'user', content: prompt }],
        });

        const raw = data.content?.map(b => b.text || '').join('') || '';

        // Strip markdown fences that Llama/Groq often adds despite instructions
        const stripped = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
        // Extract the outermost JSON object
        const jsonMatch = stripped.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("AI returned a non-JSON response. Try again.");
        return JSON.parse(jsonMatch[0]);
    };

    const autoFix = async ({ filename, code, issues }) => {
        if (!code.trim() || !issues?.length) return null;
        const issuesList = issues.map((iss, i) =>
            `${i + 1}. [${iss.severity?.toUpperCase()}] Line ${iss.line || '?'}: ${iss.title} — ${iss.description}`
        ).join('\n');

        const data = await postData('/api/ai/chat', {
            max_tokens: 6000,
            system: 'You are an expert software engineer. When given code and a list of issues, return ONLY the fully corrected code with no explanation, no markdown fences, no commentary — just the raw fixed code.',
            messages: [{
                role: 'user',
                content: `Fix ALL of the following issues in the file '${filename}'.\n\nISSUES TO FIX:\n${issuesList}\n\nORIGINAL CODE:\n${code.substring(0, 18000)}\n\nReturn ONLY the corrected code. No explanations. No markdown. Just the fixed code.`
            }],
        });
        const raw = data.content?.map(b => b.text || '').join('') || '';
        // Strip any accidental markdown fences
        return raw.replace(/^```[\w]*\n?/m, '').replace(/\n?```$/m, '').trim();
    };

    const analyze = async ({ filename, code, repoName }) => {
        if (!code.trim()) return;
        setLoading(true); setError(null); setMode('file'); setResult(null);
        try {
            const system = 'You are an elite Staff Software Engineer and Security Auditor. You MUST respond ONLY with a single valid raw JSON object. No markdown, no code fences, no prose before or after — just the JSON object starting with { and ending with }.';
            const prompt = `Perform a deep analysis on the following code from file '${filename}' in repo '${repoName}'.

Code:
${code.substring(0, 12000)}

IMPORTANT: The "fix" field in each issue MUST contain the actual corrected code snippet or exact SQL/command to resolve the problem — not a vague description.

Return EXACTLY this JSON object (raw JSON only, no markdown fences, no extra text):
{
  "healthScore": <0-100 number>,
  "summary": "<1-2 sentence executive summary>",
  "language": "<detected language>",
  "linesAnalyzed": <number>,
  "complexityMetrics": { "cyclomaticComplexity": "<Low|Medium|High>", "coupling": "<Low|Medium|High>", "testability": "<Good|Fair|Poor>" },
  "strengths": ["<strength 1>", "<strength 2>"],
  "issues": [
    {
      "line": <line number or null>,
      "title": "<short issue title>",
      "severity": "<critical|high|medium|low>",
      "type": "<Bug|Security|Performance|Style>",
      "description": "<what is wrong and why it matters>",
      "fix": "<the actual corrected code or exact command to fix this — must be concrete, not vague>"
    }
  ],
  "securityFlags": [ { "title": "<vuln>", "severity": "<critical|high|medium|low>", "description": "<details>" } ],
  "performanceInsights": [ { "title": "<issue>", "impact": "<high|medium|low>", "suggestion": "<concrete suggestion with example if possible>" } ],
  "refactorOpportunities": [ { "title": "<opportunity>", "effort": "<high|medium|low>", "impact": "<high|medium|low>", "description": "<details>" } ],
  "aiRecommendations": [ { "priority": <1-5>, "title": "<rec>", "rationale": "<why>" } ]
}`;

            const aiData = await callClaude(system, prompt);
            setResult(aiData);
        } catch (e) {
            const m = e.message || '';
            setError(m.includes('not configured') || m.includes('503') || m.includes('API key')
                ? 'AI analysis is not enabled. Ask your administrator to configure the AI key in the backend settings.'
                : 'Analysis failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const analyzeRepo = async ({ repoName, repoPath, repoType }) => {
        setLoading(true); setError(null); setMode('repo'); setResult(null);
        try {
            const system = 'You are an elite Software Architect. Respond ONLY with valid, raw JSON — no markdown, no extra text.';
            const prompt = `Analyze the repository context. Name: '${repoName}', Path/URL: '${repoPath}', Type: '${repoType}'.
Because I am passing metadata instead of the full codebase, infer likely architectural patterns, common pitfalls, and security risks associated with this type of repository name/structure.

Return EXACTLY this JSON structure (no extra keys, no markdown):
{
  "overallHealthScore": <0-100 number>,
  "repoSummary": "<Architectural overview based on inference>",
  "architecturePattern": "<Inferred pattern e.g., Monolith, Microservice, React SPA>",
  "techDebtEstimate": "<low|medium|high>",
  "securityPosture": "<strong|moderate|weak>",
  "primaryLanguages": ["<Lang 1>", "<Lang 2>"],
  "estimatedSize": "<Small|Medium|Large>",
  "metricsEstimate": { "codeQuality": <0-100>, "testCoverage": <0-100>, "documentation": <0-100>, "securityScore": <0-100> },
  "quickWins": ["<win 1>", "<win 2>"],
  "topRisks": [ { "risk": "<risk name>", "severity": "<critical|high|medium|low>", "description": "<details>" } ],
  "insights": [ { "category": "<Security|Performance|Maintainability|Testing>", "finding": "<details>", "recommendation": "<details>" } ]
}`;

            const aiData = await callClaude(system, prompt);
            setResult(aiData);
        } catch (e) {
            const m = e.message || '';
            setError(m.includes('not configured') || m.includes('503') || m.includes('API key')
                ? 'AI analysis is not enabled. Ask your administrator to configure the AI key in the backend settings.'
                : 'Analysis failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return { loading, result, error, mode, analyze, analyzeRepo, autoFix, reset: () => { setResult(null); setError(null); } };
};


/* ═══════════════════════════════════════════════════════════════════════════
   STYLES & SHARED PRIMITIVES
   ═══════════════════════════════════════════════════════════════════════════ */
const RepoStyles = () => (
    <style>{`
        @keyframes rFadeUp    { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }
        @keyframes rPulse     { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
        @keyframes rSpin      { to { transform:rotate(360deg); } }
        @keyframes rBarGrow   { from { width:0; } to { width:var(--w,100%); } }
        @keyframes rScanLine  { from { top:-2px; } to { top:calc(100% + 2px); } }
        @keyframes rScaleIn   { from { opacity:0; transform:scale(0.93); } to { opacity:1; transform:scale(1); } }
        @keyframes rShimmer   { 0% { background-position:-200% 0; } 100% { background-position:200% 0; } }

        .r8-stagger > * { animation: rFadeUp 0.38s ease-out both; }
        .r8-stagger > *:nth-child(1) { animation-delay:0ms; }
        .r8-stagger > *:nth-child(2) { animation-delay:60ms; }
        .r8-stagger > *:nth-child(3) { animation-delay:120ms; }
        .r8-stagger > *:nth-child(4) { animation-delay:180ms; }

        .r8-card { background:${THEME.surface}; border:1px solid ${THEME.glassBorder}; border-radius: 20px; padding:0; overflow:hidden; box-shadow:0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04); transition:all 0.2s ease; backdrop-filter:blur(12px); }
        .r8-card:hover { border-color:${THEME.primary}30; transform:translateY(-4px); box-shadow:0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06); }
        .r8-card-remote:hover { border-color:${THEME.primary}30 !important; }
        .r8-card-local:hover  { border-color:${THEME.info}30 !important; }

        .r8-tree-item { transition:background .14s; cursor:pointer; user-select:none; }
        .r8-tree-item:hover   { background:${THEME.primary}08 !important; }
        .r8-tree-item.r8-sel  { background:${THEME.primary}12 !important; border-left:2px solid ${THEME.primary} !important; }

        .r8-line:hover { background:${THEME.primary}07 !important; }
        .r8-tab:hover:not(.r8-tab-on) { background:${THEME.primary}10 !important; color:${THEME.textMain} !important; }
        .r8-metric { transition:transform .2s, box-shadow .2s; }
        .r8-metric:hover { transform:translateY(-4px); box-shadow:0 8px 28px rgba(0,0,0,.14); }

        .r8-scroll::-webkit-scrollbar { width:4px; height:4px; }
        .r8-scroll::-webkit-scrollbar-track { background:transparent; }
        .r8-scroll::-webkit-scrollbar-thumb { background:${THEME.primary}28; border-radius: 20px; }
        .r8-scroll::-webkit-scrollbar-thumb:hover { background:${THEME.primary}55; }

        .r8-bar-fill { animation:rBarGrow .9s ease both; }
        .r8-terminal::before {
            content:''; position:absolute; left:0; right:0; height:1px;
            background:linear-gradient(90deg, transparent, ${THEME.info}30, transparent);
            animation:rScanLine 3.5s linear infinite; z-index:5; pointer-events:none;
        }
        .r8-input:focus { border-color:${THEME.primary} !important; box-shadow:0 0 0 3px ${THEME.primary}18 !important; }
        .r8-input-local:focus { border-color:${THEME.info} !important; box-shadow:0 0 0 3px ${THEME.info}18 !important; }
        .r8-shimmer { background:linear-gradient(90deg, ${THEME.surface} 25%, ${THEME.glassBorder} 50%, ${THEME.surface} 75%); background-size:200% 100%; animation:rShimmer 1.5s infinite; border-radius: 20px; }

        .r8-btn { display:inline-flex; align-items:center; gap:7px; padding:8px 16px; border-radius: 20px; border:none; font-size:12px; font-weight:700; cursor:pointer; font-family:inherit; transition:all .16s; white-space:nowrap; }
        .r8-btn-p  { background:linear-gradient(135deg, ${THEME.primary}, ${THEME.secondary}); color:${THEME.textMain}; box-shadow:0 4px 14px ${THEME.primary}28; }
        .r8-btn-p:hover:not(:disabled)  { filter:brightness(1.1); transform:translateY(-3px); }
        .r8-btn-p:disabled { opacity: 0.5; cursor: not-allowed; }
        .r8-btn-g  { background:transparent; color:${THEME.textDim}; border:1px solid ${THEME.glassBorder}; }
        .r8-btn-g:hover  { background:${THEME.surface}; color:${THEME.textMain}; }
        .r8-btn-c  { background:${THEME.info}15; color:${THEME.info}; border:1px solid ${THEME.info}30; }
        .r8-btn-c:hover  { background:${THEME.info}25; }
        .r8-btn-sm { padding:5px 11px; font-size:11px; border-radius: 22px; }
    `}</style>
);

const PROV = {
    github:    { label:'GitHub',    Icon:Github,    color:THEME.textMuted },
    gitlab:    { label:'GitLab',    Icon:Gitlab,    color:THEME.warning },
    local:     { label:'Local',     Icon:HardDrive, color:THEME.info },
    bitbucket: { label:'Bitbucket', Icon:GitBranch, color:THEME.primary },
};

const RocketIcon = ({ size=14, color='currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
        <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
        <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
    </svg>
);

const Panel = ({ title, icon:TIcon, rightNode, noPad, children, style={} }) => (
    <div style={{ background: THEME.surface, border:`1px solid ${THEME.glassBorder}`, borderRadius:16, display:'flex', flexDirection:'column', overflow:'hidden', height:'100%', boxShadow:'0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)', backdropFilter:'blur(12px)', ...style }}>
        {title && (
            <div style={{ padding:'14px 20px', borderBottom:`1px solid ${THEME.glassBorder}`, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, background:`${THEME.bg}06`, fontWeight:700 }}>
                <div style={{ display:'flex', alignItems:'center', gap: 20 }}>
                    {TIcon && <TIcon size={13} color={THEME.primary} />}
                    <span style={{ fontSize:10.5, fontWeight:800, color:THEME.textMain, letterSpacing:'0.02em' }}>{title}</span>
                </div>
                {rightNode}
            </div>
        )}
        <div className="r8-scroll" style={{ flex:1, minHeight:0, padding:noPad?0:'20px', overflowY:'auto' }}>{children}</div>
    </div>
);

const StatusBadge = ({ label, color, pulse, size='md' }) => (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:size==='sm'?9.5:10.5, fontWeight:700, padding:size==='sm'?'3px 7px':'4px 10px', borderRadius: 16, background:`${color}14`, color, border:`1px solid ${color}25`, lineHeight:1.2, whiteSpace:'nowrap' }}>
        <span style={{ width:5, height:5, borderRadius:'50%', background:color, flexShrink:0, animation:pulse?'rPulse 1.5s infinite':'none' }}/>{label}
    </span>
);

const RiskBadge = ({ risk }) => {
    const r = (risk || 'low').toLowerCase();
    const map = { critical:THEME.danger, high:THEME.danger, medium:THEME.warning, low:THEME.success };
    return <StatusBadge label={r.toUpperCase()} color={map[r]||THEME.textMuted} size="sm"/>;
};

const Divider = () => <div style={{ height:1, background:`${THEME.glassBorder}`, margin:'14px 0' }}/>;

const SectionTitle = ({ children, icon:Icon }) => (
    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:12 }}>
        {Icon && <Icon size={12} color={THEME.primary}/>}
        <span style={{ fontSize:10.5, fontWeight:800, color:THEME.textDim, letterSpacing:'0.02em' }}>{children}</span>
    </div>
);

const MetricCard = ({ label, value, icon:Icon, color }) => (
    <div className="r8-metric" style={{ padding:20, borderRadius:16, background:`${color}08`, border:`1px solid ${color}20` }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
            <span style={{ fontSize:10, color:THEME.textDim, fontWeight:700, letterSpacing:'0.02em' }}>{label}</span>
            {Icon && <Icon size={13} color={color}/>}
        </div>
        <div style={{ fontSize:22, fontWeight:900, color: metricValue(color), lineHeight:1, letterSpacing:'-0.02em' }}>{value}</div>
    </div>
);

const ProgressBar = ({ value, color=THEME.primary, height=6 }) => (
    <div style={{ height, borderRadius:height/2, background:`${THEME.glassBorder}`, overflow:'hidden' }}>
        <div className="r8-bar-fill" style={{ height:'100%', borderRadius:height/2, width:`${value}%`, background:`linear-gradient(90deg, ${color}, ${color}cc)`, '--w':`${value}%` }}/>
    </div>
);

/* ═══════════════════════════════════════════════════════════════════════════
   STRICT FILE SYSTEM HANDLERS (No Mocks)
   ═══════════════════════════════════════════════════════════════════════════ */
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.cache']);
const getFileIcon = ext => ({ js: FileCode, ts: FileCode, json: FileJson, md: FileText }[ext] || FileCode);
const getExt = name => name.includes('.') ? name.split('.').pop().toLowerCase() : '';

async function readRealDirectory(handle, depth = 0, maxDepth = 6) {
    const entries = [];
    if (depth > maxDepth) return entries;
    for await (const [name, h] of handle.entries()) {
        if (h.kind === 'directory') {
            if (IGNORE_DIRS.has(name)) continue;
            const children = await readRealDirectory(h, depth + 1, maxDepth);
            entries.push({ id: `${depth}-${name}`, name, kind: 'dir', handle: h, children, depth });
        } else {
            entries.push({ id: `${depth}-${name}`, name, kind: 'file', handle: h, ext: getExt(name), depth });
        }
    }
    entries.sort((a, b) => (a.kind !== b.kind) ? (a.kind === 'dir' ? -1 : 1) : a.name.localeCompare(b.name));
    return entries;
}

const FsTreeNode = ({ node, depth, selectedId, onSelect, onToggle, openDirs }) => {
    const isOpen = openDirs.has(node.id);
    const isSelected = selectedId === node.id;
    const Icon = node.kind === 'dir' ? FolderOpen : getFileIcon(node.ext);

    if (node.kind === 'dir') {
        return (
            <div>
                <div className="r8-tree-item" onClick={() => onToggle(node.id)} style={{ display:'flex', alignItems:'center', gap:6, padding:`6px 12px 6px ${12 + depth * 14}px`, cursor: 'pointer' }}>
                    {isOpen ? <ChevronDown size={12} color={THEME.textDim}/> : <ChevronRight size={12} color={THEME.textDim}/>}
                    <FolderOpen size={13} color={isOpen ? THEME.warning : THEME.textDim}/>
                    <span style={{ fontSize:12, color:THEME.textMuted, fontWeight:600 }}>{node.name}</span>
                </div>
                {isOpen && node.children?.map(c => <FsTreeNode key={c.id} node={c} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} onToggle={onToggle} openDirs={openDirs}/>)}
            </div>
        );
    }
    return (
        <div className={`r8-tree-item${isSelected ? ' r8-sel' : ''}`} onClick={() => onSelect(node)} style={{ display:'flex', alignItems:'center', gap: 20, padding:`5px 12px 5px ${12 + depth * 14}px`, borderLeft: isSelected ? `2px solid ${THEME.primary}` : '2px solid transparent', cursor: 'pointer' }}>
            <Icon size={12} color={isSelected ? THEME.primary : THEME.textDim}/>
            <span style={{ fontSize:11.5, color:isSelected ? THEME.primary : THEME.textMuted }}>{node.name}</span>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   CODE VIEW (Strict Auth + Real AI Overlay)
   ═══════════════════════════════════════════════════════════════════════════ */
const CodeView = ({ activeRepo }) => {
    const aiEngine = useAIAnalysis();

    const [fsTree, setFsTree] = useState(null);
    const [dirHandle, setDirHandle] = useState(null);
    const [openDirs, setOpenDirs] = useState(new Set());
    const [selNode, setSelNode] = useState(null);

    const [fileContent, setFileContent] = useState('');
    const [fileLoading, setFileLoading] = useState(false);
    const [fsLoading, setFsLoading] = useState(false);

    const authorizeLocalFolder = useCallback(async () => {
        try {
            setFsLoading(true);
            const handle = await window.showDirectoryPicker({ mode: 'read' });
            const tree = await readRealDirectory(handle, 0);

            setDirHandle(handle);
            setFsTree(tree);
            setOpenDirs(new Set(tree.filter(n => n.kind === 'dir').map(n => n.id).slice(0, 3)));
            setSelNode(null);
            setFileContent('');
            aiEngine.reset();
        } catch (e) {
            if (e.name !== 'AbortError') console.error("FS Error:", e);
        } finally {
            setFsLoading(false);
        }
    }, [aiEngine]);

    const onToggle = useCallback(id => {
        setOpenDirs(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
    }, []);

    const onSelectFile = useCallback(async node => {
        if (node.kind !== 'file') return;
        setSelNode(node);
        aiEngine.reset();
        setFileLoading(true);

        try {
            const file = await node.handle.getFile();
            const text = await file.text();
            setFileContent(text);

            aiEngine.analyze({
                filename: node.name,
                code: text,
                repoName: dirHandle?.name || activeRepo?.name
            });
        } catch (e) {
            setFileContent(`// Error reading file from local disk: ${e.message}`);
        }
        setFileLoading(false);
    }, [aiEngine, dirHandle, activeRepo]);

    const aiResult = aiEngine.result;

    // Track which issues have been applied (by index)
    const [appliedFixes, setAppliedFixes]   = useState(new Set());
    const [expandedIssue, setExpandedIssue] = useState(null); // issue index shown inline
    const [copiedFix, setCopiedFix]         = useState(null);
    const editorScrollRef                   = React.useRef(null);

    // Reset per-file state when file changes
    React.useEffect(() => {
        setAppliedFixes(new Set());
        setExpandedIssue(null);
    }, [selNode]);

    // Scroll editor to a line number and expand its inline fix panel
    const goToLine = useCallback((issueIdx, lineNo) => {
        setExpandedIssue(issueIdx);
        // Wait one tick for React to render the expanded panel, then scroll
        setTimeout(() => {
            const container = editorScrollRef.current;
            if (!container) return;
            const target = container.querySelector(`[data-line="${lineNo}"]`);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 30);
    }, []);

    // Split lines for the line renderer (derived from fileContent)
    const lines = fileContent.split('\n');

    const copyToClipboard = (text, key) => {
        navigator.clipboard?.writeText(text).catch(() => {});
        setCopiedFix(key);
        setTimeout(() => setCopiedFix(null), 2000);
    };

    // Apply a single issue's fix: replace lines around the issue line with the fix
    const applyLineFix = useCallback((issueIdx) => {
        const issue = aiResult?.issues?.[issueIdx];
        if (!issue?.fix) return;
        const lineNo = issue.line; // 1-based

        setFileContent(prev => {
            const prevLines = prev.split('\n');
            if (lineNo && lineNo >= 1 && lineNo <= prevLines.length) {
                // Replace the affected line with the fix lines
                prevLines.splice(lineNo - 1, 1, ...issue.fix.split('\n'));
            } else {
                // No specific line — append a comment with the fix at end
                prevLines.push('', `// Applied fix: ${issue.title}`, ...issue.fix.split('\n'));
            }
            return prevLines.join('\n');
        });

        setAppliedFixes(prev => new Set([...prev, issueIdx]));
        setExpandedIssue(null);
    }, [aiResult]);

    const sevColor = s => {
        const key = (s||'').toLowerCase();
        return { critical:THEME.danger, high:THEME.danger, medium:THEME.warning, low:THEME.info }[key] || THEME.textDim;
    };

    return (
        <div style={{ display:'grid', gridTemplateColumns:'260px 1fr', gap: 22, height:'100%', minHeight:0 }}>

            {/* SIDEBAR: REAL FILE SYSTEM */}
            <div style={{ background:THEME.surface, border:`1px solid ${THEME.glassBorder}`, borderRadius:16, display:'flex', flexDirection:'column', overflow:'hidden' }}>
                <div style={{ padding:'14px 20px', borderBottom:`1px solid ${THEME.glassBorder}`, background:`${THEME.primary}06`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:11, fontWeight:800, color:THEME.textMain, letterSpacing:'0.02em' }}>Local Files</span>
                    {fsTree && <button onClick={authorizeLocalFolder} style={{ background:'none', border:'none', color:THEME.primary, fontSize:10, cursor:'pointer', fontWeight:700 }}>CHANGE</button>}
                </div>

                <div className="r8-scroll" style={{ flex:1, overflowY:'auto', padding:'8px 0' }}>
                    {fsLoading && <div style={{ padding:20, textAlign:'center' }}><Loader size={18} color={THEME.primary} style={{ animation:'rSpin 1s linear infinite', margin:'0 auto' }}/></div>}

                    {!fsTree && !fsLoading && (
                        <div style={{ padding:24, textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap: 18 }}>
                            <FolderOpen size={32} color={THEME.info}/>
                            <div>
                                <div style={{ fontSize:13, fontWeight:700, color:THEME.textMain, marginBottom:6 }}>Authorization Required</div>
                                <div style={{ fontSize:11, color:THEME.textDim, lineHeight:1.5, marginBottom:16 }}>
                                    Browser security requires you to explicitly select the <b>{activeRepo?.name}</b> folder to read files.
                                </div>
                                <button onClick={authorizeLocalFolder} className="r8-btn r8-btn-c" style={{ width:'100%', justifyContent:'center' }}>
                                    Grant Access
                                </button>
                            </div>
                        </div>
                    )}

                    {fsTree && fsTree.map(n => <FsTreeNode key={n.id} node={n} depth={0} selectedId={selNode?.id} onSelect={onSelectFile} onToggle={onToggle} openDirs={openDirs}/>)}
                </div>
            </div>

            {/* MAIN EDITOR & AI SPLIT */}
            <div style={{ display:'grid', gridTemplateColumns: (aiEngine.loading || aiResult || aiEngine.error) ? '1fr 420px' : '1fr', gap: 22, minHeight:0 }}>

                {/* CODE EDITOR */}
                <div style={{ background:THEME.surface, border:`1px solid ${THEME.glassBorder}`, borderRadius:16, display:'flex', flexDirection:'column', overflow:'hidden' }}>

                    {/* Editor header */}
                    <div style={{ padding:'10px 16px', borderBottom:`1px solid ${THEME.glassBorder}`, display:'flex', alignItems:'center', gap: 20, flexShrink:0 }}>
                        <Code size={14} color={THEME.primary}/>
                        <span style={{ fontSize:12, fontWeight:700, color:THEME.textMain, fontFamily:'monospace', flex:1 }}>{selNode ? selNode.name : 'No file selected'}</span>
                        {aiResult?.issues?.length > 0 && (
                            <span style={{ fontSize:10, color:THEME.textDim }}>
                                {appliedFixes.size}/{aiResult.issues.length} fixes applied
                            </span>
                        )}
                        {selNode && fileContent && (
                            <button
                                onClick={() => copyToClipboard(fileContent, 'editor')}
                                style={{ background:'none', border:`1px solid ${THEME.glassBorder}`, borderRadius: 16, color:THEME.textDim, fontSize:10, padding:'2px 8px', cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}
                            >
                                {copiedFix==='editor' ? <><Check size={10} color={THEME.success}/> Copied!</> : <><Copy size={10}/> Copy</>}
                            </button>
                        )}
                    </div>

                    {!selNode && !fileLoading && (
                        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap: 22, color:THEME.textDim }}>
                            <Sparkles size={24} color={`${THEME.primary}50`}/>
                            <div style={{ fontSize:13 }}>Select a file to begin Deep AI Analysis</div>
                        </div>
                    )}

                    {fileLoading && <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}><Loader size={24} color={THEME.primary} style={{ animation:'rSpin 1s linear infinite' }}/></div>}

                    {selNode && !fileLoading && fileContent && (
                        <div ref={editorScrollRef} className="r8-scroll" style={{ flex:1, overflowY:'auto', overflowX:'auto', padding:'10px 0', fontFamily: 'monospace', fontSize:12, lineHeight:1.65 }}>
                            {lines.map((line, i) => {
                                const lineNo = i + 1;
                                // find all issues for this line (may be multiple)
                                const issuesOnLine = aiResult?.issues
                                    ?.map((iss, idx) => ({ ...iss, idx }))
                                    .filter(iss => iss.line === lineNo) || [];
                                const hasIssue = issuesOnLine.length > 0;
                                const allApplied = hasIssue && issuesOnLine.every(iss => appliedFixes.has(iss.idx));
                                const isExpanded = hasIssue && issuesOnLine.some(iss => expandedIssue === iss.idx);

                                const topIssue = issuesOnLine[0];
                                const issueColor = allApplied ? THEME.success
                                    : topIssue?.severity === 'critical' || topIssue?.severity === 'high' ? THEME.danger
                                    : topIssue?.severity === 'medium' ? THEME.warning : THEME.info;

                                return (
                                    <React.Fragment key={i}>
                                        {/* Code line */}
                                        <div
                                            data-line={lineNo}
                                            onClick={() => hasIssue && !allApplied && setExpandedIssue(
                                                isExpanded ? null : issuesOnLine[0].idx
                                            )}
                                            style={{
                                                display:'flex',
                                                padding:'0 16px',
                                                background: allApplied ? `${THEME.success}08`
                                                    : hasIssue ? `${issueColor}10` : 'transparent',
                                                borderLeft: allApplied ? `3px solid ${THEME.success}50`
                                                    : hasIssue ? `3px solid ${issueColor}` : '3px solid transparent',
                                                cursor: hasIssue && !allApplied ? 'pointer' : 'default',
                                                minWidth: 0,
                                            }}
                                        >
                                            {/* Line number */}
                                            <span style={{ width:38, flexShrink:0, color:`${THEME.textDim}50`, userSelect:'none', textAlign:'right', paddingRight:12, fontSize:11 }}>{lineNo}</span>

                                            {/* Code text */}
                                            <span style={{ flex:1, color: allApplied ? THEME.success : hasIssue ? issueColor : THEME.textMuted, whiteSpace:'pre' }}>{line}</span>

                                            {/* Issue badge */}
                                            {hasIssue && !allApplied && (
                                                <span style={{ marginLeft:10, flexShrink:0, fontSize:9, fontWeight:700, color:issueColor, padding:'1px 7px', background:`${issueColor}18`, borderRadius: 16, alignSelf:'center', display:'flex', alignItems:'center', gap:4 }}>
                                                    <AlertTriangle size={9}/> {issuesOnLine.length > 1 ? `${issuesOnLine.length} issues` : topIssue.title}
                                                    <span style={{ opacity:0.6, fontSize:8 }}>{isExpanded ? '▲' : '▼'}</span>
                                                </span>
                                            )}
                                            {allApplied && (
                                                <span style={{ marginLeft:10, flexShrink:0, fontSize:9, fontWeight:700, color:THEME.success, padding:'1px 7px', background:`${THEME.success}15`, borderRadius: 16, alignSelf:'center', display:'flex', alignItems:'center', gap:3 }}>
                                                    <CheckCircle size={9}/> Fixed
                                                </span>
                                            )}
                                        </div>

                                        {/* Inline fix panel — expands below the issue line */}
                                        {isExpanded && issuesOnLine.map(iss => !appliedFixes.has(iss.idx) && (
                                            <div key={iss.idx} style={{ margin:'0 0 2px 41px', background:`${THEME.bg}`, border:`1px solid ${issueColor}30`, borderLeft:`3px solid ${issueColor}`, borderRadius:'0 6px 6px 0', overflow:'hidden' }}>
                                                {/* Issue header */}
                                                <div style={{ padding:'7px 12px', background:`${issueColor}10`, display:'flex', alignItems:'center', gap: 20 }}>
                                                    <RiskBadge risk={iss.severity}/>
                                                    <span style={{ fontSize:11, fontWeight:700, color:issueColor, flex:1 }}>{iss.title}</span>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setExpandedIssue(null); }}
                                                        style={{ background:'none', border:'none', color:THEME.textDim, cursor:'pointer', padding:2 }}
                                                    ><X size={11}/></button>
                                                </div>
                                                {/* Description */}
                                                <div style={{ padding:'6px 12px', fontSize:11, color:THEME.textDim, lineHeight:1.5, borderBottom: iss.fix ? `1px solid ${THEME.glassBorder}` : 'none' }}>
                                                    {iss.description}
                                                </div>
                                                {/* Fix */}
                                                {iss.fix && (
                                                    <div style={{ padding:'8px 12px' }}>
                                                        <div style={{ fontSize:10, color:THEME.textDim, fontWeight:700, letterSpacing:'0.02em', marginBottom:5 }}>Suggested Fix</div>
                                                        <div style={{ position:'relative', background:`${THEME.surface}`, border:`1px solid ${THEME.success}30`, borderRadius: 16, padding:'7px 70px 7px 10px', fontFamily:'monospace', fontSize:11, color:THEME.success, whiteSpace:'pre-wrap', lineHeight:1.5 }}>
                                                            {iss.fix}
                                                            {/* Action buttons */}
                                                            <div style={{ position:'absolute', top:5, right:5, display:'flex', gap:4 }}>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); copyToClipboard(iss.fix, `fix-${iss.idx}`); }}
                                                                    title="Copy fix"
                                                                    style={{ background:`${THEME.surface}`, border:`1px solid ${THEME.glassBorder}`, borderRadius: 16, cursor:'pointer', color:copiedFix===`fix-${iss.idx}` ? THEME.success : THEME.textDim, padding:'2px 6px', fontSize:9, display:'flex', alignItems:'center', gap:3 }}
                                                                >
                                                                    {copiedFix===`fix-${iss.idx}` ? <Check size={9}/> : <Copy size={9}/>}
                                                                </button>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); applyLineFix(iss.idx); }}
                                                                    title="Apply this fix"
                                                                    style={{ background:`linear-gradient(135deg,${THEME.success},${THEME.info})`, border:'none', borderRadius: 16, cursor:'pointer', color:THEME.textMain, padding:'2px 8px', fontSize:9, fontWeight:700, display:'flex', alignItems:'center', gap:3, boxShadow:`0 2px 6px ${THEME.success}40` }}
                                                                >
                                                                    <Check size={9}/> Apply Fix
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                                {!iss.fix && (
                                                    <div style={{ padding:'6px 12px 8px', fontSize:10, color:THEME.textDim, fontStyle:'italic' }}>No specific code fix available for this issue.</div>
                                                )}
                                            </div>
                                        ))}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* DETAILED AI ANALYSIS PANEL */}
                {(aiEngine.loading || aiResult || aiEngine.error) && (
                    <div style={{ background:THEME.surface, border:`1px solid ${THEME.glassBorder}`, borderRadius:16, display:'flex', flexDirection:'column', overflow:'hidden' }}>
                        <div style={{ padding:'14px 20px', borderBottom:`1px solid ${THEME.glassBorder}`, background:`${THEME.primary}06`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                            <div style={{ display:'flex', alignItems:'center', gap: 20 }}>
                                <Sparkles size={14} color={THEME.primary}/>
                                <span style={{ fontSize:11, fontWeight:800, color:THEME.textMain, letterSpacing:'0.02em' }}>Deep Analysis</span>
                            </div>
                            <button onClick={aiEngine.reset} style={{ background:'none', border:'none', color:THEME.textDim, cursor:'pointer' }}><X size={14}/></button>
                        </div>

                        <div className="r8-scroll" style={{ flex:1, overflowY:'auto', padding:20 }}>
                            {aiEngine.loading && (
                                <div style={{ display:'flex', flexDirection:'column', gap: 22, alignItems:'center', justifyContent:'center', height:'100%' }}>
                                    <Loader size={32} color={THEME.primary} style={{ animation:'rSpin 1s linear infinite' }}/>
                                    <div style={{ fontSize:12, color:THEME.textDim }}>Running advanced static analysis...</div>
                                </div>
                            )}

                            {aiEngine.error && (
                                <div style={{ padding:16, color:THEME.danger, fontSize:12, background:`${THEME.danger}10`, borderRadius: 20, lineHeight:1.6 }}>
                                    <div style={{ fontWeight:700, marginBottom:6, display:'flex', alignItems:'center', gap:6 }}>
                                        <AlertTriangle size={13}/> Analysis Error
                                    </div>
                                    {aiEngine.error}
                                    {aiEngine.error.includes('not enabled') && (
                                        <div style={{ marginTop:10, padding:10, background:`${THEME.surface}`, borderRadius: 18, fontSize:11, color:THEME.textDim, lineHeight:1.7 }}>
                                            <b style={{ color:THEME.warning }}>Fix:</b> Add your AI API key to the backend <code>.env</code> file and redeploy.
                                        </div>
                                    )}
                                </div>
                            )}

                            {aiResult && !aiEngine.loading && (
                                <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
                                    {/* Health Overview */}
                                    <div style={{ padding:16, borderRadius: 18, background:`${THEME.surface}`, border:`1px solid ${THEME.glassBorder}`, display:'flex', gap: 22 }}>
                                        <div style={{ fontSize:48, fontWeight:900, color: aiResult.healthScore > 75 ? THEME.success : THEME.warning, lineHeight:1 }}>
                                            {aiResult.healthScore}
                                        </div>
                                        <div>
                                            <div style={{ fontSize:14, fontWeight:800, color:THEME.textMain, marginBottom:4 }}>Health Score</div>
                                            <div style={{ fontSize:12, color:THEME.textDim, lineHeight:1.5 }}>{aiResult.summary}</div>
                                        </div>
                                    </div>

                                    {/* Metrics Grid */}
                                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 22 }}>
                                        <div style={{ padding:12, borderRadius: 20, background:`${THEME.primary}08`, border:`1px solid ${THEME.primary}20` }}>
                                            <div style={{ fontSize:10, color:THEME.textDim, fontWeight:700, marginBottom:4 }}>Complexity</div>
                                            <div style={{ fontSize:13, fontWeight:700, color:THEME.textMain }}>{aiResult.complexityMetrics?.cyclomaticComplexity || 'Normal'}</div>
                                        </div>
                                        <div style={{ padding:12, borderRadius: 20, background:`${THEME.info}08`, border:`1px solid ${THEME.info}20` }}>
                                            <div style={{ fontSize:10, color:THEME.textDim, fontWeight:700, marginBottom:4 }}>Testability</div>
                                            <div style={{ fontSize:13, fontWeight:700, color:THEME.textMain }}>{aiResult.complexityMetrics?.testability || 'Fair'}</div>
                                        </div>
                                    </div>

                                    {/* Strengths */}
                                    {aiResult.strengths?.length > 0 && (
                                        <div>
                                            <div style={{ fontSize:11, fontWeight:800, color:THEME.textDim, marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
                                                <CheckCircle size={12} color={THEME.success}/> Strengths
                                            </div>
                                            {aiResult.strengths.map((s, i) => (
                                                <div key={i} style={{ display:'flex', gap: 20, marginBottom:8, padding:'9px 12px', borderRadius: 20, background:`${THEME.success}06`, border:`1px solid ${THEME.success}15` }}>
                                                    <CheckCircle size={12} color={THEME.success} style={{ flexShrink:0, marginTop:2 }}/>
                                                    <span style={{ fontSize:11.5, color:THEME.textMuted, lineHeight:1.5 }}>{s}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Line-Specific Issues */}
                                    {aiResult.issues?.length > 0 && (
                                        <div>
                                            <div style={{ fontSize:11, fontWeight:800, color:THEME.textDim, marginBottom:10, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                                                <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                                                    <AlertTriangle size={12}/> Issues ({appliedFixes.size}/{aiResult.issues.length} fixed)
                                                </span>
                                            </div>
                                            {aiResult.issues.map((iss, i) => {
                                                const issColor = sevColor(iss.severity);
                                                const isApplied = appliedFixes.has(i);
                                                return (
                                                    <div key={i} style={{ marginBottom:10, padding:12, borderRadius: 20, background: isApplied ? `${THEME.success}06` : `${issColor}08`, border:`1px solid ${isApplied ? THEME.success : issColor}25`, opacity: isApplied ? 0.7 : 1, transition:'all .2s' }}>
                                                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6, gap:6 }}>
                                                            <span style={{ fontSize:12, fontWeight:700, color: isApplied ? THEME.success : issColor, flex:1 }}>
                                                                {iss.line ? <span style={{ fontFamily:'monospace', marginRight:4, opacity:0.7 }}>L{iss.line}</span> : null}{iss.title}
                                                            </span>
                                                            {isApplied
                                                                ? <span style={{ fontSize:9, fontWeight:700, color:THEME.success, padding:'2px 7px', background:`${THEME.success}18`, borderRadius: 16, flexShrink:0, display:'flex', alignItems:'center', gap:3 }}><CheckCircle size={9}/> Fixed</span>
                                                                : <RiskBadge risk={iss.severity}/>
                                                            }
                                                        </div>
                                                        <div style={{ fontSize:11, color:THEME.textDim, lineHeight:1.5, marginBottom:8 }}>{iss.description}</div>
                                                        {!isApplied && (
                                                            <div style={{ display:'flex', gap:6 }}>
                                                                {iss.line && (
                                                                    <button
                                                                        onClick={() => goToLine(i, iss.line)}
                                                                        style={{ fontSize:10, padding:'3px 9px', borderRadius: 16, border:`1px solid ${issColor}40`, background:`${issColor}10`, color:issColor, cursor:'pointer', fontWeight:600, display:'flex', alignItems:'center', gap:4 }}
                                                                    >
                                                                        <ArrowRight size={10}/> Go to Line {iss.line}
                                                                    </button>
                                                                )}
                                                                {iss.fix && (
                                                                    <button
                                                                        onClick={() => applyLineFix(i)}
                                                                        style={{ fontSize:10, padding:'3px 9px', borderRadius: 16, border:'none', background:`linear-gradient(135deg,${THEME.success},${THEME.info})`, color:THEME.textMain, cursor:'pointer', fontWeight:700, display:'flex', alignItems:'center', gap:4, boxShadow:`0 2px 6px ${THEME.success}30` }}
                                                                    >
                                                                        <Wrench size={10}/> Apply Fix
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Security Flags */}
                                    {aiResult.securityFlags?.length > 0 && (
                                        <div>
                                            <div style={{ fontSize:11, fontWeight:800, color:THEME.textDim, marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
                                                <Shield size={12}/> Security Vectors
                                            </div>
                                            {aiResult.securityFlags.map((sec, i) => (
                                                <div key={i} style={{ marginBottom:8, padding:12, borderRadius: 20, background:THEME.surface, border:`1px solid ${THEME.glassBorder}` }}>
                                                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                                                        <span style={{ fontSize:12, fontWeight:700, color:THEME.warning }}>{sec.title}</span>
                                                        <RiskBadge risk={sec.severity}/>
                                                    </div>
                                                    <div style={{ fontSize:11, color:THEME.textDim, lineHeight:1.5 }}>{sec.description}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Performance Insights */}
                                    {aiResult.performanceInsights?.length > 0 && (
                                        <div>
                                            <div style={{ fontSize:11, fontWeight:800, color:THEME.textDim, marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
                                                <Zap size={12} color={THEME.warning}/> Performance
                                            </div>
                                            {aiResult.performanceInsights.map((p, i) => (
                                                <div key={i} style={{ marginBottom:8, padding:12, borderRadius: 20, background:`${THEME.warning}06`, border:`1px solid ${THEME.warning}20` }}>
                                                    <div style={{ fontSize:12, fontWeight:700, color:THEME.warning, marginBottom:4 }}>{p.title}</div>
                                                    <div style={{ fontSize:11, color:THEME.textDim, lineHeight:1.5 }}>{p.suggestion}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* AI Recommendations */}
                                    {aiResult.aiRecommendations?.length > 0 && (
                                        <div>
                                            <div style={{ fontSize:11, fontWeight:800, color:THEME.textDim, marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
                                                <Lightbulb size={12} color={THEME.primary}/> Recommendations
                                            </div>
                                            {aiResult.aiRecommendations.sort((a,b) => a.priority - b.priority).map((rec, i) => (
                                                <div key={i} style={{ display:'flex', gap: 22, marginBottom:10, padding:'10px 12px', borderRadius: 20, background:`${THEME.primary}06`, border:`1px solid ${THEME.primary}15` }}>
                                                    <div style={{ width:20, height:20, borderRadius:'50%', background:`${THEME.primary}18`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                                                        <span style={{ fontSize:10, fontWeight:900, color:THEME.primary }}>{rec.priority}</span>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize:12, fontWeight:700, color:THEME.textMain, marginBottom:3 }}>{rec.title}</div>
                                                        <div style={{ fontSize:11, color:THEME.textDim, lineHeight:1.5 }}>{rec.rationale}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   INSIGHTS VIEW (Repo Level Analysis)
   ═══════════════════════════════════════════════════════════════════════════ */
const InsightsView = ({ activeRepo }) => {
    const ai = useAIAnalysis();

    const runAnalysis = () => {
        if (!activeRepo) return;
        ai.analyzeRepo({ repoName: activeRepo.name, repoPath: activeRepo.url, repoType: activeRepo.type });
    };

    const r = ai.result;

    return (
        <div style={{ display:'flex', flexDirection:'column', gap: 22, height:'100%' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ fontSize:16, fontWeight:800, color:THEME.textMain }}>Repository Intelligence</div>
                <button onClick={runAnalysis} disabled={!activeRepo||ai.loading} className="r8-btn r8-btn-p">
                    {ai.loading ? <><Loader size={13} style={{ animation:'rSpin 1s linear infinite' }}/> Analyzing Hub…</> : <><Sparkles size={13}/> Run Full Audit</>}
                </button>
            </div>

            <div className="r8-scroll" style={{ flex:1, overflowY:'auto' }}>
                {ai.loading && (
                    <Panel title="Scanning Architecture..." icon={Sparkles}>
                        <div style={{ padding: 40, display:'flex', flexDirection:'column', alignItems:'center', gap:20 }}>
                            <Loader size={32} color={THEME.primary} style={{ animation:'rSpin 1s linear infinite' }}/>
                            <div style={{ color:THEME.textDim, fontSize:13 }}>Compiling cross-file context and mapping architecture constraints...</div>
                        </div>
                    </Panel>
                )}

                {ai.error && (
                    <div style={{ padding:16, background:`${THEME.danger}10`, color:THEME.danger, borderRadius: 18, lineHeight:1.6, fontSize:12 }}>
                        <div style={{ fontWeight:700, marginBottom:6, display:'flex', alignItems:'center', gap:6 }}>
                            <AlertTriangle size={13}/> Analysis Error
                        </div>
                        {ai.error}
                        {ai.error.includes('not enabled') && (
                            <div style={{ marginTop:10, padding:10, background:`rgba(0,0,0,.2)`, borderRadius: 18, fontSize:11, color:THEME.textDim, lineHeight:1.7 }}>
                                <b style={{ color:THEME.warning }}>Fix:</b> Add your AI API key to the backend <code>.env</code> file and redeploy.
                            </div>
                        )}
                    </div>
                )}

                {!ai.loading && !ai.result && !ai.error && (
                    <div style={{ padding:'60px 20px', textAlign:'center', border:`2px dashed ${THEME.glassBorder}`, borderRadius:16, display:'flex', flexDirection:'column', alignItems:'center', gap: 22 }}>
                        <div style={{ width:60, height:60, borderRadius: 20, background:`${THEME.primary}10`, display:'flex', alignItems:'center', justifyContent:'center' }}><Activity size={26} color={THEME.primary}/></div>
                        <div style={{ fontSize:16, fontWeight:800, color:THEME.textMuted }}>No Analysis Run Yet</div>
                        <div style={{ fontSize:12.5, color:THEME.textDim, maxWidth:360, lineHeight:1.7 }}>Click <b>Run Full Audit</b> to evaluate this repository's tech debt, overall health, and hidden vulnerabilities.</div>
                    </div>
                )}

                {r && !ai.loading && (() => {
                    const hc = r.overallHealthScore >= 80 ? THEME.success : r.overallHealthScore >= 60 ? THEME.warning : THEME.danger;
                    return (
                        <div style={{ display:'flex', flexDirection:'column', gap: 22 }}>
                            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap: 22 }} className="r8-stagger">
                                <MetricCard label="Overall Health" value={`${r.overallHealthScore}/100`} icon={Activity}    color={hc}/>
                                <MetricCard label="Code Quality"   value={`${r.metricsEstimate?.codeQuality||0}/100`} icon={Code}  color={THEME.primary}/>
                                <MetricCard label="Security"       value={`${r.metricsEstimate?.securityScore||0}/100`} icon={Shield} color={THEME.info}/>
                                <MetricCard label="Tech Debt"      value={r.techDebtEstimate?.toUpperCase()} icon={Wrench}  color={r.techDebtEstimate==='high'?THEME.danger:THEME.warning}/>
                            </div>

                            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 22 }}>
                                <Panel title="Architecture Review" icon={Workflow}>
                                    <p style={{ fontSize:12.5, color:THEME.textDim, lineHeight:1.7, marginBottom:16 }}>{r.repoSummary}</p>
                                    <div style={{ display:'flex', gap: 20, flexWrap:'wrap', marginBottom:16 }}>
                                        {r.primaryLanguages?.map((l,i) => <span key={i} style={{ padding:'3px 10px', borderRadius: 18, fontSize:10.5, fontWeight:700, background:`${THEME.primary}12`, color:THEME.primary, border:`1px solid ${THEME.primary}20` }}>{l}</span>)}
                                        <span style={{ padding:'3px 10px', borderRadius: 18, fontSize:10.5, fontWeight:700, background:`${THEME.info}12`, color:THEME.info, border:`1px solid ${THEME.info}20` }}>{r.architecturePattern}</span>
                                    </div>
                                </Panel>

                                <Panel title="Top Risks & Quick Wins" icon={Flame}>
                                    {r.quickWins?.map((w,i)=>(
                                        <div key={i} style={{ display:'flex', gap: 20, marginBottom:10, padding:'9px 12px', borderRadius: 20, background:`${THEME.success}06`, border:`1px solid ${THEME.success}15` }}>
                                            <CheckCircle size={12} color={THEME.success} style={{ flexShrink:0, marginTop:2 }}/>
                                            <span style={{ fontSize:11.5, color:THEME.textMuted, lineHeight:1.5 }}>{w}</span>
                                        </div>
                                    ))}
                                    {r.topRisks?.map((risk,i)=>(
                                        <div key={i} style={{ display:'flex', gap: 20, marginTop:10, padding:'9px 12px', borderRadius: 20, background:`${THEME.danger}06`, border:`1px solid ${THEME.danger}15` }}>
                                            <AlertTriangle size={12} color={THEME.danger} style={{ flexShrink:0, marginTop:2 }}/>
                                            <span style={{ fontSize:11.5, color:THEME.textMuted, lineHeight:1.5 }}><b>{risk.risk}:</b> {risk.description}</span>
                                        </div>
                                    ))}
                                </Panel>
                            </div>

                            {/* Insights */}
                            {r.insights?.length > 0 && (
                                <Panel title="Deep Insights" icon={Lightbulb}>
                                    <div style={{ display:'flex', flexDirection:'column', gap: 22 }}>
                                        {r.insights.map((ins, i) => (
                                            <div key={i} style={{ padding:'12px 14px', borderRadius: 16, background:THEME.surface, border:`1px solid ${THEME.glassBorder}` }}>
                                                <div style={{ display:'flex', alignItems:'center', gap: 20, marginBottom:6 }}>
                                                    <span style={{ fontSize:10, fontWeight:800, padding:'2px 8px', borderRadius: 16, background:`${THEME.primary}15`, color:THEME.primary }}>{ins.category}</span>
                                                </div>
                                                <div style={{ fontSize:12, color:THEME.textMuted, lineHeight:1.5, marginBottom:6 }}>{ins.finding}</div>
                                                <div style={{ fontSize:11.5, color:THEME.success, lineHeight:1.5 }}>→ {ins.recommendation}</div>
                                            </div>
                                        ))}
                                    </div>
                                </Panel>
                            )}
                        </div>
                    );
                })()}
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   DATABASE, CICD & PR PLACEHOLDERS
   ═══════════════════════════════════════════════════════════════════════════ */
const DatabaseView = () => <Panel title="Database Analysis" icon={Database}><div style={{padding:20, color:THEME.textDim, fontSize:12}}>Connect a live DB or schema file to enable migration risk analysis.</div></Panel>;
const CICDView = () => <Panel title="CI/CD Pipeline" icon={RocketIcon}><div style={{padding:20, color:THEME.textDim, fontSize:12}}>Connect Jenkins, Actions, or GitLab CI for deployment metrics.</div></Panel>;
const PullRequestView = () => <Panel title="Pull Requests" icon={GitPullRequest}><div style={{padding:20, color:THEME.textDim, fontSize:12}}>Provide a GitHub/GitLab token to analyze open PR code diffs.</div></Panel>;

/* ═══════════════════════════════════════════════════════════════════════════
   MODALS & FORMS
   ═══════════════════════════════════════════════════════════════════════════ */
const LocalRepoForm = ({ onConnect, onClose }) => {
    const [path, setPath] = useState('');
    const [name, setName] = useState('');

    const connect = () => {
        if (!path.trim()) return;
        const derivedName = name || path.split(/[/\\]/).filter(Boolean).pop() || 'local-repo';
        onConnect({ path, name: derivedName });
    };

    return (
        <div style={{ padding:22, display:'flex', flexDirection:'column', gap:18 }}>
            <div style={{ display:'flex', alignItems:'center', gap: 18 }}>
                <div style={{ width:40, height:40, borderRadius: 16, background:`${THEME.info}18`, border:`1px solid ${THEME.info}30`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <HardDrive size={18} color={THEME.info}/>
                </div>
                <div>
                    <div style={{ fontSize:14.5, fontWeight:800, color:THEME.textMain }}>Connect Local Path</div>
                    <div style={{ fontSize:11, color:THEME.textDim, marginTop:2 }}>Fathom will read files via Browser File System Access API</div>
                </div>
            </div>

            <div>
                <label style={{ fontSize:10.5, fontWeight:700, color:THEME.textDim, letterSpacing:'0.02em', display:'block', marginBottom:8 }}>Absolute Path</label>
                <input value={path} onChange={e=>setPath(e.target.value)} placeholder="/path/to/project or C:\Projects\app" className="r8-input r8-input-local" style={{ width:'100%', background:THEME.surface, border:`1px solid ${THEME.glassBorder}`, borderRadius: 16, padding:'12px', color:THEME.textMain, fontFamily:THEME.fontMono, fontSize:12.5, boxSizing:'border-box', outline:'none' }}/>
            </div>

            <div style={{ padding:'10px 14px', borderRadius: 20, background:`${THEME.info}08`, border:`1px solid ${THEME.info}20`, fontSize:11, color:THEME.textDim, lineHeight:1.5 }}>
                <b style={{color:THEME.info}}>Note:</b> When accessing local folders, branch details and git commit history cannot be retrieved automatically without a local proxy server. Code analysis will work perfectly on raw files.
            </div>

            <div style={{ display:'flex', gap: 20, justifyContent:'flex-end' }}>
                <button onClick={onClose} className="r8-btn r8-btn-g">Cancel</button>
                <button onClick={connect} disabled={!path.trim()} className="r8-btn r8-btn-p" style={{ opacity:!path.trim()?0.5:1 }}><HardDrive size={13}/> Register Local</button>
            </div>
        </div>
    );
};

const AddRepoModal = ({ onAdd, onClose }) => {
    const [provider, setProvider] = useState('github');
    const [url, setUrl] = useState('');

    const handleRemote = () => {
        if (!url.trim()) return;
        const name = url.split('/').pop().replace(/\.git$/,'') || 'repo';
        onAdd({ name, url, type:provider, branch:'Syncing...', lastCommit:'Pending Integration', isLocal:false });
    };

    const handleLocal = (data) => {
        onAdd({ name:data.name, url:data.path, type:'local', branch:'Local Directory', lastCommit:'—', isLocal:true });
    };

    return (
        <div style={{ background: THEME.surface, borderRadius: 18, border: `1px solid ${THEME.glassBorder}`, display: 'flex', flexDirection: 'column', maxWidth: 560, animation: 'fadeIn 0.2s ease' }}>
            <div style={{ padding:'18px 22px', borderBottom:`1px solid ${THEME.glassBorder}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ fontSize:15, fontWeight:800, color:THEME.textMain }}>Connect Repository</div>
                <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:THEME.textDim }}><X size={16}/></button>
            </div>

                <div style={{ display:'flex', gap:5, padding:'14px 22px 0' }}>
                    {Object.entries(PROV).map(([key, p]) => (
                        <button key={key} onClick={()=>setProvider(key)} style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 13px', borderRadius: 20, border:`1px solid ${provider===key?p.color+'40':THEME.glassBorder}`, background:provider===key?`${p.color}14`:'transparent', color:provider===key?p.color:THEME.textDim, fontSize:12, fontWeight:700, cursor:'pointer' }}>
                            <p.Icon size={13}/>{p.label}
                        </button>
                    ))}
                </div>

                {provider==='local' ? <LocalRepoForm onConnect={handleLocal} onClose={onClose}/> : (
                    <div style={{ padding:22, display:'flex', flexDirection:'column', gap: 22 }}>
                        <div>
                            <label style={{ fontSize:10.5, fontWeight:700, color:THEME.textDim, marginBottom:8, display:'block' }}>Repository URL</label>
                            <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://github.com/user/repo" style={{ width:'100%', padding:'11px 12px', background:THEME.surface, border:`1px solid ${THEME.glassBorder}`, borderRadius: 20, color:THEME.textMain, outline:'none', fontSize:13, boxSizing:'border-box' }}/>
                        </div>
                        <div style={{ display:'flex', gap: 20, justifyContent:'flex-end' }}>
                            <button onClick={onClose} className="r8-btn r8-btn-g">Cancel</button>
                            <button onClick={handleRemote} disabled={!url.trim()} className="r8-btn r8-btn-p"><Plus size={13}/> Connect</button>
                        </div>
                    </div>
                )}
            </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   ROOT REPOSITORY TAB MANAGER
   ═══════════════════════════════════════════════════════════════════════════ */
const RepoCard = ({ repo, onOpen, onDelete }) => {
    const isLocal = repo.type==='local';
    const prov = PROV[repo.type] || PROV.github;
    const accent = isLocal ? THEME.info : THEME.primary;

    return (
        <div className={`r8-card r8-card-${isLocal?'local':'remote'}`} onClick={()=>onOpen(repo)} style={{ padding:22, borderRadius: 20, background:THEME.surface, border:`1px solid ${THEME.glassBorder}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
                <div style={{ display:'flex', alignItems:'center', gap: 18 }}>
                    <div style={{ width:40, height:40, borderRadius:11, background:`${accent}14`, border:`1px solid ${accent}25`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <prov.Icon size={18} color={accent}/>
                    </div>
                    <div>
                        <div style={{ fontSize:15, fontWeight:800, color:THEME.textMain }}>{repo.name}</div>
                        <div style={{ fontSize:10.5, color:THEME.textDim, fontFamily:'monospace', marginTop:2, maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{isLocal ? repo.url : repo.branch}</div>
                    </div>
                </div>
                <button onClick={e=>{e.stopPropagation();onDelete(repo.id);}} style={{ background:'none', border:'none', cursor:'pointer' }}><Trash2 size={13} color={THEME.danger}/></button>
            </div>
            <div style={{ display:'flex', gap:7, marginBottom:14 }}>
                <StatusBadge label={prov.label} color={accent} size="sm"/>
                <StatusBadge label={isLocal?'LOCAL':'REMOTE'} color={isLocal?THEME.info:THEME.success} size="sm"/>
            </div>
            <div style={{ height:1, background:THEME.glassBorder, marginBottom:12 }}/>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:THEME.textDim }}>
                <span>{repo.lastCommit}</span>
                <div style={{ color:accent, fontWeight:600 }}>Open →</div>
            </div>
        </div>
    );
};

const RepositoryTab = () => {
    useAdaptiveTheme(); // keeps THEME in sync with dark/light toggle
    const [view, setView] = useState('repos');
    const [repos, setRepos] = useState([]);
    const [activeRepo, setActiveRepo] = useState(null);
    const [subView, setSubView] = useState('code');
    const [showAdd, setShowAdd] = useState(false);
    const [search, setSearch] = useState('');

    useEffect(() => { try { const s=localStorage.getItem('fathom_repos_v10'); if(s) setRepos(JSON.parse(s)); } catch {} }, []);
    useEffect(() => { try { localStorage.setItem('fathom_repos_v10', JSON.stringify(repos)); } catch {} }, [repos]);

    const handleAdd = useCallback(data => { setRepos(prev=>[{ id:Date.now(), ...data }, ...prev]); setShowAdd(false); }, []);
    const handleDelete = useCallback(id => setRepos(prev=>prev.filter(r=>r.id!==id)), []);
    const openRepo = useCallback(repo => { setActiveRepo(repo); setView('browser'); setSubView('code'); }, []);

    const filtered = repos.filter(r=>r.name?.toLowerCase().includes(search.toLowerCase()));

    const NAV_TABS = [
        { id:'code', label:'Code', icon:Code },
        { id:'insights', label:'Insights', icon:Activity },
        { id:'cicd', label:'CI/CD', icon:RocketIcon },
        { id:'prs', label:'Pull Requests', icon:GitPullRequest },
        { id:'db', label:'Database', icon:Database },
    ];

    if (view === 'repos') {
        return (
            <div style={{ padding:'0 28px 56px' }}>
                <RepoStyles/>
                {showAdd && <AddRepoModal onAdd={handleAdd} onClose={()=>setShowAdd(false)}/>}

                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'26px 0 24px' }}>
                    <div>
                        <h2 style={{ fontSize:26, fontWeight:900, color:THEME.textMain, margin:0 }}>Repositories</h2>
                        <div style={{ fontSize:12.5, color:THEME.textDim, marginTop:5 }}>Manage your connected codebases</div>
                    </div>
                    <div style={{ display:'flex', gap: 22 }}>
                        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." style={{ padding:'9px 12px', background:THEME.surface, border:`1px solid ${THEME.glassBorder}`, borderRadius: 20, color:THEME.textMain, outline:'none' }}/>
                        <button onClick={()=>setShowAdd(true)} className="r8-btn r8-btn-p"><Plus size={14}/> Add Repository</button>
                    </div>
                </div>

                {filtered.length > 0 ? (
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap: 20 }} className="r8-stagger">
                        {filtered.map(repo => <RepoCard key={repo.id} repo={repo} onOpen={openRepo} onDelete={handleDelete}/>)}
                    </div>
                ) : (
                    <div style={{ padding:'72px 20px', textAlign:'center', border:`2px dashed ${THEME.glassBorder}`, borderRadius:16, display:'flex', flexDirection:'column', alignItems:'center' }}>
                        <GitBranch size={26} color={`${THEME.primary}50`} style={{ marginBottom: 16 }}/>
                        <div style={{ fontSize:15.5, fontWeight:700, color:THEME.textMuted }}>No repositories connected</div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div style={{ display:'flex', flexDirection:'column', height:'100vh', padding:'0 28px 24px' }}>
            <RepoStyles/>
            <div style={{ padding:'14px 0', display:'flex', alignItems:'center', gap: 22 }}>
                <button onClick={()=>setView('repos')} className="r8-btn r8-btn-g r8-btn-sm">Repositories</button>
                <ChevronRight size={11} color={THEME.textDim}/>
                <span style={{ fontWeight:800, color:THEME.textMain, fontSize:14 }}>{activeRepo?.name}</span>
            </div>

            <div style={{ display:'flex', gap:4, padding:4, background:THEME.surface, border:`1px solid ${THEME.glassBorder}`, borderRadius: 16, marginBottom:14, width:'fit-content' }}>
                {NAV_TABS.map(tab=>(
                    <button key={tab.id} onClick={()=>setSubView(tab.id)} className={`r8-tab${subView===tab.id?' r8-tab-on':''}`} style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 15px', borderRadius: 20, border:'none', cursor:'pointer', background:subView===tab.id?`linear-gradient(135deg, ${THEME.primary}, ${THEME.secondary})`:'transparent', color:subView===tab.id?THEME.textMain:THEME.textDim, fontSize:12, fontWeight:700 }}>
                        <tab.icon size={12}/> {tab.label}
                    </button>
                ))}
            </div>

            <div style={{ flex:1, minHeight:0, overflow:'hidden', minWidth:0 }}>
                {subView==='code' && <CodeView activeRepo={activeRepo}/>}
                {subView==='insights' && <InsightsView activeRepo={activeRepo}/>}
                {subView==='cicd' && <CICDView/>}
                {subView==='prs' && <PullRequestView/>}
                {subView==='db' && <DatabaseView/>}
            </div>
        </div>
    );
};

export default RepositoryTab;