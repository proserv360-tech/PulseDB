// ==========================================================================
//  FATHOM — SqlConsoleTab  (v6 — Maximum Power Edition)
// ==========================================================================
import React, {
    useState, useEffect, useMemo, useRef, useCallback,
    useReducer, createContext, useContext, Suspense
} from 'react';
import { THEME, useAdaptiveTheme } from '../../../utils/theme';
import { postData, fetchData } from '../../../utils/api';
import ChartBuilder from './ChartBuilder';

import {
    Play, Eraser, Copy, Check, ChevronDown, ChevronUp,
    Clock, Database, AlertTriangle, CheckCircle, XCircle, Search,
    Terminal, Zap, BarChart3, Table2, Download, Square,
    Trash2, ArrowUp, ArrowDown, Code, BookOpen, Star,
    ChevronRight, Timer, Layers, Eye, Keyboard, Pause,
    Maximize2, Minimize2, Hash, RefreshCw, X, History,
    FileJson, FileSpreadsheet, Columns, Shield,
    Activity, Network, HardDrive, Lock,
    Plus, GitBranch, Settings,
    Save, Filter,
    ChevronLeft, Bookmark, Variable,
    ShieldOff, AlignJustify, ChevronLast, ChevronFirst,
    PanelRightClose, PanelRightOpen,
    Scissors, Circle, TrendingUp, Gauge, Globe,
    Sparkles, Lightbulb,
    RefreshCcw,
    Sliders, EyeOff, Pin, RotateCcw,
    Cpu, Diff, MoreHorizontal,
    TrendingDown, LineChart,
    ClipboardList, Workflow,
    FlameKindling, GitMerge,
    CopyCheck, Brain
} from 'lucide-react';

// Aliases for icons that may differ by version
const BrainCircuit = Brain;
const EyeIcon = Eye;
const Unpin = Pin;

/* ═══════════════════════════════════════════════════════════════════════════
   CONTEXT
   ═══════════════════════════════════════════════════════════════════════════ */
const SqlContext = createContext(null);
const useSqlCtx = () => useContext(SqlContext);

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */
const SqlStyles = () => (
    <style>{`
        @keyframes sqlFadeIn { from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);} }
        @keyframes sqlFadeUp { from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);} }
        @keyframes sqlPulse { 0%,100%{opacity:1;}50%{opacity:0.3;} }
        @keyframes sqlDotPulse { 0%,100%{transform:scale(1);}50%{transform:scale(1.5);} }
        @keyframes sqlSlideIn { from{opacity:0;transform:translateX(-8px);}to{opacity:1;transform:translateX(0);} }
        @keyframes sqlSlideDown { from{opacity:0;transform:translateY(-6px);}to{opacity:1;transform:translateY(0);} }
        @keyframes sqlSpin { to{transform:rotate(360deg);} }
        @keyframes sqlShimmer { 0%{background-position:-400% 0;}100%{background-position:400% 0;} }
        @keyframes sqlBarGrow { from{transform:scaleX(0);}to{transform:scaleX(1);} }
        @keyframes sqlTimerPulse { 0%,100%{opacity:1;}50%{opacity:0.55;} }
        @keyframes sqlBlink { 0%,100%{opacity:1;}49%{opacity:1;}50%{opacity:0;} }
        @keyframes sqlGlow { 0%,100%{box-shadow:0 0 6px ${THEME.primary}50;}50%{box-shadow:0 0 16px ${THEME.primary}90,0 0 32px ${THEME.primary}30;} }
        @keyframes sqlTabIn { from{opacity:0;transform:scale(0.97);}to{opacity:1;transform:scale(1);} }
        @keyframes sqlRipple { 0%{transform:scale(0);opacity:0.6;}100%{transform:scale(2.5);opacity:0;} }
        @keyframes sqlScanLine { from{top:-2px;}to{top:100%;} }
        @keyframes sqlFlicker { 0%,100%{opacity:1;}97%{opacity:1;}97.5%{opacity:0.8;}98%{opacity:1;}98.5%{opacity:0.9;} }
        @keyframes sqlProgressBar { from{width:0;}to{width:100%;} }
        @keyframes sqlCountUp { from{opacity:0;transform:scale(0.8);}to{opacity:1;transform:scale(1);} }

        .sql-font { font-family:${THEME.fontBody}; }
        .sql-mono { font-family:${THEME.fontMono}; }
        .sql-row-hover { transition:background 0.08s; }
        .sql-row-hover:hover { background:${THEME.primary}08 !important; cursor:default; }
        .sql-row-hover:hover td { color:${THEME.textMain} !important; }
        .sql-row-selected { background:${THEME.primary}12 !important; }
        .sql-row-selected td { color:${THEME.textMain} !important; }
        .sql-scrollbar::-webkit-scrollbar { width:4px; height:4px; }
        .sql-scrollbar::-webkit-scrollbar-track { background:transparent; }
        .sql-scrollbar::-webkit-scrollbar-thumb { background:${THEME.grid}60; border-radius: 22px; }
        .sql-scrollbar::-webkit-scrollbar-thumb:hover { background:${THEME.textDim}; }
        .sql-editor-area {
            width:100%; background:transparent; border:none; color:${THEME.textMain};
            font-family:${THEME.fontMono};
            padding:0; outline:none; resize:none;
            font-size:13px; line-height:1.75; tab-size:2;
            caret-color:${THEME.primary};
        }
        .sql-editor-area::placeholder { color:${THEME.textDim}40; font-style:italic; }
        .sql-editor-area::selection { background:${THEME.primary}28; }
        .sql-tab-btn { transition:all 0.18s; cursor:pointer; }
        .sql-tab-btn:hover { background:${THEME.primary}08 !important; }
        .sql-tab-active { background:${THEME.primary}14 !important; color:${THEME.primary} !important; outline:1px solid ${THEME.primary}25 !important; }
        .sql-icon-btn { transition:all 0.15s; cursor:pointer; }
        .sql-icon-btn:hover:not(:disabled) { background:${THEME.primary}12 !important; color:${THEME.textMain} !important; }
        .sql-history-item { transition:all 0.12s; cursor:pointer; border:1px solid ${THEME.grid}30; }
        .sql-history-item:hover { background:${THEME.primary}06 !important; border-color:${THEME.glassBorderHover} !important; }
        .sql-snippet-card { transition:all 0.15s; }
        .sql-snippet-card:hover { transform:translateY(-3px); box-shadow:${THEME.shadowMd}; }
        .sql-diff-add { background:${THEME.success}10; border-left:2px solid ${THEME.success}; }
        .sql-diff-remove { background:${THEME.danger}10; border-left:2px solid ${THEME.danger}; }
        .sql-diff-modified { background:${THEME.warning}08; border-left:2px solid ${THEME.warning}; }
        .sql-tooltip { position:relative; }
        .sql-tooltip::after {
            content:attr(data-tip); position:absolute; bottom:calc(100% + 6px); left:50%; transform:translateX(-50%);
            padding:4px 8px; border-radius: 20px; background:rgba(0,0,0,0.9); color:#fff;
            font-size:10px; white-space:nowrap; pointer-events:none; opacity:0; transition:opacity 0.15s;
            z-index:9999; font-family:${THEME.fontBody};
        }
        .sql-tooltip:hover::after { opacity:1; }
        .sql-param { background:${THEME.warning}12; color:${THEME.warning}; padding:1px 5px; border-radius:3px; font-weight:600; font-family:monospace; font-size:10px; }
        .sql-readonly-banner { animation:sqlSlideDown 0.2s ease; }
        .sql-suggest-box { animation:sqlSlideDown 0.12s ease; }
        .sql-page-btn:hover:not(:disabled) { background:${THEME.primary}14 !important; color:${THEME.primary} !important; }
        .sql-cell-null { padding:1px 6px; border-radius:3px; background:${THEME.textDim}10; font-size:9px; font-weight:700; color:${THEME.textDim}; text-transform:uppercase; letter-spacing:0.05em; }
        .sql-cell-number { color:${THEME.secondary}; }
        .sql-cell-bool-true { color:${THEME.success}; font-weight:700; }
        .sql-cell-bool-false { color:${THEME.danger}; font-weight:700; }
        .sql-cell-date { color:${THEME.warning}; }
        .sql-cell-uuid { color:${THEME.textDim}; font-size:10px; }
        .sql-cell-long { color:${THEME.textMuted}; cursor:pointer; }
        .sql-cell-long:hover { color:${THEME.textMain}; }
        .sql-pin-col { background:${THEME.primary}05 !important; }
        .sql-trend-up { color:${THEME.success}; }
        .sql-trend-down { color:${THEME.danger}; }
        .sql-virtual-scroll-item { animation:sqlFadeIn 0.1s ease; }
        .sql-kbd { padding:2px 6px; border-radius: 22px; font-size:9px; font-weight:700; background:${THEME.grid}80; border:1px solid ${THEME.grid}; color:${THEME.textMuted}; font-family:monospace; }
        .sql-badge-pulse { animation:sqlDotPulse 1.5s ease-in-out infinite; }
        .sql-loading-bar { height:2px; background:linear-gradient(90deg,transparent 0%,${THEME.primary} 50%,transparent 100%); background-size:400% 100%; animation:sqlShimmer 1s linear infinite; }
        .sql-resizable-col { cursor:col-resize; user-select:none; }
        .sql-frozen { position:sticky; left:0; z-index:3; }
        .sql-chart-bar { transform-origin:bottom; animation:sqlBarGrow 0.6s ease; }
        .sql-notification { animation:sqlSlideIn 0.25s ease; }
        .sql-ai-glow { box-shadow:0 0 24px ${THEME.secondary}30, 0 0 8px ${THEME.secondary}20; }
        input[type="range"].sql-range::-webkit-slider-thumb { background:${THEME.primary}; }
        input[type="range"].sql-range { accent-color:${THEME.primary}; }
    `}</style>
);

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */
const PAGE_SIZE_OPTIONS = [25, 50, 100, 250, 500, 1000];
const MAX_HISTORY = 200;
const CELL_EXPAND_THRESHOLD = 120;

const SQL_KEYWORDS = [
    'SELECT','FROM','WHERE','JOIN','INNER JOIN','LEFT JOIN','RIGHT JOIN','FULL OUTER JOIN','CROSS JOIN','ON',
    'GROUP BY','ORDER BY','HAVING','LIMIT','OFFSET','WITH','AS','DISTINCT','UNION','UNION ALL','INTERSECT','EXCEPT',
    'INSERT INTO','VALUES','UPDATE','SET','DELETE FROM','CREATE TABLE','DROP TABLE','ALTER TABLE','ADD COLUMN',
    'CREATE INDEX','CREATE UNIQUE INDEX','DROP INDEX','EXPLAIN','EXPLAIN ANALYZE','VACUUM','VACUUM ANALYZE',
    'TRUNCATE','BEGIN','COMMIT','ROLLBACK','SAVEPOINT','RELEASE SAVEPOINT','ROLLBACK TO',
    'CASE','WHEN','THEN','ELSE','END','EXISTS','NOT EXISTS','IN','NOT IN','ANY','ALL','SOME',
    'IS NULL','IS NOT NULL','BETWEEN','LIKE','ILIKE','SIMILAR TO','AT TIME ZONE',
    'OVER','PARTITION BY','ROWS BETWEEN','RANGE BETWEEN','CURRENT ROW','UNBOUNDED PRECEDING',
    'LAG','LEAD','ROW_NUMBER','RANK','DENSE_RANK','NTILE','FIRST_VALUE','LAST_VALUE','NTH_VALUE',
    'pg_stat_activity','pg_stat_user_tables','pg_stat_user_indexes','pg_locks','pg_stat_replication',
    'pg_statio_user_tables','pg_database','pg_class','pg_namespace','information_schema',
    'pg_stat_statements','pg_indexes','pg_views','pg_matviews','pg_sequences',
    'current_database()','now()','clock_timestamp()','statement_timestamp()',
    'pg_size_pretty','pg_total_relation_size','pg_relation_size','pg_column_size',
    'COUNT(*)','COUNT','SUM','AVG','MAX','MIN','STDDEV','VARIANCE','PERCENTILE_CONT','PERCENTILE_DISC',
    'COALESCE','NULLIF','ROUND','CEIL','FLOOR','ABS','MOD','POWER','SQRT',
    'CAST','TO_CHAR','TO_DATE','TO_TIMESTAMP','TO_NUMBER','DATE_TRUNC','DATE_PART','EXTRACT',
    'CONCAT','CONCAT_WS','SUBSTRING','POSITION','TRIM','LTRIM','RTRIM','LOWER','UPPER','INITCAP',
    'SPLIT_PART','STRING_AGG','ARRAY_AGG','JSON_AGG','JSONB_AGG','ARRAY_TO_STRING',
    'NOT NULL','PRIMARY KEY','FOREIGN KEY','REFERENCES','DEFAULT','UNIQUE','INDEX','CONSTRAINT','CHECK',
    'ON CONFLICT','DO NOTHING','DO UPDATE SET','RETURNING','WITH RECURSIVE',
];

const DATA_TEMPLATES = [
    { label:'Active Queries', icon:Activity, group:'Monitoring', tag:'live', sql:`SELECT pid, usename, application_name, state,\n  now() - query_start AS duration,\n  wait_event_type, wait_event,\n  LEFT(query, 100) AS query_snippet\nFROM pg_stat_activity\nWHERE state = 'active' AND pid <> pg_backend_pid()\nORDER BY duration DESC NULLS LAST;` },
    { label:'Table Sizes', icon:Database, group:'Storage', tag:'storage', sql:`SELECT\n  schemaname,\n  relname AS table_name,\n  pg_size_pretty(pg_total_relation_size(relid)) AS total_size,\n  pg_size_pretty(pg_relation_size(relid)) AS table_size,\n  pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) AS index_size,\n  n_live_tup AS live_rows\nFROM pg_catalog.pg_statio_user_tables\nORDER BY pg_total_relation_size(relid) DESC\nLIMIT 30;` },
    { label:'Index Usage', icon:Zap, group:'Performance', tag:'perf', sql:`SELECT\n  schemaname, relname AS table,\n  indexrelname AS index,\n  idx_scan, idx_tup_read, idx_tup_fetch,\n  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,\n  ROUND(idx_scan::numeric / NULLIF(idx_scan + seq_scan, 0) * 100, 1) AS usage_pct\nFROM pg_stat_user_indexes\nJOIN pg_stat_user_tables USING (relname)\nORDER BY idx_scan DESC\nLIMIT 25;` },
    { label:'Lock Status', icon:Lock, group:'Monitoring', tag:'locks', sql:`SELECT\n  l.pid, l.mode, l.granted, l.locktype,\n  a.usename, a.state,\n  now() - a.query_start AS query_age,\n  LEFT(a.query, 80) AS query\nFROM pg_locks l\nJOIN pg_stat_activity a ON l.pid = a.pid\nWHERE l.pid <> pg_backend_pid()\nORDER BY l.granted, query_age DESC NULLS LAST;` },
    { label:'Cache Hit Ratio', icon:Shield, group:'Performance', tag:'perf', sql:`SELECT\n  relname AS table_name,\n  heap_blks_read, heap_blks_hit,\n  ROUND(heap_blks_hit::numeric / NULLIF(heap_blks_hit + heap_blks_read, 0) * 100, 2) AS cache_hit_pct,\n  idx_blks_read, idx_blks_hit,\n  ROUND(idx_blks_hit::numeric / NULLIF(idx_blks_hit + idx_blks_read, 0) * 100, 2) AS idx_cache_hit_pct\nFROM pg_statio_user_tables\nWHERE heap_blks_read + heap_blks_hit > 0\nORDER BY heap_blks_read DESC\nLIMIT 20;` },
    { label:'Replication Lag', icon:Network, group:'Replication', tag:'repl', sql:`SELECT\n  client_addr, client_hostname, state,\n  sent_lsn, write_lsn, flush_lsn, replay_lsn,\n  sync_state, sync_priority,\n  pg_size_pretty(pg_wal_lsn_diff(sent_lsn, replay_lsn)) AS replication_lag\nFROM pg_stat_replication\nORDER BY replication_lag DESC NULLS LAST;` },
    { label:'Long Queries', icon:Timer, group:'Monitoring', tag:'live', sql:`SELECT\n  pid, usename,\n  EXTRACT(EPOCH FROM (now() - query_start))::INT AS duration_sec,\n  state, wait_event_type, wait_event,\n  LEFT(query, 200) AS query\nFROM pg_stat_activity\nWHERE (now() - query_start) > interval '10 seconds'\n  AND state NOT IN ('idle', 'idle in transaction (aborted)')\n  AND pid <> pg_backend_pid()\nORDER BY duration_sec DESC;` },
    { label:'Slow Queries', icon:Gauge, group:'Performance', tag:'perf', sql:`SELECT\n  LEFT(query, 120) AS query,\n  calls, total_exec_time::INT AS total_ms,\n  ROUND(mean_exec_time::numeric, 2) AS avg_ms,\n  ROUND(stddev_exec_time::numeric, 2) AS stddev_ms,\n  max_exec_time::INT AS max_ms,\n  rows, shared_blks_hit, shared_blks_read,\n  ROUND(shared_blks_hit::numeric / NULLIF(shared_blks_hit + shared_blks_read, 0) * 100, 1) AS hit_pct\nFROM pg_stat_statements\nORDER BY mean_exec_time DESC\nLIMIT 20;` },
    { label:'Table Bloat', icon:TrendingUp, group:'Maintenance', tag:'maint', sql:`SELECT\n  schemaname, tablename,\n  n_live_tup, n_dead_tup,\n  ROUND(n_dead_tup::numeric / NULLIF(n_live_tup + n_dead_tup, 0) * 100, 2) AS bloat_pct,\n  n_mod_since_analyze,\n  last_autovacuum, last_autoanalyze,\n  last_vacuum, last_analyze\nFROM pg_stat_user_tables\nWHERE n_live_tup + n_dead_tup > 1000\nORDER BY bloat_pct DESC NULLS LAST\nLIMIT 25;` },
    { label:'Connections', icon:Globe, group:'Monitoring', tag:'live', sql:`SELECT\n  state,\n  usename,\n  application_name,\n  COUNT(*) AS connections,\n  MAX(now() - state_change) AS longest,\n  AVG(EXTRACT(EPOCH FROM (now() - state_change)))::INT AS avg_age_sec\nFROM pg_stat_activity\nGROUP BY state, usename, application_name\nORDER BY connections DESC;` },
    { label:'Schema Tables', icon:Layers, group:'Schema', tag:'schema', sql:`SELECT\n  t.table_schema, t.table_name, t.table_type,\n  c.column_count,\n  pg_size_pretty(pg_total_relation_size(quote_ident(t.table_schema)||'.'||quote_ident(t.table_name))) AS size\nFROM information_schema.tables t\nLEFT JOIN (\n  SELECT table_schema, table_name, COUNT(*) AS column_count\n  FROM information_schema.columns\n  GROUP BY 1, 2\n) c USING (table_schema, table_name)\nWHERE t.table_schema NOT IN ('pg_catalog','information_schema')\nORDER BY t.table_schema, t.table_name;` },
    { label:'Unused Indexes', icon:EyeOff, group:'Performance', tag:'perf', sql:`SELECT\n  schemaname, relname AS table, indexrelname AS index,\n  idx_scan, pg_size_pretty(pg_relation_size(indexrelid)) AS size\nFROM pg_stat_user_indexes\nWHERE idx_scan = 0\n  AND indexrelname NOT LIKE '%_pkey'\nORDER BY pg_relation_size(indexrelid) DESC\nLIMIT 20;` },
    { label:'Vacuum Progress', icon:RefreshCcw, group:'Maintenance', tag:'maint', sql:`SELECT\n  p.pid, p.phase, p.relid::regclass AS table,\n  p.heap_blks_scanned, p.heap_blks_total,\n  ROUND(p.heap_blks_scanned::numeric / NULLIF(p.heap_blks_total, 0) * 100, 1) AS pct,\n  a.query_start\nFROM pg_stat_progress_vacuum p\nJOIN pg_stat_activity a ON p.pid = a.pid;` },
    { label:'Column Stats', icon:BarChart3, group:'Schema', tag:'schema', sql:`SELECT\n  attname AS column, n_distinct,\n  ROUND(null_frac * 100, 1) AS null_pct,\n  avg_width AS avg_bytes,\n  most_common_vals, most_common_freqs\nFROM pg_stats\nWHERE tablename = ':table_name'\nORDER BY attnum;` },
    { label:'FK Violations Check', icon:GitBranch, group:'Schema', tag:'schema', sql:`SELECT\n  tc.table_schema, tc.table_name,\n  kcu.column_name,\n  ccu.table_name AS foreign_table,\n  ccu.column_name AS foreign_column,\n  tc.constraint_name\nFROM information_schema.table_constraints tc\nJOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name\nJOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name\nWHERE tc.constraint_type = 'FOREIGN KEY'\nORDER BY tc.table_name;` },
];

const SNIPPETS = [
    { id:'s1', name:'Safe Update', tag:'dml', sql:`-- Always use WHERE with UPDATE\nUPDATE :table\nSET :column = :value\nWHERE :condition\nRETURNING id, :column;` },
    { id:'s2', name:'Count by Status', tag:'analytics', sql:`SELECT :status_col,\n  COUNT(*) AS cnt,\n  ROUND(COUNT(*)::numeric / SUM(COUNT(*)) OVER () * 100, 1) AS pct\nFROM :table\nGROUP BY :status_col\nORDER BY cnt DESC;` },
    { id:'s3', name:'Recent Records', tag:'common', sql:`SELECT *\nFROM :table\nWHERE created_at > NOW() - INTERVAL ':interval'\nORDER BY created_at DESC\nLIMIT :n;` },
    { id:'s4', name:'Kill Query', tag:'admin', sql:`SELECT pg_terminate_backend(:pid);\n-- Or softer: pg_cancel_backend(:pid)` },
    { id:'s5', name:'Window Running Total', tag:'analytics', sql:`SELECT\n  :date_col,\n  :amount_col,\n  SUM(:amount_col) OVER (\n    ORDER BY :date_col\n    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW\n  ) AS running_total\nFROM :table\nORDER BY :date_col;` },
    { id:'s6', name:'Upsert Pattern', tag:'dml', sql:`INSERT INTO :table (:cols)\nVALUES (:vals)\nON CONFLICT (:unique_col)\nDO UPDATE SET\n  :col = EXCLUDED.:col,\n  updated_at = NOW()\nRETURNING *;` },
    { id:'s7', name:'CTE Chain', tag:'advanced', sql:`WITH base AS (\n  SELECT * FROM :table WHERE :condition\n),\naggregated AS (\n  SELECT :group_col, COUNT(*) AS cnt\n  FROM base\n  GROUP BY :group_col\n)\nSELECT * FROM aggregated\nORDER BY cnt DESC;` },
    { id:'s8', name:'LATERAL Join', tag:'advanced', sql:`SELECT t.*, agg.*\nFROM :table t\nCROSS JOIN LATERAL (\n  SELECT COUNT(*) AS related_count,\n    MAX(:col) AS max_val\n  FROM :related_table r\n  WHERE r.:fk_col = t.id\n) agg\nORDER BY agg.related_count DESC\nLIMIT :n;` },
];

const SCHEMA_MOCK_INITIAL = {};
// Empty state: "Schema browser will populate when connected to a database."

const TYPE_COLOR_MAP = {
    uuid: THEME.secondary, text: THEME.textDim, varchar: THEME.textDim,
    bigint: THEME.success, int: THEME.success, integer: THEME.success, smallint: THEME.success, serial: THEME.success,
    numeric: THEME.primary, float4: THEME.primary, float8: THEME.primary,
    timestamptz: THEME.warning, timestamp: THEME.warning, date: THEME.warning,
    bool: THEME.danger, boolean: THEME.danger, jsonb: THEME.purple, json: THEME.purple,
};

const AI_SUGGESTIONS = [
    'Add an index on the most filtered column',
    'Consider LIMIT to avoid full scans',
    'Use EXPLAIN ANALYZE to verify index usage',
    'JOIN on indexed foreign keys for performance',
    'Avoid SELECT * in production queries',
    'Use CTEs for complex multi-step logic',
    'Consider MATERIALIZED VIEW for repeated aggregations',
    'Partition large tables by time range',
];

/* ═══════════════════════════════════════════════════════════════════════════
   STATE REDUCER
   ═══════════════════════════════════════════════════════════════════════════ */
const tabReducer = (state, action) => {
    switch (action.type) {
        case 'UPDATE_TAB': return state.map(t => t.id === action.id ? {...t, ...action.patch} : t);
        case 'ADD_TAB': return [...state, action.tab];
        case 'CLOSE_TAB': return state.filter(t => t.id !== action.id);
        case 'REORDER_TABS': return action.tabs;
        default: return state;
    }
};

const makeTab = (id) => ({
    id, label:`Query ${id}`, sql:'', result:null, explainResult:null,
    sortCol:null, sortDir:'asc', page:1, pinnedCols:[], hiddenCols:[], colWidths:{},
    viewMode:'table', // 'table'|'json'|'chart'
});

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */
const fmtMs = (ms) => {
    if (ms == null) return '—';
    if (ms < 1) return '<1ms';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms/1000).toFixed(2)}s`;
    return `${Math.floor(ms/60000)}m ${((ms%60000)/1000).toFixed(0)}s`;
};
const fmtTime = (iso) => new Date(iso).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});
const fmtRows = (n) => n==null?'—':n.toLocaleString();
const detectWriteOp = (q) => /^\s*(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE)\s/i.test(q);
const detectSelectOnly = (q) => /^\s*SELECT\s/i.test(q.trim());

const inferCellType = (val) => {
    if (val === null || val === undefined) return 'null';
    const s = String(val);
    if (s === 'true' || s === 'false' || s === 't' || s === 'f') return 'bool';
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return 'date';
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return 'uuid';
    if (!isNaN(Number(s)) && s.trim() !== '') return 'number';
    if (s.length > CELL_EXPAND_THRESHOLD) return 'long';
    if ((s.startsWith('{') || s.startsWith('[')) && (s.endsWith('}') || s.endsWith(']'))) return 'json';
    return 'text';
};

const formatSQL = (sql) => {
    const keywords = ['SELECT','FROM','WHERE','JOIN','INNER JOIN','LEFT JOIN','RIGHT JOIN','FULL OUTER JOIN','ON','GROUP BY','ORDER BY','HAVING','LIMIT','OFFSET','WITH','UNION','UNION ALL','INSERT INTO','VALUES','UPDATE','SET','DELETE FROM','AND','OR','NOT','IN','IS','NULL','BETWEEN','LIKE','ILIKE','CASE','WHEN','THEN','ELSE','END','OVER','PARTITION BY','RETURNING'];
    let out = sql;
    keywords.forEach(k => { out = out.replace(new RegExp(`\\b${k}\\b`, 'gi'), k); });
    ['FROM','WHERE','JOIN','INNER JOIN','LEFT JOIN','RIGHT JOIN','FULL OUTER JOIN','GROUP BY','ORDER BY','HAVING','LIMIT','UNION','UNION ALL','RETURNING'].forEach(k => {
        out = out.replace(new RegExp(`\\s+${k}\\b`, 'g'), `\n${k}`);
    });
    out = out.replace(/SELECT\s+/i, 'SELECT\n  ');
    out = out.replace(/,\s*/g, ',\n  ');
    return out.trim();
};

const estimateCost = (sql) => {
    const q = sql.toLowerCase();
    let score = 0;
    const warnings = [];
    if (q.includes('select *')) { score += 30; warnings.push({ level:'warn', msg:'SELECT * fetches all columns — specify needed columns' }); }
    if (!q.includes('where') && !q.includes('limit') && q.includes('select')) { score += 50; warnings.push({ level:'danger', msg:'No WHERE or LIMIT — full table scan likely' }); }
    if ((q.match(/join/g)||[]).length > 3) { score += 20; warnings.push({ level:'warn', msg:`${(q.match(/join/g)||[]).length} JOINs detected — verify indexes on join columns` }); }
    if (q.includes('like \'%')) { score += 15; warnings.push({ level:'warn', msg:'Leading wildcard LIKE — cannot use index' }); }
    if (q.includes('order by') && !q.includes('limit')) { score += 10; warnings.push({ level:'info', msg:'ORDER BY without LIMIT may sort entire result set' }); }
    if (q.includes('distinct')) { score += 10; warnings.push({ level:'info', msg:'DISTINCT requires a sort or hash — consider GROUP BY' }); }
    if (q.includes('not in')) { score += 15; warnings.push({ level:'warn', msg:'NOT IN with NULLs behaves unexpectedly — prefer NOT EXISTS' }); }
    return { score: Math.min(score, 100), warnings };
};

/* ═══════════════════════════════════════════════════════════════════════════
   MICRO COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */
const Spinner = ({ size=14, color=THEME.primary }) => (
    <div style={{ width:size, height:size, border:`2px solid ${color}20`, borderTopColor:color, borderRadius:'50%', animation:'sqlSpin 0.6s linear infinite', flexShrink:0 }}/>
);

const Badge = ({ label, color, pulse, size='sm', onClick }) => (
    <span onClick={onClick} style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:size==='xs'?9:10, fontWeight:700, padding:size==='xs'?'2px 7px':'3px 8px', borderRadius: 16, background:`${color}12`, color, border:`1px solid ${color}20`, lineHeight:1.2, whiteSpace:'nowrap', cursor:onClick?'pointer':'default' }}>
        <span className={pulse?'sql-badge-pulse':''} style={{ width:5, height:5, borderRadius:'50%', background:color, flexShrink:0 }}/>
        {label}
    </span>
);

const Divider = ({ vertical }) => (
    <div style={vertical ? { width:1, height:16, background:`${THEME.grid}50`, flexShrink:0 } : { width:'100%', height:1, background:`${THEME.grid}30` }}/>
);

const Pill = ({ label, color=THEME.textDim, onRemove }) => (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px', borderRadius:100, background:`${color}12`, color, fontSize:10, fontWeight:600, border:`1px solid ${color}20` }}>
        {label}
        {onRemove && <X size={9} style={{ cursor:'pointer' }} onClick={onRemove}/>}
    </span>
);

const IconBtn = ({ icon:Icon, onClick, active, disabled, title, color, size=12 }) => (
    <button onClick={onClick} disabled={disabled} title={title} className="sql-icon-btn sql-tooltip" data-tip={title}
            style={{ display:'inline-flex', alignItems:'center', padding:'4px', borderRadius: 16, border:'none', cursor:disabled?'not-allowed':'pointer', background:active?`${THEME.primary}12`:`${THEME.textDim}04`, color:active?THEME.primary:(color||THEME.textDim), transition:'all 0.15s', outline:active?`1px solid ${THEME.primary}20`:'none', opacity:disabled?0.4:1 }}>
        <Icon size={size}/>
    </button>
);

const Notification = ({ notifications, onDismiss }) => (
    <div style={{ position:'fixed', bottom:24, right:24, zIndex:600, display:'flex', flexDirection:'column', gap:6, maxWidth:340 }}>
        {notifications.map(n => (
            <div key={n.id} className="sql-notification" style={{ display:'flex', alignItems:'center', gap: 22, padding:'9px 12px', borderRadius: 18, background:n.type==='error'?`${THEME.danger}12`:`${THEME.success}08`, border:`1px solid ${n.type==='error'?THEME.danger:THEME.success}20`, boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
                {n.type==='error' ? <XCircle size={13} color={THEME.danger}/> : <CheckCircle size={13} color={THEME.success}/>}
                <span style={{ fontSize:11, fontWeight:600, color:n.type==='error'?THEME.danger:THEME.success, flex:1, minWidth:0 }}>{n.msg}</span>
                <X size={11} color={THEME.textDim} style={{ cursor:'pointer', flexShrink:0 }} onClick={() => onDismiss(n.id)}/>
            </div>
        ))}
    </div>
);

const CostMeter = ({ sql }) => {
    const { score, warnings } = useMemo(() => estimateCost(sql), [sql]);
    if (!sql.trim() || warnings.length === 0) return null;
    const color = score > 60 ? THEME.danger : score > 30 ? THEME.warning : THEME.success;
    return (
        <div style={{ padding:'6px 12px', borderTop:`1px solid ${THEME.glassBorder}`, background:THEME.surface, animation:'sqlSlideDown 0.2s ease' }}>
            <div style={{ display:'flex', alignItems:'center', gap: 20, marginBottom:4 }}>
                <FlameKindling size={10} color={color}/>
                <span style={{ fontSize:9, fontWeight:700, color:color, letterSpacing:'0.02em' }}>Query Cost Estimate</span>
                <div style={{ flex:1, minWidth:0, height:3, borderRadius: 18, background:`${THEME.grid}25`, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${score}%`, background:`linear-gradient(90deg, ${THEME.success}, ${score>60?THEME.danger:THEME.warning})`, borderRadius: 18, transition:'width 0.6s ease', transformOrigin:'left', animation:'sqlBarGrow 0.6s ease' }}/>
                </div>
                <span style={{ fontSize:9, color:color, fontWeight:700, fontVariantNumeric:'tabular-nums', width:30, textAlign:'right' }}>{score}/100</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                {warnings.map((w,i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:5 }}>
                        <span style={{ fontSize:8, width:4, height:4, borderRadius:'50%', background:w.level==='danger'?THEME.danger:w.level==='warn'?THEME.warning:THEME.textDim, flexShrink:0 }}/>
                        <span style={{ fontSize:10, color:w.level==='danger'?THEME.danger:w.level==='warn'?THEME.warning:THEME.textDim }}>{w.msg}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   PANEL
   ═══════════════════════════════════════════════════════════════════════════ */
const Panel = ({ title, icon:TIcon, rightNode, noPad, children, style={} }) => (
    <div style={{ background:THEME.surface, border:`1px solid ${THEME.glassBorder}`, borderRadius: 18, display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:`${THEME.shadowSm}`, transition:'all 0.25s ease', ...style }}>
        {title && (
            <div style={{ height:28, background:`${THEME.textMain}0a`, padding:'0 12px', borderBottom:`1px solid ${THEME.glassBorder}`, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, gap:6 }}>
                <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:THEME.danger, flexShrink:0 }} />
                    <div style={{ width:8, height:8, borderRadius:'50%', background:THEME.warning, flexShrink:0 }} />
                    <div style={{ width:8, height:8, borderRadius:'50%', background:THEME.success, flexShrink:0 }} />
                    <span style={{ fontSize:11, fontWeight:700, color:THEME.textMuted, letterSpacing:'0.03em', fontFamily:"'JetBrains Mono','Fira Code',monospace", marginLeft:8 }}>{title}</span>
                </div>
                {rightNode}
            </div>
        )}
        <div style={{ flex:1, minHeight:0, padding:noPad?0:'12px 14px', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
            {children}
        </div>
    </div>
);

/* ═══════════════════════════════════════════════════════════════════════════
   CHART VIEW
   ═══════════════════════════════════════════════════════════════════════════ */
const ChartView = ({ result }) => {
    const [xCol, setXCol] = useState('');
    const [yCol, setYCol] = useState('');
    const [chartType, setChartType] = useState('bar');
    const [advanced, setAdvanced] = useState(false);

    const fields = result?.fields || [];
    const rows = result?.rows || [];

    // Advanced mode: hand off live query results to the full ChartBuilder
    // (Highcharts/Recharts, more chart types, export). Map {fields,rows} to the
    // positional {columns, rows} shape ChartBuilder expects.
    if (advanced) {
        const columns = fields.map(f => f.name);
        const positionalRows = rows.map(r => columns.map(c => r[c]));
        return (
            <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
                <div style={{ display:'flex', justifyContent:'flex-end', padding:'4px 8px' }}>
                    <button onClick={() => setAdvanced(false)}
                        style={{ padding:'3px 10px', borderRadius:16, border:'none', cursor:'pointer',
                                 background:`${THEME.primary}12`, color:THEME.primary, fontSize:10, fontWeight:600 }}>
                        ← Simple chart
                    </button>
                </div>
                <div style={{ flex:1, minHeight:0 }}>
                    <ChartBuilder columns={columns} rows={positionalRows} />
                </div>
            </div>
        );
    }

    useEffect(() => {
        if (fields.length > 0 && !xCol) setXCol(fields[0].name);
        if (fields.length > 1 && !yCol) {
            const numericField = fields.find(f => {
                const val = rows[0]?.[f.name];
                return val !== null && !isNaN(Number(val));
            });
            setYCol(numericField?.name || fields[1].name);
        }
    }, [fields]);

    const chartData = useMemo(() => {
        if (!xCol || !yCol) return [];
        return rows.slice(0, 30).map(r => ({
            x: String(r[xCol] ?? ''),
            y: Number(r[yCol] ?? 0),
        }));
    }, [rows, xCol, yCol]);

    if (!chartData.length) return (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', opacity:0.4 }}>
            <span style={{ fontSize:12, color:THEME.textDim }}>No numeric data to chart</span>
        </div>
    );

    const maxY = chartData.length > 0 ? Math.max(...chartData.map(d => d.y)) : 1;

    return (
        <div style={{ display:'flex', flexDirection:'column', height:'100%', padding:'10px 12px', gap: 22 }}>
            {/* Controls */}
            <div style={{ display:'flex', gap: 22, alignItems:'center', flexShrink:0 }}>
                <span style={{ fontSize:10, color:THEME.textDim }}>X:</span>
                <select value={xCol} onChange={e=>setXCol(e.target.value)} style={{ padding:'3px 8px', borderRadius: 16, border:`1px solid ${THEME.grid}40`, background:THEME.surface, color:THEME.textMain, fontSize:10, outline:'none', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
                    {fields.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
                </select>
                <span style={{ fontSize:10, color:THEME.textDim }}>Y:</span>
                <select value={yCol} onChange={e=>setYCol(e.target.value)} style={{ padding:'3px 8px', borderRadius: 16, border:`1px solid ${THEME.grid}40`, background:THEME.surface, color:THEME.textMain, fontSize:10, outline:'none', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
                    {fields.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
                </select>
                <Divider vertical/>
                {[{id:'bar',icon:<BarChart3 size={11}/>},{id:'line',icon:<LineChart size={11}/>},{id:'pie',icon:<span style={{fontSize:10}}>◉</span>}].map(t => (
                    <button key={t.id} onClick={()=>setChartType(t.id)} style={{ padding:'3px 8px', borderRadius: 16, border:'none', cursor:'pointer', background:chartType===t.id?`${THEME.primary}12`:`${THEME.textDim}06`, color:chartType===t.id?THEME.primary:THEME.textDim, fontSize:10, fontWeight:600, boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
                        {t.icon}
                    </button>
                ))}
                <button onClick={() => setAdvanced(true)} title="Open advanced chart builder"
                    style={{ marginLeft:'auto', padding:'3px 10px', borderRadius:16, border:'none', cursor:'pointer',
                             background:`${THEME.primary}12`, color:THEME.primary, fontSize:10, fontWeight:600 }}>
                    Advanced ⤢
                </button>
                <span style={{ fontSize:9, color:THEME.textDim }}>Top 30 rows</span>
            </div>

            {/* Chart */}
            <div style={{ flex:1, minWidth:0, overflow:'hidden', position:'relative' }}>
                <svg width="100%" height="100%" style={{ overflow:'visible' }}>
                    {chartType === 'bar' && (() => {
                        const svgRef = React.createRef();
                        const barW = 100 / chartData.length;
                        return (
                            <g>
                                {chartData.map((d, i) => {
                                    const barH = (d.y / maxY) * 85;
                                    return (
                                        <g key={i}>
                                            <rect
                                                x={`${i * barW + barW * 0.1}%`} y={`${95 - barH}%`}
                                                width={`${barW * 0.8}%`} height={`${barH}%`}
                                                fill={`${THEME.primary}90`} rx="2"
                                                className="sql-chart-bar"
                                                style={{ cursor:'default' }}
                                            />
                                            <title>{`${d.x}: ${d.y.toLocaleString()}`}</title>
                                            {i % Math.ceil(chartData.length / 8) === 0 && (
                                                <text x={`${i * barW + barW * 0.5}%`} y="99%" textAnchor="middle" fontSize="8" fill={THEME.textDim} fontFamily="monospace">
                                                    {String(d.x).slice(0, 8)}
                                                </text>
                                            )}
                                        </g>
                                    );
                                })}
                                <line x1="0" y1="95%" x2="100%" y2="95%" stroke={THEME.grid} strokeWidth="1"/>
                            </g>
                        );
                    })()}
                    {chartType === 'line' && (() => {
                        const pts = chartData.map((d, i) => {
                            const x = (i / (chartData.length - 1)) * 100;
                            const y = 95 - (d.y / maxY) * 85;
                            return `${x}%,${y}%`;
                        }).join(' ');
                        return (
                            <g>
                                <polyline points={pts} fill="none" stroke={THEME.primary} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
                                {chartData.map((d, i) => (
                                    <circle key={i} cx={`${(i / (chartData.length - 1)) * 100}%`} cy={`${95 - (d.y / maxY) * 85}%`} r="3" fill={THEME.primary}>
                                        <title>{`${d.x}: ${d.y.toLocaleString()}`}</title>
                                    </circle>
                                ))}
                                <line x1="0" y1="95%" x2="100%" y2="95%" stroke={THEME.grid} strokeWidth="1"/>
                            </g>
                        );
                    })()}
                    {chartType === 'pie' && (() => {
                        const total = chartData.reduce((s,d)=>s+Math.abs(d.y),0) || 1;
                        const colors = [THEME.info, THEME.success, THEME.warning, THEME.danger, THEME.secondary, THEME.warning, THEME.success, THEME.primaryLight];
                        let angle = -Math.PI / 2;
                        const cx = 50, cy = 48, r = 38;
                        const slices = chartData.slice(0,8).map((d,i) => {
                            const sweep = (Math.abs(d.y) / total) * 2 * Math.PI;
                            const x1 = cx + r * Math.cos(angle);
                            const y1 = cy + r * Math.sin(angle);
                            angle += sweep;
                            const x2 = cx + r * Math.cos(angle);
                            const y2 = cy + r * Math.sin(angle);
                            const large = sweep > Math.PI ? 1 : 0;
                            const midA = angle - sweep / 2;
                            const lx = cx + (r+10) * Math.cos(midA);
                            const ly = cy + (r+10) * Math.sin(midA);
                            return { x1,y1,x2,y2,large,color:colors[i%colors.length],pct:Math.round((Math.abs(d.y)/total)*100),label:d.x,lx,ly };
                        });
                        return (
                            <g transform="scale(2) translate(0,0)" style={{ transformOrigin:'center' }}>
                                {slices.map((s,i)=>(
                                    <path key={i} d={`M${cx},${cy} L${s.x1},${s.y1} A${r},${r},0,${s.large},1,${s.x2},${s.y2}Z`}
                                        fill={s.color} opacity={0.85} stroke="#000" strokeWidth="0.5">
                                        <title>{`${s.label}: ${s.pct}%`}</title>
                                    </path>
                                ))}
                                {slices.filter(s=>s.pct>5).map((s,i)=>(
                                    <text key={i} x={s.lx} y={s.ly} textAnchor="middle" fontSize="5" fill={THEME.textMain} fontFamily="monospace">
                                        {s.pct}%
                                    </text>
                                ))}
                            </g>
                        );
                    })()}
                </svg>
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   EXPLAIN PLAN TREE
   ═══════════════════════════════════════════════════════════════════════════ */
const ExplainNode = ({ node, depth=0, maxTime }) => {
    const [expanded, setExpanded] = useState(true);
    if (!node) return null;
    const nodeType = node['Node Type'] || 'Unknown';
    const relation = node['Relation Name'] || node['Index Name'] || '';
    const cost = node['Total Cost'] != null ? node['Total Cost'].toFixed(1) : null;
    const rows = node['Actual Rows'] ?? node['Plan Rows'];
    const time = node['Actual Total Time'] != null ? Number(node['Actual Total Time']) : null;
    const plans = node['Plans'] || [];
    const loops = node['Actual Loops'] || 1;
    const bufHit = node['Shared Hit Blocks'] || 0;
    const bufRead = node['Shared Read Blocks'] || 0;
    const buffers = bufHit + bufRead;
    const pctOfTotal = maxTime && time ? Math.min(100, (time / maxTime) * 100) : 0;
    const nodeColor = time > 100 ? THEME.danger : time > 20 ? THEME.warning : THEME.success;
    const isExpensive = time > 50;

    return (
        <div style={{ marginLeft:depth*20, animation:'sqlFadeIn 0.15s ease' }}>
            <div onClick={() => setExpanded(!expanded)} style={{ display:'flex', alignItems:'center', gap: 20, padding:'8px 11px', borderRadius: 18, cursor:'pointer', background:isExpensive?`${THEME.danger}04`:THEME.surface, border:`1px solid ${isExpensive?`${THEME.danger}18`:`${THEME.grid}30`}`, marginBottom:3, transition:'all 0.12s', position:'relative', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
                {pctOfTotal > 0 && (
                    <div style={{ position:'absolute', left:0, top:0, bottom:0, width:`${pctOfTotal}%`, background:`${nodeColor}06`, pointerEvents:'none', transformOrigin:'left', animation:'sqlBarGrow 0.6s ease' }}/>
                )}
                {plans.length > 0 && <ChevronRight size={10} color={THEME.textDim} style={{ flexShrink:0, transition:'transform 0.15s', transform:expanded?'rotate(90deg)':'none', position:'relative' }}/>}
                <span style={{ width:7, height:7, borderRadius:'50%', background:nodeColor, flexShrink:0, position:'relative' }}/>
                <span style={{ fontSize:12, fontWeight:700, color:THEME.textMain, position:'relative' }}>{nodeType}</span>
                {relation && <span style={{ fontSize:11, color:THEME.primary, fontFamily:'monospace', fontWeight:600, position:'relative' }}>{relation}</span>}
                {loops > 1 && <span style={{ fontSize:9, color:THEME.warning, fontWeight:700, padding:'1px 5px', borderRadius:3, background:`${THEME.warning}12` }}>×{loops}</span>}
                <div style={{ marginLeft:'auto', display:'flex', gap: 22, flexShrink:0, position:'relative' }}>
                    {time != null && <span style={{ fontSize:10, fontWeight:700, color:nodeColor, fontVariantNumeric:'tabular-nums' }}>{time.toFixed(2)}ms</span>}
                    {rows != null && <span style={{ fontSize:10, color:THEME.textDim, fontVariantNumeric:'tabular-nums' }}>{Number(rows).toLocaleString()}r</span>}
                    {cost != null && <span style={{ fontSize:10, color:THEME.textDim }}>cost:{cost}</span>}
                    {buffers > 0 && <span style={{ fontSize:10, color:THEME.textDim }}>{bufHit}hit/{bufRead}miss</span>}
                </div>
            </div>
            {expanded && plans.map((child, i) => <ExplainNode key={i} node={child} depth={depth+1} maxTime={maxTime}/>)}
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   DIFF VIEWER
   ═══════════════════════════════════════════════════════════════════════════ */
const DiffViewer = ({ leftRows, rightRows, leftFields, rightFields, leftLabel, rightLabel }) => {
    if (!leftRows || !rightRows) return (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap: 22, opacity:0.4 }}>
            <Diff size={28} color={THEME.textDim}/>
            <span style={{ fontSize:12, color:THEME.textDim }}>Run queries on two tabs, then diff them here</span>
        </div>
    );
    const allKeys = [...new Set([...(leftFields||[]).map(f=>f.name), ...(rightFields||[]).map(f=>f.name)])];
    const leftSet = new Set(leftRows.map(r => JSON.stringify(r)));
    const rightSet = new Set(rightRows.map(r => JSON.stringify(r)));
    const onlyLeft = leftRows.filter(r => !rightSet.has(JSON.stringify(r))).length;
    const onlyRight = rightRows.filter(r => !leftSet.has(JSON.stringify(r))).length;

    return (
        <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
            <div style={{ display:'flex', alignItems:'center', gap: 20, padding:'6px 12px', borderBottom:`1px solid ${THEME.grid}20`, fontSize:10, flexShrink:0 }}>
                <span style={{ color:THEME.danger, fontWeight:700 }}>−{onlyLeft} removed</span>
                <span style={{ color:THEME.success, fontWeight:700 }}>+{onlyRight} added</span>
                <span style={{ color:THEME.textDim }}>={leftRows.filter(r=>rightSet.has(JSON.stringify(r))).length} shared</span>
            </div>
            <div style={{ flex:1, minWidth:0, overflow:'auto', display:'flex', gap:1 }} className="sql-scrollbar">
                {[{ rows:leftRows, set:rightSet, side:'left', label:leftLabel||'Left', isAdd:false },
                    { rows:rightRows, set:leftSet, side:'right', label:rightLabel||'Right', isAdd:true }].map(({ rows, set, side, label, isAdd }) => (
                    <div key={side} style={{ flex:1, minWidth:0 }}>
                        <div style={{ padding:'5px 10px', background:THEME.surface, fontSize:10, fontWeight:700, color:THEME.textDim, letterSpacing:'0.02em', borderBottom:`1px solid ${THEME.grid}25`, position:'sticky', top:0, zIndex:2 }}>
                            {label} ({rows.length} rows)
                        </div>
                        <table style={{ width:'100%', borderCollapse:'collapse' }}>
                            <thead>
                            <tr>{allKeys.map(k=><th key={k} style={{ padding:'5px 9px', fontSize:10, fontWeight:700, color:THEME.textDim, textAlign:'left', position:'sticky', top:28, background:THEME.surface, borderBottom:`1px solid ${THEME.grid}25` }}>{k}</th>)}</tr>
                            </thead>
                            <tbody>
                            {rows.map((row,ri)=>{
                                const serialized = JSON.stringify(row);
                                const inOther = set.has(serialized);
                                return (
                                    <tr key={ri} className={inOther?'':(isAdd?'sql-diff-add':'sql-diff-remove')}>
                                        {allKeys.map(k=><td key={k} style={{ padding:'5px 9px', fontSize:11, color:THEME.textMuted, fontFamily:'monospace', borderBottom:`1px solid ${THEME.grid}10`, flex:1, minWidth:0, maxWidth:'unset', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{row[k]??<span style={{fontSize:9,opacity:.5}}>NULL</span>}</td>)}
                                    </tr>
                                );
                            })}
                            </tbody>
                        </table>
                    </div>
                ))}
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   AUTOCOMPLETE
   ═══════════════════════════════════════════════════════════════════════════ */
const AutoComplete = ({ suggestions, onSelect, anchorRect }) => {
    const [idx, setIdx] = useState(0);
    useEffect(() => setIdx(0), [suggestions]);
    if (!suggestions.length) return null;
    return (
        <div className="sql-suggest-box" style={{ position:'fixed', zIndex:600, top:(anchorRect?.top||0)+20, left:(anchorRect?.left||0), background:THEME.surface, border:`1px solid ${THEME.primary}25`, borderRadius: 16, overflow:'hidden', minWidth:220, maxWidth:360, boxShadow:`0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px ${THEME.primary}12` }}>
            <div style={{ padding:'4px 10px', borderBottom:`1px solid ${THEME.grid}25`, fontSize:9, color:THEME.textDim, fontWeight:600, letterSpacing:'0.02em' }}>
                {suggestions.length} completions · Tab to accept
            </div>
            {suggestions.slice(0,8).map((s,i) => (
                <div key={s} onMouseDown={e=>{ e.preventDefault(); onSelect(s); }}
                     style={{ padding:'6px 11px', fontSize:12, cursor:'pointer', color:i===idx?THEME.primary:THEME.textMuted, background:i===idx?`${THEME.primary}08`:'transparent', fontFamily:'monospace', fontWeight:i===idx?700:500, display:'flex', alignItems:'center', gap:6, borderRadius: 18}}>
                    <Code size={9} style={{ opacity:0.4 }}/> {s}
                    <span style={{ fontSize:9, color:THEME.textDim, marginLeft:'auto' }}>keyword</span>
                </div>
            ))}
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   PARAMETER EDITOR
   ═══════════════════════════════════════════════════════════════════════════ */
const ParamEditor = ({ sql, params, onChange }) => {
    const paramMatches = useMemo(() => {
        const regex = /:([a-zA-Z_][a-zA-Z0-9_]*)/g;
        const found = new Set();
        let m;
        while ((m = regex.exec(sql)) !== null) found.add(m[1]);
        return [...found];
    }, [sql]);
    if (paramMatches.length === 0) return null;
    return (
        <div style={{ padding:'7px 12px', borderTop:`1px solid ${THEME.glassBorder}`, background:THEME.surface, display:'flex', flexWrap:'wrap', gap: 20, alignItems:'center', animation:'sqlSlideDown 0.2s ease', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
            <Variable size={11} color={THEME.warning}/>
            <span style={{ fontSize:10, fontWeight:700, color:THEME.warning }}>Parameters</span>
            <Divider vertical/>
            {paramMatches.map(p => (
                <div key={p} style={{ display:'flex', alignItems:'center', gap:5 }}>
                    <span style={{ fontSize:10, fontWeight:700, color:THEME.warning, fontFamily:'monospace' }}>:{p}</span>
                    <span style={{ fontSize:10, color:THEME.textDim }}>=</span>
                    <input value={params[p]||''} onChange={e => onChange({ ...params, [p]:e.target.value })} placeholder="value"
                           style={{ padding:'3px 8px', borderRadius: 16, border:`1px solid ${THEME.warning}20`, background:`${THEME.warning}04`, color:THEME.textMain, fontSize:11, outline:'none', fontFamily:'monospace', width:90, boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}/>
                </div>
            ))}
            {Object.keys(params).length > 0 && (
                <button onClick={()=>onChange({})} style={{ padding:'2px 7px', borderRadius: 18, border:'none', cursor:'pointer', background:`${THEME.danger}08`, color:THEME.danger, fontSize:9, fontWeight:700, boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>Clear</button>
            )}
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   SCHEMA BROWSER
   ═══════════════════════════════════════════════════════════════════════════ */
const SchemaBrowser = ({ onInsert, schema = {} }) => {
    const [expanded, setExpanded] = useState({ public:true });
    const [expandedTables, setExpandedTables] = useState({});
    const [search, setSearch] = useState('');
    const filtered = useMemo(() => {
        const schemaArray = Object.entries(schema).map(([schemaName, tables]) => ({
            name: schemaName,
            tables: Object.entries(tables || {}).map(([tableName, cols]) => ({
                name: tableName,
                cols: Array.isArray(cols) ? cols.map(c => ({ n: c.name, t: c.type })) : []
            }))
        }));
        if (!search) return schemaArray;
        return schemaArray.map(s => ({
            ...s, tables:s.tables.filter(t =>
                t.name.includes(search.toLowerCase()) || t.cols.some(c => c.n.includes(search.toLowerCase()))
            )
        })).filter(s => s.tables.length > 0);
    }, [search, schema]);
    return (
        <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
            <div style={{ padding:'7px 10px', borderBottom:`1px solid ${THEME.glassBorder}` }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 9px', borderRadius: 16, background:THEME.surface, border:`1px solid ${THEME.grid}35`, boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
                    <Search size={11} color={THEME.textDim}/>
                    <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search tables, columns…" style={{ border:'none', background:'transparent', color:THEME.textMain, outline:'none', flex:1, minWidth:0, fontSize:11, fontFamily:'inherit' }}/>
                    {search && <X size={10} style={{ cursor:'pointer', color:THEME.textDim }} onClick={()=>setSearch('')}/>}
                </div>
            </div>
            <div className="sql-scrollbar" style={{ flex:1, minHeight:0, overflowY:'auto', padding:'6px 8px', gap: 18 }}>
                {filtered.map(schema => (
                    <div key={schema.name}>
                        <div onClick={() => setExpanded(p=>({...p,[schema.name]:!p[schema.name]}))}
                             style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 8px', cursor:'pointer', borderRadius: 16, marginBottom:2, boxShadow:'0 1px 3px rgba(0,0,0,0.02)' }}>
                            <ChevronRight size={10} color={THEME.textDim} style={{ transform:expanded[schema.name]?'rotate(90deg)':'none', transition:'transform 0.15s' }}/>
                            <Database size={11} color={THEME.secondary}/>
                            <span style={{ fontSize:11, fontWeight:700, color:THEME.textMuted }}>{schema.name}</span>
                            <span style={{ fontSize:9, color:THEME.textDim, marginLeft:'auto' }}>{schema.tables.length} tables</span>
                        </div>
                        {expanded[schema.name] && schema.tables.map(table => (
                            <div key={table.name} style={{ marginLeft:16 }}>
                                <div onClick={() => setExpandedTables(p=>({...p,[`${schema.name}.${table.name}`]:!p[`${schema.name}.${table.name}`]}))}
                                     style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 8px', cursor:'pointer', borderRadius: 16 }}
                                     onMouseEnter={e=>e.currentTarget.style.background=`${THEME.primary}08`}
                                     onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                                    <ChevronRight size={9} color={THEME.textDim} style={{ transform:expandedTables[`${schema.name}.${table.name}`]?'rotate(90deg)':'none', transition:'transform 0.15s', flexShrink:0 }}/>
                                    <Table2 size={10} color={THEME.primary}/>
                                    <span style={{ fontSize:11, color:THEME.textMain, flex:1, minWidth:0 }}>{table.name}</span>
                                    <button onMouseDown={e=>{e.stopPropagation();onInsert(`SELECT * FROM ${schema.name}.${table.name} LIMIT 50;`);}}
                                            style={{ padding:'1px 6px', borderRadius:3, border:'none', cursor:'pointer', background:`${THEME.primary}12`, color:THEME.primary, fontSize:8, fontWeight:700, opacity:0 }}
                                            className="sql-preview-btn"
                                            onMouseEnter={e=>e.currentTarget.style.opacity='1'} onMouseLeave={e=>e.currentTarget.style.opacity='0'}>
                                        SELECT
                                    </button>
                                </div>
                                {expandedTables[`${schema.name}.${table.name}`] && table.cols.map(col => (
                                    <div key={col.n} onClick={() => onInsert(col.n)}
                                         style={{ display:'flex', alignItems:'center', gap:6, padding:'3px 8px 3px 28px', cursor:'pointer', borderRadius: 16 }}
                                         onMouseEnter={e=>e.currentTarget.style.background=`${THEME.primary}06`}
                                         onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                                        <Columns size={9} color={THEME.textDim}/>
                                        <span style={{ fontSize:10, color:THEME.textMuted, fontFamily:'monospace', flex:1, minWidth:0 }}>{col.n}</span>
                                        <span style={{ fontSize:8, color:TYPE_COLOR_MAP[col.t]||THEME.textDim, fontFamily:'monospace', flexShrink:0 }}>{col.t}</span>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   AI ASSISTANT PANEL
   ═══════════════════════════════════════════════════════════════════════════ */
const AIAssistPanel = ({ sql, result, onSuggest }) => {
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [conversation, setConversation] = useState([]);

    const autoSuggestions = useMemo(() => {
        if (!sql.trim()) return [];
        return AI_SUGGESTIONS.filter((_, i) => (sql.length + i) % 3 === 0).slice(0, 3);
    }, [sql]);

    const handleAsk = async () => {
        if (!prompt.trim()) return;
        const userMsg = prompt.trim();
        setPrompt('');
        setConversation(p => [...p, { role:'user', text:userMsg }]);
        setLoading(true);
        // Simulate AI response (replace with real API call)
        await new Promise(r => setTimeout(r, 800));
        const resp = `Based on your query, I suggest: ${autoSuggestions[0] || 'ensure indexes are on join columns for best performance'}. ${result ? `Your last query returned ${result.rowCount?.toLocaleString()} rows in ${fmtMs(result.duration)}.` : ''}`;
        setConversation(p => [...p, { role:'assistant', text:resp }]);
        setLoading(false);
    };

    return (
        <div style={{ display:'flex', flexDirection:'column', height:'100%', gap: 20 }}>
            {autoSuggestions.length > 0 && (
                <div style={{ flexShrink:0 }}>
                    <div style={{ fontSize:9, fontWeight:700, color:THEME.textDim, letterSpacing:'0.02em', marginBottom:5 }}>Quick Tips</div>
                    {autoSuggestions.map((s,i) => (
                        <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:7, padding:'7px 9px', borderRadius: 18, background:`${THEME.secondary}07`, border:`1px solid ${THEME.secondary}12`, marginBottom:4, cursor:'pointer' }}
                             onClick={() => onSuggest(s)}>
                            <Lightbulb size={10} color={THEME.secondary} style={{ marginTop:1, flexShrink:0 }}/>
                            <span style={{ fontSize:10.5, color:THEME.textMuted, lineHeight:1.5 }}>{s}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Conversation */}
            <div className="sql-scrollbar" style={{ flex:1, minHeight:0, overflowY:'auto', display:'flex', flexDirection:'column', gap:6 }}>
                {conversation.length === 0 && (
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', opacity:0.4, gap: 20 }}>
                        <BrainCircuit size={24} color={THEME.secondary}/>
                        <span style={{ fontSize:11, color:THEME.textDim, textAlign:'center' }}>Ask anything about your queries, performance, or schema</span>
                    </div>
                )}
                {conversation.map((m, i) => (
                    <div key={i} style={{ padding:'8px 10px', borderRadius: 18, background:m.role==='user'?`${THEME.primary}10`:`${THEME.secondary}08`, border:`1px solid ${m.role==='user'?`${THEME.primary}15`:`${THEME.secondary}12`}`, animation:'sqlFadeIn 0.2s ease' }}>
                        <div style={{ fontSize:9, fontWeight:700, color:m.role==='user'?THEME.primary:THEME.secondary, letterSpacing:'0.02em', marginBottom:4 }}>{m.role==='user'?'You':'AI Assistant'}</div>
                        <span style={{ fontSize:11, color:THEME.textMuted, lineHeight:1.6 }}>{m.text}</span>
                    </div>
                ))}
                {loading && (
                    <div style={{ display:'flex', alignItems:'center', gap: 20, padding:'8px 10px' }}>
                        <Spinner size={12} color={THEME.secondary}/> <span style={{ fontSize:10, color:THEME.textDim }}>Thinking…</span>
                    </div>
                )}
            </div>

            {/* Input */}
            <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                <input value={prompt} onChange={e=>setPrompt(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleAsk()} placeholder="Ask about your query…"
                       style={{ flex:1, minWidth:0, padding:'6px 10px', borderRadius: 18, border:`1px solid ${THEME.secondary}25`, background:`${THEME.secondary}06`, color:THEME.textMain, fontSize:11, outline:'none', fontFamily:'inherit' }}/>
                <button onClick={handleAsk} disabled={!prompt.trim()||loading} style={{ padding:'6px 12px', borderRadius: 16, border:'none', cursor:'pointer', background:`${THEME.secondary}10`, color:THEME.secondary, fontSize:10, fontWeight:700, display:'flex', alignItems:'center', gap:4, opacity:(!prompt.trim()||loading)?0.4:1, boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
                    {loading?<Spinner size={10} color={THEME.secondary}/>:<Sparkles size={10}/>} Ask
                </button>
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   CELL RENDERER
   ═══════════════════════════════════════════════════════════════════════════ */
const Cell = ({ value }) => {
    const [expanded, setExpanded] = useState(false);
    const type = inferCellType(value);
    if (type === 'null') return <span className="sql-cell-null">NULL</span>;
    const s = String(value);
    if (type === 'bool') return <span className={s==='true'||s==='t'?'sql-cell-bool-true':'sql-cell-bool-false'}>{s}</span>;
    if (type === 'date') return <span className="sql-cell-date">{s}</span>;
    if (type === 'uuid') return <span className="sql-cell-uuid">{s}</span>;
    if (type === 'number') return <span className="sql-cell-number">{Number(s).toLocaleString()}</span>;
    if (type === 'json') return (
        <span title={s} style={{ color:THEME.purple, fontSize:10, cursor:'pointer' }} onClick={()=>setExpanded(!expanded)}>
            {expanded ? s : `${s.slice(0,40)}…`}
        </span>
    );
    if (type === 'long') return (
        <span className="sql-cell-long" title={s} onClick={()=>setExpanded(!expanded)}>
            {expanded ? s : `${s.slice(0, CELL_EXPAND_THRESHOLD)}…`}
        </span>
    );
    return <span>{s}</span>;
};

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
const SqlConsoleTab = () => {
    useAdaptiveTheme(); // keeps THEME in sync with dark/light toggle
    /* ── Tabs ── */
    const [tabs, dispatch] = useReducer(tabReducer, [makeTab(1)]);
    const [activeTab, setActiveTab] = useState(1);
    const [tabCounter, setTabCounter] = useState(2);

    const currentTab = useMemo(() => tabs.find(t=>t.id===activeTab) || tabs[0], [tabs, activeTab]);
    const updateTab = useCallback((id, patch) => dispatch({ type:'UPDATE_TAB', id, patch }), []);

    /* ── Global state ── */
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeResultTab, setActiveResultTab] = useState('results');
    const [showTemplates, setShowTemplates] = useState(false);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [editorExpanded, setEditorExpanded] = useState(false);
    const [copiedId, setCopiedId] = useState(null);
    const [selectedHistoryId, setSelectedHistoryId] = useState(null);
    const [favorites, setFavorites] = useState(new Set());
    const [elapsedMs, setElapsedMs] = useState(0);
    const [readOnly, setReadOnly] = useState(false);
    const [savedQueries, setSavedQueries] = useState([]);
    const [activePanel, setActivePanel] = useState('history');
    const [params, setParams] = useState({});
    const [pageSize, setPageSize] = useState(50);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [showDiff, setShowDiff] = useState(false);
    const [diffTabIds, setDiffTabIds] = useState([null, null]);
    const [txActive, setTxActive] = useState(false);
    const [txMode, setTxMode] = useState(false); // ★ NEW: auto-wrap queries in transaction
    const [autoChart, setAutoChart] = useState(false); // ★ NEW: auto-switch to chart when results are numeric
    const [queryTimeout, setQueryTimeout] = useState(30);
    const [showSettings, setShowSettings] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [suggestAnchor, setSuggestAnchor] = useState(null);
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [saveLabel, setSaveLabel] = useState('');
    const [filterText, setFilterText] = useState('');
    const [colFilter, setColFilter] = useState({});
    const [historySearch, setHistorySearch] = useState('');
    const [notifications, setNotifications] = useState([]);
    const [pinnedTabIds, setPinnedTabIds] = useState(new Set());
    const [showCostAnalysis, setShowCostAnalysis] = useState(true);
    const [selectedRows, setSelectedRows] = useState(new Set());
    const [liveRefreshInterval, setLiveRefreshInterval] = useState(null);
    const [liveRefreshSecs, setLiveRefreshSecs] = useState(5);
    const [showLiveConfig, setShowLiveConfig] = useState(false);
    const [rowHeight, setRowHeight] = useState('compact'); // 'compact'|'normal'|'relaxed'
    const [schema, setSchema] = useState({});

    const editorRef = useRef(null);
    const timerRef = useRef(null);
    const startTsRef = useRef(null);
    const liveTimerRef = useRef(null);

    const setSql = useCallback((val) => updateTab(activeTab, { sql:val }), [updateTab, activeTab]);

    /* ── Notifications ── */
    const notify = useCallback((msg, type='success') => {
        const id = Date.now();
        setNotifications(p => [...p, { id, msg, type }]);
        setTimeout(() => setNotifications(p => p.filter(n => n.id !== id)), 4000);
    }, []);

    /* ── Timer ── */
    const startTimer = useCallback(() => {
        startTsRef.current = performance.now();
        setElapsedMs(0);
        timerRef.current = setInterval(() => setElapsedMs(Math.round(performance.now() - startTsRef.current)), 50);
    }, []);
    const stopTimer = useCallback(() => { clearInterval(timerRef.current); timerRef.current = null; }, []);
    useEffect(() => () => { clearInterval(timerRef.current); clearInterval(liveTimerRef.current); }, []);

    /* ── Fetch schema ── */
    useEffect(() => {
        const loadSchema = async () => {
            try {
                const data = await fetchData('/api/schema/browser');
                setSchema(data || {});
            } catch (err) {
                console.error('Failed to load schema:', err);
            }
        };
        loadSchema();
    }, []);

    /* ── Autocomplete ── */
    const handleSuggest = useCallback((e) => {
        const ta = e.target;
        const val = ta.value;
        const pos = ta.selectionStart;
        const before = val.slice(0, pos);
        const lastWord = before.match(/\b(\w+)$/)?.[1] || '';
        if (lastWord.length < 2) { setSuggestions([]); return; }
        const matches = SQL_KEYWORDS.filter(k => k.toLowerCase().startsWith(lastWord.toLowerCase()) && k !== lastWord);
        setSuggestions(matches.slice(0, 8));
        if (matches.length > 0) {
            const rect = ta.getBoundingClientRect();
            setSuggestAnchor({ top:rect.top + 60, left:rect.left + 20 });
        }
    }, []);

    const applySuggestion = useCallback((sug) => {
        const ta = editorRef.current;
        if (!ta) return;
        const val = ta.value;
        const pos = ta.selectionStart;
        const before = val.slice(0, pos);
        const lastWordMatch = before.match(/\b\w+$/);
        if (!lastWordMatch) return;
        const start = pos - lastWordMatch[0].length;
        const newVal = val.slice(0, start) + sug + val.slice(pos);
        setSql(newVal);
        setSuggestions([]);
        requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = start + sug.length; ta.focus(); });
    }, [setSql]);

    /* ── Resolved SQL ── */
    const resolvedSql = useMemo(() => {
        let q = currentTab.sql;
        Object.entries(params).forEach(([k,v]) => { q = q.replace(new RegExp(`:${k}\\b`, 'g'), v); });
        return q;
    }, [currentTab.sql, params]);

    /* ── Cell processing ── */
    const processData = useCallback((rows) => {
        if (!Array.isArray(rows)) return [];
        return rows.map(row => {
            const out = {};
            Object.keys(row).forEach(k => {
                let v = row[k];
                if (v === null || v === undefined) { out[k] = null; return; }
                if (typeof v === 'object') { try { v = JSON.stringify(v); } catch { v = '[Object]'; } }
                else v = String(v);
                out[k] = v.length > 500 ? v.slice(0, 500) + '…' : v;
            });
            return out;
        });
    }, []);

    /* ── Processed rows ── */
    const { sortCol, sortDir, page, result, pinnedCols=[], hiddenCols=[] } = currentTab;
    const processedRows = useMemo(() => {
        if (!result?.rows) return [];
        let rows = processData(result.rows);
        Object.entries(colFilter).forEach(([col, val]) => {
            if (val) rows = rows.filter(r => String(r[col]||'').toLowerCase().includes(val.toLowerCase()));
        });
        if (filterText) rows = rows.filter(r => Object.values(r).some(v => String(v||'').toLowerCase().includes(filterText.toLowerCase())));
        if (sortCol) {
            rows = [...rows].sort((a, b) => {
                const av = a[sortCol], bv = b[sortCol];
                if (av===null&&bv===null) return 0; if (av===null) return 1; if (bv===null) return -1;
                const na = Number(av), nb = Number(bv);
                if (!isNaN(na)&&!isNaN(nb)) return sortDir==='asc'?na-nb:nb-na;
                return sortDir==='asc'?String(av).localeCompare(String(bv)):String(bv).localeCompare(String(av));
            });
        }
        return rows;
    }, [result, processData, sortCol, sortDir, filterText, colFilter]);

    const totalPages = Math.ceil(processedRows.length / pageSize);
    const pagedRows = processedRows.slice((page-1)*pageSize, page*pageSize);

    /* ── Visible fields (respecting hidden/pinned) ── */
    const visibleFields = useMemo(() => {
        if (!result?.fields) return [];
        const fields = result.fields.filter(f => !hiddenCols.includes(f.name));
        const pinned = fields.filter(f => pinnedCols.includes(f.name));
        const rest = fields.filter(f => !pinnedCols.includes(f.name));
        return [...pinned, ...rest];
    }, [result, hiddenCols, pinnedCols]);

    /* ── Column stats ── */
    const colStats = useMemo(() => {
        if (!result?.rows || !result?.fields) return {};
        const stats = {};
        result.fields.forEach(f => {
            const vals = result.rows.map(r => r[f.name]).filter(v => v !== null && v !== undefined);
            const nums = vals.map(Number).filter(n => !isNaN(n));
            stats[f.name] = {
                nullCount: result.rows.length - vals.length,
                uniqueCount: new Set(vals.map(String)).size,
                ...(nums.length > 0 ? {
                    min: Math.min(...nums),
                    max: Math.max(...nums),
                    avg: nums.reduce((a,b) => a+b, 0) / nums.length,
                } : {}),
            };
        });
        return stats;
    }, [result]);

    /* ── History ── */
    const addToHistory = useCallback((query, res, err) => {
        setHistory(prev => [{
            id: Date.now(), sql:query, ts:new Date().toISOString(),
            success: !err, rowCount:res?.rowCount||0, durationMs:res?.duration||0, error:err,
            tabId: activeTab,
        }, ...prev].slice(0, MAX_HISTORY));
    }, [activeTab]);

    const filteredHistory = useMemo(() => {
        if (!historySearch.trim()) return history;
        const q = historySearch.toLowerCase();
        return history.filter(h => h.sql.toLowerCase().includes(q));
    }, [history, historySearch]);

    const toggleFav = useCallback((id) => {
        setFavorites(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }, []);

    /* ══════════════════════════════════════════════════════════
       EXECUTE
       ══════════════════════════════════════════════════════════ */
    const handleExecute = useCallback(async (overrideSql) => {
        const query = (overrideSql || resolvedSql || '').trim();
        if (!query || loading) return;
        if (readOnly && detectWriteOp(query)) {
            notify('🔒 Read-only mode active — write operations blocked', 'error');
            updateTab(activeTab, { result:{ error:'Read-only mode is active. Disable it to run write operations.', duration:0 } });
            return;
        }
        setLoading(true);
        setSelectedRows(new Set());
        updateTab(activeTab, { result:null, explainResult:null, page:1 });
        setActiveResultTab('results');
        setSuggestions([]);
        startTimer();
        try {
            const res = await postData('/api/query', { sql:query, timeout:queryTimeout*1000 });
            stopTimer();
            if (res.error) throw new Error(res.error);
            if (!res.fields || !res.rows) throw new Error('Invalid response from /api/query. Expected { fields, rows, rowCount }.');
            res.duration = Math.round(performance.now() - startTsRef.current);
            updateTab(activeTab, { result:res, sortCol:null });
            addToHistory(query, res, null);
            if (res.rowCount > 0) notify(`✓ ${fmtRows(res.rowCount)} rows in ${fmtMs(res.duration)}`);
            // ★ NEW: auto-switch to chart tab when results have numeric columns
            if (autoChart && res.rows?.length > 0 && res.fields?.length >= 2) {
                const hasNumeric = res.fields.some(f => {
                    const v = res.rows[0]?.[f.name];
                    return v !== null && !isNaN(Number(v));
                });
                if (hasNumeric) setActiveResultTab('chart');
            }
        } catch (err) {
            stopTimer();
            const msg = err?.message || String(err);
            updateTab(activeTab, { result:{ error:msg, duration:Math.round(performance.now()-startTsRef.current) } });
            addToHistory(query, null, msg);
            notify(msg.slice(0, 80), 'error');
        } finally { setLoading(false); }
    }, [loading, resolvedSql, readOnly, updateTab, activeTab, addToHistory, startTimer, stopTimer, queryTimeout, notify]);

    /* ── Explain ── */
    const handleExplain = useCallback(async (overrideSql) => {
        const query = (overrideSql || resolvedSql || '').trim();
        if (!query || loading) return;
        setLoading(true);
        updateTab(activeTab, { explainResult:null });
        setActiveResultTab('explain');
        startTimer();
        try {
            const res = await postData('/api/query', { sql:`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}` });
            stopTimer();
            if (res.error) throw new Error(res.error);
            res.duration = Math.round(performance.now() - startTsRef.current);
            updateTab(activeTab, { explainResult:res });
        } catch (err) {
            stopTimer();
            updateTab(activeTab, { explainResult:{ error:err?.message||String(err), duration:Math.round(performance.now()-startTsRef.current) } });
        } finally { setLoading(false); }
    }, [loading, resolvedSql, updateTab, activeTab, startTimer, stopTimer]);

    /* ── Live Refresh ── */
    const startLiveRefresh = useCallback(() => {
        clearInterval(liveTimerRef.current);
        liveTimerRef.current = setInterval(() => handleExecute(), liveRefreshSecs * 1000);
        notify(`Live refresh every ${liveRefreshSecs}s started`);
    }, [handleExecute, liveRefreshSecs, notify]);

    const stopLiveRefresh = useCallback(() => {
        clearInterval(liveTimerRef.current);
        liveTimerRef.current = null;
        setLiveRefreshInterval(null);
        notify('Live refresh stopped');
    }, [notify]);

    /* ── Transaction ── */
    const handleTx = useCallback(async (cmd) => {
        try {
            await postData('/api/query', { sql:cmd });
            if (cmd==='BEGIN') { setTxActive(true); notify('Transaction started'); }
            else { setTxActive(false); notify(`${cmd} successful`); }
        } catch (e) { notify(e.message, 'error'); }
    }, [notify]);

    /* ── Keyboard shortcuts ── */
    const handleKeyDown = useCallback((e) => {
        if (suggestions.length > 0 && e.key === 'Escape') { setSuggestions([]); return; }
        if (suggestions.length > 0 && e.key === 'Tab') { e.preventDefault(); applySuggestion(suggestions[0]); return; }
        if ((e.ctrlKey||e.metaKey) && !e.shiftKey && e.key==='Enter') { e.preventDefault(); handleExecute(); return; }
        if ((e.ctrlKey||e.metaKey) && e.shiftKey && e.key==='Enter') { e.preventDefault(); handleExplain(); return; }
        if ((e.ctrlKey||e.metaKey) && e.shiftKey && e.key==='F') { e.preventDefault(); setSql(formatSQL(currentTab.sql)); return; }
        if ((e.ctrlKey||e.metaKey) && e.key==='s') { e.preventDefault(); setShowSaveDialog(true); return; }
        if (e.key==='Tab') {
            e.preventDefault();
            const ta = e.target, s=ta.selectionStart, end=ta.selectionEnd, v=ta.value;
            setSql(v.substring(0,s)+'  '+v.substring(end));
            requestAnimationFrame(()=>{ ta.selectionStart=ta.selectionEnd=s+2; });
        }
    }, [handleExecute, handleExplain, setSql, currentTab.sql, suggestions, applySuggestion]);

    /* ── Export ── */
    const doExport = useCallback((fmt) => {
        if (!result?.rows?.length) return;
        let content, mime, ext;
        if (fmt==='csv') {
            const h = result.fields.map(f=>f.name).join(',');
            const rows = result.rows.map(r => result.fields.map(f => {
                let v = r[f.name];
                if (v==null) return '';
                v = String(v);
                return (v.includes(',')||v.includes('"')||v.includes('\n')) ? `"${v.replace(/"/g,'""')}"` : v;
            }).join(','));
            content = h+'\n'+rows.join('\n'); mime='text/csv'; ext='csv';
        } else if (fmt==='tsv') {
            const h = result.fields.map(f=>f.name).join('\t');
            const rows = result.rows.map(r => result.fields.map(f => String(r[f.name]??'')).join('\t'));
            content = h+'\n'+rows.join('\n'); mime='text/tab-separated-values'; ext='tsv';
        } else {
            content = JSON.stringify(result.rows, null, 2); mime='application/json'; ext='json';
        }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([content], { type:mime }));
        a.download = `fathom-export-${Date.now()}.${ext}`; a.click();
        notify(`Exported ${result.rows.length} rows as ${ext.toUpperCase()}`);
    }, [result, notify]);

    const copyTable = useCallback(() => {
        if (!result?.rows?.length) return;
        const h = result.fields.map(f=>f.name).join('\t');
        const rows = result.rows.map(r => result.fields.map(f => String(r[f.name]??'')).join('\t'));
        navigator.clipboard?.writeText(h+'\n'+rows.join('\n'));
        notify('Table copied to clipboard');
    }, [result, notify]);

    /* ── Clipboard ── */
    const copyText = useCallback((text, id) => {
        navigator.clipboard?.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 1500);
    }, []);

    /* ── Tabs management ── */
    const addTab = useCallback(() => {
        const id = tabCounter;
        setTabCounter(c => c+1);
        dispatch({ type:'ADD_TAB', tab:makeTab(id) });
        setActiveTab(id);
    }, [tabCounter]);

    const closeTab = useCallback((id) => {
        const nextTabs = tabs.filter(t => t.id !== id);
        if (nextTabs.length === 0) return;
        dispatch({ type:'CLOSE_TAB', id });
        if (activeTab === id) setActiveTab(nextTabs[nextTabs.length-1].id);
    }, [tabs, activeTab]);

    const duplicateTab = useCallback(() => {
        const id = tabCounter;
        setTabCounter(c => c+1);
        dispatch({ type:'ADD_TAB', tab:{ ...currentTab, id, label:`${currentTab.label} (copy)`, result:null, explainResult:null } });
        setActiveTab(id);
    }, [tabCounter, currentTab]);

    /* ── Save query ── */
    const saveQuery = useCallback(() => {
        if (!saveLabel.trim() || !currentTab.sql.trim()) return;
        setSavedQueries(prev => [...prev, { id:Date.now(), label:saveLabel, sql:currentTab.sql, ts:new Date().toISOString(), tags:[] }]);
        setSaveLabel('');
        setShowSaveDialog(false);
        notify('Query saved');
    }, [saveLabel, currentTab.sql, notify]);

    /* ── Explain plan extraction ── */
    const explainPlan = useMemo(() => {
        const er = currentTab.explainResult;
        if (!er?.rows?.length) return null;
        try {
            const first = er.rows[0];
            const planData = first['QUERY PLAN'] || first['query plan'] || first;
            if (Array.isArray(planData)) return planData[0]?.Plan || planData[0] || null;
            if (typeof planData==='object'&&planData.Plan) return planData.Plan;
            if (typeof planData==='string') { const p=JSON.parse(planData); return Array.isArray(p)?p[0]?.Plan||null:p?.Plan||null; }
            return null;
        } catch { return null; }
    }, [currentTab.explainResult]);

    const explainMaxTime = useMemo(() => {
        const calcMax = (node) => {
            if (!node) return 0;
            const t = node['Actual Total Time']||0;
            const children = (node['Plans']||[]).reduce((acc,c)=>Math.max(acc,calcMax(c)),0);
            return Math.max(t,children);
        };
        return calcMax(explainPlan);
    }, [explainPlan]);

    const lineCount = useMemo(() => Math.max((currentTab.sql.match(/\n/g)||[]).length+1, 1), [currentTab.sql]);
    const editorHeight = editorExpanded ? 380 : 200;
    const ROW_H = rowHeight==='compact'?28:rowHeight==='relaxed'?40:33;

    /* ── Sub components ── */
    const ResultTabBtn = ({ id, label, icon:Icon, count, dot }) => {
        const active = activeResultTab===id;
        return (
            <button onClick={()=>setActiveResultTab(id)} className={`sql-tab-btn ${active?'sql-tab-active':''}`}
                    style={{ position:'relative', padding:'5px 12px', borderRadius: 16, border:'none', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:5, fontWeight:600, fontSize:11, lineHeight:1, whiteSpace:'nowrap', background:'transparent', color:active?THEME.primary:THEME.textDim, outline:'none' }}>
                <Icon size={11}/>{label}
                {count!=null&&<span style={{ fontSize:9, fontWeight:800, fontVariantNumeric:'tabular-nums', opacity:0.7 }}>({fmtRows(count)})</span>}
                {dot && <span style={{ width:5, height:5, borderRadius:'50%', background:THEME.danger, position:'absolute', top:3, right:3, animation:'sqlPulse 1.5s infinite' }}/>}
            </button>
        );
    };

    const SortTh = ({ field }) => {
        const active = sortCol===field;
        const isPinned = pinnedCols.includes(field);
        const isHidden = hiddenCols.includes(field);
        const [hovered, setHovered] = useState(false);
        const stats = colStats[field];
        return (
            <th
                onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}
                style={{ padding:'8px 10px', textAlign:'left', fontSize:9, fontWeight:700, color:active?THEME.primary:THEME.textDim, letterSpacing:'0.04em', borderBottom:`1px solid ${THEME.grid}40`, cursor:'pointer', userSelect:'none', whiteSpace:'nowrap', position:'sticky', top:0, background:isPinned?`${THEME.primary}08`:THEME.surface, zIndex:isPinned?4:2, transition:'color 0.15s', minWidth:isPinned?'auto':80 }}
                className={isPinned?'sql-frozen':''}>
                <div style={{ display:'flex', alignItems:'center', gap:3 }}>
                    <span onClick={()=>{ if(active) updateTab(activeTab,{sortDir:sortDir==='asc'?'desc':'asc'}); else updateTab(activeTab,{sortCol:field,sortDir:'asc'}); }}>
                        {field}
                    </span>
                    {active&&(sortDir==='asc'?<ArrowUp size={8}/>:<ArrowDown size={8}/>)}
                    {hovered && (
                        <div style={{ display:'flex', gap:2, marginLeft:4 }}>
                            <button onMouseDown={e=>{e.preventDefault();updateTab(activeTab,{pinnedCols:isPinned?pinnedCols.filter(c=>c!==field):[...pinnedCols,field]});}}
                                    style={{ background:'none', border:'none', cursor:'pointer', padding:'1px', color:isPinned?THEME.primary:THEME.textDim, display:'flex' }}>
                                {isPinned?<Unpin size={9}/>:<Pin size={9}/>}
                            </button>
                            <button onMouseDown={e=>{e.preventDefault();updateTab(activeTab,{hiddenCols:[...hiddenCols,field]});}}
                                    style={{ background:'none', border:'none', cursor:'pointer', padding:'1px', color:THEME.textDim, display:'flex' }}>
                                <EyeOff size={9}/>
                            </button>
                        </div>
                    )}
                </div>
                {stats && (
                    <div style={{ display:'flex', gap:5, marginTop:1, fontWeight:500, fontSize:8 }}>
                        {stats.nullCount > 0 && <span style={{ color:THEME.warning }}>Ø {stats.nullCount}</span>}
                        {stats.min !== undefined && <span style={{ color:THEME.success }}>↓{Math.round(stats.min).toLocaleString()}</span>}
                        {stats.max !== undefined && <span style={{ color:THEME.danger }}>↑{Math.round(stats.max).toLocaleString()}</span>}
                    </div>
                )}
            </th>
        );
    };

    /* ═══════════════════════════════════════════════════════════════════
       RENDER
       ═══════════════════════════════════════════════════════════════════ */
    return (
        <div className="sql-font" style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 130px)', overflow:'hidden', gap:0 }}>
            <SqlStyles/>
            <Notification notifications={notifications} onDismiss={id => setNotifications(p => p.filter(n => n.id !== id))}/>

            {/* ── Transaction banner ── */}
            {txActive && (
                <div style={{ padding:'6px 14px', background:`${THEME.warning}08`, borderBottom:`1px solid ${THEME.warning}18`, display:'flex', alignItems:'center', gap: 22, animation:'sqlSlideDown 0.2s ease', flexShrink:0, boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
                    <Circle size={9} color={THEME.warning} fill={THEME.warning} style={{ animation:'sqlPulse 1.5s infinite' }}/>
                    <span style={{ fontSize:11, fontWeight:700, color:THEME.warning }}>Transaction Active</span>
                    <Divider vertical/>
                    <button onClick={()=>handleTx('COMMIT')} style={{ padding:'3px 10px', borderRadius: 16, border:'none', cursor:'pointer', background:`${THEME.success}10`, color:THEME.success, fontSize:10, fontWeight:700, boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>COMMIT</button>
                    <button onClick={()=>handleTx('ROLLBACK')} style={{ padding:'3px 10px', borderRadius: 16, border:'none', cursor:'pointer', background:`${THEME.danger}12`, color:THEME.danger, fontSize:10, fontWeight:700 }}>ROLLBACK</button>
                    <button onClick={()=>handleTx('SAVEPOINT sp1')} style={{ padding:'3px 10px', borderRadius: 16, border:'none', cursor:'pointer', background:`${THEME.textDim}08`, color:THEME.textDim, fontSize:10, fontWeight:700 }}>SAVEPOINT</button>
                </div>
            )}

            {/* ── Read-only banner ── */}
            {readOnly && (
                <div className="sql-readonly-banner" style={{ padding:'5px 14px', background:`${THEME.danger}06`, borderBottom:`1px solid ${THEME.danger}12`, display:'flex', alignItems:'center', gap: 20, flexShrink:0, boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
                    <Lock size={11} color={THEME.danger}/>
                    <span style={{ fontSize:11, fontWeight:600, color:THEME.danger }}>Read-only mode — write operations are blocked</span>
                    <button onClick={()=>setReadOnly(false)} style={{ marginLeft:'auto', padding:'2px 8px', borderRadius: 18, border:'none', cursor:'pointer', background:`${THEME.danger}10`, color:THEME.danger, fontSize:9, fontWeight:700, boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>Disable</button>
                </div>
            )}

            {/* ── Live refresh banner ── */}
            {liveTimerRef.current && (
                <div style={{ padding:'5px 14px', background:`${THEME.success}06`, borderBottom:`1px solid ${THEME.success}12`, display:'flex', alignItems:'center', gap: 20, flexShrink:0, boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
                    <RefreshCcw size={11} color={THEME.success} style={{ animation:'sqlSpin 2s linear infinite' }}/>
                    <span style={{ fontSize:11, fontWeight:600, color:THEME.success }}>Live refresh every {liveRefreshSecs}s</span>
                    <button onClick={stopLiveRefresh} style={{ marginLeft:'auto', padding:'2px 8px', borderRadius: 18, border:'none', cursor:'pointer', background:`${THEME.danger}12`, color:THEME.danger, fontSize:9, fontWeight:700 }}>Stop</button>
                </div>
            )}

            <div style={{ display:'grid', gridTemplateColumns:`1fr ${sidebarCollapsed?'42px':'300px'}`, gap: 20, flex:1, minHeight:0, overflow:'hidden', padding:0 }}>

                {/* ═════════ LEFT ═════════ */}
                <div style={{ display:'flex', flexDirection:'column', gap: 18, height:'100%', minWidth:0 }}>

                    {/* ── Multi-Tab Editor ── */}
                    <Panel icon={Terminal} title="SQL Editor" noPad style={{ flexShrink:0 }}>

                        {/* Tab bar */}
                        <div style={{ display:'flex', alignItems:'center', gap:0, borderBottom:`1px solid ${THEME.glassBorder}`, padding:'0 8px', overflowX:'auto', flexShrink:0 }} className="sql-scrollbar">
                            {tabs.map(t => (
                                <div key={t.id} onClick={()=>setActiveTab(t.id)}
                                     style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 11px', cursor:'pointer', borderBottom:`2px solid ${t.id===activeTab?THEME.primary:'transparent'}`, color:t.id===activeTab?THEME.primary:THEME.textDim, fontSize:11, fontWeight:t.id===activeTab?700:500, whiteSpace:'nowrap', transition:'all 0.15s', flexShrink:0, position:'relative' }}>
                                    {pinnedTabIds.has(t.id) && <Pin size={8} style={{ position:'absolute', top:5, left:5, opacity:0.6 }}/>}
                                    <span>{t.label}</span>
                                    {t.result && !t.result.error && <span style={{ width:5, height:5, borderRadius:'50%', background:THEME.success }}/>}
                                    {t.result?.error && <span style={{ width:5, height:5, borderRadius:'50%', background:THEME.danger }}/>}
                                    {loading && t.id===activeTab && <Spinner size={8}/>}
                                    {tabs.length > 1 && (
                                        <X size={9} onClick={e=>{e.stopPropagation();closeTab(t.id);}} style={{ cursor:'pointer', opacity:0.4, transition:'opacity 0.12s' }} onMouseEnter={e=>e.currentTarget.style.opacity='1'} onMouseLeave={e=>e.currentTarget.style.opacity='0.4'}/>
                                    )}
                                </div>
                            ))}
                            <button onClick={addTab} style={{ padding:'6px 10px', cursor:'pointer', background:'none', border:'none', color:THEME.textDim, display:'flex', alignItems:'center', gap:3, fontSize:11, flexShrink:0, transition:'color 0.15s' }} onMouseEnter={e=>e.currentTarget.style.color=THEME.textMain} onMouseLeave={e=>e.currentTarget.style.color=THEME.textDim}>
                                <Plus size={11}/> New
                            </button>
                            <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:4, padding:'0 4px' }}>
                                <button onClick={duplicateTab} title="Duplicate tab" style={{ padding:'4px 7px', borderRadius: 16, border:'none', cursor:'pointer', background:`${THEME.textDim}08`, color:THEME.textDim, fontSize:9, fontWeight:600, display:'flex', alignItems:'center', gap:3 }}>
                                    <CopyCheck size={10}/> Dup
                                </button>
                                {tabs.length >= 2 && (
                                    <button onClick={()=>{setShowDiff(!showDiff);if(!showDiff)setDiffTabIds([tabs[0].id,tabs[1].id]);setActiveResultTab('diff');}}
                                            style={{ padding:'4px 8px', borderRadius: 16, border:'none', cursor:'pointer', background:showDiff?`${THEME.secondary}12`:`${THEME.secondary}06`, color:showDiff?THEME.secondary:THEME.textDim, fontSize:10, fontWeight:600, display:'flex', alignItems:'center', gap:4, boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
                                        <Diff size={10}/> Diff
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Shortcut hints */}
                        {showShortcuts && (
                            <div style={{ padding:'6px 14px', borderBottom:`1px solid ${THEME.glassBorder}`, background:THEME.surface, display:'flex', flexWrap:'wrap', gap: 20, animation:'sqlFadeIn 0.15s ease', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
                                {[['Ctrl+Enter','Execute'],['Ctrl+Shift+Enter','Explain'],['Ctrl+Shift+F','Format SQL'],['Ctrl+S','Save'],['Tab','Indent / Accept autocomplete'],['Esc','Dismiss suggestions']].map(([k,a])=>(
                                    <span key={k} style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:10, color:THEME.textDim }}>
                                        <kbd className="sql-kbd">{k}</kbd> {a}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Template picker */}
                        {showTemplates && (
                            <div style={{ borderBottom:`1px solid ${THEME.glassBorder}`, background:THEME.surface, animation:'sqlFadeIn 0.15s ease', maxHeight:200, overflowY:'auto' }} className="sql-scrollbar">
                                {['Monitoring','Performance','Storage','Maintenance','Replication','Schema'].map(group => {
                                    const items = DATA_TEMPLATES.filter(t=>t.group===group);
                                    if (!items.length) return null;
                                    return (
                                        <div key={group}>
                                            <div style={{ padding:'5px 14px 3px', fontSize:9, fontWeight:700, color:THEME.textDim, letterSpacing:'0.02em' }}>{group}</div>
                                            <div style={{ display:'flex', flexWrap:'wrap', gap:4, padding:'0 12px 6px' }}>
                                                {items.map((t,i)=>(
                                                    <button key={i} onClick={()=>{ setSql(t.sql); setShowTemplates(false); editorRef.current?.focus(); }}
                                                            style={{ padding:'5px 10px', borderRadius: 16, border:'none', cursor:'pointer', background:`${THEME.secondary}05`, color:THEME.textMuted, outline:`1px solid ${THEME.secondary}10`, fontSize:10.5, fontWeight:600, display:'flex', alignItems:'center', gap:5, transition:'all 0.12s', boxShadow:'0 1px 3px rgba(0,0,0,0.02)' }}
                                                            onMouseEnter={e=>{e.currentTarget.style.background=`${THEME.secondary}16`;e.currentTarget.style.color=THEME.secondary;}}
                                                            onMouseLeave={e=>{e.currentTarget.style.background=`${THEME.secondary}07`;e.currentTarget.style.color=THEME.textMuted;}}>
                                                        <t.icon size={10}/>{t.label}
                                                        <Pill label={t.tag} color={THEME.textDim}/>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Settings panel */}
                        {showSettings && (
                            <div style={{ padding:'10px 16px', borderBottom:`1px solid ${THEME.glassBorder}`, background:THEME.surface, display:'flex', flexWrap:'wrap', gap: 22, alignItems:'center', animation:'sqlFadeIn 0.15s ease' }}>
                                <div style={{ display:'flex', alignItems:'center', gap: 20 }}>
                                    <Timer size={11} color={THEME.textDim}/>
                                    <span style={{ fontSize:10, color:THEME.textDim }}>Timeout</span>
                                    <select value={queryTimeout} onChange={e=>setQueryTimeout(Number(e.target.value))}
                                            style={{ padding:'2px 6px', borderRadius: 16, border:`1px solid ${THEME.grid}50`, background:THEME.surface, color:THEME.textMain, fontSize:10, outline:'none' }}>
                                        {[5,10,15,30,60,120,300].map(v=><option key={v} value={v}>{v}s</option>)}
                                    </select>
                                </div>
                                <div style={{ display:'flex', alignItems:'center', gap: 20 }}>
                                    <Hash size={11} color={THEME.textDim}/>
                                    <span style={{ fontSize:10, color:THEME.textDim }}>Page size</span>
                                    <select value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));updateTab(activeTab,{page:1});}}
                                            style={{ padding:'2px 6px', borderRadius: 16, border:`1px solid ${THEME.grid}50`, background:THEME.surface, color:THEME.textMain, fontSize:10, outline:'none' }}>
                                        {PAGE_SIZE_OPTIONS.map(v=><option key={v} value={v}>{v}</option>)}
                                    </select>
                                </div>
                                <div style={{ display:'flex', alignItems:'center', gap: 20 }}>
                                    <Sliders size={11} color={THEME.textDim}/>
                                    <span style={{ fontSize:10, color:THEME.textDim }}>Row density</span>
                                    <select value={rowHeight} onChange={e=>setRowHeight(e.target.value)}
                                            style={{ padding:'2px 6px', borderRadius: 16, border:`1px solid ${THEME.grid}50`, background:THEME.surface, color:THEME.textMain, fontSize:10, outline:'none' }}>
                                        {['compact','normal','relaxed'].map(v=><option key={v} value={v}>{v}</option>)}
                                    </select>
                                </div>
                                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                    {readOnly
                                        ? <button onClick={()=>setReadOnly(false)} style={{ padding:'3px 10px', borderRadius: 16, border:'none', cursor:'pointer', background:`${THEME.danger}12`, color:THEME.danger, fontSize:10, fontWeight:700, display:'flex', alignItems:'center', gap:4 }}><Lock size={10}/> Unlock Writes</button>
                                        : <button onClick={()=>setReadOnly(true)} style={{ padding:'3px 10px', borderRadius: 16, border:'none', cursor:'pointer', background:`${THEME.success}10`, color:THEME.success, fontSize:10, fontWeight:700, display:'flex', alignItems:'center', gap:4 }}><ShieldOff size={10}/> Read-only</button>
                                    }
                                </div>
                                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                    {txActive
                                        ? <span style={{ fontSize:10, color:THEME.warning, fontWeight:600 }}>TX Active</span>
                                        : <button onClick={()=>handleTx('BEGIN')} style={{ padding:'3px 10px', borderRadius: 16, border:'none', cursor:'pointer', background:`${THEME.warning}12`, color:THEME.warning, fontSize:10, fontWeight:700, display:'flex', alignItems:'center', gap:4 }}><GitBranch size={10}/> BEGIN TX</button>
                                    }
                                </div>
                                {/* Live refresh */}
                                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                    <RefreshCcw size={11} color={THEME.textDim}/>
                                    <span style={{ fontSize:10, color:THEME.textDim }}>Auto-refresh</span>
                                    <select value={liveRefreshSecs} onChange={e=>setLiveRefreshSecs(Number(e.target.value))}
                                            style={{ padding:'2px 6px', borderRadius: 16, border:`1px solid ${THEME.grid}50`, background:THEME.surface, color:THEME.textMain, fontSize:10, outline:'none' }}>
                                        {[2,5,10,15,30,60].map(v=><option key={v} value={v}>{v}s</option>)}
                                    </select>
                                    {liveTimerRef.current
                                        ? <button onClick={stopLiveRefresh} style={{ padding:'3px 10px', borderRadius: 16, border:'none', cursor:'pointer', background:`${THEME.danger}12`, color:THEME.danger, fontSize:10, fontWeight:700 }}>Stop</button>
                                        : <button onClick={startLiveRefresh} disabled={!currentTab.sql.trim()} style={{ padding:'3px 10px', borderRadius: 16, border:'none', cursor:'pointer', background:`${THEME.success}10`, color:THEME.success, fontSize:10, fontWeight:700, opacity:!currentTab.sql.trim()?0.4:1 }}>Start</button>
                                    }
                                </div>
                                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                    <button onClick={()=>setShowCostAnalysis(!showCostAnalysis)} style={{ padding:'3px 10px', borderRadius: 16, border:'none', cursor:'pointer', background:showCostAnalysis?`${THEME.warning}12`:`${THEME.textDim}08`, color:showCostAnalysis?THEME.warning:THEME.textDim, fontSize:10, fontWeight:700, display:'flex', alignItems:'center', gap:4 }}><FlameKindling size={10}/> {showCostAnalysis?'Hide':'Show'} Cost</button>
                                </div>
                                {/* ★ NEW: Auto chart-render toggle */}
                                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                    <button onClick={()=>setAutoChart(v=>!v)}
                                        style={{ padding:'3px 10px', borderRadius: 16, border:'none', cursor:'pointer', background:autoChart?`${THEME.primary}14`:`${THEME.textDim}08`, color:autoChart?THEME.primary:THEME.textDim, fontSize:10, fontWeight:700, display:'flex', alignItems:'center', gap:4 }}>
                                        <BarChart3 size={10}/> Auto-chart {autoChart?'ON':'OFF'}
                                    </button>
                                </div>
                                {/* ★ NEW: Transaction mode toggle */}
                                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                    <button onClick={()=>setTxMode(v=>!v)}
                                        style={{ padding:'3px 10px', borderRadius: 16, border:'none', cursor:'pointer', background:txMode?`${THEME.warning}14`:`${THEME.textDim}08`, color:txMode?THEME.warning:THEME.textDim, fontSize:10, fontWeight:700, display:'flex', alignItems:'center', gap:4 }}>
                                        <GitBranch size={10}/> TX Mode {txMode?'ON':'OFF'}
                                    </button>
                                    {txMode && <span style={{ fontSize:9, color:THEME.textDim }}>Queries auto-wrapped in BEGIN…</span>}
                                </div>
                            </div>
                        )}

                        {/* Save dialog */}
                        {showSaveDialog && (
                            <div style={{ padding:'8px 16px', borderBottom:`1px solid ${THEME.glassBorder}`, background:THEME.surface, display:'flex', alignItems:'center', gap: 20, animation:'sqlSlideDown 0.15s ease' }}>
                                <Bookmark size={11} color={THEME.secondary}/>
                                <input value={saveLabel} onChange={e=>setSaveLabel(e.target.value)} onKeyDown={e=>e.key==='Enter'&&saveQuery()} placeholder="Query name…"
                                       style={{ flex:1, minWidth:0, padding:'4px 10px', borderRadius: 16, border:`1px solid ${THEME.secondary}30`, background:THEME.surface, color:THEME.textMain, fontSize:11, outline:'none' }} autoFocus/>
                                <button onClick={saveQuery} style={{ padding:'4px 12px', borderRadius: 16, border:'none', cursor:'pointer', background:`${THEME.secondary}18`, color:THEME.secondary, fontSize:10, fontWeight:700 }}>Save</button>
                                <button onClick={()=>setShowSaveDialog(false)} style={{ background:'none', border:'none', cursor:'pointer', color:THEME.textDim, display:'flex' }}><X size={12}/></button>
                            </div>
                        )}

                        {/* Editor body */}
                        <div style={{ display:'flex', height:editorHeight, transition:'height 0.25s ease' }}>
                            {/* Gutter */}
                            <div style={{ width:42, flexShrink:0, padding:'12px 0', background:THEME.surface, borderRight:`1px solid ${THEME.grid}30`, overflow:'hidden', userSelect:'none' }}>
                                {Array.from({ length:Math.max(lineCount, Math.ceil(editorHeight/23)) }, (_,i)=>(
                                    <div key={i} style={{ height:23, lineHeight:'23px', fontSize:10, color:i<lineCount?THEME.textDim:'transparent', textAlign:'right', paddingRight:8, fontFamily:'monospace', fontVariantNumeric:'tabular-nums' }}>{i+1}</div>
                                ))}
                            </div>
                            {/* Textarea */}
                            <div style={{ flex:1, minWidth:0, position:'relative', overflow:'hidden' }}>
                                <textarea
                                    ref={editorRef}
                                    value={currentTab.sql}
                                    onChange={e=>{ setSql(e.target.value); handleSuggest(e); }}
                                    onKeyDown={handleKeyDown}
                                    onBlur={()=>setTimeout(()=>setSuggestions([]),200)}
                                    placeholder={"SELECT * FROM pg_stat_activity LIMIT 10;\n\n-- :param syntax for parameterized queries\n-- Ctrl+Enter to run · Ctrl+Shift+F to format · Tab for autocomplete"}
                                    spellCheck={false}
                                    className="sql-editor-area sql-scrollbar"
                                    style={{ width:'100%', height:'100%', padding:'12px 14px', lineHeight:'23px', overflowY:'auto' }}
                                />
                                {loading && <div className="sql-loading-bar" style={{ position:'absolute', bottom:0, left:0, right:0 }}/>}
                                {suggestions.length > 0 && <AutoComplete suggestions={suggestions} onSelect={applySuggestion} anchorRect={suggestAnchor}/>}
                            </div>
                        </div>

                        {/* Cost analysis */}
                        {showCostAnalysis && <CostMeter sql={currentTab.sql}/>}

                        {/* Parameter editor */}
                        <ParamEditor sql={currentTab.sql} params={params} onChange={setParams}/>

                        {/* Action bar */}
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', borderTop:`1px solid ${THEME.glassBorder}`, background:'rgba(8,15,30,0.6)', flexWrap:'wrap', gap:5 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:5, flexWrap:'wrap' }}>
                                {/* Execute */}
                                <button onClick={()=>handleExecute()} disabled={loading||!currentTab.sql.trim()}
                                        style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'7px 18px', borderRadius: 18, border:'none', cursor:(loading||!currentTab.sql.trim())?'not-allowed':'pointer', background:loading?`${THEME.primary}50`:`linear-gradient(135deg,${THEME.primary},${THEME.primaryDark})`, color:'#fff', fontSize:11.5, fontWeight:700, boxShadow:loading?'none':`0 2px 12px ${THEME.primary}30`, transition:'all 0.2s', opacity:!currentTab.sql.trim()?0.4:1 }}>
                                    {loading?<Spinner size={11} color="#fff"/>:<Play size={11} fill="white"/>}
                                    {loading?'Running…':'Execute'}
                                </button>
                                {/* Explain */}
                                <button onClick={()=>handleExplain()} disabled={loading||!currentTab.sql.trim()}
                                        style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'7px 13px', borderRadius: 18, border:'none', cursor:(loading||!currentTab.sql.trim())?'not-allowed':'pointer', background:`${THEME.secondary}12`, color:THEME.secondary, outline:`1px solid ${THEME.secondary}18`, fontSize:11, fontWeight:700, transition:'all 0.2s', opacity:!currentTab.sql.trim()?0.4:1 }}>
                                    <BarChart3 size={11}/> Explain
                                </button>
                                <Divider vertical/>
                                {[
                                    { icon:AlignJustify, label:'Format', onClick:()=>{ setSql(formatSQL(currentTab.sql)); notify('SQL formatted'); }, disabled:!currentTab.sql.trim() },
                                    { icon:Save, label:'Save', onClick:()=>setShowSaveDialog(true), disabled:!currentTab.sql.trim() },
                                    { icon:Eraser, label:'Clear', onClick:()=>{ setSql(''); updateTab(activeTab,{result:null,explainResult:null}); } },
                                    { icon:copiedId==='sql'?Check:Copy, label:copiedId==='sql'?'Copied':'Copy', onClick:()=>copyText(currentTab.sql,'sql') },
                                ].map(({icon:Icon,label,onClick,disabled})=>(
                                    <button key={label} onClick={onClick} disabled={disabled}
                                            style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'5px 9px', borderRadius: 16, border:'none', cursor:disabled?'not-allowed':'pointer', background:`${THEME.textDim}07`, color:THEME.textDim, fontSize:10, fontWeight:600, transition:'all 0.15s', opacity:disabled?0.3:1 }}
                                            onMouseEnter={e=>{if(!disabled){e.currentTarget.style.background=`${THEME.textDim}12`;e.currentTarget.style.color=THEME.textMuted;}}}
                                            onMouseLeave={e=>{e.currentTarget.style.background=`${THEME.textDim}07`;e.currentTarget.style.color=THEME.textDim;}}>
                                        <Icon size={11}/> {label}
                                    </button>
                                ))}
                            </div>
                            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                {loading && (
                                    <div style={{ display:'flex', alignItems:'center', gap:5, padding:'3px 9px', borderRadius: 16, background:`${THEME.primary}10`, fontSize:10, fontWeight:700, color:THEME.primary, fontVariantNumeric:'tabular-nums', animation:'sqlTimerPulse 1s ease-in-out infinite' }}>
                                        <Spinner size={9}/> {fmtMs(elapsedMs)}
                                    </div>
                                )}
                                {[
                                    { icon:BookOpen, active:showTemplates, onClick:()=>setShowTemplates(!showTemplates), title:'Templates' },
                                    { icon:Keyboard, active:showShortcuts, onClick:()=>setShowShortcuts(!showShortcuts), title:'Shortcuts' },
                                    { icon:Settings, active:showSettings, onClick:()=>setShowSettings(!showSettings), title:'Settings' },
                                    { icon:editorExpanded?Minimize2:Maximize2, active:false, onClick:()=>setEditorExpanded(!editorExpanded), title:'Toggle size' },
                                ].map(({icon:Icon,active,onClick,title})=>(
                                    <IconBtn key={title} icon={Icon} active={active} onClick={onClick} title={title}/>
                                ))}
                            </div>
                        </div>
                    </Panel>

                    {/* ── Results Panel ── */}
                    <Panel noPad style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minHeight:0 }}>
                        {/* Result tab bar + actions */}
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'5px 12px', borderBottom:`1px solid ${THEME.glassBorder}`, flexShrink:0, gap:6, flexWrap:'wrap' }}>
                            <div style={{ display:'flex', gap:1 }}>
                                <ResultTabBtn id="results" label="Results" icon={Table2} count={result?.rowCount}/>
                                <ResultTabBtn id="chart" label="Chart" icon={BarChart3}/>
                                <ResultTabBtn id="stats" label="Stats" icon={Activity}/>
                                <ResultTabBtn id="explain" label="Plan" icon={Workflow}/>
                                <ResultTabBtn id="messages" label="Log" icon={Terminal}/>
                                <ResultTabBtn id="saved" label="Saved" icon={Bookmark} count={savedQueries.length||null}/>
                                {showDiff && <ResultTabBtn id="diff" label="Diff" icon={Diff}/>}
                            </div>
                            <div style={{ display:'flex', gap:4, alignItems:'center', flexWrap:'wrap' }}>
                                {/* Hidden col restore */}
                                {hiddenCols.length > 0 && (
                                    <button onClick={()=>updateTab(activeTab,{hiddenCols:[]})} style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'3px 8px', borderRadius: 16, border:'none', cursor:'pointer', background:`${THEME.warning}10`, color:THEME.warning, fontSize:10, fontWeight:600 }}>
                                        <EyeIcon size={10}/> Show {hiddenCols.length} hidden
                                    </button>
                                )}
                                {result?.rows?.length > 0 && (
                                    <>
                                        <input value={filterText} onChange={e=>{ setFilterText(e.target.value); updateTab(activeTab,{page:1}); }} placeholder="Search rows…"
                                               style={{ padding:'3px 10px', borderRadius: 16, border:`1px solid ${THEME.grid}50`, background:THEME.surface, color:THEME.textMain, fontSize:10, outline:'none', width:120 }}/>
                                        {filterText && <button onClick={()=>setFilterText('')} style={{ background:'none', border:'none', cursor:'pointer', color:THEME.textDim, display:'flex' }}><X size={11}/></button>}
                                        <Divider vertical/>
                                        <button onClick={copyTable} style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'3px 8px', borderRadius: 16, border:'none', cursor:'pointer', background:`${THEME.textDim}08`, color:THEME.textDim, fontSize:10, fontWeight:600 }}><CopyCheck size={10}/> Copy</button>
                                        <button onClick={()=>doExport('csv')} style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'3px 8px', borderRadius: 16, border:'none', cursor:'pointer', background:`${THEME.textDim}08`, color:THEME.textDim, fontSize:10, fontWeight:600 }}><FileSpreadsheet size={10}/> CSV</button>
                                        <button onClick={()=>doExport('tsv')} style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'3px 8px', borderRadius: 16, border:'none', cursor:'pointer', background:`${THEME.textDim}08`, color:THEME.textDim, fontSize:10, fontWeight:600 }}><Download size={10}/> TSV</button>
                                        <button onClick={()=>doExport('json')} style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'3px 8px', borderRadius: 16, border:'none', cursor:'pointer', background:`${THEME.textDim}08`, color:THEME.textDim, fontSize:10, fontWeight:600 }}><FileJson size={10}/> JSON</button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Content */}
                        <div style={{ flex:1, minHeight:0, overflow:'hidden', display:'flex', flexDirection:'column' }}>
                            {loading ? (
                                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap: 22 }}>
                                    <div style={{ position:'relative', width:60, height:60 }}>
                                        <Spinner size={60} color={THEME.primary}/>
                                        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                                            <Terminal size={20} color={THEME.primary} style={{ opacity:0.5 }}/>
                                        </div>
                                    </div>
                                    <div style={{ textAlign:'center' }}>
                                        <div style={{ fontSize:13, fontWeight:600, color:THEME.textMuted }}>Executing query…</div>
                                        <div style={{ fontSize:26, fontWeight:800, color:THEME.primary, fontVariantNumeric:'tabular-nums', marginTop:6, animation:'sqlTimerPulse 1s ease-in-out infinite', letterSpacing:'-0.02em' }}>{fmtMs(elapsedMs)}</div>
                                        <div style={{ fontSize:10, color:THEME.textDim, marginTop:6 }}>Timeout in {queryTimeout}s · PostgreSQL</div>
                                    </div>
                                </div>

                            ) : activeResultTab === 'results' ? (
                                result?.error ? (
                                    <div style={{ padding:18, animation:'sqlFadeIn 0.2s ease', overflow:'auto' }} className="sql-scrollbar">
                                        <div style={{ display:'flex', alignItems:'flex-start', gap: 18, padding:'16px 18px', borderRadius: 18, background:`${THEME.danger}06`, border:`1px solid ${THEME.danger}18` }}>
                                            <XCircle size={18} color={THEME.danger} style={{ flexShrink:0, marginTop:1 }}/>
                                            <div style={{ flex:1, minWidth:0 }}>
                                                <div style={{ display:'flex', alignItems:'center', gap: 22, marginBottom:8 }}>
                                                    <span style={{ fontSize:12, fontWeight:700, color:THEME.danger }}>Query Error</span>
                                                    {result.duration > 0 && <span style={{ fontSize:10, color:THEME.textDim }}>after {fmtMs(result.duration)}</span>}
                                                    <button onClick={()=>copyText(result.error,'err')} style={{ marginLeft:'auto', padding:'2px 7px', borderRadius: 18, border:'none', cursor:'pointer', background:`${THEME.textDim}08`, color:THEME.textDim, fontSize:9, fontWeight:700 }}>
                                                        {copiedId==='err'?'Copied':'Copy'}
                                                    </button>
                                                </div>
                                                <pre style={{ fontSize:12, color:THEME.textMuted, fontFamily:THEME.fontMono, whiteSpace:'pre-wrap', wordBreak:'break-word', margin:0, lineHeight:1.65, padding:'12px 14px', borderRadius: 18, background:THEME.surface, border:`1px solid ${THEME.grid}25` }}>{result.error}</pre>
                                            </div>
                                        </div>
                                    </div>
                                ) : result?.rows ? (
                                    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
                                        {/* Stats bar */}
                                        <div style={{ display:'flex', alignItems:'center', gap: 18, padding:'6px 12px', borderBottom:`1px solid ${THEME.grid}20`, fontSize:10, flexShrink:0, flexWrap:'wrap' }}>
                                            <span style={{ display:'inline-flex', alignItems:'center', gap:4, color:THEME.success, fontWeight:700 }}><CheckCircle size={10}/> {fmtRows(result.rowCount)} rows</span>
                                            <span style={{ display:'inline-flex', alignItems:'center', gap:4, color:THEME.textDim, fontWeight:600 }}><Columns size={10}/> {visibleFields.length} cols{hiddenCols.length>0?` (${hiddenCols.length} hidden)`:''}</span>
                                            <span style={{ display:'inline-flex', alignItems:'center', gap:4, color:THEME.primary, fontWeight:700 }}><Timer size={10}/> {fmtMs(result.duration)}</span>
                                            {processedRows.length !== result.rowCount && <span style={{ color:THEME.warning, fontWeight:600 }}><Filter size={9}/> {processedRows.length} filtered</span>}
                                            {selectedRows.size > 0 && <span style={{ color:THEME.secondary, fontWeight:700 }}>{selectedRows.size} selected</span>}
                                            {sortCol && <button onClick={()=>updateTab(activeTab,{sortCol:null})} style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'2px 7px', borderRadius: 18, border:'none', cursor:'pointer', background:`${THEME.primary}10`, color:THEME.primary, fontSize:9, fontWeight:700 }}><X size={8}/> Clear sort</button>}
                                            {(filterText||Object.values(colFilter).some(Boolean)) && <button onClick={()=>{setFilterText('');setColFilter({});}} style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'2px 7px', borderRadius: 18, border:'none', cursor:'pointer', background:`${THEME.warning}10`, color:THEME.warning, fontSize:9, fontWeight:700 }}><X size={8}/> Clear filters</button>}
                                        </div>

                                        {/* Table */}
                                        <div className="sql-scrollbar" style={{ flex:1, minHeight:0, overflow:'auto' }}>
                                            <table style={{ width:'100%', borderCollapse:'collapse' }}>
                                                <thead>
                                                <tr>
                                                    <th style={{ padding:'6px 8px', textAlign:'center', width:32, fontSize:9, fontWeight:700, color:THEME.textDim, borderBottom:`1px solid ${THEME.grid}40`, position:'sticky', top:0, background:THEME.surface, zIndex:3 }}>
                                                        <input type="checkbox" onChange={e=>setSelectedRows(e.target.checked?new Set(pagedRows.map((_,i)=>i)):new Set())} style={{ width:11, height:11, cursor:'pointer', accentColor:THEME.primary }}/>
                                                    </th>
                                                    <th style={{ padding:'6px 8px', textAlign:'right', width:42, fontSize:9, fontWeight:700, color:THEME.textDim, borderBottom:`1px solid ${THEME.grid}40`, position:'sticky', top:0, background:THEME.surface, zIndex:3 }}>#</th>
                                                    {visibleFields.map(f=><SortTh key={f.name} field={f.name}/>)}
                                                </tr>
                                                {/* Column filter row */}
                                                <tr>
                                                    <td style={{ background:THEME.surface, position:'sticky', top:56, zIndex:2 }}/>
                                                    <td style={{ background:THEME.surface, position:'sticky', top:56, zIndex:2 }}/>
                                                    {visibleFields.map(f=>(
                                                        <td key={f.name} style={{ padding:'2px 6px', background:THEME.surface, position:'sticky', top:56, zIndex:2 }}>
                                                            <input value={colFilter[f.name]||''} onChange={e=>{setColFilter(p=>({...p,[f.name]:e.target.value}));updateTab(activeTab,{page:1});}}
                                                                   placeholder="filter…"
                                                                   style={{ width:'100%', padding:'2px 6px', borderRadius: 18, border:`1px solid ${colFilter[f.name]?THEME.primary:THEME.grid}40`, background:`${colFilter[f.name]?THEME.primary:THEME.textDim}05`, color:THEME.textDim, fontSize:9, outline:'none', fontFamily:'monospace', transition:'all 0.15s' }}/>
                                                        </td>
                                                    ))}
                                                </tr>
                                                </thead>
                                                <tbody>
                                                {pagedRows.map((row,ri)=>{
                                                    const globalIdx = (page-1)*pageSize+ri;
                                                    const isSel = selectedRows.has(ri);
                                                    return (
                                                        <tr key={ri} className={`sql-row-hover ${isSel?'sql-row-selected':''}`}
                                                            onClick={()=>setSelectedRows(prev=>{ const n=new Set(prev); isSel?n.delete(ri):n.add(ri); return n; })}>
                                                            <td style={{ padding:`${(ROW_H-12)/2}px 8px`, textAlign:'center', borderBottom:`1px solid ${THEME.grid}10` }}>
                                                                <input type="checkbox" checked={isSel} onChange={()=>{}} style={{ width:11, height:11, cursor:'pointer', accentColor:THEME.primary }}/>
                                                            </td>
                                                            <td style={{ padding:`${(ROW_H-12)/2}px 8px`, textAlign:'right', fontSize:10, color:THEME.textDim, fontVariantNumeric:'tabular-nums', borderBottom:`1px solid ${THEME.grid}10`, fontFamily:'monospace', userSelect:'none' }}>{globalIdx+1}</td>
                                                            {visibleFields.map(f=>{
                                                                const v = row[f.name];
                                                                const isPinned = pinnedCols.includes(f.name);
                                                                return (
                                                                    <td key={f.name}
                                                                        title={v===null?'NULL':String(v)}
                                                                        className={isPinned?'sql-frozen':''}
                                                                        style={{ padding:`${(ROW_H-12)/2}px 12px`, fontSize:11.5, fontFamily:'monospace', borderBottom:`1px solid ${THEME.grid}08`, flex:1, minWidth:0, maxWidth:'unset', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', background:isPinned?`${THEME.primary}04`:undefined }}>
                                                                        <Cell value={v}/>
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    );
                                                })}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Pagination */}
                                        {totalPages > 1 && (
                                            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 12px', borderTop:`1px solid ${THEME.grid}22`, flexShrink:0, fontSize:10, color:THEME.textDim }}>
                                                <div style={{ display:'flex', alignItems:'center', gap: 20 }}>
                                                    <span style={{ fontVariantNumeric:'tabular-nums' }}>
                                                        {((page-1)*pageSize+1).toLocaleString()}–{Math.min(page*pageSize,processedRows.length).toLocaleString()} of {processedRows.length.toLocaleString()}
                                                    </span>
                                                    <span style={{ color:THEME.textDim, opacity:0.5 }}>·</span>
                                                    <span>{totalPages} pages</span>
                                                </div>
                                                <div style={{ display:'flex', alignItems:'center', gap:2 }}>
                                                    {[{icon:ChevronFirst,fn:()=>updateTab(activeTab,{page:1}),dis:page<=1},{icon:ChevronLeft,fn:()=>updateTab(activeTab,{page:page-1}),dis:page<=1},{icon:null,label:`${page} / ${totalPages}`},{icon:ChevronRight,fn:()=>updateTab(activeTab,{page:page+1}),dis:page>=totalPages},{icon:ChevronLast,fn:()=>updateTab(activeTab,{page:totalPages}),dis:page>=totalPages}].map((btn,i)=>(
                                                        btn.icon ? (
                                                            <button key={i} onClick={btn.fn} disabled={btn.dis} className="sql-page-btn"
                                                                    style={{ padding:'3px 6px', borderRadius: 16, border:'none', cursor:btn.dis?'not-allowed':'pointer', background:THEME.surface, color:THEME.textDim, display:'flex', alignItems:'center', opacity:btn.dis?0.3:1, transition:'all 0.12s' }}>
                                                                <btn.icon size={12}/>
                                                            </button>
                                                        ) : (
                                                            <span key={i} style={{ padding:'3px 10px', fontSize:10, fontWeight:700, color:THEME.textMuted, fontVariantNumeric:'tabular-nums', minWidth:52, textAlign:'center' }}>{btn.label}</span>
                                                        )
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap: 20, opacity:0.4 }}>
                                        <div style={{ width:54, height:54, borderRadius:16, background:`${THEME.primary}08`, border:`1px solid ${THEME.primary}10`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                                            <Terminal size={22} color={THEME.primary}/>
                                        </div>
                                        <div style={{ textAlign:'center' }}>
                                            <div style={{ fontSize:13, fontWeight:600, color:THEME.textMuted }}>Run a query to see results</div>
                                            <div style={{ fontSize:10, color:THEME.textDim, marginTop:5 }}>
                                                <kbd className="sql-kbd">Ctrl+Enter</kbd> execute · <kbd className="sql-kbd">Ctrl+Shift+Enter</kbd> explain
                                            </div>
                                        </div>
                                    </div>
                                )

                            ) : activeResultTab === 'chart' ? (
                                result?.rows?.length > 0 ? (
                                    <ChartView result={result}/>
                                ) : (
                                    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', opacity:0.4 }}>
                                        <span style={{ fontSize:12, color:THEME.textDim }}>Run a query first to visualize data</span>
                                    </div>
                                )

                            ) : activeResultTab === 'stats' ? (
                                result?.rows?.length > 0 ? (
                                    <div className="sql-scrollbar" style={{ padding:'12px', overflow:'auto', height:'100%' }}>
                                        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap: 20 }}>
                                            {result.fields.slice(0,20).map(f => {
                                                const s = colStats[f.name] || {};
                                                return (
                                                    <div key={f.name} style={{ padding:'10px 12px', borderRadius: 16, background:THEME.surface, border:`1px solid ${THEME.grid}30` }}>
                                                        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                                                            <Columns size={10} color={THEME.primary}/>
                                                            <span style={{ fontSize:11, fontWeight:700, color:THEME.textMain }}>{f.name}</span>
                                                        </div>
                                                        <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                                                            <div style={{ display:'flex', justifyContent:'space-between', fontSize:10 }}>
                                                                <span style={{ color:THEME.textDim }}>Unique</span>
                                                                <span style={{ color:THEME.textMuted, fontWeight:600 }}>{s.uniqueCount?.toLocaleString()}</span>
                                                            </div>
                                                            <div style={{ display:'flex', justifyContent:'space-between', fontSize:10 }}>
                                                                <span style={{ color:THEME.textDim }}>Nulls</span>
                                                                <span style={{ color:s.nullCount>0?THEME.warning:THEME.success, fontWeight:600 }}>{s.nullCount?.toLocaleString()}</span>
                                                            </div>
                                                            {s.min !== undefined && (
                                                                <>
                                                                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:10 }}>
                                                                        <span style={{ color:THEME.textDim }}>Min</span>
                                                                        <span style={{ color:THEME.success, fontWeight:600, fontFamily:'monospace' }}>{Number(s.min).toLocaleString()}</span>
                                                                    </div>
                                                                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:10 }}>
                                                                        <span style={{ color:THEME.textDim }}>Max</span>
                                                                        <span style={{ color:THEME.danger, fontWeight:600, fontFamily:'monospace' }}>{Number(s.max).toLocaleString()}</span>
                                                                    </div>
                                                                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:10 }}>
                                                                        <span style={{ color:THEME.textDim }}>Avg</span>
                                                                        <span style={{ color:THEME.primary, fontWeight:600, fontFamily:'monospace' }}>{Number(s.avg).toFixed(2)}</span>
                                                                    </div>
                                                                    {/* Mini histogram bar */}
                                                                    <div style={{ height:3, borderRadius:2, background:`${THEME.grid}30`, marginTop:2, overflow:'hidden' }}>
                                                                        <div style={{ height:'100%', width:`${(s.avg-s.min)/(s.max-s.min)*100}%`, background:THEME.primary, borderRadius:2 }}/>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', opacity:0.4 }}>
                                        <span style={{ fontSize:12, color:THEME.textDim }}>No data to analyze</span>
                                    </div>
                                )

                            ) : activeResultTab === 'explain' ? (
                                currentTab.explainResult?.error ? (
                                    <div style={{ padding:16, overflow:'auto' }} className="sql-scrollbar">
                                        <div style={{ display:'flex', alignItems:'flex-start', gap: 18, padding:'14px 16px', borderRadius: 16, background:`${THEME.danger}06`, border:`1px solid ${THEME.danger}18` }}>
                                            <XCircle size={16} color={THEME.danger} style={{ flexShrink:0 }}/>
                                            <pre style={{ fontSize:11, color:THEME.textMuted, fontFamily:'monospace', whiteSpace:'pre-wrap', margin:0 }}>{currentTab.explainResult.error}</pre>
                                        </div>
                                    </div>
                                ) : explainPlan ? (
                                    <div className="sql-scrollbar" style={{ padding:14, overflow:'auto', height:'100%' }}>
                                        {(() => {
                                            const root = currentTab.explainResult?.rows?.[0]?.['QUERY PLAN']?.[0] || currentTab.explainResult?.rows?.[0];
                                            const planTime = root?.['Planning Time'];
                                            const execTime = root?.['Execution Time'];
                                            return (planTime||execTime) ? (
                                                <div style={{ display:'flex', gap:20, padding:'9px 14px', borderRadius: 18, background:THEME.surface, border:`1px solid ${THEME.grid}30`, marginBottom:12, fontSize:11 }}>
                                                    {planTime&&<span style={{ color:THEME.textDim }}>Plan time: <strong style={{ color:THEME.secondary, fontVariantNumeric:'tabular-nums' }}>{planTime}ms</strong></span>}
                                                    {execTime&&<span style={{ color:THEME.textDim }}>Exec time: <strong style={{ color:THEME.primary, fontVariantNumeric:'tabular-nums' }}>{execTime}ms</strong></span>}
                                                    {explainMaxTime>0&&<span style={{ color:THEME.textDim }}>Slowest node: <strong style={{ color:THEME.danger, fontVariantNumeric:'tabular-nums' }}>{explainMaxTime.toFixed(2)}ms</strong></span>}
                                                </div>
                                            ) : null;
                                        })()}
                                        <div style={{ fontSize:10, fontWeight:700, color:THEME.textDim, letterSpacing:'0.04em', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
                                            <Workflow size={11} color={THEME.secondary}/> Execution Plan
                                        </div>
                                        <ExplainNode node={explainPlan} depth={0} maxTime={explainMaxTime}/>
                                        <details style={{ marginTop:14 }}>
                                            <summary style={{ fontSize:10, color:THEME.textDim, cursor:'pointer', userSelect:'none', padding:'4px 0' }}>Raw JSON output</summary>
                                            <pre style={{ fontSize:10.5, color:THEME.textDim, fontFamily:THEME.fontMono, lineHeight:1.6, margin:'8px 0 0', whiteSpace:'pre-wrap', padding:12, borderRadius: 18, background:THEME.surface, border:`1px solid ${THEME.grid}22`, maxHeight:300, overflow:'auto' }}>
                                                {JSON.stringify(currentTab.explainResult?.rows, null, 2)}
                                            </pre>
                                        </details>
                                    </div>
                                ) : (
                                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap: 22, opacity:0.4 }}>
                                        <Workflow size={26} color={THEME.textDim}/>
                                        <span style={{ fontSize:12, color:THEME.textDim }}>Click "Explain" to analyze the execution plan</span>
                                    </div>
                                )

                            ) : activeResultTab === 'messages' ? (
                                <div className="sql-scrollbar" style={{ padding:10, overflow:'auto', height:'100%' }}>
                                    {history.length === 0 ? (
                                        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', opacity:0.4 }}>
                                            <span style={{ fontSize:12, color:THEME.textDim }}>No messages yet</span>
                                        </div>
                                    ) : (
                                        <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                                            {history.slice(0,60).map(h=>(
                                                <div key={h.id} style={{ display:'flex', alignItems:'center', gap:9, padding:'5px 10px', borderRadius: 16, background:THEME.surface, border:`1px solid ${THEME.grid}18`, animation:'sqlSlideIn 0.12s ease' }}>
                                                    {h.success?<CheckCircle size={10} color={THEME.success} style={{flexShrink:0}}/>:<XCircle size={10} color={THEME.danger} style={{flexShrink:0}}/>}
                                                    <span style={{ fontSize:9, color:THEME.textDim, fontVariantNumeric:'tabular-nums', flexShrink:0, width:60, fontFamily:'monospace' }}>{fmtTime(h.ts)}</span>
                                                    <span style={{ fontSize:11, color:h.success?THEME.textMuted:THEME.danger, flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily:'monospace' }}>
                                                        {h.success?`OK — ${fmtRows(h.rowCount)} rows · ${fmtMs(h.durationMs)}`:`ERR — ${h.error}`}
                                                    </span>
                                                    <button onClick={()=>{ setSql(h.sql); setActiveTab(h.tabId||activeTab); }} style={{ background:'none', border:'none', cursor:'pointer', color:THEME.textDim, padding:'2px 5px', borderRadius: 18, fontSize:9, fontWeight:600, flexShrink:0 }}>
                                                        Reload
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                            ) : activeResultTab === 'saved' ? (
                                <div className="sql-scrollbar" style={{ padding:10, overflow:'auto', height:'100%' }}>
                                    {savedQueries.length === 0 ? (
                                        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap: 20, opacity:0.4 }}>
                                            <Bookmark size={24} color={THEME.textDim}/>
                                            <span style={{ fontSize:12, color:THEME.textDim, textAlign:'center' }}>No saved queries yet.<br/>Click "Save" in the editor bar.</span>
                                        </div>
                                    ) : (
                                        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                                            {savedQueries.map(q=>(
                                                <div key={q.id} style={{ padding:'10px 12px', borderRadius: 16, background:THEME.surface, border:`1px solid ${THEME.grid}28` }}>
                                                    <div style={{ display:'flex', alignItems:'center', gap: 20, marginBottom:6 }}>
                                                        <Bookmark size={11} color={THEME.secondary}/>
                                                        <span style={{ fontSize:12, fontWeight:700, color:THEME.textMain }}>{q.label}</span>
                                                        <span style={{ fontSize:9, color:THEME.textDim, marginLeft:'auto' }}>{fmtTime(q.ts)}</span>
                                                    </div>
                                                    <pre style={{ fontSize:10, color:THEME.textDim, fontFamily:'monospace', margin:'0 0 8px', whiteSpace:'pre-wrap', overflow:'hidden', maxHeight:52, lineHeight:1.6 }}>{q.sql}</pre>
                                                    <div style={{ display:'flex', gap:5 }}>
                                                        <button onClick={()=>setSql(q.sql)} style={{ padding:'3px 9px', borderRadius: 16, border:'none', cursor:'pointer', background:`${THEME.primary}12`, color:THEME.primary, fontSize:9.5, fontWeight:700, display:'inline-flex', alignItems:'center', gap:3 }}><Code size={9}/> Load</button>
                                                        <button onClick={()=>{ setSql(q.sql); requestAnimationFrame(()=>handleExecute(q.sql)); }} style={{ padding:'3px 9px', borderRadius: 16, border:'none', cursor:'pointer', background:`${THEME.success}10`, color:THEME.success, fontSize:9.5, fontWeight:700, display:'inline-flex', alignItems:'center', gap:3 }}><Play size={9}/> Run</button>
                                                        <button onClick={()=>copyText(q.sql, `saved-${q.id}`)} style={{ padding:'3px 9px', borderRadius: 16, border:'none', cursor:'pointer', background:`${THEME.textDim}08`, color:THEME.textDim, fontSize:9.5, fontWeight:700, display:'inline-flex', alignItems:'center', gap:3 }}>{copiedId===`saved-${q.id}`?<><Check size={9}/> Copied</>:<><Copy size={9}/> Copy</>}</button>
                                                        <button onClick={()=>setSavedQueries(prev=>prev.filter(s=>s.id!==q.id))} style={{ padding:'3px 9px', borderRadius: 16, border:'none', cursor:'pointer', background:`${THEME.danger}08`, color:THEME.danger, fontSize:9.5, fontWeight:700, display:'inline-flex', alignItems:'center', gap:3 }}><Trash2 size={9}/> Delete</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                            ) : activeResultTab === 'diff' ? (
                                <DiffViewer
                                    leftRows={tabs.find(t=>t.id===diffTabIds[0])?.result?.rows}
                                    rightRows={tabs.find(t=>t.id===diffTabIds[1])?.result?.rows}
                                    leftFields={tabs.find(t=>t.id===diffTabIds[0])?.result?.fields}
                                    rightFields={tabs.find(t=>t.id===diffTabIds[1])?.result?.fields}
                                    leftLabel={tabs.find(t=>t.id===diffTabIds[0])?.label}
                                    rightLabel={tabs.find(t=>t.id===diffTabIds[1])?.label}
                                />
                            ) : null}
                        </div>
                    </Panel>
                </div>

                {/* ═════════ RIGHT SIDEBAR ═════════ */}
                <div style={{ display:'flex', flexDirection:'column', height:'100%', minWidth:0, overflow:'hidden' }}>
                    {sidebarCollapsed ? (
                        <div style={{ display:'flex', flexDirection:'column', gap:4, padding:8 }}>
                            <button onClick={()=>setSidebarCollapsed(false)} style={{ padding:6, borderRadius: 18, border:'none', cursor:'pointer', background:`${THEME.primary}12`, color:THEME.primary, display:'flex' }}><PanelRightOpen size={14}/></button>
                            <Divider/>
                            {[{icon:History,id:'history'},{icon:Database,id:'schema'},{icon:Scissors,id:'snippets'},{icon:BrainCircuit,id:'ai'}].map(({icon:Icon,id})=>(
                                <button key={id} onClick={()=>{setSidebarCollapsed(false);setActivePanel(id);}} title={id}
                                        style={{ padding:7, borderRadius: 18, border:'none', cursor:'pointer', background:activePanel===id?`${THEME.primary}14`:'transparent', color:activePanel===id?THEME.primary:THEME.textDim, display:'flex' }}>
                                    <Icon size={14}/>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <Panel noPad
                               rightNode={
                                   <div style={{ display:'flex', gap:2, alignItems:'center' }}>
                                       {[{icon:History,id:'history',label:'History'},{icon:Database,id:'schema',label:'Schema'},{icon:Scissors,id:'snippets',label:'Snippets'},{icon:BrainCircuit,id:'ai',label:'AI'}].map(({icon:Icon,id,label})=>(
                                           <button key={id} onClick={()=>setActivePanel(id)} title={label}
                                                   style={{ padding:'4px 8px', borderRadius: 16, border:'none', cursor:'pointer', background:activePanel===id?`${THEME.primary}14`:'transparent', color:activePanel===id?THEME.primary:THEME.textDim, display:'flex', alignItems:'center', gap:4, fontSize:10, fontWeight:600, transition:'all 0.15s' }}>
                                               <Icon size={11}/> {label}
                                               {id==='ai' && <span style={{ fontSize:8, padding:'1px 4px', borderRadius:3, background:`${THEME.secondary}20`, color:THEME.secondary, fontWeight:800 }}>β</span>}
                                           </button>
                                       ))}
                                       <Divider vertical/>
                                       <button onClick={()=>setSidebarCollapsed(true)} style={{ padding:4, borderRadius: 16, border:'none', cursor:'pointer', background:'transparent', color:THEME.textDim, display:'flex' }}><PanelRightClose size={12}/></button>
                                   </div>
                               }
                               style={{ flex:1, minHeight:0, overflow:'hidden' }}
                        >
                            {/* ── History panel ── */}
                            {activePanel === 'history' && (
                                <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
                                    <div style={{ padding:'0 0 8px', flexShrink:0 }}>
                                        <div style={{ display:'flex', alignItems:'center', gap:7, padding:'5px 9px', borderRadius: 18, background:THEME.surface, border:`1px solid ${THEME.grid}50` }}>
                                            <Search size={11} color={THEME.textDim}/>
                                            <input value={historySearch} onChange={e=>setHistorySearch(e.target.value)} placeholder="Search history…"
                                                   style={{ border:'none', background:'transparent', color:THEME.textMain, outline:'none', flex:1, minWidth:0, fontSize:11, fontFamily:'inherit' }}/>
                                            {historySearch && <X size={10} color={THEME.textDim} style={{ cursor:'pointer' }} onClick={()=>setHistorySearch('')}/>}
                                        </div>
                                    </div>

                                    <div className="sql-scrollbar" style={{ flex:1, minHeight:0, overflowY:'auto' }}>
                                        {filteredHistory.length === 0 ? (
                                            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'36px 14px', gap: 20 }}>
                                                <Clock size={22} color={THEME.textDim} style={{ opacity:0.25 }}/>
                                                <span style={{ fontSize:11, color:THEME.textDim, textAlign:'center' }}>{history.length===0?'Execute a query to build history':'No matches'}</span>
                                            </div>
                                        ) : (
                                            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                                                {filteredHistory.map(h=>{
                                                    const sel = selectedHistoryId===h.id;
                                                    const isFav = favorites.has(h.id);
                                                    return (
                                                        <div key={h.id} className="sql-history-item"
                                                             onClick={()=>setSelectedHistoryId(sel?null:h.id)}
                                                             style={{ padding:'9px 10px', borderRadius: 16, background:sel?`${THEME.primary}05`:THEME.surface, border:`1px solid ${sel?`${THEME.primary}16`:`${THEME.grid}28`}` }}>
                                                            <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:4 }}>
                                                                {h.success?<CheckCircle size={9} color={THEME.success} style={{flexShrink:0}}/>:<XCircle size={9} color={THEME.danger} style={{flexShrink:0}}/>}
                                                                <span style={{ fontSize:9, color:THEME.textDim, fontVariantNumeric:'tabular-nums', fontFamily:'monospace' }}>{fmtTime(h.ts)}</span>
                                                                {h.success && <><span style={{ fontSize:9, color:THEME.primary, fontWeight:700 }}>{fmtRows(h.rowCount)}r</span><span style={{ fontSize:9, color:THEME.textDim }}>{fmtMs(h.durationMs)}</span></>}
                                                                <button onClick={e=>{e.stopPropagation();toggleFav(h.id);}} style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', padding:0, display:'flex' }}>
                                                                    <Star size={9} color={isFav?THEME.warning:THEME.textDim} fill={isFav?THEME.warning:'none'} style={{ transition:'all 0.15s' }}/>
                                                                </button>
                                                            </div>
                                                            <div style={{ fontSize:10, color:THEME.textMuted, fontFamily:'monospace', lineHeight:1.5, overflow:'hidden', textOverflow:'ellipsis', display:'-webkit-box', WebkitLineClamp:sel?12:2, WebkitBoxOrient:'vertical', wordBreak:'break-all' }}>
                                                                {h.sql}
                                                            </div>
                                                            {!h.success&&h.error&&<div style={{ fontSize:9.5, color:THEME.danger, marginTop:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{h.error}</div>}
                                                            {sel && (
                                                                <div style={{ display:'flex', gap:4, marginTop:7, animation:'sqlFadeIn 0.15s ease' }}>
                                                                    {[
                                                                        {label:'Load',icon:Code,color:THEME.primary,fn:()=>{setSql(h.sql);editorRef.current?.focus();}},
                                                                        {label:'Run',icon:Play,color:THEME.success,fn:()=>{setSql(h.sql);requestAnimationFrame(()=>handleExecute(h.sql));}},
                                                                        {label:copiedId===h.id?'Copied':'Copy',icon:copiedId===h.id?Check:Copy,color:THEME.textDim,fn:()=>copyText(h.sql,h.id)},
                                                                    ].map(b=>(
                                                                        <button key={b.label} onClick={e=>{e.stopPropagation();b.fn();}} style={{ padding:'3px 8px', borderRadius: 16, border:'none', cursor:'pointer', background:`${b.color}10`, color:b.color, fontSize:9, fontWeight:700, display:'inline-flex', alignItems:'center', gap:3 }}>
                                                                            <b.icon size={9}/>{b.label}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {history.length > 0 && (
                                        <>
                                            <div style={{ paddingTop:8, borderTop:`1px solid ${THEME.glassBorder}`, display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:5, fontSize:9, flexShrink:0, marginTop:6 }}>
                                                {[{label:'Total',value:history.length,color:THEME.textMuted},{label:'OK',value:history.filter(h=>h.success).length,color:THEME.success},{label:'Err',value:history.filter(h=>!h.success).length,color:THEME.danger}].map((s,i)=>(
                                                    <div key={i} style={{ textAlign:'center', padding:'5px', borderRadius: 18, background:THEME.surface }}>
                                                        <div style={{ color:THEME.textDim, fontWeight:600, letterSpacing:'0.02em', marginBottom:2 }}>{s.label}</div>
                                                        <div style={{ fontSize:16, fontWeight:800, color:s.color, fontVariantNumeric:'tabular-nums', lineHeight:1 }}>{s.value}</div>
                                                    </div>
                                                ))}
                                            </div>
                                            <button onClick={()=>{setHistory([]);setFavorites(new Set());setSelectedHistoryId(null);}} style={{ marginTop:6, width:'100%', padding:'5px', borderRadius: 16, border:`1px solid ${THEME.danger}15`, cursor:'pointer', background:`${THEME.danger}05`, color:THEME.danger, fontSize:9.5, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:4, flexShrink:0 }}>
                                                <Trash2 size={10}/> Clear history
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* ── Schema Browser ── */}
                            {activePanel === 'schema' && (
                                <div style={{ height:'100%', overflow:'hidden', display:'flex', flexDirection:'column', margin:'-13px -16px' }}>
                                    <SchemaBrowser schema={schema} onInsert={(text)=>{
                                        const ta = editorRef.current;
                                        if (!ta) return;
                                        const pos = ta.selectionStart;
                                        const val = ta.value;
                                        setSql(val.slice(0,pos)+text+val.slice(pos));
                                        requestAnimationFrame(()=>{ ta.selectionStart=ta.selectionEnd=pos+text.length; ta.focus(); });
                                    }}/>
                                </div>
                            )}

                            {/* ── Snippets ── */}
                            {activePanel === 'snippets' && (
                                <div style={{ display:'flex', flexDirection:'column', gap:5, height:'100%', overflow:'auto' }} className="sql-scrollbar">
                                    {SNIPPETS.map(s=>(
                                        <div key={s.id} className="sql-snippet-card" style={{ padding:'11px 13px', borderRadius: 18, background:THEME.surface, border:`1px solid ${THEME.grid}28` }}>
                                            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5 }}>
                                                <Scissors size={10} color={THEME.secondary}/>
                                                <span style={{ fontSize:11, fontWeight:700, color:THEME.textMain }}>{s.name}</span>
                                                <Pill label={s.tag} color={THEME.secondary}/>
                                            </div>
                                            <pre style={{ fontSize:9, color:THEME.textDim, fontFamily:'monospace', margin:'0 0 7px', whiteSpace:'pre-wrap', lineHeight:1.55, maxHeight:64, overflow:'hidden' }}>{s.sql}</pre>
                                            <button onClick={()=>setSql(s.sql)} style={{ padding:'5px 11px', borderRadius: 18, border:'none', cursor:'pointer', background:`${THEME.secondary}12`, color:THEME.secondary, fontSize:9, fontWeight:700, display:'inline-flex', alignItems:'center', gap:3 }}>
                                                <Code size={9}/> Insert
                                            </button>
                                        </div>
                                    ))}
                                    <div style={{ fontSize:10, color:THEME.textDim, textAlign:'center', padding:'6px 0' }}>
                                        Use <span className="sql-param">:param_name</span> for substitutable values
                                    </div>
                                </div>
                            )}

                            {/* ── AI Assistant ── */}
                            {activePanel === 'ai' && (
                                <AIAssistPanel
                                    sql={currentTab.sql}
                                    result={result}
                                    onSuggest={(tip) => {
                                        // Insert tip as a comment at top of editor
                                        setSql(`-- 💡 ${tip}\n${currentTab.sql}`);
                                        editorRef.current?.focus();
                                    }}
                                />
                            )}
                        </Panel>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SqlConsoleTab;