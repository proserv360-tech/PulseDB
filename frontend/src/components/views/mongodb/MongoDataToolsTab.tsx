import React, { useState, useEffect, useCallback } from 'react';
import { THEME } from '../../../utils/theme';
import { fetchData, postData } from '../../../utils/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
    Database,
    Edit,
    Plus,
    Trash2,
    RefreshCw,
    Download,
    Upload,
    Play,
    AlertCircle,
    ChevronDown,
    ChevronUp,
    Copy,
    X,
    Check,
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────────────────────── */
/* THEME & CONSTANTS */
/* ─────────────────────────────────────────────────────────────────────────── */
const DARK_THEME = {
    bg: THEME.bg,
    card: THEME.surface,
    border: THEME.grid,
    text: THEME.textMain,
    textMuted: THEME.textMuted,
    accent: THEME.primaryLight,
    success: THEME.primary,
    warning: THEME.warning,
    danger: THEME.danger,
    green: THEME.success,
};

const Styles = () => (
    <style>{`
        @keyframes mongoFade { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes mongoPulse { 0%{opacity:1} 50%{opacity:0.6} 100%{opacity:1} }

        .mongo-card {
            background: ${DARK_THEME.card};
            border: 1px solid ${DARK_THEME.border};
            border-left: 3px solid #00684A;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
            backdrop-filter: blur(12px);
            transition: all 0.25s ease;
            position: relative;
            animation: mongoFade 0.3s ease;
        }

        .mongo-card:hover {
            box-shadow: 0 12px 28px rgba(0,104,74,0.12);
            transform: translateY(-4px);
        }

        .mongo-card::after {
            content: '';
            position: absolute;
            top: 12px;
            right: 12px;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #00684A40;
        }

        .mongo-card-head {
            padding: 14px 20px;
            border-bottom: 1px solid ${DARK_THEME.border};
            display: flex;
            align-items: center;
            gap: 22px;
            font-weight: 700;
        }

        .mongo-card-body {
            padding: 22px 26px;
        }

        .mongo-section {
            margin-bottom: 24px;
        }

        .mongo-section-title {
            font-size: 13px;
            font-weight: 700;
            color: ${DARK_THEME.text};
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 20px;
        }

        .mongo-input {
            width: 100%;
            background: ${DARK_THEME.bg};
            border: 1px solid ${DARK_THEME.border};
            border-radius: 22px;
            padding: 12px 14px;
            color: ${DARK_THEME.text};
            font-size: 13px;
            margin-bottom: 16px;
            font-family: 'Monaco', 'Courier New', monospace;
        }

        .mongo-input:focus {
            outline: none;
            border-color: ${DARK_THEME.accent};
            box-shadow: 0 0 0 2px ${DARK_THEME.accent}20;
        }

        .mongo-textarea {
            width: 100%;
            background: ${DARK_THEME.bg};
            border: 1px solid ${DARK_THEME.border};
            border-radius: 22px;
            padding: 16px;
            color: ${DARK_THEME.text};
            font-size: 12px;
            font-family: 'Monaco', 'Courier New', monospace;
            min-height: 200px;
            resize: vertical;
            margin-bottom: 16px;
        }

        .mongo-textarea:focus {
            outline: none;
            border-color: ${DARK_THEME.accent};
            box-shadow: 0 0 0 2px ${DARK_THEME.accent}20;
        }

        .mongo-btn {
            background: ${DARK_THEME.accent};
            color: ${DARK_THEME.bg};
            border: none;
            border-radius: 20px;
            padding: 10px 18px;
            font-weight: 600;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 20px;
            font-size: 12px;
            transition: all 0.2s;
        }

        .mongo-btn:hover {
            background: #3b82f6;
            transform: translateY(-3px);
        }

        .mongo-btn:disabled {
            background: ${DARK_THEME.border};
            cursor: not-allowed;
            transform: none;
        }

        .mongo-btn-secondary {
            background: ${DARK_THEME.border};
            color: ${DARK_THEME.text};
        }

        .mongo-btn-secondary:hover {
            background: ${DARK_THEME.border}cc;
        }

        .mongo-btn-danger {
            background: ${DARK_THEME.danger};
            color: white;
        }

        .mongo-btn-danger:hover {
            background: #fb7185;
        }

        .mongo-btn-group {
            display: flex;
            gap: 20px;
            margin-top: 12px;
            flex-wrap: wrap;
        }

        .mongo-select {
            width: 100%;
            background: ${DARK_THEME.bg};
            border: 1px solid ${DARK_THEME.border};
            border-radius: 22px;
            padding: 12px 14px;
            color: ${DARK_THEME.text};
            font-size: 13px;
            margin-bottom: 16px;
        }

        .mongo-select:focus {
            outline: none;
            border-color: ${DARK_THEME.accent};
        }

        .mongo-collapsible {
            cursor: pointer;
            user-select: none;
        }

        .mongo-collapsible:hover {
            background: ${DARK_THEME.bg};
        }

        .mongo-stage-card {
            background: ${DARK_THEME.bg};
            border: 1px solid ${DARK_THEME.border};
            border-radius: 22px;
            padding: 16px;
            margin-bottom: 16px;
        }

        .mongo-result-box {
            background: ${DARK_THEME.bg};
            border: 1px solid ${DARK_THEME.border};
            border-radius: 22px;
            padding: 16px;
            max-height: 400px;
            overflow-y: auto;
            font-family: 'Monaco', 'Courier New', monospace;
            font-size: 11px;
            color: ${DARK_THEME.textMuted};
            white-space: pre-wrap;
            word-break: break-all;
        }

        .mongo-loading {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 20px;
            padding: 20px;
            color: ${DARK_THEME.textMuted};
            font-size: 13px;
        }

        .mongo-spinner {
            animation: mongoPulse 1.5s ease-in-out infinite;
        }

        .mongo-error {
            background: ${DARK_THEME.danger}15;
            border: 1px solid ${DARK_THEME.danger};
            border-radius: 22px;
            padding: 14px;
            color: ${DARK_THEME.danger};
            margin-bottom: 16px;
            font-size: 12px;
            display: flex;
            align-items: flex-start;
            gap: 22px;
        }

        .mongo-success {
            background: ${DARK_THEME.success}15;
            border: 1px solid ${DARK_THEME.success};
            border-radius: 22px;
            padding: 14px;
            color: ${DARK_THEME.success};
            margin-bottom: 16px;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 22px;
        }
    `}</style>
);

/* ═══════════════════════════════════════════════════════════════════════════ */
/* MONGO DATA TOOLS TAB COMPONENT */
/* ═══════════════════════════════════════════════════════════════════════════ */
export default function MongoDataToolsTab() {
    const [collections, setCollections] = useState(['users', 'products', 'orders', 'sessions']);
    const [selectedCollection, setSelectedCollection] = useState('users');
    const [queryMode, setQueryMode] = useState('find'); // find, insert, update, delete
    const [queryJSON, setQueryJSON] = useState('{\n  "status": "active"\n}');
    const [updateJSON, setUpdateJSON] = useState('{\n  "$set": { "status": "inactive" }\n}');
    const [queryResult, setQueryResult] = useState(null);
    const [resultLoading, setResultLoading] = useState(false);
    const [resultError, setResultError] = useState(null);
    const [resultSuccess, setResultSuccess] = useState(null);

    // Aggregation pipeline
    const [pipelineStages, setPipelineStages] = useState([
        { stage: '$match', content: '{ "status": "active" }' },
        { stage: '$group', content: '{ "_id": "$category", "count": { "$sum": 1 } }' },
    ]);

    // Import/Export
    const [importJSON, setImportJSON] = useState('');
    const [exportLoading, setExportLoading] = useState(false);

    const loadCollections = useCallback(async () => {
        try {
            const data = await fetchData('/api/mongodb/collections');
            setCollections(data?.collections || collections);
        } catch (err) {
            console.error('Failed to load collections', err);
        }
    }, []);

    useEffect(() => {
        loadCollections();
    }, [loadCollections]);

    const executeQuery = async () => {
        try {
            setResultLoading(true);
            setResultError(null);
            setResultSuccess(null);

            let payload = { collection: selectedCollection };

            if (queryMode === 'find') {
                payload.query = JSON.parse(queryJSON);
                const result = await postData('/api/mongodb/find', payload);
                setQueryResult(result.documents || []);
                setResultSuccess(`Found ${result.documents?.length || 0} documents`);
            } else if (queryMode === 'insert') {
                const doc = JSON.parse(queryJSON);
                const result = await postData('/api/mongodb/insert', { ...payload, document: doc });
                setQueryResult(result);
                setResultSuccess('Document inserted successfully');
            } else if (queryMode === 'update') {
                payload.filter = JSON.parse(queryJSON);
                payload.update = JSON.parse(updateJSON);
                const result = await postData('/api/mongodb/update', payload);
                setQueryResult(result);
                setResultSuccess(`Updated ${result.modifiedCount || 0} documents`);
            } else if (queryMode === 'delete') {
                payload.filter = JSON.parse(queryJSON);
                const result = await postData('/api/mongodb/delete', payload);
                setQueryResult(result);
                setResultSuccess(`Deleted ${result.deletedCount || 0} documents`);
            }
        } catch (err) {
            setResultError(err.message || 'Query execution failed');
        } finally {
            setResultLoading(false);
        }
    };

    const executeAggregation = async () => {
        try {
            setResultLoading(true);
            setResultError(null);

            const pipeline = pipelineStages.map((s) => {
                const obj = {};
                obj[s.stage] = JSON.parse(s.content);
                return obj;
            });

            const result = await postData('/api/mongodb/aggregate', {
                collection: selectedCollection,
                pipeline,
            });
            setQueryResult(result.results || []);
            setResultSuccess(`Aggregation returned ${result.results?.length || 0} results`);
        } catch (err) {
            setResultError(err.message || 'Aggregation failed');
        } finally {
            setResultLoading(false);
        }
    };

    const exportCollection = async () => {
        try {
            setExportLoading(true);
            const result = await fetchData(`/api/mongodb/export/${selectedCollection}`);
            setImportJSON(JSON.stringify(result.documents || [], null, 2));
            setResultSuccess('Collection exported');
        } catch (err) {
            setResultError('Export failed: ' + err.message);
        } finally {
            setExportLoading(false);
        }
    };

    const importCollection = async () => {
        try {
            setResultLoading(true);
            const docs = JSON.parse(importJSON);
            const result = await postData('/api/mongodb/import', {
                collection: selectedCollection,
                documents: Array.isArray(docs) ? docs : [docs],
            });
            setResultSuccess(`Imported ${result.insertedCount || 0} documents`);
            setImportJSON('');
        } catch (err) {
            setResultError('Import failed: ' + err.message);
        } finally {
            setResultLoading(false);
        }
    };

    const addStage = () => {
        setPipelineStages([...pipelineStages, { stage: '$project', content: '{ "_id": 1 }' }]);
    };

    const removeStage = (idx) => {
        setPipelineStages(pipelineStages.filter((_, i) => i !== idx));
    };

    const updateStage = (idx, field, value) => {
        const updated = [...pipelineStages];
        updated[idx][field] = value;
        setPipelineStages(updated);
    };

    return (
        <>
            <Styles />
            <div style={{ padding: '0 0 20px 0' }}>
                {/* Collection Selector */}
                <div className="mongo-section">
                    <h3 className="mongo-section-title">
                        <Database size={16} /> Select Collection
                    </h3>
                    <div className="mongo-card">
                        <select
                            className="mongo-select"
                            value={selectedCollection}
                            onChange={(e) => setSelectedCollection(e.target.value)}
                        >
                            {collections.map((c) => (
                                <option key={c} value={c}>
                                    {c}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Document Editor */}
                <div className="mongo-section">
                    <h3 className="mongo-section-title">
                        <Edit size={16} /> Document Editor
                    </h3>
                    <div className="mongo-card">
                        <div style={{ marginBottom: 16 }}>
                            <label
                                style={{
                                    display: 'block',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    marginBottom: 8,
                                    color: DARK_THEME.textMuted,
                                }}
                            >
                                Operation
                            </label>
                            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                                {['find', 'insert', 'update', 'delete'].map((op) => (
                                    <button
                                        key={op}
                                        onClick={() => setQueryMode(op)}
                                        style={{
                                            padding: '20px 24px',
                                            background: queryMode === op ? DARK_THEME.accent : DARK_THEME.border,
                                            color: queryMode === op ? DARK_THEME.bg : DARK_THEME.text,
                                            border: 'none',
                                            borderRadius: 18,
                                            cursor: 'pointer',
                                            fontWeight: 600,
                                            fontSize: 12,
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        {op.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {resultError && (
                            <div className="mongo-error">
                                <AlertCircle size={16} />
                                {resultError}
                            </div>
                        )}

                        {resultSuccess && (
                            <div className="mongo-success">
                                <Check size={16} />
                                {resultSuccess}
                            </div>
                        )}

                        <label
                            style={{
                                display: 'block',
                                fontSize: 12,
                                fontWeight: 600,
                                marginBottom: 8,
                                color: DARK_THEME.textMuted,
                            }}
                        >
                            Query / Filter
                        </label>
                        <textarea
                            className="mongo-textarea"
                            value={queryJSON}
                            onChange={(e) => setQueryJSON(e.target.value)}
                            placeholder='{"field": "value"}'
                        />

                        {queryMode === 'update' && (
                            <>
                                <label
                                    style={{
                                        display: 'block',
                                        fontSize: 12,
                                        fontWeight: 600,
                                        marginBottom: 8,
                                        color: DARK_THEME.textMuted,
                                    }}
                                >
                                    Update Expression
                                </label>
                                <textarea
                                    className="mongo-textarea"
                                    value={updateJSON}
                                    onChange={(e) => setUpdateJSON(e.target.value)}
                                    placeholder='{"$set": {"field": "value"}}'
                                />
                            </>
                        )}

                        <div className="mongo-btn-group">
                            <button className="mongo-btn" onClick={executeQuery} disabled={resultLoading}>
                                {resultLoading && <RefreshCw size={14} className="mongo-spinner" />}
                                Execute
                            </button>
                        </div>

                        {queryResult && (
                            <div style={{ marginTop: 16 }}>
                                <label
                                    style={{
                                        display: 'block',
                                        fontSize: 12,
                                        fontWeight: 600,
                                        marginBottom: 8,
                                        color: DARK_THEME.textMuted,
                                    }}
                                >
                                    Result
                                </label>
                                <div className="mongo-result-box">{JSON.stringify(queryResult, null, 2)}</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Aggregation Pipeline Builder */}
                <div className="mongo-section">
                    <h3 className="mongo-section-title">
                        <Plus size={16} /> Aggregation Pipeline Builder
                    </h3>
                    <div className="mongo-card">
                        <div style={{ marginBottom: 16 }}>
                            {pipelineStages.map((stage, idx) => (
                                <div key={idx} className="mongo-stage-card">
                                    <div style={{ display: 'flex', gap: 20, marginBottom: 8 }}>
                                        <select
                                            className="mongo-select"
                                            style={{ marginBottom: 0, flex: '0 0 150px' }}
                                            value={stage.stage}
                                            onChange={(e) => updateStage(idx, 'stage', e.target.value)}
                                        >
                                            {[
                                                '$match',
                                                '$project',
                                                '$group',
                                                '$sort',
                                                '$limit',
                                                '$skip',
                                                '$unwind',
                                                '$lookup',
                                            ].map((s) => (
                                                <option key={s} value={s}>
                                                    {s}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            className="mongo-btn mongo-btn-danger"
                                            onClick={() => removeStage(idx)}
                                            style={{ flex: '0 0 auto' }}
                                        >
                                            <X size={12} /> Remove
                                        </button>
                                    </div>
                                    <textarea
                                        className="mongo-textarea"
                                        style={{ minHeight: 80, marginBottom: 0 }}
                                        value={stage.content}
                                        onChange={(e) => updateStage(idx, 'content', e.target.value)}
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="mongo-btn-group">
                            <button className="mongo-btn mongo-btn-secondary" onClick={addStage}>
                                <Plus size={14} /> Add Stage
                            </button>
                            <button className="mongo-btn" onClick={executeAggregation} disabled={resultLoading}>
                                {resultLoading && <RefreshCw size={14} className="mongo-spinner" />}
                                Execute Pipeline
                            </button>
                        </div>

                        {queryResult && (
                            <div style={{ marginTop: 16 }}>
                                <label
                                    style={{
                                        display: 'block',
                                        fontSize: 12,
                                        fontWeight: 600,
                                        marginBottom: 8,
                                        color: DARK_THEME.textMuted,
                                    }}
                                >
                                    Result
                                </label>
                                <div className="mongo-result-box">{JSON.stringify(queryResult, null, 2)}</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Import/Export */}
                <div className="mongo-section">
                    <h3 className="mongo-section-title">
                        <Download size={16} /> Import / Export
                    </h3>
                    <div className="mongo-card">
                        <div style={{ marginBottom: 16 }}>
                            <label
                                style={{
                                    display: 'block',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    marginBottom: 8,
                                    color: DARK_THEME.textMuted,
                                }}
                            >
                                JSON Data
                            </label>
                            <textarea
                                className="mongo-textarea"
                                value={importJSON}
                                onChange={(e) => setImportJSON(e.target.value)}
                                placeholder='[{"_id": 1, "name": "example"}]'
                            />
                        </div>

                        <div className="mongo-btn-group">
                            <button className="mongo-btn" onClick={exportCollection} disabled={exportLoading}>
                                {exportLoading && <RefreshCw size={14} className="mongo-spinner" />}
                                <Upload size={14} /> Export
                            </button>
                            <button
                                className="mongo-btn"
                                onClick={importCollection}
                                disabled={resultLoading || !importJSON.trim()}
                            >
                                {resultLoading && <RefreshCw size={14} className="mongo-spinner" />}
                                <Download size={14} /> Import
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
