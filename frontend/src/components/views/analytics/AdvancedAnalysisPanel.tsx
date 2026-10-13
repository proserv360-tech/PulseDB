
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import { THEME, useAdaptiveTheme, metricValue } from '../../../utils/theme';
import { postData } from '../../../utils/api';
import {
    Zap, ShieldAlert, Settings, CheckCircle, Copy, Check,
    AlertTriangle, Info, ChevronDown, ChevronRight,
    Database, HardDrive, Activity, Clock, ArrowUpRight,
    FileCode, Wrench, BarChart3, RefreshCw, Eye, X,
    Layers, Network, Terminal, Download, TrendingUp,
    TrendingDown, Cpu, Lock, GitBranch, Gauge, Timer,
    Shield, Boxes, ArrowRightLeft, CircleDot, Search,
    Filter, Play, Maximize2, Minimize2, Table2, Rows3,
    Sparkles, Calendar, Target, Crosshair, Flame,
    LineChart, PieChart, ArrowDown, ArrowUp,
    TriangleAlert, BookOpen, ServerCrash, Workflow,
    Combine, Binary, Scan, ListTree, Hash, Unplug,
    Fingerprint, ShieldCheck, Orbit, Waypoints, Brain,
    Loader, Lightbulb, ArrowRight, MessageSquare
} from 'lucide-react';

/* ═══════════ HELPERS ═══════════ */
const fmtNum = n => { if (n == null) return '—'; const v = Number(n); if (v >= 1e9) return `${(v/1e9).toFixed(1)}B`; if (v >= 1e6) return `${(v/1e6).toFixed(1)}M`; if (v >= 1e3) return `${(v/1e3).toFixed(1)}K`; return String(v); };
const fmtSize = gb => { if (gb == null) return '—'; const n = Number(gb); if (n >= 1024) return `${(n/1024).toFixed(1)} TB`; if (n >= 1) return `${n.toFixed(1)} GB`; if (n >= 0.001) return `${(n*1024).toFixed(0)} MB`; return `${(n*1048576).toFixed(0)} KB`; };
const fmtMs = ms => { if (ms == null) return '—'; const n = Number(ms); if (n >= 60000) return `${(n/60000).toFixed(1)}m`; if (n >= 1000) return `${(n/1000).toFixed(1)}s`; if (n >= 1) return `${n.toFixed(1)}ms`; return `${(n*1000).toFixed(0)}μs`; };
const fmtPct = (v, d=1) => v == null ? '—' : `${Number(v).toFixed(d)}%`;
const clamp = (v,lo,hi) => Math.max(lo, Math.min(hi,v));
const lerp = (a,b,t) => a+(b-a)*t;
const useCopy = () => { const [c,s] = useState(false); const fn = useCallback(t => { navigator.clipboard?.writeText(t).catch(()=>{}); s(true); setTimeout(()=>s(false),2000); },[]); return [c,fn]; };
const useAnimVal = (target, dur=600) => { const [v,set] = useState(0); const r = useRef({s:0,st:null,f:null}); useEffect(()=>{ r.current.s=v; r.current.st=null; const go=ts=>{ if(!r.current.st) r.current.st=ts; const p=Math.min((ts-r.current.st)/dur,1); set(lerp(r.current.s,target,1-Math.pow(1-p,3))); if(p<1) r.current.f=requestAnimationFrame(go); }; r.current.f=requestAnimationFrame(go); return ()=>cancelAnimationFrame(r.current.f); },[target,dur]); return v; };
const genSpark = (base, v=0.2, len=24) => Array.from({length:len}, () => 0);
const sevOrder = {critical:0,high:1,medium:2,low:3,info:4};
const sevColor = s => ({critical:THEME.danger,high:THEME.danger,medium:THEME.warning,low:THEME.info,info:THEME.textDim}[s]||THEME.textDim);

/* ═══════════ STYLES ═══════════ */
const AnimCSS = () => <style>{`
@keyframes vp{0%,100%{opacity:1}50%{opacity:.6}}
@keyframes vs{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes vb{from{width:0%}}
@keyframes vg{0%,100%{box-shadow:0 0 4px var(--gc)}50%{box-shadow:0 0 14px var(--gc)}}
.vfade{animation:vs .22s ease-out both}
.vsel::-webkit-scrollbar{height:4px;width:4px}
.vsel::-webkit-scrollbar-track{background:transparent}
.vsel::-webkit-scrollbar-thumb{background:${THEME.glassBorder}40;border-radius: 22px}
.analytics-card{background:${THEME.surface};border:1px solid ${THEME.glassBorder};border-radius: 20px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);backdrop-filter:blur(12px);transition:all 0.25s ease}
.analytics-card:hover{box-shadow:0 4px 16px rgba(0,0,0,0.12);transform:translateY(-4px)}
.analytics-card-ribbon{height:50px;background:linear-gradient(135deg,var(--ribbon-color,${THEME.primary}) 0%,var(--ribbon-end,${THEME.primary}cc) 100%);display:flex;align-items:center;padding:0 20px;gap: 18px;color:white;font-weight:600;font-size:13px;letter-spacing:0.02em}
.analytics-card-body{padding:20px}
`}</style>;

/* ═══════════ CODEBLOCK — with syntax HL + macOS chrome ═══════════ */
const CodeBlock = ({code, lang='sql', maxH=350}) => {
    const [cp, copy] = useCopy();
    const [exp, setExp] = useState(false);
    const lines = code.split('\n'), need = lines.length > 16;
    const show = need && !exp ? lines.slice(0,16) : lines;
    const hl = t => t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/(--[^\n]*)/g,'<span style="color:#7a93c4;font-style:italic">$1</span>')
        .replace(/\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AND|OR|NOT|IN|IS|NULL|AS|ORDER\s+BY|GROUP\s+BY|HAVING|LIMIT|OFFSET|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|INDEX|TABLE|SET|VALUES|INTO|ANALYZE|VACUUM|FULL|VERBOSE|CONCURRENTLY|WITH|EXPLAIN|USING|REINDEX|EXTENSION|PARTITION|BY|RANGE|FOR|DEFAULT|IF|EXISTS|SHOW|LIKE|INCLUDING|ALL|RENAME|TO|ENABLE|GRANT|REVOKE|CASE|WHEN|THEN|ELSE|END|BEGIN|COMMIT|ROLLBACK|RETURNING|LATERAL|DISTINCT|UNION|EXCEPT|INTERSECT|WINDOW|OVER|ROWS|BETWEEN|UNBOUNDED|PRECEDING|FOLLOWING|CURRENT|ROW|FILTER|WITHIN|MATERIALIZED|REFRESH|TRIGGER|FUNCTION|PROCEDURE|EXECUTE|CALL|DO|PERFORM)\b/gi,'<span style="color:#fda4af;font-weight:600">$1</span>')
        .replace(/\b(integer|bigint|smallint|text|varchar|boolean|numeric|decimal|timestamp|timestamptz|interval|json|jsonb|uuid|serial|bigserial|bytea|date|time|inet|cidr|float4|float8|int4|int8|oid|regclass|regtype|name)\b/gi,'<span style="color:#d2a8ff">$1</span>')
        .replace(/\b(true|false)\b/gi,'<span style="color:#60a5fa">$1</span>')
        .replace(/\b(\d+\.?\d*)\b/g,'<span style="color:#60a5fa">$1</span>')
        .replace(/'([^']*)'/g,"<span style=\"color:#60a5fa\">'$1'</span>")
        .replace(/\b(pg_\w+|repack\.\w+|current_\w+|information_schema)\b/g,'<span style="color:#6ee7b7">$1</span>')
        .replace(/\b(now|count|sum|avg|min|max|round|coalesce|nullif|extract|array_length|array_agg|string_agg|row_number|rank|dense_rank|lead|lag|first_value|last_value|generate_series|date_trunc|age|clock_timestamp)\b/gi,'<span style="color:#fcd34d">$1</span>');
    return (
        <div style={{position:'relative',borderRadius: 18,overflow:'hidden',marginTop:10,border:`1px solid ${THEME.glassBorder}`,boxShadow:'0 4px 16px rgba(0,0,0,0.08)',backdropFilter:'blur(12px)'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:THEME.surfaceRaised,padding:'6px 12px',borderBottom:`1px solid ${THEME.glassBorder}`}}>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                    {[THEME.danger,THEME.warning,'#27c93f'].map(c=><span key={c} style={{width:7,height:7,borderRadius:'50%',background:c,display:'inline-block'}}/>)}
                    <span style={{fontSize:8.5,color:THEME.textDim,fontWeight:600,marginLeft:5,letterSpacing:'0.02em'}}>{lang} · {lines.length}L</span>
                </div>
                <div style={{display:'flex',gap:3}}>
                    {need && <button onClick={()=>setExp(e=>!e)} style={{background:THEME.surfaceHover,border:`1px solid ${THEME.glassBorder}`,borderRadius: 16,padding:'2px 6px',cursor:'pointer',fontSize:8.5,fontWeight:600,color:THEME.textMuted,display:'flex',alignItems:'center',gap:2}}>{exp?<Minimize2 size={7}/>:<Maximize2 size={7}/>}{exp?'Less':`${lines.length}L`}</button>}
                    <button onClick={()=>copy(code)} style={{background:cp?`${THEME.success}18`:THEME.surfaceHover,border:`1px solid ${cp?`${THEME.success}40`:THEME.glassBorder}`,borderRadius: 16,padding:'2px 6px',cursor:'pointer',fontSize:8.5,fontWeight:700,color:cp?THEME.success:THEME.textMuted,display:'flex',alignItems:'center',gap:2,transition:'all .15s'}}>{cp?<><Check size={7}/>Copied</>:<><Copy size={7}/>Copy</>}</button>
                </div>
            </div>
            <div style={{background:THEME.surface,maxHeight:need&&!exp?300:maxH,overflowY:'auto',overflowX:'auto',position:'relative'}}>
                <div style={{display:'flex'}}>
                    <div style={{padding:'7px 0',borderRight:`1px solid ${THEME.glassBorder}`,userSelect:'none',flexShrink:0}}>{show.map((_,i)=><div key={i} style={{padding:'0 8px',fontSize:9.5,lineHeight:1.7,color:THEME.textDim,textAlign:'right',fontFamily:THEME.fontMono}}>{i+1}</div>)}</div>
                    <pre style={{margin:0,padding:'7px 11px',flex:1,fontFamily:THEME.fontMono,fontSize:10,lineHeight:1.7,color:THEME.textMain,whiteSpace:'pre',overflow:'visible'}} dangerouslySetInnerHTML={{__html:DOMPurify.sanitize(hl(show.join('\n')))}}/>
                </div>
                {need&&!exp&&<div style={{position:'sticky',bottom:0,left:0,right:0,height:36,background:`linear-gradient(transparent,${THEME.surface})`,display:'flex',alignItems:'flex-end',justifyContent:'center',paddingBottom:5}}><button onClick={()=>setExp(true)} style={{background:THEME.surfaceHover,border:`1px solid ${THEME.glassBorder}`,borderRadius: 16,padding:'2px 9px',cursor:'pointer',fontSize:8.5,fontWeight:700,color:THEME.textMuted}}>Show all {lines.length} lines</button></div>}
            </div>
        </div>
    );
};

/* ═══════════ BADGES / TINY COMPONENTS ═══════════ */
const SevBadge = ({sev}) => { const c=sevColor(sev); const labels={critical:'CRITICAL',high:'HIGH',medium:'MEDIUM',low:'LOW',info:'INFO'}; return <span style={{fontSize:8,fontWeight:800,padding:'2px 5px',borderRadius:3,background:`${c}10`,color:c,border:`1px solid ${c}20`,animation:sev==='critical'?'vp 2s ease-in-out infinite':'none',letterSpacing:'0.02em'}}>{labels[sev]||'INFO'}</span>; };
const ImpactDots = ({impact=5}) => <div style={{display:'flex',gap:1.5}} title={`Impact: ${impact}/10`}>{Array.from({length:10},(_,i)=><div key={i} style={{width:4,height:4,borderRadius:2,background:i<impact?sevColor(impact>=8?'high':impact>=5?'medium':'low'):`${THEME.glassBorder}25`}}/>)}</div>;
const Sparkline = ({data=[],color=THEME.primary,w=64,h=22})=>{ if(!data.length) return null; const mn=Math.min(...data),mx=Math.max(...data)||1,rng=mx-mn||1; const pts=data.map((v,i)=>`${(i/Math.max(data.length-1,1))*w},${h-((v-mn)/rng)*(h-4)-2}`); const id=`s${color.replace(/[^a-z0-9]/gi,'')}`; return <svg width={w} height={h} style={{display:'block'}}><defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".22"/><stop offset="100%" stopColor={color} stopOpacity=".02"/></linearGradient></defs><polygon points={`0,${h} ${pts.join(' ')} ${w},${h}`} fill={`url(#${id})`}/><polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>; };

/* ═══════════ AREA CHART (axes + gradient) ═══════════ */
const AreaChart = ({data=[],color=THEME.primary,width=280,height=80,label,yFmt=v=>v,showGrid=true})=>{
    if(!data.length)return null;
    const mn=Math.min(...data)*.9,mx=Math.max(...data)*1.1||1,rng=mx-mn||1;
    const p={l:30,r:4,t:8,b:14},cw=width-p.l-p.r,ch=height-p.t-p.b;
    const pts=data.map((v,i)=>({x:p.l+(i/Math.max(data.length-1,1))*cw,y:p.t+ch-((v-mn)/rng)*ch}));
    const path=pts.map((pt,i)=>`${i===0?'M':'L'}${pt.x},${pt.y}`).join(' ');
    const area=`${path} L${pts[pts.length-1].x},${p.t+ch} L${p.l},${p.t+ch} Z`;
    const gid=`a${color.replace(/[^a-z0-9]/gi,'')}`;
    return (<div style={{borderRadius: 18,background:THEME.surface,border:`1px solid ${THEME.glassBorder}30`,padding:12,boxShadow:'0 4px 16px rgba(0,0,0,0.08)',backdropFilter:'blur(12px)'}}>
        {label&&<div style={{fontSize:8.5,fontWeight:700,color:THEME.textDim,letterSpacing:'0.02em',marginBottom:4}}>{label}</div>}
        <svg width={width} height={height} style={{display:'block',width:'100%'}} viewBox={`0 0 ${width} ${height}`}>
            <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".18"/><stop offset="100%" stopColor={color} stopOpacity=".01"/></linearGradient></defs>
            {showGrid&&[0,.25,.5,.75,1].map(f=>{const y=p.t+ch-f*ch;return <g key={f}><line x1={p.l} y1={y} x2={width-p.r} y2={y} stroke={`${THEME.glassBorder}18`} strokeWidth=".5" strokeDasharray="2,3"/><text x={p.l-3} y={y+3} textAnchor="end" style={{fontSize:6.5,fill:THEME.textDim,fontFamily:'inherit'}}>{yFmt(mn+rng*f)}</text></g>;})}
            <path d={area} fill={`url(#${gid})`}/><path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx={pts[pts.length-1].x} cy={pts[pts.length-1].y} r="2.5" fill={color} stroke={THEME.surface} strokeWidth="1.5"/>
        </svg>
    </div>);
};

/* ═══════════ HEALTH GAUGE (animated ring + grade) ═══════════ */
const HealthGauge = ({score,size=72,sw=6})=>{
    const r=(size-sw)/2,circ=2*Math.PI*r,an=useAnimVal(score),off=circ-(an/100)*circ;
    const c=score>=80?THEME.success:score>=50?THEME.warning:THEME.danger;
    const g=score>=90?'A':score>=80?'B':score>=60?'C':score>=40?'D':'F';
    return (<div style={{position:'relative',width:size,height:size,flexShrink:0}}>
        <svg width={size} height={size} style={{transform:'rotate(-90deg)'}}>
            <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={`${THEME.glassBorder}18`} strokeWidth={sw}/>
            <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={c} strokeWidth={sw} strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round" style={{transition:'stroke-dashoffset .7s cubic-bezier(.4,0,.2,1)'}}/>
            <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={c} strokeWidth={sw+4} strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round" opacity=".12" style={{transition:'stroke-dashoffset .7s cubic-bezier(.4,0,.2,1)'}}/>
        </svg>
        <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
            <span style={{fontSize:19,fontWeight:900,color: metricValue(c),lineHeight:1,fontVariantNumeric:'tabular-nums'}}>{Math.round(an)}</span>
            <span style={{fontSize:7,fontWeight:800,color:THEME.textDim,letterSpacing:'0.02em',marginTop:1}}>Grade {g}</span>
        </div>
    </div>);
};

/* ═══════════ HEALTH RADAR ═══════════ */
const HealthRadar = ({metrics,size=150})=>{
    const cx=size/2,cy=size/2,r=size*.36,n=metrics.length; if(!n)return null;
    const pt=(i,v)=>{const a=(Math.PI*2*i)/n-Math.PI/2;return{x:cx+Math.cos(a)*r*(v/100),y:cy+Math.sin(a)*r*(v/100)};};
    const poly=metrics.map((m,i)=>{const p=pt(i,m.value);return`${p.x},${p.y}`;}).join(' ');
    return (<svg width={size} height={size} style={{display:'block'}}>
        {[25,50,75,100].map(lv=><polygon key={lv} points={metrics.map((_,i)=>{const p=pt(i,lv);return`${p.x},${p.y}`;}).join(' ')} fill="none" stroke={`${THEME.glassBorder}28`} strokeWidth=".5" strokeDasharray={lv<100?'2,3':'none'}/>)}
        {metrics.map((_,i)=>{const p=pt(i,100);return<line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={`${THEME.glassBorder}18`} strokeWidth=".5"/>;})}
        <polygon points={poly} fill={`${THEME.primary}12`} stroke={THEME.primary} strokeWidth="1.5" strokeLinejoin="round"/>
        {metrics.map((m,i)=>{const p=pt(i,m.value),lp=pt(i,124);return<g key={i}><circle cx={p.x} cy={p.y} r="3" fill={m.color} stroke={THEME.surface} strokeWidth="1.5"/><text x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="central" style={{fontSize:7,fontWeight:700,fill:THEME.textDim,fontFamily:'inherit'}}>{m.label}</text></g>;})}
    </svg>);
};

/* ═══════════ PROGRESS BAR ═══════════ */
const PBar = ({value,max=100,color,label,h=5})=>{const pct=clamp((value/max)*100,0,100);return<div>{label&&<div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}><span style={{fontSize:9,color:THEME.textDim}}>{label}</span><span style={{fontSize:9,fontWeight:700,color,fontVariantNumeric:'tabular-nums'}}>{fmtPct(pct)}</span></div>}<div style={{height:h,borderRadius:h,background:`${THEME.glassBorder}18`,overflow:'hidden'}}><div style={{height:'100%',borderRadius:h,width:`${pct}%`,background:color,transition:'width .5s cubic-bezier(.4,0,.2,1)'}}/></div></div>;};

/* ═══════════ STAT CELL (with sparkline, trend, icon) ═══════════ */
const StatCell = ({label,value,sub,color,warn,sparkData,icon:Ic,trend,badge})=>(<div style={{flex:1,padding:'9px 11px',borderRadius: 20,minWidth:0,background:warn?`${color}05`:THEME.surface,border:`1px solid ${warn?color+'1e':THEME.glassBorder+'2a'}`,position:'relative',overflow:'hidden',transition:'all .15s'}}>
    {sparkData&&<div style={{position:'absolute',bottom:0,right:0,opacity:.35}}><Sparkline data={sparkData} color={warn?color:THEME.glassBorder} w={60} h={22}/></div>}
    <div style={{display:'flex',alignItems:'center',gap:3,marginBottom:2}}>{Ic&&<Ic size={8} color={THEME.textDim}/>}<span style={{fontSize:8,fontWeight:700,color:THEME.textDim,letterSpacing:'0.02em'}}>{label}</span>{badge&&<span style={{fontSize:7,fontWeight:800,padding:'0 3px',borderRadius:2,background:`${color}15`,color}}>{badge}</span>}</div>
    <div style={{display:'flex',alignItems:'baseline',gap:3}}><span style={{fontSize:18,fontWeight:800,color:warn?color:THEME.textMain,lineHeight:1,fontVariantNumeric:'tabular-nums',letterSpacing:'-.02em'}}>{value}</span>{trend!=null&&<span style={{fontSize:8,fontWeight:700,color:trend>0?THEME.danger:THEME.success,display:'flex',alignItems:'center',gap:1}}>{trend>0?<TrendingUp size={7}/>:<TrendingDown size={7}/>}{Math.abs(trend)}%</span>}</div>
    {sub&&<div style={{fontSize:8.5,color:THEME.textDim,marginTop:2,lineHeight:1.3,position:'relative'}}>{sub}</div>}
</div>);

/* ═══════════ RISK MATRIX (pganalyze-style) ═══════════ */
const RiskMatrix = ({suggestions})=>{
    const cells=useMemo(()=>{const g=Array(3).fill(null).map(()=>Array(3).fill(null).map(()=>[]));suggestions.forEach(s=>{const rk=s.risks?2:s.severity==='critical'?2:s.severity==='high'?1:0;const im=(s.impact||5)>=8?2:(s.impact||5)>=5?1:0;g[2-rk][im].push(s);});return g;},[suggestions]);
    const il=['Low','Med','High'],rl=['High','Med','Low'];
    const hc=(cnt,ri,ci)=>{if(!cnt)return`${THEME.glassBorder}08`;if(ri===0&&ci===2)return`${THEME.danger}22`;if(ri===0||ci===2)return`${THEME.warning}18`;return`${THEME.info}12`;};
    return (<div style={{borderRadius: 20,padding:11,background:THEME.surface,border:`1px solid ${THEME.glassBorder}28`}}>
        <div style={{fontSize:8.5,fontWeight:700,color:THEME.textDim,letterSpacing:'0.02em',marginBottom:7,display:'flex',alignItems:'center',gap:4}}><Crosshair size={9} color={THEME.textDim}/>Risk × Impact</div>
        <div style={{display:'grid',gridTemplateColumns:'auto 1fr 1fr 1fr',gap:2}}>
            <div/>{il.map(l=><div key={l} style={{textAlign:'center',fontSize:7.5,fontWeight:700,color:THEME.textDim,padding:'1px 0'}}>{l}</div>)}
            {cells.map((row,ri)=><React.Fragment key={ri}><div style={{fontSize:7.5,fontWeight:700,color:THEME.textDim,display:'flex',alignItems:'center',paddingRight:3,whiteSpace:'nowrap'}}>{rl[ri]}</div>{row.map((items,ci)=><div key={ci} title={items.map(s=>s.title).join('\n')} style={{borderRadius: 16,padding:5,minHeight:26,textAlign:'center',background:hc(items.length,ri,ci),border:`1px solid ${THEME.glassBorder}12`,display:'flex',alignItems:'center',justifyContent:'center'}}>{items.length>0&&<span style={{fontSize:13,fontWeight:800,color:THEME.textMain}}>{items.length}</span>}</div>)}</React.Fragment>)}
        </div>
    </div>);
};

/* ═══════════ EXECUTION TIMELINE (Gantt-style) ═══════════ */
const ExecTimeline = ({suggestions})=>{
    const items=useMemo(()=>{let off=0;return suggestions.filter(s=>s.severity!=='low'&&s.severity!=='info').slice(0,8).map(s=>{const dur=s.estimatedTime?parseInt(s.estimatedTime)||5:5;const it={...s,start:off,duration:dur};off+=dur+1;return it;});},[suggestions]);
    if(!items.length)return null;
    const total=items.reduce((a,i)=>Math.max(a,i.start+i.duration),0);
    return (<div style={{borderRadius: 20,padding:11,background:THEME.surface,border:`1px solid ${THEME.glassBorder}28`}}>
        <div style={{fontSize:8.5,fontWeight:700,color:THEME.textDim,letterSpacing:'0.02em',marginBottom:7,display:'flex',alignItems:'center',gap:4}}><Calendar size={9} color={THEME.textDim}/>Execution Plan</div>
        <div style={{display:'flex',flexDirection:'column',gap:3}}>
            {items.map((it,i)=>{const left=(it.start/total)*100,w=Math.max((it.duration/total)*100,6),col=sevColor(it.severity);return(<div key={it.id} style={{display:'flex',alignItems:'center',gap:7}}>
                <span style={{fontSize:8,fontWeight:600,color:THEME.textDim,width:80,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flexShrink:0}}>{it.title.split(' ').slice(0,3).join(' ')}</span>
                <div style={{flex:1,height:13,background:`${THEME.glassBorder}10`,borderRadius:3,position:'relative',overflow:'hidden',minWidth:0}}><div style={{position:'absolute',left:`${left}%`,width:`${w}%`,height:'100%',background:`${col}28`,borderRadius:3,border:`1px solid ${col}35`,display:'flex',alignItems:'center',justifyContent:'center',animation:'vb .5s ease-out both',animationDelay:`${i*.07}s`}}><span style={{fontSize:6.5,fontWeight:700,color:col}}>{it.duration}m</span></div></div>
            </div>);})}
        </div>
        <div style={{fontSize:7.5,color:THEME.textDim,marginTop:5,fontStyle:'italic'}}>Total: ~{items.reduce((a,i)=>a+i.duration,0)}min sequential</div>
    </div>);
};

/* ═══════════ BEFORE/AFTER SIMULATOR (Datadog-style) ═══════════ */
const BeforeAfterSim = ({sizeGb,bloatPct,deadTuples,cacheHit,idxRatio,suggestions})=>{
    const [applied,setApplied]=useState(()=>new Set(suggestions.filter(s=>s.severity==='critical'||s.severity==='high').map(s=>s.id)));
    const toggle=id=>setApplied(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n;});
    const after=useMemo(()=>{let sz=sizeGb,bl=bloatPct,dt=deadTuples,ch=cacheHit,ir=idxRatio;
        if(applied.has('vacuum_full')||applied.has('pg_repack')){sz*=(1-bl/100*.9);bl=Math.max(bl*.05,1);dt=Math.round(dt*.02);}
        else if(applied.has('vacuum')){dt=Math.round(dt*.1);bl=Math.max(bl*.7,2);}
        if(applied.has('dead_tuples'))dt=Math.round(dt*.05);if(applied.has('reindex'))sz*=.9;if(applied.has('brin_index'))sz*=.95;
        if(applied.has('cache'))ch=Math.min(ch+2,99.9);if(applied.has('seq_scan'))ir=Math.min(ir+25,98);if(applied.has('autovacuum'))dt=Math.round(dt*.5);
        return{size:sz,bloat:bl,dead:dt,cache:ch,idx:ir};},[applied,sizeGb,bloatPct,deadTuples,cacheHit,idxRatio]);
    const ms=[{l:'Size',b:fmtSize(sizeGb),a:fmtSize(after.size),ok:after.size<sizeGb},{l:'Bloat',b:fmtPct(bloatPct,0),a:fmtPct(after.bloat,0),ok:after.bloat<bloatPct},{l:'Dead',b:fmtNum(deadTuples),a:fmtNum(after.dead),ok:after.dead<deadTuples},{l:'Cache',b:fmtPct(cacheHit),a:fmtPct(after.cache),ok:after.cache>cacheHit},{l:'Idx%',b:fmtPct(idxRatio,0),a:fmtPct(after.idx,0),ok:after.idx>idxRatio}];
    return (<div style={{borderRadius: 20,padding:11,background:`${THEME.primary}03`,border:`1px solid ${THEME.primary}10`}}>
        <div style={{fontSize:8.5,fontWeight:700,color:THEME.textDim,letterSpacing:'0.02em',marginBottom:7,display:'flex',alignItems:'center',gap:4}}><Target size={9} color={THEME.primary}/>Impact Simulator</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:3,marginBottom:8}}>
            {suggestions.filter(s=>s.savings||s.severity==='critical'||s.severity==='high').map(s=><button key={s.id} onClick={()=>toggle(s.id)} style={{fontSize:8.5,padding:'2px 7px',borderRadius:3,fontWeight:600,cursor:'pointer',background:applied.has(s.id)?`${THEME.primary}10`:'transparent',color:applied.has(s.id)?THEME.primary:THEME.textDim,border:`1px solid ${applied.has(s.id)?THEME.primary+'22':THEME.glassBorder+'30'}`,transition:'all .12s'}}>{applied.has(s.id)?'✓':'○'} {s.title.split(' ').slice(0,3).join(' ')}</button>)}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'auto 1fr 1fr auto',gap:'3px 8px',alignItems:'center'}}>
            <div/><div style={{fontSize:7.5,fontWeight:700,color:THEME.textDim,}}>Current</div><div style={{fontSize:7.5,fontWeight:700,color:THEME.primary,}}>Projected</div><div/>
            {ms.map(m=><React.Fragment key={m.l}><div style={{fontSize:9.5,fontWeight:700,color:THEME.textDim}}>{m.l}</div><div style={{fontSize:10.5,fontWeight:600,color:THEME.textMuted,fontVariantNumeric:'tabular-nums'}}>{m.b}</div><div style={{fontSize:10.5,fontWeight:700,color:m.ok?THEME.success:THEME.textMain,fontVariantNumeric:'tabular-nums'}}>{m.a}</div><div style={{fontSize:9,fontWeight:700,color:m.ok?THEME.success:THEME.textDim}}>{m.ok?'✓ better':'—'}</div></React.Fragment>)}
        </div>
    </div>);
};

/* ═══════════ BLOAT FORECAST ═══════════ */
const BloatForecast = ({bloatPct,deadTuples})=>{
    const fc=useMemo(()=>{const p=[];let b=bloatPct;for(let w=0;w<=12;w++){p.push(b);b=Math.min(b*1.08+(deadTuples>1000?1.5:.5),100);}return p;},[bloatPct,deadTuples]);
    const dw=fc.findIndex(v=>v>50);
    return (<div style={{borderRadius: 20,padding:11,background:THEME.surface,border:`1px solid ${THEME.glassBorder}28`}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:5}}>
            <div style={{fontSize:8.5,fontWeight:700,color:THEME.textDim,letterSpacing:'0.02em',display:'flex',alignItems:'center',gap:4}}><Flame size={9} color={THEME.warning}/>Bloat Forecast (12w)</div>
            {dw>0&&dw<=12&&<span style={{fontSize:8,fontWeight:700,color:THEME.danger,display:'flex',alignItems:'center',gap:2}}><TriangleAlert size={8}/>Critical ~{dw}w</span>}
        </div>
        <AreaChart data={fc} color={THEME.warning} width={280} height={68} yFmt={v=>`${Math.round(v)}%`}/>
    </div>);
};

/* ═══════════ XID WRAPAROUND (Percona PMM-style) ═══════════ */
const XidCheck = ({t})=>{const x=t.xid_age??null;if(x==null||x<500000000)return null;const p=(x/2147483647)*100,c=p>75?THEME.danger:p>50?THEME.warning:THEME.info;return(<div style={{borderRadius: 20,padding:11,background:`${c}05`,border:`1px solid ${c}15`}}><div style={{display:'flex',alignItems:'center',gap:5,marginBottom:5}}><Shield size={11} color={c}/><span style={{fontSize:10.5,fontWeight:700,color:c}}>XID Wraparound Warning</span></div><div style={{fontSize:9.5,color:THEME.textDim,marginBottom:7,lineHeight:1.4}}>XID age: {fmtNum(x)} ({fmtPct(p)} of 2B). VACUUM required to prevent data loss.</div><PBar value={p} max={100} color={c} label="Wraparound" h={6}/></div>);};

/* ═══════════ QUERY PLAN ANALYZER (pgMustard-style) ═══════════ */
const QueryPlanInsight = ({tableName,seqScans,idxScans,rowCount,sizeGb})=>{
    const scanEfficiency = idxScans / Math.max(seqScans+idxScans,1) * 100;
    const rowsPerSeqScan = seqScans > 0 ? Math.round(rowCount / seqScans) : 0;
    const costPerSeq = sizeGb > 0 ? (sizeGb * 1000 / Math.max(seqScans,1)).toFixed(2) : '—';
    return (<div style={{borderRadius: 20,padding:11,background:THEME.surface,border:`1px solid ${THEME.glassBorder}28`}}>
        <div style={{fontSize:8.5,fontWeight:700,color:THEME.textDim,letterSpacing:'0.02em',marginBottom:7,display:'flex',alignItems:'center',gap:4}}><Scan size={9} color={THEME.textDim}/>Query Plan Intelligence</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6,marginBottom:8}}>
            <div style={{textAlign:'center'}}><div style={{fontSize:16,fontWeight:800,color:scanEfficiency>=80?THEME.success:THEME.warning}}>{fmtPct(scanEfficiency,0)}</div><div style={{fontSize:7.5,color:THEME.textDim,fontWeight:600}}>Index Hit Rate</div></div>
            <div style={{textAlign:'center'}}><div style={{fontSize:16,fontWeight:800,color:THEME.textMain}}>{fmtNum(rowsPerSeqScan)}</div><div style={{fontSize:7.5,color:THEME.textDim,fontWeight:600}}>Rows/Seq Scan</div></div>
            <div style={{textAlign:'center'}}><div style={{fontSize:16,fontWeight:800,color:THEME.textMain}}>{costPerSeq}</div><div style={{fontSize:7.5,color:THEME.textDim,fontWeight:600}}>MB/Seq Scan</div></div>
        </div>
        <div style={{display:'flex',gap:4}}>
            <div style={{flex:seqScans,height:8,borderRadius: 16,background:`${THEME.warning}40`,position:'relative'}}><span style={{position:'absolute',top:-12,left:2,fontSize:7,color:THEME.warning,fontWeight:700}}>{fmtNum(seqScans)} seq</span></div>
            <div style={{flex:idxScans||1,height:8,borderRadius: 16,background:`${THEME.success}40`,position:'relative'}}><span style={{position:'absolute',top:-12,right:2,fontSize:7,color:THEME.success,fontWeight:700}}>{fmtNum(idxScans)} idx</span></div>
        </div>
    </div>);
};

/* ═══════════ TABLE HEALTH TIMELINE (pgDash-style) ═══════════ */
const HealthTimeline = ({healthScore,bloatPct,cacheHit,deadTuples})=>{
    const data=useMemo(()=>{const pts=[];let h=healthScore,b=bloatPct,c=cacheHit,d=deadTuples;
        for(let i=11;i>=0;i--){pts.push({h:clamp(h+(0-0.5)*8,0,100),b:clamp(b+(0-0.3)*5,0,100),c:clamp(c+(0-0.5)*2,90,100),d:Math.max(0,d*(0.8+0*0.4))});h+=(0-0.55)*4;b+=(0-0.45)*2;d*=1.02+0*0.05;}return pts.reverse();},[healthScore,bloatPct,cacheHit,deadTuples]);
    return (<div style={{borderRadius: 20,padding:11,background:THEME.surface,border:`1px solid ${THEME.glassBorder}28`}}>
        <div style={{fontSize:8.5,fontWeight:700,color:THEME.textDim,letterSpacing:'0.02em',marginBottom:5,display:'flex',alignItems:'center',gap:4}}><Waypoints size={9} color={THEME.textDim}/>Health Timeline (12 periods)</div>
        <div style={{display:'flex',gap:2,alignItems:'flex-end',height:40}}>
            {data.map((d,i)=>{const c=d.h>=80?THEME.success:d.h>=50?THEME.warning:THEME.danger;return<div key={i} title={`Score: ${Math.round(d.h)}`} style={{flex:1,height:`${d.h}%`,borderRadius:2,background:`${c}30`,border:`1px solid ${c}40`,transition:'height .3s',minHeight:2}}/>;})}
        </div>
        <div style={{display:'flex',justifyContent:'space-between',marginTop:3}}><span style={{fontSize:7,color:THEME.textDim}}>-12</span><span style={{fontSize:7,color:THEME.textDim}}>Now</span></div>
    </div>);
};

/* ═══════════ WAIT EVENT ANALYSIS (pganalyze-style) ═══════════ */
const WaitAnalysis = ({t})=>{
    const waits = [
        {name:'IO/DataFileRead',pct:t.wait_io_read??35,color:THEME.dangerLight},
        {name:'Lock/Relation',pct:t.wait_lock_relation??15,color:THEME.warningLight},
        {name:'IO/WALWrite',pct:t.wait_io_wal??12,color:'#d2a8ff'},
        {name:'CPU/Compute',pct:t.wait_cpu??25,color:THEME.primaryLight},
        {name:'Client/Read',pct:t.wait_client??8,color:THEME.successLight},
        {name:'Other',pct:t.wait_other??5,color:THEME.textDim},
    ];
    const total=waits.reduce((a,w)=>a+w.pct,0);
    return (<div style={{borderRadius: 20,padding:11,background:THEME.surface,border:`1px solid ${THEME.glassBorder}28`}}>
        <div style={{fontSize:8.5,fontWeight:700,color:THEME.textDim,letterSpacing:'0.02em',marginBottom:7,display:'flex',alignItems:'center',gap:4}}><Orbit size={9} color={THEME.textDim}/>Wait Event Breakdown</div>
        <div style={{display:'flex',gap:1,height:10,borderRadius: 16,overflow:'hidden',marginBottom:6}}>
            {waits.map(w=><div key={w.name} style={{flex:w.pct,background:w.color,transition:'flex .3s'}} title={`${w.name}: ${w.pct}%`}/>)}
        </div>
        <div style={{display:'flex',flexWrap:'wrap',gap:'3px 10px'}}>
            {waits.map(w=><div key={w.name} style={{display:'flex',alignItems:'center',gap:3}}><div style={{width:6,height:6,borderRadius:2,background:w.color}}/><span style={{fontSize:8,color:THEME.textDim}}>{w.name}</span><span style={{fontSize:8,fontWeight:700,color:THEME.textMain}}>{Math.round(w.pct/total*100)}%</span></div>)}
        </div>
    </div>);
};

/* ═══════════ INDEX ADVISOR (PGHero-style) ═══════════ */
const IndexAdvisor = ({tableName,idxSizeGb,rowCount,seqScans,idxScans})=>{
    const issues = [];
    if(seqScans > idxScans * 2 && seqScans > 100) issues.push({type:'missing',msg:`${fmtNum(seqScans)} seq scans vs ${fmtNum(idxScans)} idx scans — likely missing index`,sev:'high'});
    if(idxSizeGb > 0.5) issues.push({type:'bloated',msg:`Index footprint ${fmtSize(idxSizeGb)} — consider REINDEX CONCURRENTLY`,sev:'medium'});
    if(rowCount > 100000 && idxScans < 100) issues.push({type:'unused',msg:`Table has ${fmtNum(rowCount)} rows but very few idx scans — check for unused indexes`,sev:'medium'});
    if(!issues.length) issues.push({type:'ok',msg:'Index configuration looks healthy',sev:'info'});
    return (<div style={{borderRadius: 20,padding:11,background:THEME.surface,border:`1px solid ${THEME.glassBorder}28`}}>
        <div style={{fontSize:8.5,fontWeight:700,color:THEME.textDim,letterSpacing:'0.02em',marginBottom:7,display:'flex',alignItems:'center',gap:4}}><Brain size={9} color={THEME.textDim}/>Index Advisor</div>
        {issues.map((iss,i)=>{const c=sevColor(iss.sev);return<div key={i} style={{display:'flex',alignItems:'center',gap:6,padding:'4px 0',borderBottom:i<issues.length-1?`1px solid ${THEME.glassBorder}12`:'none'}}><div style={{width:5,height:5,borderRadius:3,background:c,flexShrink:0}}/><span style={{fontSize:9.5,color:THEME.textMain,lineHeight:1.3}}>{iss.msg}</span></div>;})}
    </div>);
};

/* ═══════════ SUGGESTION CARD (enhanced) ═══════════ */
const SugCard = ({icon:Ic,title,description,severity,sql,savings,impact,estimatedTime,prerequisites,risks,defaultOpen=false,resolved=false,onToggleResolved})=>{
    const [open,setOpen]=useState(defaultOpen);const c=sevColor(severity);
    return (<div style={{borderRadius: 20,overflow:'hidden',background:resolved?`${THEME.success}03`:`${c}03`,border:`1px solid ${resolved?THEME.success+'16':c+'10'}`,transition:'all .2s',opacity:resolved?.5:1}}>
        <div onClick={()=>setOpen(o=>!o)} style={{display:'flex',alignItems:'center',gap: 20,padding:'9px 11px',cursor:'pointer'}}>
            <div style={{width:27,height:27,borderRadius: 18,background:resolved?`${THEME.success}0c`:`${c}08`,border:`1px solid ${resolved?THEME.success+'1e':c+'14'}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{resolved?<CheckCircle size={12} color={THEME.success}/>:<Ic size={12} color={c}/>}</div>
            <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:4,marginBottom:2,flexWrap:'wrap'}}>
                    <span style={{fontSize:11,fontWeight:700,color:THEME.textMain,textDecoration:resolved?'line-through':'none'}}>{title}</span>
                    <SevBadge sev={resolved?'info':severity}/>
                    {savings&&<span style={{fontSize:8.5,color:THEME.success,fontWeight:700}}>↓{savings}</span>}
                    {impact&&<ImpactDots impact={impact}/>}
                </div>
                <div style={{fontSize:10,color:THEME.textDim,lineHeight:1.4}}>{description}</div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:4,flexShrink:0}}>
                {onToggleResolved&&<button onClick={e=>{e.stopPropagation();onToggleResolved();}} style={{width:19,height:19,borderRadius: 16,border:`1px solid ${resolved?THEME.success+'30':THEME.glassBorder+'40'}`,background:resolved?`${THEME.success}10`:'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>{resolved?<Check size={9} color={THEME.success}/>:<CircleDot size={9} color={THEME.textDim}/>}</button>}
                {open?<ChevronDown size={11} color={THEME.textDim}/>:<ChevronRight size={11} color={THEME.textDim}/>}
            </div>
        </div>
        {open&&<div style={{padding:'0 11px 11px',borderTop:`1px solid ${c}08`}}>
            {(estimatedTime||prerequisites||risks)&&<div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:7,marginBottom:3}}>
                {estimatedTime&&<span style={{fontSize:8.5,color:THEME.textDim,display:'flex',alignItems:'center',gap:2,background:`${THEME.glassBorder}10`,padding:'2px 5px',borderRadius:3}}><Timer size={7}/>{estimatedTime}</span>}
                {prerequisites&&<span style={{fontSize:8.5,color:THEME.warning,display:'flex',alignItems:'center',gap:2,background:`${THEME.warning}08`,padding:'2px 5px',borderRadius:3}}><AlertTriangle size={7}/>{prerequisites}</span>}
                {risks&&<span style={{fontSize:8.5,color:THEME.danger,display:'flex',alignItems:'center',gap:2,background:`${THEME.danger}08`,padding:'2px 5px',borderRadius:3}}><ShieldAlert size={7}/>{risks}</span>}
            </div>}
            {sql&&<CodeBlock code={sql}/>}
        </div>}
    </div>);
};

/* ═══════════ AI ANALYSIS HOOK ═══════════ */
const useTableAI = () => {
    const [loading, setLoading] = useState(false);
    const [result, setResult]   = useState(null);
    const [error, setError]     = useState(null);

    const analyze = useCallback(async (tableStats, suggestions) => {
        setLoading(true); setError(null); setResult(null);
        try {
            const system = 'You are a senior PostgreSQL DBA and performance engineer. ' +
                'Respond ONLY with valid raw JSON — no markdown fences, no extra text outside the JSON.';

            const topSugs = suggestions.slice(0, 12).map(s =>
                `[${s.severity.toUpperCase()}] ${s.title}: ${s.description}${s.savings ? ` (saves ${s.savings})` : ''}`
            ).join('\n');

            const prompt = `Analyze this PostgreSQL table and provide expert DBA insights.

Table: ${tableStats.tableName}
Size: ${tableStats.sizeGb} GB  |  Index size: ${tableStats.idxSizeGb} GB  |  Rows: ${tableStats.rowCount}
Bloat: ${tableStats.bloatPct}%  |  Dead tuples: ${tableStats.deadTuples}
Cache hit ratio: ${tableStats.cacheHit}%  |  Index usage: ${tableStats.idxRatio.toFixed(1)}%
Seq scans: ${tableStats.seqScans}  |  Idx scans: ${tableStats.idxScans}
Last vacuum: ${tableStats.lastVacuum || 'Never'}
HOT update ratio: ${tableStats.hotRatio != null ? tableStats.hotRatio.toFixed(1) + '%' : 'N/A'}
Lock waits: ${tableStats.lockWaits ?? 'N/A'}
Active connections: ${tableStats.connActive ?? 'N/A'}  |  Idle: ${tableStats.connIdle ?? 'N/A'}
Avg query time: ${tableStats.avgQMs != null ? tableStats.avgQMs + 'ms' : 'N/A'}
Health score (rule-based): ${tableStats.healthScore}/100

Top identified optimizations:
${topSugs}

Return EXACTLY this JSON (no extra keys, no markdown):
{
  "overallAssessment": "<2-3 sentence executive summary of the table's health, bottlenecks, and urgency>",
  "healthGrade": "<A|B|C|D|F>",
  "primaryBottleneck": "<single most impactful root cause right now>",
  "riskLevel": "<critical|high|medium|low>",
  "quickWins": [
    { "title": "<action>", "impact": "<high|medium|low>", "effort": "<minutes|hours|days>", "rationale": "<why this first>" }
  ],
  "rootCauses": [
    { "cause": "<root cause>", "evidence": "<what metric reveals it>", "recommendation": "<specific fix>" }
  ],
  "workloadProfile": "<OLTP|OLAP|Mixed|Write-heavy|Read-heavy — inferred from the stats>",
  "tuningRecommendations": [
    { "parameter": "<postgresql.conf param or table option>", "currentEstimate": "<likely current value>", "suggestedValue": "<recommended value>", "reason": "<why>" }
  ],
  "vacuumStrategy": "<concrete vacuum/autovacuum strategy recommendation for this specific table>",
  "indexStrategy": "<concrete index recommendation based on scan ratios>",
  "longTermRisks": ["<risk 1>", "<risk 2>", "<risk 3>"],
  "estimatedImprovementPct": <0-100 number — estimated query performance improvement if top fixes applied>
}`;

            const data = await postData('/api/ai/chat', {
                max_tokens: 2000,
                system,
                messages: [{ role: 'user', content: prompt }],
            });

            const raw = data.content?.map(b => b.text || '').join('') || '';
            // Strip markdown fences that Llama/Groq often adds despite instructions
            const stripped = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
            const match = stripped.match(/\{[\s\S]*\}/);
            if (!match) throw new Error('AI returned a non-JSON response. Please try again.');
            setResult(JSON.parse(match[0]));
        } catch (e) {
            const msg = e.message || '';
            // Sanitise: never expose API key names or vendor details
            const clean = msg.includes('not configured') || msg.includes('API key') || msg.includes('503')
                ? 'AI analysis is not enabled. Ask your administrator to configure the AI key in the backend settings.'
                : msg.includes('non-JSON')
                ? 'Received an unexpected response. Please try again.'
                : `Analysis failed. Please try again.`;
            setError(clean);
        } finally {
            setLoading(false);
        }
    }, []);

    return { loading, result, error, analyze, reset: () => { setResult(null); setError(null); } };
};

/* ═══════════ AI RESULT RENDERER ═══════════ */
const AIAnalysisResult = ({ result, tableName }) => {
    const gradeColor = g => ({ A: THEME.success, B: THEME.success, C: THEME.warning, D: THEME.danger, F: THEME.danger }[g] || THEME.textDim);
    const riskColor  = r => ({ critical: THEME.danger, high: THEME.danger, medium: THEME.warning, low: THEME.success }[r] || THEME.textDim);
    const impactColor = i => ({ high: THEME.danger, medium: THEME.warning, low: THEME.success }[i] || THEME.textDim);
    const effortColor = e => ({ minutes: THEME.success, hours: THEME.warning, days: THEME.danger }[e] || THEME.textDim);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>

            {/* Grade + Assessment */}
            <div style={{ borderRadius: 20, padding: 13, background: `${THEME.primary}04`, border: `1px solid ${THEME.primary}12`, display: 'flex', gap: 13, alignItems: 'flex-start' }}>
                <div style={{ flexShrink: 0, width: 54, height: 54, borderRadius: 18, background: `${gradeColor(result.healthGrade)}10`, border: `2px solid ${gradeColor(result.healthGrade)}30`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 24, fontWeight: 900, color: gradeColor(result.healthGrade), lineHeight: 1 }}>{result.healthGrade}</span>
                    <span style={{ fontSize: 7, fontWeight: 700, color: THEME.textDim,  letterSpacing: '.05em' }}>Grade</span>
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 10.5, fontWeight: 800, color: THEME.textMain }}>AI Assessment</span>
                        <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 16, background: `${riskColor(result.riskLevel)}10`, color: riskColor(result.riskLevel), border: `1px solid ${riskColor(result.riskLevel)}20` }}>{result.riskLevel} risk</span>
                        <span style={{ fontSize: 8, fontWeight: 600, padding: '2px 6px', borderRadius: 16, background: `${THEME.info}10`, color: THEME.info, border: `1px solid ${THEME.info}18` }}>{result.workloadProfile}</span>
                    </div>
                    <p style={{ fontSize: 10.5, color: THEME.textMuted, lineHeight: 1.55, margin: 0 }}>{result.overallAssessment}</p>
                    {result.estimatedImprovementPct > 0 && (
                        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <TrendingUp size={9} color={THEME.success} />
                            <span style={{ fontSize: 9.5, color: THEME.success, fontWeight: 700 }}>Up to {result.estimatedImprovementPct}% query performance improvement if top fixes applied</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Primary Bottleneck */}
            {result.primaryBottleneck && (
                <div style={{ borderRadius: 20, padding: 11, background: `${THEME.danger}04`, border: `1px solid ${THEME.danger}14`, display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                    <Crosshair size={13} color={THEME.danger} style={{ flexShrink: 0, marginTop: 1 }} />
                    <div>
                        <div style={{ fontSize: 8.5, fontWeight: 800, color: THEME.danger,  letterSpacing: '.05em', marginBottom: 3 }}>Primary Bottleneck</div>
                        <div style={{ fontSize: 10.5, color: THEME.textMain, lineHeight: 1.5 }}>{result.primaryBottleneck}</div>
                    </div>
                </div>
            )}

            {/* Quick Wins */}
            {result.quickWins?.length > 0 && (
                <div style={{ borderRadius: 20, padding: 11, background: THEME.surface, border: `1px solid ${THEME.glassBorder}28` }}>
                    <div style={{ fontSize: 8.5, fontWeight: 800, color: THEME.textDim,  letterSpacing: '.05em', marginBottom: 7, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Zap size={9} color={THEME.warning} />Quick Wins
                    </div>
                    {result.quickWins.map((w, i) => (
                        <div key={i} style={{ display: 'flex', gap: 9, padding: '6px 0', borderBottom: i < result.quickWins.length - 1 ? `1px solid ${THEME.glassBorder}14` : 'none' }}>
                            <span style={{ fontSize: 9, fontWeight: 800, color: THEME.textDim, width: 14, flexShrink: 0 }}>{i + 1}.</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2, flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: 10.5, fontWeight: 700, color: THEME.textMain }}>{w.title}</span>
                                    <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 16, background: `${impactColor(w.impact)}10`, color: impactColor(w.impact), border: `1px solid ${impactColor(w.impact)}18` }}>{w.impact} impact</span>
                                    <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 16, background: `${effortColor(w.effort)}10`, color: effortColor(w.effort), border: `1px solid ${effortColor(w.effort)}18` }}>{w.effort}</span>
                                </div>
                                <div style={{ fontSize: 9.5, color: THEME.textDim, lineHeight: 1.4 }}>{w.rationale}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Root Causes */}
            {result.rootCauses?.length > 0 && (
                <div style={{ borderRadius: 20, padding: 11, background: THEME.surface, border: `1px solid ${THEME.glassBorder}28` }}>
                    <div style={{ fontSize: 8.5, fontWeight: 800, color: THEME.textDim,  letterSpacing: '.05em', marginBottom: 7, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Brain size={9} color={THEME.primary} />Root Cause Analysis
                    </div>
                    {result.rootCauses.map((rc, i) => (
                        <div key={i} style={{ padding: '7px 0', borderBottom: i < result.rootCauses.length - 1 ? `1px solid ${THEME.glassBorder}14` : 'none' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                                <ArrowRight size={9} color={THEME.primary} />
                                <span style={{ fontSize: 10.5, fontWeight: 700, color: THEME.textMain }}>{rc.cause}</span>
                            </div>
                            <div style={{ paddingLeft: 14 }}>
                                <div style={{ fontSize: 9.5, color: THEME.textDim, marginBottom: 2 }}>
                                    <span style={{ fontWeight: 700, color: THEME.info }}>Evidence: </span>{rc.evidence}
                                </div>
                                <div style={{ fontSize: 9.5, color: THEME.textMuted }}>
                                    <span style={{ fontWeight: 700, color: THEME.success }}>Fix: </span>{rc.recommendation}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Vacuum + Index strategy side by side */}
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                {result.vacuumStrategy && (
                    <div style={{ flex: 1, minWidth: 180, borderRadius: 20, padding: 11, background: THEME.surface, border: `1px solid ${THEME.glassBorder}28` }}>
                        <div style={{ fontSize: 8.5, fontWeight: 800, color: THEME.textDim,  letterSpacing: '.05em', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Settings size={9} color={THEME.warning} />Vacuum Strategy
                        </div>
                        <p style={{ fontSize: 10, color: THEME.textMuted, lineHeight: 1.5, margin: 0 }}>{result.vacuumStrategy}</p>
                    </div>
                )}
                {result.indexStrategy && (
                    <div style={{ flex: 1, minWidth: 180, borderRadius: 20, padding: 11, background: THEME.surface, border: `1px solid ${THEME.glassBorder}28` }}>
                        <div style={{ fontSize: 8.5, fontWeight: 800, color: THEME.textDim,  letterSpacing: '.05em', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Layers size={9} color={THEME.info} />Index Strategy
                        </div>
                        <p style={{ fontSize: 10, color: THEME.textMuted, lineHeight: 1.5, margin: 0 }}>{result.indexStrategy}</p>
                    </div>
                )}
            </div>

            {/* Tuning Recommendations */}
            {result.tuningRecommendations?.length > 0 && (
                <div style={{ borderRadius: 20, padding: 11, background: THEME.surface, border: `1px solid ${THEME.glassBorder}28` }}>
                    <div style={{ fontSize: 8.5, fontWeight: 800, color: THEME.textDim,  letterSpacing: '.05em', marginBottom: 7, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Gauge size={9} color={THEME.primary} />Config Tuning
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: '3px 8px', marginBottom: 4 }}>
                            {['Parameter', 'Current est.', 'Suggested'].map(h => (
                                <span key={h} style={{ fontSize: 7.5, fontWeight: 700, color: THEME.textDim,  letterSpacing: '.04em' }}>{h}</span>
                            ))}
                        </div>
                        {result.tuningRecommendations.map((tr, i) => (
                            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: '3px 8px', padding: '5px 0', borderTop: `1px solid ${THEME.glassBorder}12` }}>
                                <span style={{ fontSize: 9.5, fontWeight: 700, color: THEME.primary, fontFamily: THEME.fontMono }}>{tr.parameter}</span>
                                <span style={{ fontSize: 9, color: THEME.textDim, fontFamily: THEME.fontMono }}>{tr.currentEstimate}</span>
                                <span style={{ fontSize: 9, color: THEME.success, fontWeight: 700, fontFamily: THEME.fontMono }}>{tr.suggestedValue}</span>
                                {tr.reason && (
                                    <div style={{ gridColumn: '1 / -1', fontSize: 9, color: THEME.textDim, lineHeight: 1.4, paddingBottom: 2 }}>{tr.reason}</div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Long-term Risks */}
            {result.longTermRisks?.length > 0 && (
                <div style={{ borderRadius: 20, padding: 11, background: `${THEME.warning}03`, border: `1px solid ${THEME.warning}12` }}>
                    <div style={{ fontSize: 8.5, fontWeight: 800, color: THEME.textDim,  letterSpacing: '.05em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <TriangleAlert size={9} color={THEME.warning} />Long-term Risks
                    </div>
                    {result.longTermRisks.map((risk, i) => (
                        <div key={i} style={{ display: 'flex', gap: 7, padding: '3px 0' }}>
                            <span style={{ fontSize: 8, color: THEME.warning, fontWeight: 800, flexShrink: 0, marginTop: 1 }}>→</span>
                            <span style={{ fontSize: 10, color: THEME.textMuted, lineHeight: 1.4 }}>{risk}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

/* ══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════════════ */
const AdvancedAnalysisPanel = ({table, resolvedOptimizations: rawResolved, onMarkResolved, onUnmarkResolved}) => {
    useAdaptiveTheme(); // keeps THEME in sync with dark/light toggle
    const resolvedOptimizations = useMemo(() => {
        if (rawResolved instanceof Set) return rawResolved;
        if (Array.isArray(rawResolved)) return new Set(rawResolved);
        return new Set();
    }, [rawResolved]);

    const [activeTab, setActiveTab] = useState('overview');
    const [masterCopied, setMasterCopied] = useState(false);
    const [masterExpanded, setMasterExpanded] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [severityFilter, setSeverityFilter] = useState('all');
    const [sortBy, setSortBy] = useState('severity');
    const [showResolved, setShowResolved] = useState(true);

    // AI analysis
    const ai = useTableAI();

    const t = table || {};
    const tableName = t.table_name || 'unknown';
    const bloatPct = t.bloat_ratio_pct ?? 0;
    const deadTuples = t.dead_tuples ?? 150;
    const cacheHit = t.cache_hit_ratio ?? 99.8;
    const sizeGb = Number(t.total_size_gb ?? 0);
    const idxSizeGb = Number(t.index_size_gb ?? sizeGb * 0.28);
    const rowCount = t.row_count ?? 0;
    const lastVacuum = t.last_autovacuum ?? null;
    const seqScans = t.seq_scan ?? 0;
    const idxScans = t.idx_scan ?? 0;
    const idxRatio = idxScans / Math.max(seqScans + idxScans, 1) * 100;
    const lockWaits = t.lock_waits ?? null;
    const connActive = t.active_connections ?? null;
    const connIdle = t.idle_connections ?? null;
    const tupUpd = t.n_tup_upd ?? null;
    const hotRatio = t.n_tup_hot_upd ? (t.n_tup_hot_upd / Math.max(t.n_tup_upd, 1) * 100) : null;
    const tupIns = t.n_tup_ins ?? null;
    const tupDel = t.n_tup_del ?? null;
    const avgQMs = t.avg_query_time_ms ?? null;
    const txPerSec = t.transactions_per_sec ?? null;
    const checkpointReq = t.checkpoints_req ?? null;

    const spCache = useMemo(() => genSpark(cacheHit, 0.03), [cacheHit]);
    const spDead = useMemo(() => genSpark(deadTuples, 0.5), [deadTuples]);
    const spBloat = useMemo(() => genSpark(bloatPct, 0.3), [bloatPct]);
    const spIdx = useMemo(() => genSpark(idxRatio, 0.15), [idxRatio]);

    const healthScore = useMemo(() => {
        let s = 100;
        if (bloatPct > 50) s -= 30; else if (bloatPct > 20) s -= 15; else if (bloatPct > 5) s -= 5;
        if (cacheHit < 95) s -= 25; else if (cacheHit < 99) s -= 10;
        if (deadTuples > 5000) s -= 20; else if (deadTuples > 1000) s -= 10; else if (deadTuples > 200) s -= 3;
        if (idxRatio < 50) s -= 15; else if (idxRatio < 80) s -= 5;
        if (lockWaits > 10) s -= 10;
        if (hotRatio != null && hotRatio < 30) s -= 5;
        if (checkpointReq > 100) s -= 5;
        return clamp(Math.round(s), 0, 100);
    }, [bloatPct, cacheHit, deadTuples, idxRatio, lockWaits, hotRatio, checkpointReq]);

    const radarMetrics = useMemo(() => [
        {label:'Cache',value:cacheHit,color:cacheHit>=99?THEME.success:THEME.warning},
        {label:'Idx%',value:idxRatio,color:idxRatio>=80?THEME.success:THEME.warning},
        {label:'Bloat',value:Math.max(100-bloatPct,0),color:bloatPct<10?THEME.success:THEME.danger},
        {label:'Vacuum',value:deadTuples<200?90:deadTuples<1000?60:25,color:deadTuples<500?THEME.success:THEME.warning},
        {label:'HOT',value:hotRatio??70,color:(hotRatio??70)>50?THEME.success:THEME.warning},
        {label:'Health',value:healthScore,color:healthScore>=80?THEME.success:THEME.danger},
    ], [cacheHit, idxRatio, bloatPct, deadTuples, hotRatio, healthScore]);

    /* ══════════ SUGGESTIONS ENGINE (18+ optimizations) ══════════ */
    const suggestions = useMemo(() => {
        const L = [];
        // 1. VACUUM FULL
        if (bloatPct > 50) L.push({id:'vacuum_full',category:'bloat',icon:RefreshCw,title:'VACUUM FULL — reclaim bloated space',description:`${bloatPct}% bloat ≈ ${fmtSize(sizeGb*bloatPct/100)} dead space. Rewrites entire table.`,severity:'critical',impact:10,savings:fmtSize(sizeGb*bloatPct/100),estimatedTime:`${Math.ceil(sizeGb*3)}+ min`,risks:'ACCESS EXCLUSIVE lock',prerequisites:'Maintenance window',
            sql:`-- ⚠ ACCESS EXCLUSIVE lock — blocks ALL operations\n-- Recovery: ~${fmtSize(sizeGb*bloatPct/100)}\n\nSELECT pg_size_pretty(pg_total_relation_size('${tableName}')) AS before_size;\nVACUUM FULL ANALYZE ${tableName};\nSELECT pg_size_pretty(pg_total_relation_size('${tableName}')) AS after_size;\nANALYZE ${tableName};`});
        else if (bloatPct > 5) L.push({id:'vacuum',category:'bloat',icon:RefreshCw,title:'VACUUM — clean dead tuples',description:`${bloatPct}% bloat, ~${fmtNum(deadTuples)} dead tuples. Non-blocking.`,severity:bloatPct>20?'high':'medium',impact:7,savings:fmtSize(sizeGb*bloatPct/100),estimatedTime:`${Math.ceil(sizeGb*.5)} min`,
            sql:`VACUUM (VERBOSE, ANALYZE) ${tableName};\n\nSELECT n_dead_tup, n_live_tup,\n       round(n_dead_tup::numeric / NULLIF(n_live_tup+n_dead_tup,0)*100,2) AS dead_pct\nFROM pg_stat_user_tables WHERE relname='${tableName}';`});
        // 2. pg_repack
        if (bloatPct > 30) L.push({id:'pg_repack',category:'bloat',icon:Wrench,title:'pg_repack — zero-downtime bloat removal',description:'Online table rewrite. Production-safe VACUUM FULL alternative.',severity:'high',impact:9,savings:fmtSize(sizeGb*bloatPct/100),estimatedTime:`${Math.ceil(sizeGb*5)} min`,prerequisites:'pg_repack extension',
            sql:`CREATE EXTENSION IF NOT EXISTS pg_repack;\npg_repack --host=localhost --dbname=your_db --table=${tableName} --no-kill-backend\n\n-- Or SQL:\nSELECT repack.repack_table('public.${tableName}');\nSELECT pg_size_pretty(pg_total_relation_size('${tableName}')) AS after;`});
        // 3. REINDEX
        if (idxSizeGb > 0.05 || bloatPct > 10 || deadTuples > 500) L.push({id:'reindex',category:'index',icon:Layers,title:'REINDEX CONCURRENTLY — remove index bloat',description:`Index: ${fmtSize(idxSizeGb)}. Bloated indexes waste shared_buffers.`,severity:bloatPct>30?'high':'medium',impact:7,savings:fmtSize(idxSizeGb*.4),estimatedTime:`${Math.ceil(idxSizeGb*10)} min`,
            sql:`REINDEX TABLE CONCURRENTLY ${tableName};\n\n-- Index report:\nSELECT indexname, pg_size_pretty(pg_relation_size(indexrelid)) AS size,\n       idx_scan, idx_tup_read\nFROM pg_stat_user_indexes WHERE relname='${tableName}'\nORDER BY pg_relation_size(indexrelid) DESC;\n\n-- Unused (drop candidates):\nSELECT indexname, idx_scan, pg_size_pretty(pg_relation_size(indexrelid)) AS size\nFROM pg_stat_user_indexes\nWHERE relname='${tableName}' AND idx_scan=0\nORDER BY pg_relation_size(indexrelid) DESC;`});
        // 4. BRIN
        if (sizeGb > 0.05) L.push({id:'brin_index',category:'index',icon:Network,title:'BRIN index for time-series columns',description:'~90% smaller than B-Tree for ordered data. Ideal for timestamps/IDs.',severity:'medium',impact:6,savings:fmtSize(idxSizeGb*.88),
            sql:`CREATE INDEX CONCURRENTLY idx_${tableName}_brin\n    ON ${tableName} USING BRIN (created_at)\n    WITH (pages_per_range=128);\n\nEXPLAIN (ANALYZE, BUFFERS) SELECT * FROM ${tableName}\nWHERE created_at > NOW() - INTERVAL '1 day';`});
        // 5. Partial
        if (rowCount > 10000) L.push({id:'partial_index',category:'index',icon:Database,title:'Partial index for filtered queries',description:'Index only matching rows — much smaller & faster.',severity:'medium',impact:7,
            sql:`CREATE INDEX CONCURRENTLY idx_${tableName}_active\n    ON ${tableName} (id, created_at)\n    WHERE status IN ('active','pending');\n\nEXPLAIN (ANALYZE, BUFFERS)\nSELECT * FROM ${tableName}\nWHERE status='active' AND created_at > NOW()-INTERVAL '7 days';`});
        // 6. Covering
        if (rowCount > 50000) L.push({id:'covering_index',category:'index',icon:Boxes,title:'Covering index (INCLUDE) — index-only scans',description:'Serves queries entirely from index, zero heap lookups.',severity:'medium',impact:6,
            sql:`CREATE INDEX CONCURRENTLY idx_${tableName}_cover\n    ON ${tableName} (status, created_at)\n    INCLUDE (id, updated_at);\n\nEXPLAIN (ANALYZE, BUFFERS) SELECT id, status, created_at, updated_at\nFROM ${tableName} WHERE status='active'\n  AND created_at > NOW()-INTERVAL '30 days';`});
        // 7. Expression index
        if (rowCount > 50000) L.push({id:'expression_index',category:'index',icon:Hash,title:'Expression index for computed filters',description:'If queries use LOWER(), date_trunc(), or casts in WHERE, create an expression index.',severity:'low',impact:5,
            sql:`-- Example: case-insensitive email lookup\nCREATE INDEX CONCURRENTLY idx_${tableName}_email_lower\n    ON ${tableName} (LOWER(email));\n\n-- Date truncation for daily aggregates:\nCREATE INDEX CONCURRENTLY idx_${tableName}_day\n    ON ${tableName} (date_trunc('day', created_at));\n\nEXPLAIN (ANALYZE) SELECT * FROM ${tableName}\nWHERE LOWER(email) = 'user@example.com';`});
        // 8. Unused indexes
        L.push({id:'unused_indexes',category:'index',icon:Search,title:'Detect & remove unused indexes',description:'Unused indexes waste disk, slow writes, increase WAL.',severity:idxSizeGb>0.1?'medium':'low',impact:5,savings:fmtSize(idxSizeGb*.2),
            sql:`SELECT indexrelname, pg_size_pretty(pg_relation_size(indexrelid)) AS size,\n       idx_scan, idx_tup_read\nFROM pg_stat_user_indexes\nWHERE relname='${tableName}' AND idx_scan=0\nORDER BY pg_relation_size(indexrelid) DESC;\n\n-- Check FK constraints:\nSELECT conname, contype, conindid::regclass\nFROM pg_constraint WHERE conrelid='${tableName}'::regclass;`});
        // 9. Duplicate indexes
        L.push({id:'duplicate_indexes',category:'index',icon:Combine,title:'Find duplicate & overlapping indexes',description:'Multiple indexes on same columns waste space and slow DML.',severity:'low',impact:4,
            sql:`-- Find indexes with identical column sets:\nSELECT array_agg(indexname) AS duplicate_indexes,\n       string_agg(pg_size_pretty(pg_relation_size(indexrelid)), ', ') AS sizes\nFROM pg_stat_user_indexes\nJOIN pg_index ON indexrelid = pg_stat_user_indexes.indexrelid\nWHERE relname='${tableName}'\nGROUP BY indkey\nHAVING count(*) > 1;\n\n-- Overlapping (prefix) indexes:\nSELECT a.indexname AS wider, b.indexname AS narrower,\n       pg_size_pretty(pg_relation_size(a.indexrelid)) AS wider_size\nFROM pg_index a\nJOIN pg_index b ON a.indrelid = b.indrelid\n  AND a.indexrelid != b.indexrelid\n  AND a.indkey::text LIKE b.indkey::text || '%'\nWHERE a.indrelid = '${tableName}'::regclass;`});
        // 10. Seq scan
        if (idxRatio < 50 && seqScans > 1000) L.push({id:'seq_scan',category:'query',icon:BarChart3,title:`${Math.round(100-idxRatio)}% seq scans — missing indexes`,description:`Only ${Math.round(idxRatio)}% use indexes.`,severity:'high',impact:9,
            sql:`-- Slow queries (pg_stat_statements):\nSELECT query, calls, mean_exec_time::numeric(10,2) AS mean_ms,\n       total_exec_time::numeric(10,2) AS total_ms,\n       shared_blks_hit, shared_blks_read\nFROM pg_stat_statements WHERE query ILIKE '%${tableName}%'\nORDER BY mean_exec_time DESC LIMIT 10;\n\n-- Column stats:\nSELECT attname, n_distinct, correlation\nFROM pg_stats WHERE tablename='${tableName}' ORDER BY n_distinct;`});
        // 11. Dead tuples
        if (deadTuples > 500) L.push({id:'dead_tuples',category:'vacuum',icon:RefreshCw,title:`${fmtNum(deadTuples)} dead tuples`,description:'Dead tuples slow scans and bloat indexes.',severity:deadTuples>5000?'high':deadTuples>1000?'medium':'low',impact:deadTuples>5000?8:5,
            sql:`VACUUM (VERBOSE, ANALYZE) ${tableName};\n\nSELECT relname, n_live_tup, n_dead_tup,\n       round(n_dead_tup::numeric/NULLIF(n_live_tup+n_dead_tup,0)*100,2) AS dead_pct,\n       last_autovacuum, last_vacuum\nFROM pg_stat_user_tables WHERE relname='${tableName}';\n\n-- Blocking txns?\nSELECT pid, now()-xact_start AS duration, state, query\nFROM pg_stat_activity WHERE xact_start IS NOT NULL AND state!='idle'\nORDER BY duration DESC;\n\n-- Replication slots?\nSELECT slot_name, active FROM pg_replication_slots;`});
        // 12. Cache
        if (cacheHit < 99) L.push({id:'cache',category:'performance',icon:Activity,title:`Cache hit ${fmtPct(cacheHit)} < 99% target`,description:'Excess disk I/O. Tune shared_buffers.',severity:cacheHit<95?'critical':cacheHit<97?'high':'medium',impact:cacheHit<95?10:7,
            sql:`SELECT relname, heap_blks_read, heap_blks_hit,\n    round(heap_blks_hit::numeric/NULLIF(heap_blks_hit+heap_blks_read,0)*100,2) AS hit_pct\nFROM pg_statio_user_tables WHERE relname='${tableName}';\n\n-- Tuning:\n-- shared_buffers       = ${Math.max(4,Math.ceil(sizeGb*4))}GB\n-- effective_cache_size = ${Math.max(12,Math.ceil(sizeGb*12))}GB\n-- work_mem             = 64MB\n-- maintenance_work_mem = 1GB`});
        // 13. Autovacuum
        L.push({id:'autovacuum',category:'vacuum',icon:Settings,title:'Tune per-table autovacuum',description:'Default 20% is too lazy for OLTP tables.',severity:deadTuples>1000?'high':deadTuples>200?'medium':'low',impact:6,estimatedTime:'Instant',
            sql:`ALTER TABLE ${tableName} SET (\n    autovacuum_vacuum_scale_factor=0.01,\n    autovacuum_analyze_scale_factor=0.005,\n    autovacuum_vacuum_cost_delay=2,\n    autovacuum_vacuum_cost_limit=1000,\n    autovacuum_vacuum_threshold=50\n);\n\nSELECT relname, reloptions FROM pg_class WHERE relname='${tableName}';\nSELECT pid, relid::regclass, phase FROM pg_stat_progress_vacuum;`});
        // 14. Statistics
        L.push({id:'statistics',category:'query',icon:BarChart3,title:'Increase statistics target',description:'Better estimates → better plans.',severity:'low',impact:4,
            sql:`ALTER TABLE ${tableName}\n    ALTER COLUMN id SET STATISTICS 500,\n    ALTER COLUMN created_at SET STATISTICS 500;\nANALYZE ${tableName};\n\nSELECT attname, n_distinct, correlation\nFROM pg_stats WHERE tablename='${tableName}';`});
        // 15. Partitioning
        if (rowCount > 1000000 || sizeGb > 1) L.push({id:'partitioning',category:'performance',icon:Table2,title:'Table partitioning',description:`${fmtNum(rowCount)} rows/${fmtSize(sizeGb)} — partition by range.`,severity:sizeGb>5?'high':'medium',impact:8,estimatedTime:'Hours',risks:'Schema change',prerequisites:'Backup first',
            sql:`CREATE TABLE ${tableName}_part (LIKE ${tableName} INCLUDING ALL)\n    PARTITION BY RANGE (created_at);\nCREATE TABLE ${tableName}_y2025m01 PARTITION OF ${tableName}_part\n    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');\nCREATE TABLE ${tableName}_default PARTITION OF ${tableName}_part DEFAULT;\n\nINSERT INTO ${tableName}_part SELECT * FROM ${tableName};\nALTER TABLE ${tableName} RENAME TO ${tableName}_old;\nALTER TABLE ${tableName}_part RENAME TO ${tableName};\nSET enable_partition_pruning=on;`});
        // 16. Lock contention
        if (lockWaits > 0 || connActive > 50) L.push({id:'lock_contention',category:'performance',icon:Lock,title:`Lock contention (${lockWaits||'?'} waits)`,description:'Queries blocked by locks.',severity:lockWaits>10?'high':'medium',impact:8,
            sql:`SELECT blocked.pid, blocked.query AS blocked_query,\n       blocking.pid AS blocker_pid, blocking.query,\n       now()-blocked.query_start AS wait\nFROM pg_stat_activity blocked\nJOIN pg_locks bl ON bl.pid=blocked.pid AND NOT bl.granted\nJOIN pg_locks gl ON gl.locktype=bl.locktype AND gl.database IS NOT DISTINCT FROM bl.database\n    AND gl.relation IS NOT DISTINCT FROM bl.relation AND gl.pid!=bl.pid AND gl.granted\nJOIN pg_stat_activity blocking ON blocking.pid=gl.pid\nORDER BY wait DESC;\n\nSET lock_timeout='5s';`});
        // 17. HOT updates
        if (hotRatio != null && hotRatio < 50 && tupUpd > 1000) L.push({id:'hot_updates',category:'performance',icon:Zap,title:`Low HOT ratio (${fmtPct(hotRatio)})`,description:'Lower fillfactor to enable more HOT updates.',severity:'medium',impact:6,
            sql:`SELECT relname, n_tup_upd, n_tup_hot_upd,\n    round(n_tup_hot_upd::numeric/NULLIF(n_tup_upd,0)*100,1) AS hot_pct\nFROM pg_stat_user_tables WHERE relname='${tableName}';\n\nALTER TABLE ${tableName} SET (fillfactor=80);\nVACUUM FULL ${tableName};`});
        // 18. WAL/Checkpoint
        if (sizeGb > 0.5 || tupUpd > 10000) L.push({id:'wal_checkpoint',category:'performance',icon:GitBranch,title:'WAL & checkpoint tuning',description:'Reduce I/O spikes from checkpoints.',severity:'low',impact:5,
            sql:`SELECT checkpoints_timed, checkpoints_req,\n       checkpoint_write_time, checkpoint_sync_time\nFROM pg_stat_bgwriter;\n\n-- Tuning: max_wal_size=4GB, checkpoint_timeout=15min`});
        // 19. TOAST
        if (sizeGb > 0.2) L.push({id:'toast',category:'performance',icon:Rows3,title:'TOAST compression check',description:'Verify compression for large columns.',severity:'low',impact:3,
            sql:`SELECT c.relname, pg_size_pretty(pg_relation_size(c.oid)) AS tbl,\n       t.relname AS toast, pg_size_pretty(pg_relation_size(t.oid)) AS toast_size\nFROM pg_class c JOIN pg_class t ON t.oid=c.reltoastrelid\nWHERE c.relname='${tableName}';\n\n-- PG14+: ALTER TABLE ${tableName} ALTER COLUMN col SET COMPRESSION lz4;`});
        // 20. Parallel
        if (sizeGb > 0.5 || rowCount > 500000) L.push({id:'parallel_query',category:'query',icon:Cpu,title:'Parallel query execution',description:'Leverage multiple workers for large scans.',severity:'low',impact:5,
            sql:`SHOW max_parallel_workers_per_gather;\nALTER TABLE ${tableName} SET (parallel_workers=4);\nEXPLAIN (ANALYZE) SELECT count(*) FROM ${tableName};`});
        // 21. Connection pool
        if (connActive > 20 || connIdle > 50) L.push({id:'conn_pool',category:'performance',icon:ArrowRightLeft,title:`High connections (${connActive||'?'}/${connIdle||'?'})`,description:'Each conn ≈ 10MB. Use PgBouncer.',severity:connActive>100?'high':'medium',impact:7,
            sql:`SELECT state, count(*) FROM pg_stat_activity GROUP BY state;\nSHOW max_connections;\n\n-- PgBouncer: pool_mode=transaction, default_pool_size=20`});
        // 22. pg_stat_statements
        L.push({id:'pg_stat_statements',category:'query',icon:BookOpen,title:'Enable pg_stat_statements',description:'Essential query profiling extension.',severity:'low',impact:5,
            sql:`-- postgresql.conf: shared_preload_libraries='pg_stat_statements'\nCREATE EXTENSION IF NOT EXISTS pg_stat_statements;\n\nSELECT query, calls, mean_exec_time::numeric(10,2) AS mean_ms,\n       total_exec_time::numeric(10,2) AS total_ms\nFROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;`});
        // 23. XID freeze
        if (rowCount > 100000) L.push({id:'xid_freeze',category:'vacuum',icon:Shield,title:'XID freeze check',description:'Prevent transaction wraparound.',severity:'low',impact:4,
            sql:`SELECT relname, age(relfrozenxid) AS xid_age,\n       round(age(relfrozenxid)::numeric/2147483647*100,2) AS pct\nFROM pg_class WHERE relkind='r' AND relname='${tableName}';\n\nVACUUM (FREEZE, VERBOSE) ${tableName};`});
        // 24. Materialized view
        if (rowCount > 500000 && seqScans > 500) L.push({id:'matview',category:'query',icon:ListTree,title:'Consider materialized view for heavy aggregations',description:'Pre-compute expensive aggregates. Refresh periodically.',severity:'low',impact:6,
            sql:`-- Example: pre-computed daily stats\nCREATE MATERIALIZED VIEW mv_${tableName}_daily AS\nSELECT date_trunc('day', created_at) AS day,\n       count(*) AS cnt, avg(amount) AS avg_amount\nFROM ${tableName}\nGROUP BY 1\nWITH DATA;\n\nCREATE UNIQUE INDEX ON mv_${tableName}_daily (day);\n\n-- Refresh (concurrent = no lock):\nREFRESH MATERIALIZED VIEW CONCURRENTLY mv_${tableName}_daily;`});
        // 25. Row-level security
        if (rowCount > 10000) L.push({id:'rls_check',category:'performance',icon:Fingerprint,title:'Row-Level Security performance check',description:'RLS policies add per-row overhead. Verify they use indexed columns.',severity:'low',impact:3,
            sql:`-- Check if RLS is enabled:\nSELECT relname, relrowsecurity, relforcerowsecurity\nFROM pg_class WHERE relname='${tableName}';\n\n-- List RLS policies:\nSELECT polname, polcmd, polroles::regrole[], polqual, polwithcheck\nFROM pg_policy WHERE polrelid='${tableName}'::regclass;\n\n-- Ensure policy conditions use indexed columns for performance.`});
        return L;
    }, [tableName,bloatPct,deadTuples,cacheHit,sizeGb,idxSizeGb,rowCount,idxRatio,seqScans,idxScans,lockWaits,connActive,connIdle,hotRatio,tupUpd]);

    const filtered = useMemo(() => {
        let l = [...suggestions];
        if (!showResolved) l = l.filter(s => !resolvedOptimizations.has(s.id));
        if (searchQuery) { const q = searchQuery.toLowerCase(); l = l.filter(s => s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.category.includes(q)); }
        if (severityFilter !== 'all') l = l.filter(s => s.severity === severityFilter);
        if (sortBy === 'severity') l.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);
        else if (sortBy === 'impact') l.sort((a, b) => (b.impact || 0) - (a.impact || 0));
        else if (sortBy === 'category') l.sort((a, b) => a.category.localeCompare(b.category));
        return l;
    }, [suggestions, searchQuery, severityFilter, sortBy, showResolved, resolvedOptimizations]);

    const masterScript = useMemo(() => {
        const h = `-- ════════════════════════════════════════════════════════════\n-- FATHOM MASTER OPTIMIZATION SCRIPT v5\n-- Table: ${tableName} | Health: ${healthScore}/100\n-- ${new Date().toISOString().slice(0,19).replace('T',' ')} UTC\n-- Bloat: ${bloatPct}% | Dead: ${fmtNum(deadTuples)} | Cache: ${fmtPct(cacheHit)}\n-- Size: ${fmtSize(sizeGb)} (idx: ${fmtSize(idxSizeGb)}) | Rows: ${fmtNum(rowCount)}\n-- ⚠ REVIEW BEFORE PRODUCTION\n-- ════════════════════════════════════════════════════════════\n`;
        const s = suggestions.map((s, i) => `\n-- [${i+1}/${suggestions.length}] [${s.severity.toUpperCase()}] ${s.title}\n-- Impact: ${s.impact||'?'}/10${s.estimatedTime?` | Est: ${s.estimatedTime}`:''}${s.risks?`\n-- ⚠ ${s.risks}`:''}\n${s.sql}`).join('\n');
        const f = `\n\n-- ══ VERIFICATION ══\nSELECT pg_size_pretty(pg_total_relation_size('${tableName}')) AS total,\n       pg_size_pretty(pg_relation_size('${tableName}')) AS tbl,\n       pg_size_pretty(pg_indexes_size('${tableName}')) AS idx;\n\nSELECT n_live_tup, n_dead_tup, seq_scan, idx_scan,\n       round(idx_scan::numeric/NULLIF(seq_scan+idx_scan,0)*100,1) AS idx_pct,\n       last_vacuum, last_autovacuum\nFROM pg_stat_user_tables WHERE relname='${tableName}';`;
        return h + s + f;
    }, [suggestions, tableName, bloatPct, deadTuples, cacheHit, sizeGb, idxSizeGb, rowCount, healthScore]);

    const tabs = [
        {id:'overview',label:'Overview',icon:Eye,cnt:null},
        {id:'performance',label:'Perf',icon:Zap,cnt:suggestions.filter(s=>['performance','query'].includes(s.category)).length},
        {id:'index',label:'Indexes',icon:Layers,cnt:suggestions.filter(s=>s.category==='index').length},
        {id:'vacuum',label:'Vacuum',icon:Settings,cnt:suggestions.filter(s=>['vacuum','bloat'].includes(s.category)).length},
        {id:'insights',label:'Insights',icon:LineChart,cnt:null},
        {id:'all',label:'All',icon:Filter,cnt:suggestions.length},
        {id:'script',label:'Script',icon:Terminal,cnt:suggestions.length},
        {id:'ai',label:'AI',icon:Brain,cnt:null,highlight:true},
    ];

    const tabSugs = useMemo(() => {
        if (activeTab === 'performance') return filtered.filter(s => ['performance','query'].includes(s.category));
        if (activeTab === 'index') return filtered.filter(s => s.category === 'index');
        if (activeTab === 'vacuum') return filtered.filter(s => ['vacuum','bloat'].includes(s.category));
        if (activeTab === 'all') return filtered;
        return [];
    }, [activeTab, filtered]);

    const hiCnt = suggestions.filter(s => s.severity === 'high' || s.severity === 'critical').length;
    const resCnt = suggestions.filter(s => resolvedOptimizations.has(s.id)).length;

    /* ══════════ RENDER ══════════ */
    return (
        <div style={{background:THEME.surface,border:`1px solid ${THEME.glassBorder}`,borderRadius:16,overflow:'hidden',display:'flex',flexDirection:'column'}}>
            <AnimCSS/>

            {/* Header */}
            <div style={{padding:'13px 16px',borderBottom:`1px solid ${THEME.glassBorder}`,display:'flex',alignItems:'center',gap:11}}>
                <HealthGauge score={healthScore} size={54}/>
                <div style={{flex:1}}>
                    <div style={{fontSize:10.5,fontWeight:800,color:THEME.textMain,letterSpacing:'0.02em'}}>Deep Analysis: <span style={{color:THEME.primary}}>{tableName}</span></div>
                    <div style={{fontSize:9.5,color:THEME.textDim,marginTop:2}}>
                        {suggestions.length} optimizations{hiCnt>0&&<span style={{color:THEME.danger,fontWeight:700}}> · {hiCnt} critical/high</span>}{resCnt>0&&<span style={{color:THEME.success,fontWeight:700}}> · {resCnt} resolved</span>}
                    </div>
                    <div style={{display:'flex',gap:1,marginTop:4,height:3,borderRadius:2,overflow:'hidden'}}>
                        {['critical','high','medium','low'].map(sv=>{const c=suggestions.filter(s=>s.severity===sv).length;return c?<div key={sv} style={{flex:c,background:sevColor(sv),borderRadius:1}}/>:null;})}
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div style={{display:'flex',gap:5,padding:'9px 16px 0',flexWrap:'wrap'}}>
                <StatCell label="Cache" icon={Activity} value={fmtPct(cacheHit)} sub="Target >99%" color={cacheHit>=99?THEME.success:THEME.warning} warn={cacheHit<99} sparkData={spCache} badge={cacheHit<95?'!!':cacheHit<99?'!':null}/>
                <StatCell label="Dead" icon={RefreshCw} value={fmtNum(deadTuples)} sub="Tuples" color={deadTuples>1000?THEME.warning:THEME.success} warn={deadTuples>1000} sparkData={spDead}/>
                <StatCell label="Bloat" icon={HardDrive} value={fmtPct(bloatPct,0)} sub={`~${fmtSize(sizeGb*bloatPct/100)}`} color={bloatPct>30?THEME.danger:bloatPct>15?THEME.warning:THEME.success} warn={bloatPct>15} sparkData={spBloat}/>
                <StatCell label="Idx%" icon={Layers} value={fmtPct(idxRatio,0)} sub={`${fmtNum(seqScans)} seq`} color={idxRatio>=80?THEME.success:THEME.warning} warn={idxRatio<80} sparkData={spIdx}/>
            </div>

            {/* Tabs */}
            <div className="vsel" style={{display:'flex',gap:3,padding:'9px 16px 0',overflowX:'auto'}}>
                {tabs.map(tb=>{const on=activeTab===tb.id;const isAI=tb.id==='ai';return(
                    <button key={tb.id} onClick={()=>setActiveTab(tb.id)} style={{display:'inline-flex',alignItems:'center',gap:4,padding:'5px 9px',borderRadius: 18,border:'none',cursor:'pointer',fontSize:9.5,fontWeight:600,transition:'all .2s',whiteSpace:'nowrap',flexShrink:0,
                        background: on ? `linear-gradient(135deg,${THEME.primary},${THEME.secondary})` : isAI ? `linear-gradient(135deg,${THEME.primary}18,${THEME.secondary}12)` : THEME.surface,
                        color: on ? '#fff' : isAI ? THEME.primary : THEME.textMuted,
                        boxShadow: on ? `0 2px 8px ${THEME.primary}30` : isAI ? `0 0 0 1px ${THEME.primary}30` : 'none',
                        outline: on || isAI ? 'none' : `1px solid ${THEME.glassBorder}40`}}>
                        <tb.icon size={9}/>{tb.label}
                        {isAI && ai.result && !on && <span style={{width:5,height:5,borderRadius:'50%',background:THEME.success,marginLeft:1}}/>}
                        {tb.cnt!=null&&tb.cnt>0&&<span style={{fontSize:8,fontWeight:800,padding:'0 4px',borderRadius: 16,background:on?'rgba(255,255,255,.2)':`${THEME.primary}10`,color:on?'#fff':THEME.primary}}>{tb.cnt}</span>}
                    </button>
                );})}
            </div>

            {/* Content */}
            <div className="vsel" style={{padding:'11px 16px',flex:1,minHeight:0,overflowY:'auto'}}>

                {/* OVERVIEW */}
                {activeTab==='overview'&&<div className="vfade" style={{display:'flex',flexDirection:'column',gap:11}}>
                    <div style={{display:'flex',gap:11,alignItems:'stretch',flexWrap:'wrap'}}>
                        <div style={{borderRadius: 20,padding:9,background:THEME.surface,border:`1px solid ${THEME.glassBorder}28`,display:'flex',flexDirection:'column',alignItems:'center'}}>
                            <div style={{fontSize:8.5,fontWeight:700,color:THEME.textDim,marginBottom:2,letterSpacing:'0.02em'}}>Health Radar</div>
                            <HealthRadar metrics={radarMetrics} size={140}/>
                        </div>
                        <div style={{flex:1,minWidth:190,borderRadius: 20,padding:11,background:THEME.surface,border:`1px solid ${THEME.glassBorder}28`}}>
                            <div style={{fontSize:8.5,fontWeight:700,color:THEME.textDim,marginBottom:7,letterSpacing:'0.02em'}}>Table Profile</div>
                            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4px 12px'}}>
                                {[['Size',fmtSize(sizeGb)],['Indexes',fmtSize(idxSizeGb)],['Rows',fmtNum(rowCount)],['Seq Scans',fmtNum(seqScans)],['Idx Scans',fmtNum(idxScans)],['Last Vacuum',lastVacuum?new Date(lastVacuum).toLocaleDateString():'Never'],
                                    ...(tupIns!=null?[['Inserts',fmtNum(tupIns)]]:[]),(tupUpd!=null?[['Updates',fmtNum(tupUpd)]]:[]),(tupDel!=null?[['Deletes',fmtNum(tupDel)]]:[]),(hotRatio!=null?[['HOT%',fmtPct(hotRatio)]]:[]),(avgQMs!=null?[['Avg Query',fmtMs(avgQMs)]]:[]),(txPerSec!=null?[['TPS',fmtNum(txPerSec)]]:[])]
                                    .map(([k,v])=><div key={k} style={{display:'flex',justifyContent:'space-between'}}><span style={{fontSize:9,color:THEME.textDim}}>{k}</span><span style={{fontSize:9,fontWeight:700,color:THEME.textMain,fontVariantNumeric:'tabular-nums'}}>{v}</span></div>)}
                            </div>
                        </div>
                    </div>
                    <XidCheck t={t}/>
                    <BeforeAfterSim sizeGb={sizeGb} bloatPct={bloatPct} deadTuples={deadTuples} cacheHit={cacheHit} idxRatio={idxRatio} suggestions={suggestions}/>
                    <div style={{display:'flex',gap:11,flexWrap:'wrap'}}>
                        <div style={{flex:1,minWidth:210}}><RiskMatrix suggestions={suggestions}/></div>
                        <div style={{flex:1,minWidth:210}}><ExecTimeline suggestions={suggestions}/></div>
                    </div>
                    <div style={{display:'flex',gap:11,flexWrap:'wrap'}}>
                        <div style={{flex:1,minWidth:210}}><QueryPlanInsight tableName={tableName} seqScans={seqScans} idxScans={idxScans} rowCount={rowCount} sizeGb={sizeGb}/></div>
                        <div style={{flex:1,minWidth:210}}><IndexAdvisor tableName={tableName} idxSizeGb={idxSizeGb} rowCount={rowCount} seqScans={seqScans} idxScans={idxScans}/></div>
                    </div>
                    {/* Priority */}
                    <div style={{borderRadius: 20,padding:11,background:THEME.surface,border:`1px solid ${THEME.glassBorder}28`}}>
                        <div style={{fontSize:8.5,fontWeight:700,color:THEME.textDim,marginBottom:7,letterSpacing:'0.02em',display:'flex',alignItems:'center',gap:4}}><Flame size={9} color={THEME.danger}/>Priority Actions</div>
                        {suggestions.filter(s=>s.severity==='critical'||s.severity==='high').slice(0,6).map((s,i)=><div key={s.id} style={{display:'flex',alignItems:'center',gap:6,padding:'4px 0',borderBottom:i<5?`1px solid ${THEME.glassBorder}12`:'none'}}>
                            <span style={{fontSize:8.5,fontWeight:800,color:THEME.textDim,width:13}}>{i+1}.</span>
                            <s.icon size={9} color={sevColor(s.severity)}/>
                            <span style={{fontSize:10,fontWeight:600,color:THEME.textMain,flex:1}}>{s.title}</span>
                            <SevBadge sev={s.severity}/>
                            {s.savings&&<span style={{fontSize:8,color:THEME.success,fontWeight:700}}>↓{s.savings}</span>}
                        </div>)}
                    </div>
                </div>}

                {/* INSIGHTS */}
                {activeTab==='insights'&&<div className="vfade" style={{display:'flex',flexDirection:'column',gap:11}}>
                    <BloatForecast bloatPct={bloatPct} deadTuples={deadTuples}/>
                    <HealthTimeline healthScore={healthScore} bloatPct={bloatPct} cacheHit={cacheHit} deadTuples={deadTuples}/>
                    <WaitAnalysis t={t}/>
                    <div style={{display:'flex',gap:11,flexWrap:'wrap'}}>
                        <div style={{flex:1,minWidth:190}}><AreaChart data={spCache} color={cacheHit>=99?THEME.success:THEME.warning} label="Cache Hit" yFmt={v=>`${v.toFixed(1)}%`}/></div>
                        <div style={{flex:1,minWidth:190}}><AreaChart data={spDead} color={deadTuples>1000?THEME.warning:THEME.success} label="Dead Tuples" yFmt={v=>fmtNum(Math.round(v))}/></div>
                    </div>
                    <div style={{borderRadius: 20,padding:11,background:THEME.surface,border:`1px solid ${THEME.glassBorder}28`}}>
                        <div style={{fontSize:8.5,fontWeight:700,color:THEME.textDim,letterSpacing:'0.02em',marginBottom:7}}><PieChart size={9} style={{display:'inline',marginRight:4}}/>Breakdown</div>
                        {['critical','high','medium','low'].map(sv=>{const cnt=suggestions.filter(s=>s.severity===sv).length,res=suggestions.filter(s=>s.severity===sv&&resolvedOptimizations.has(s.id)).length;return cnt>0?<div key={sv} style={{marginBottom:5}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}><span style={{fontSize:9.5,fontWeight:600,color:sevColor(sv),textTransform:'capitalize'}}>{sv}</span><span style={{fontSize:8.5,color:THEME.textDim}}>{res}/{cnt}</span></div><PBar value={res} max={cnt} color={sevColor(sv)} h={4}/></div>:null;})}
                        <div style={{marginTop:8,fontSize:8.5,fontWeight:700,color:THEME.textDim,marginBottom:5}}>Categories</div>
                        <div style={{display:'flex',flexWrap:'wrap',gap:4}}>{[...new Set(suggestions.map(s=>s.category))].map(c=><span key={c} style={{fontSize:9,padding:'2px 7px',borderRadius:3,background:`${THEME.primary}08`,color:THEME.primary,fontWeight:600,border:`1px solid ${THEME.primary}12`}}>{c} ({suggestions.filter(s=>s.category===c).length})</span>)}</div>
                    </div>
                </div>}

                {/* SUGGESTION TABS */}
                {['performance','index','vacuum','all'].includes(activeTab)&&<div className="vfade" style={{display:'flex',flexDirection:'column',gap:7}}>
                    {activeTab==='all'&&<div style={{display:'flex',gap:5,marginBottom:3,flexWrap:'wrap'}}>
                        <div style={{flex:1,minWidth:130,display:'flex',alignItems:'center',gap:4,padding:'4px 8px',borderRadius: 16,background:THEME.surface,border:`1px solid ${THEME.glassBorder}30`}}>
                            <Search size={9} color={THEME.textDim}/><input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Search..." style={{flex:1,background:'transparent',border:'none',outline:'none',fontSize:10,color:THEME.textMain,fontFamily:'inherit'}}/>{searchQuery&&<button onClick={()=>setSearchQuery('')} style={{background:'transparent',border:'none',cursor:'pointer',padding:0}}><X size={8} color={THEME.textDim}/></button>}
                        </div>
                        <select value={severityFilter} onChange={e=>setSeverityFilter(e.target.value)} style={{padding:'4px 7px',borderRadius: 16,fontSize:9.5,fontWeight:600,background:THEME.surface,border:`1px solid ${THEME.glassBorder}30`,color:THEME.textMain,cursor:'pointer',outline:'none'}}><option value="all">All</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>
                        <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{padding:'4px 7px',borderRadius: 16,fontSize:9.5,fontWeight:600,background:THEME.surface,border:`1px solid ${THEME.glassBorder}30`,color:THEME.textMain,cursor:'pointer',outline:'none'}}><option value="severity">Severity</option><option value="impact">Impact</option><option value="category">Category</option></select>
                        <button onClick={()=>setShowResolved(r=>!r)} style={{padding:'4px 7px',borderRadius: 16,fontSize:9.5,fontWeight:600,cursor:'pointer',background:showResolved?`${THEME.success}0c`:THEME.surface,border:`1px solid ${showResolved?THEME.success+'22':THEME.glassBorder+'30'}`,color:showResolved?THEME.success:THEME.textDim,display:'flex',alignItems:'center',gap:2}}>{showResolved?<Eye size={8}/>:<X size={8}/>}Resolved</button>
                    </div>}
                    {tabSugs.length===0?<div style={{textAlign:'center',padding:'26px 0',color:THEME.textDim,fontSize:10.5}}><CheckCircle size={20} color={THEME.success} style={{opacity:.4,display:'block',margin:'0 auto 5px'}}/>{searchQuery?'No matches':'All clear'}</div>
                        :tabSugs.map(s=><SugCard key={s.id} icon={s.icon} title={s.title} description={s.description} severity={s.severity} sql={s.sql} savings={s.savings} impact={s.impact} estimatedTime={s.estimatedTime} prerequisites={s.prerequisites} risks={s.risks} resolved={resolvedOptimizations.has(s.id)} onToggleResolved={()=>resolvedOptimizations.has(s.id)?onUnmarkResolved?.(s.id):onMarkResolved?.(s.id)} defaultOpen={s.severity==='critical'&&tabSugs.indexOf(s)===0}/>)}
                </div>}

                {/* AI ANALYSIS */}
                {activeTab==='ai'&&<div className="vfade" style={{display:'flex',flexDirection:'column',gap:11}}>

                    {/* Intro / trigger */}
                    {!ai.result && !ai.loading && !ai.error && (
                        <div style={{borderRadius: 20,padding:16,background:`${THEME.primary}04`,border:`1px solid ${THEME.primary}14`,textAlign:'center'}}>
                            <Brain size={28} color={THEME.primary} style={{opacity:.5,margin:'0 auto 8px',display:'block'}}/>
                            <div style={{fontSize:12,fontWeight:800,color:THEME.textMain,marginBottom:4}}>AI Deep Analysis</div>
                            <div style={{fontSize:10,color:THEME.textDim,lineHeight:1.6,maxWidth:320,margin:'0 auto 12px'}}>
                                Send this table's live stats for expert DBA insights — root cause analysis, workload profiling, config tuning, and prioritised quick wins.
                            </div>
                            <div style={{display:'flex',flexWrap:'wrap',gap:5,justifyContent:'center',marginBottom:12}}>
                                {['Root causes','Workload profile','Config tuning','Quick wins','Long-term risks'].map(f=>(
                                    <span key={f} style={{fontSize:8.5,padding:'2px 8px',borderRadius:3,background:`${THEME.primary}10`,color:THEME.primary,border:`1px solid ${THEME.primary}18`,fontWeight:600}}>{f}</span>
                                ))}
                            </div>
                            <button onClick={()=>ai.analyze({tableName,sizeGb,idxSizeGb,rowCount,bloatPct,deadTuples,cacheHit,idxRatio,seqScans,idxScans,lastVacuum,hotRatio,lockWaits,connActive,connIdle,avgQMs,healthScore},suggestions)}
                                style={{display:'inline-flex',alignItems:'center',gap:6,padding:'8px 18px',borderRadius: 18,border:'none',cursor:'pointer',fontSize:11,fontWeight:700,background:`linear-gradient(135deg,${THEME.primary},${THEME.secondary})`,color:'#fff',boxShadow:`0 3px 12px ${THEME.primary}30`}}>
                                <Sparkles size={12}/>Run AI Analysis
                            </button>
                        </div>
                    )}

                    {/* Loading */}
                    {ai.loading && (
                        <div style={{borderRadius: 20,padding:24,background:`${THEME.primary}04`,border:`1px solid ${THEME.primary}14`,textAlign:'center'}}>
                            <Loader size={22} color={THEME.primary} style={{margin:'0 auto 10px',display:'block',animation:'relSpin 1s linear infinite'}}/>
                            <div style={{fontSize:11,fontWeight:700,color:THEME.textMain,marginBottom:3}}>Analysing…</div>
                            <div style={{fontSize:9.5,color:THEME.textDim}}>Sending {suggestions.length} optimizations + live stats for expert DBA review</div>
                        </div>
                    )}

                    {/* Error */}
                    {ai.error && !ai.loading && (
                        <div style={{borderRadius: 20,padding:13,background:`${THEME.danger}05`,border:`1px solid ${THEME.danger}14`,display:'flex',gap:9,alignItems:'flex-start'}}>
                            <AlertTriangle size={14} color={THEME.danger} style={{flexShrink:0,marginTop:1}}/>
                            <div style={{flex:1}}>
                                <div style={{fontSize:10.5,fontWeight:700,color:THEME.danger,marginBottom:3}}>Analysis failed</div>
                                <div style={{fontSize:9.5,color:THEME.textDim,lineHeight:1.4}}>{ai.error}</div>
                            </div>
                            <button onClick={()=>{ai.reset();ai.analyze({tableName,sizeGb,idxSizeGb,rowCount,bloatPct,deadTuples,cacheHit,idxRatio,seqScans,idxScans,lastVacuum,hotRatio,lockWaits,connActive,connIdle,avgQMs,healthScore},suggestions)}}
                                style={{padding:'4px 10px',borderRadius: 16,border:`1px solid ${THEME.danger}20`,background:`${THEME.danger}0a`,color:THEME.danger,cursor:'pointer',fontSize:9.5,fontWeight:700,flexShrink:0}}>
                                Retry
                            </button>
                        </div>
                    )}

                    {/* Result */}
                    {ai.result && !ai.loading && (
                        <>
                            <AIAnalysisResult result={ai.result} tableName={tableName}/>
                            <button onClick={()=>{ai.reset();}}
                                style={{alignSelf:'flex-start',display:'inline-flex',alignItems:'center',gap:5,padding:'5px 11px',borderRadius: 18,border:`1px solid ${THEME.glassBorder}30`,background:'transparent',cursor:'pointer',fontSize:9.5,fontWeight:600,color:THEME.textDim}}>
                                <RefreshCw size={9}/>Re-run Analysis
                            </button>
                        </>
                    )}
                </div>}

                {/* SCRIPT */}
                {activeTab==='script'&&<div className="vfade" style={{display:'flex',flexDirection:'column',gap:11}}>
                    <div style={{padding:'9px 11px',borderRadius: 20,background:`${THEME.primary}04`,border:`1px solid ${THEME.primary}10`}}>
                        <div style={{fontSize:11,fontWeight:700,color:THEME.textMain,marginBottom:2,display:'flex',alignItems:'center',gap:4}}><Sparkles size={10} color={THEME.primary}/>Master Script</div>
                        <div style={{fontSize:10,color:THEME.textDim,lineHeight:1.5}}>
                            <strong style={{color:THEME.danger}}>{suggestions.filter(s=>s.severity==='critical').length}</strong> critical · <strong style={{color:THEME.danger}}>{suggestions.filter(s=>s.severity==='high').length}</strong> high · <strong style={{color:THEME.warning}}>{suggestions.filter(s=>s.severity==='medium').length}</strong> med · <strong style={{color:THEME.textMuted}}>{suggestions.filter(s=>s.severity==='low').length}</strong> low — {masterScript.split('\n').length}L
                        </div>
                    </div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:3}}>{suggestions.map((s,i)=><span key={s.id} style={{fontSize:8.5,padding:'2px 7px',borderRadius:3,fontWeight:600,background:`${sevColor(s.severity)}06`,color:sevColor(s.severity),border:`1px solid ${sevColor(s.severity)}12`}}>{i+1}. {s.title.split(' ').slice(0,3).join(' ')}…</span>)}</div>
                    <div style={{display:'flex',gap:5}}>
                        <button onClick={()=>{navigator.clipboard?.writeText(masterScript).catch(()=>{});setMasterCopied(true);setTimeout(()=>setMasterCopied(false),2500);}} style={{flex:1,display:'inline-flex',alignItems:'center',justifyContent:'center',gap:5,padding:'8px',borderRadius: 18,cursor:'pointer',fontSize:11,fontWeight:700,background:masterCopied?`${THEME.success}10`:`${THEME.primary}10`,color:masterCopied?THEME.success:THEME.primary,border:`1px solid ${masterCopied?THEME.success:THEME.primary}1e`,transition:'all .15s'}}>{masterCopied?<><Check size={11}/>Copied</>:<><Copy size={11}/>Copy Script</>}</button>
                        <button onClick={()=>{const b=new Blob([masterScript],{type:'text/plain'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=`fathom_${tableName}_${Date.now()}.sql`;a.click();URL.revokeObjectURL(u);}} style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:5,padding:'8px 11px',borderRadius: 18,border:`1px solid ${THEME.glassBorder}38`,background:'transparent',cursor:'pointer',color:THEME.textMuted,fontSize:11,fontWeight:700}} onMouseEnter={e=>{e.currentTarget.style.borderColor=THEME.glassBorder;e.currentTarget.style.color=THEME.textMain}} onMouseLeave={e=>{e.currentTarget.style.borderColor=`${THEME.glassBorder}38`;e.currentTarget.style.color=THEME.textMuted}}><Download size={11}/>.sql</button>
                    </div>
                    <div style={{borderRadius: 20,overflow:'hidden',border:`1px solid ${THEME.glassBorder}28`}}>
                        <div onClick={()=>setMasterExpanded(e=>!e)} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 11px',cursor:'pointer',background:THEME.surface,borderBottom:masterExpanded?`1px solid ${THEME.glassBorder}28`:'none'}}>
                            <span style={{fontSize:10,fontWeight:700,color:THEME.textMuted,display:'flex',alignItems:'center',gap:4}}><FileCode size={9} color={THEME.textDim}/>Preview ({masterScript.split('\n').length}L)</span>
                            {masterExpanded?<ChevronDown size={10} color={THEME.textDim}/>:<ChevronRight size={10} color={THEME.textDim}/>}
                        </div>
                        {masterExpanded&&<CodeBlock code={masterScript} maxH={500}/>}
                    </div>
                </div>}
            </div>
        </div>
    );
};

export default AdvancedAnalysisPanel;