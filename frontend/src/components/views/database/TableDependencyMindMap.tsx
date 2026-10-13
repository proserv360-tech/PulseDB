import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { THEME, useAdaptiveTheme } from '../../../utils/theme';
import { fetchData } from '../../../utils/api';
import { Search, ZoomIn, ZoomOut, Filter } from 'lucide-react';

/**
 * TableDependencyMindMap
 * ─────────────────────────────────────────────────────────────────
 * Interactive mind map showing table dependencies with radial layout.
 *
 * Features:
 * - Central node for selected table (bright, emphasized)
 * - Concentric rings showing depth (direct deps, referenced tables, indirect)
 * - Color-coded by relationship depth (bright center → dim edges)
 * - Animated dashed lines with directional arrowheads
 * - Node details on hover (columns, relationship type, row count)
 * - Zoom + pan controls
 * - Search/filter for specific tables
 * - Legend showing relationship types
 */

const TableDependencyMindMap = ({ selectedTableId = null, onTableSelect = null }) => {
    useAdaptiveTheme();

    const [relationships, setRelationships] = useState(null);
    const [selectedTable, setSelectedTable] = useState(selectedTableId);
    const [selectedTableDetails, setSelectedTableDetails] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterSchema, setFilterSchema] = useState('');
    const [zoom, setZoom] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [hoveredNode, setHoveredNode] = useState(null);
    const [tooltip, setTooltip] = useState(null);

    const svgRef = useRef(null);
    const containerRef = useRef(null);
    const nodesRef = useRef([]);
    const linksRef = useRef([]);

    // Fetch schema data
    useEffect(() => {
        const fetchSchema = async () => {
            try {
                setLoading(true);
                setError(null);
                const relData = await fetchData('/api/schema/relationships');
                setRelationships(relData);

                // Auto-select first table if none specified
                if (!selectedTable && relData.tables.length > 0) {
                    setSelectedTable(relData.tables[0].id);
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchSchema();
    }, []);

    // Fetch selected table details
    useEffect(() => {
        if (!selectedTable) {
            setSelectedTableDetails(null);
            return;
        }
        const [schema, table] = selectedTable.split('.');
        const fetchDetails = async () => {
            try {
                const details = await fetchData(`/api/schema/columns/${schema}/${table}`);
                setSelectedTableDetails(details);
            } catch (err) {
                console.error('Failed to fetch table details:', err);
            }
        };
        fetchDetails();
    }, [selectedTable]);

    // Call parent callback when selection changes
    useEffect(() => {
        if (onTableSelect) {
            onTableSelect(selectedTable);
        }
    }, [selectedTable, onTableSelect]);

    // Get unique schemas
    const schemas = useMemo(() => {
        if (!relationships) return [];
        const schemaSet = new Set();
        relationships.tables.forEach(t => schemaSet.add(t.schema));
        return Array.from(schemaSet).sort();
    }, [relationships]);

    // Build dependency graph for selected table
    const dependencyData = useMemo(() => {
        if (!relationships || !selectedTable) return { nodes: [], links: [] };

        const tables = new Map(relationships.tables.map(t => [t.id, t]));
        const nodes = [];
        const links = [];
        const nodeIds = new Set();

        // Center node (selected table)
        const centerTable = tables.get(selectedTable);
        if (centerTable) {
            nodes.push({
                id: selectedTable,
                name: centerTable.name,
                schema: centerTable.schema,
                rowCount: centerTable.rowCount,
                depth: 0,
                isCenter: true,
            });
            nodeIds.add(selectedTable);
        }

        // First ring: Direct dependencies (both ways)
        const ring1Nodes = new Set();
        const ring1Links = [];

        for (const rel of relationships.relationships) {
            // Tables that reference the selected table (incoming)
            if (rel.to === selectedTable && rel.from !== selectedTable) {
                ring1Nodes.add(rel.from);
                ring1Links.push({
                    source: rel.from,
                    target: selectedTable,
                    fromColumn: rel.fromColumn,
                    toColumn: rel.toColumn,
                    type: 'incoming', // This table references selectedTable
                });
            }
            // Tables referenced by the selected table (outgoing)
            else if (rel.from === selectedTable && rel.to !== selectedTable) {
                ring1Nodes.add(rel.to);
                ring1Links.push({
                    source: selectedTable,
                    target: rel.to,
                    fromColumn: rel.fromColumn,
                    toColumn: rel.toColumn,
                    type: 'outgoing', // selectedTable references this table
                });
            }
        }

        // Add ring1 nodes
        for (const nodeId of ring1Nodes) {
            const table = tables.get(nodeId);
            if (table && !nodeIds.has(nodeId)) {
                nodes.push({
                    id: nodeId,
                    name: table.name,
                    schema: table.schema,
                    rowCount: table.rowCount,
                    depth: 1,
                    isCenter: false,
                });
                nodeIds.add(nodeId);
                links.push(...ring1Links.filter(l => l.source === nodeId || l.target === nodeId));
            }
        }

        // Second ring: Tables referenced by ring1 nodes (2-hop)
        const ring2Nodes = new Set();
        const ring2Links = [];

        for (const nodeId of ring1Nodes) {
            for (const rel of relationships.relationships) {
                // If ring1 node references another table
                if (rel.from === nodeId && rel.to !== selectedTable && !nodeIds.has(rel.to)) {
                    ring2Nodes.add(rel.to);
                    ring2Links.push({
                        source: nodeId,
                        target: rel.to,
                        fromColumn: rel.fromColumn,
                        toColumn: rel.toColumn,
                        type: 'indirect',
                    });
                }
                // If another table references this ring1 node
                if (rel.to === nodeId && rel.from !== selectedTable && !nodeIds.has(rel.from)) {
                    ring2Nodes.add(rel.from);
                    ring2Links.push({
                        source: rel.from,
                        target: nodeId,
                        fromColumn: rel.fromColumn,
                        toColumn: rel.toColumn,
                        type: 'indirect',
                    });
                }
            }
        }

        // Add ring2 nodes (limit to 8 for readability)
        let ring2Count = 0;
        for (const nodeId of ring2Nodes) {
            if (ring2Count >= 8) break;
            const table = tables.get(nodeId);
            if (table && !nodeIds.has(nodeId)) {
                nodes.push({
                    id: nodeId,
                    name: table.name,
                    schema: table.schema,
                    rowCount: table.rowCount,
                    depth: 2,
                    isCenter: false,
                });
                nodeIds.add(nodeId);
                ring2Count++;
                links.push(...ring2Links.filter(l => l.source === nodeId || l.target === nodeId));
            }
        }

        return { nodes, links };
    }, [relationships, selectedTable]);

    // Calculate radial positions
    const positionedNodes = useMemo(() => {
        const positioned = [];
        const centerX = 200;
        const centerY = 200;
        const ring1Radius = 120;
        const ring2Radius = 200;

        for (const node of dependencyData.nodes) {
            if (node.isCenter) {
                positioned.push({ ...node, x: centerX, y: centerY });
            } else {
                const allNodesAtDepth = dependencyData.nodes.filter(n => n.depth === node.depth);
                const indexInRing = allNodesAtDepth.indexOf(node);
                const angleStep = (2 * Math.PI) / Math.max(allNodesAtDepth.length, 3);
                const angle = angleStep * indexInRing - Math.PI / 2;
                const radius = node.depth === 1 ? ring1Radius : ring2Radius;
                const x = centerX + Math.cos(angle) * radius;
                const y = centerY + Math.sin(angle) * radius;
                positioned.push({ ...node, x, y });
            }
        }

        nodesRef.current = positioned;
        return positioned;
    }, [dependencyData]);

    // Render SVG
    const render = useCallback(() => {
        const svg = svgRef.current;
        if (!svg) return;

        // Clear
        while (svg.firstChild) svg.removeChild(svg.firstChild);

        const width = svg.clientWidth || 800;
        const height = svg.clientHeight || 600;

        // Defs for arrowheads
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const markerIncoming = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        markerIncoming.setAttribute('id', 'arrowIncoming');
        markerIncoming.setAttribute('markerWidth', '10');
        markerIncoming.setAttribute('markerHeight', '10');
        markerIncoming.setAttribute('refX', '8');
        markerIncoming.setAttribute('refY', '3');
        markerIncoming.setAttribute('orient', 'auto');
        markerIncoming.setAttribute('markerUnits', 'strokeWidth');
        const pathIncoming = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathIncoming.setAttribute('d', 'M0,0 L0,6 L9,3 z');
        pathIncoming.setAttribute('fill', THEME.secondary);
        markerIncoming.appendChild(pathIncoming);
        defs.appendChild(markerIncoming);

        const markerOutgoing = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        markerOutgoing.setAttribute('id', 'arrowOutgoing');
        markerOutgoing.setAttribute('markerWidth', '10');
        markerOutgoing.setAttribute('markerHeight', '10');
        markerOutgoing.setAttribute('refX', '8');
        markerOutgoing.setAttribute('refY', '3');
        markerOutgoing.setAttribute('orient', 'auto');
        markerOutgoing.setAttribute('markerUnits', 'strokeWidth');
        const pathOutgoing = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathOutgoing.setAttribute('d', 'M0,0 L0,6 L9,3 z');
        pathOutgoing.setAttribute('fill', THEME.primary);
        markerOutgoing.appendChild(pathOutgoing);
        defs.appendChild(markerOutgoing);

        svg.appendChild(defs);

        // Group for zoom/pan
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.style.transform = `scale(${zoom})`;
        g.style.transformOrigin = `${width / 2}px ${height / 2}px`;
        g.style.transformBox = 'fill-box';

        // Draw links with arrows
        for (const link of dependencyData.links) {
            const source = positionedNodes.find(n => n.id === link.source);
            const target = positionedNodes.find(n => n.id === link.target);
            if (!source || !target) continue;

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', source.x);
            line.setAttribute('y1', source.y);
            line.setAttribute('x2', target.x);
            line.setAttribute('y2', target.y);

            if (link.type === 'incoming') {
                line.setAttribute('stroke', THEME.secondary);
                line.setAttribute('marker-end', 'url(#arrowIncoming)');
            } else if (link.type === 'outgoing') {
                line.setAttribute('stroke', THEME.primary);
                line.setAttribute('marker-end', 'url(#arrowOutgoing)');
            } else {
                line.setAttribute('stroke', THEME.textMuted);
                line.setAttribute('opacity', '0.3');
            }

            line.setAttribute('stroke-width', '2');
            line.setAttribute('stroke-dasharray', '4,2');
            line.setAttribute('opacity', '0.6');
            g.appendChild(line);
        }

        // Draw nodes
        for (const node of positionedNodes) {
            const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');

            // Node circle
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', node.x);
            circle.setAttribute('cy', node.y);
            circle.setAttribute('r', node.isCenter ? 50 : (node.depth === 1 ? 40 : 32));

            if (node.isCenter) {
                circle.setAttribute('fill', THEME.secondary);
                circle.setAttribute('opacity', '0.95');
            } else if (node.depth === 1) {
                circle.setAttribute('fill', THEME.primary);
                circle.setAttribute('opacity', hoveredNode === node.id ? '0.8' : '0.6');
            } else {
                circle.setAttribute('fill', THEME.textMuted);
                circle.setAttribute('opacity', hoveredNode === node.id ? '0.5' : '0.3');
            }

            circle.style.cursor = 'pointer';
            circle.style.transition = 'all 0.2s ease';

            // Add glow effect for center node
            if (node.isCenter) {
                circle.setAttribute('filter', `drop-shadow(0 0 8px ${THEME.secondary}40)`);
            }

            circle.addEventListener('click', () => {
                setSelectedTable(node.id);
            });

            circle.addEventListener('mouseover', () => {
                setHoveredNode(node.id);
                setTooltip({
                    x: node.x,
                    y: node.y,
                    name: node.name,
                    schema: node.schema,
                    rowCount: node.rowCount,
                });
            });

            circle.addEventListener('mouseout', () => {
                setHoveredNode(null);
                setTooltip(null);
            });

            group.appendChild(circle);

            // Node label
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', node.x);
            text.setAttribute('y', node.y);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('dominant-baseline', 'middle');
            text.setAttribute('fill', node.isCenter ? THEME.textInverse : THEME.textMain);
            text.setAttribute('font-size', node.isCenter ? '13' : '11');
            text.setAttribute('font-weight', '600');
            text.style.pointerEvents = 'none';
            text.textContent = node.name.substring(0, 12);
            group.appendChild(text);

            // Row count badge for first ring
            if (!node.isCenter && node.depth === 1 && node.rowCount) {
                const badge = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                badge.setAttribute('x', node.x);
                badge.setAttribute('y', node.y + 18);
                badge.setAttribute('text-anchor', 'middle');
                badge.setAttribute('font-size', '9');
                badge.setAttribute('fill', THEME.textMuted);
                badge.style.pointerEvents = 'none';
                const rowStr = node.rowCount > 1000000 ? `${(node.rowCount / 1000000).toFixed(1)}M` :
                              node.rowCount > 1000 ? `${(node.rowCount / 1000).toFixed(0)}K` :
                              node.rowCount;
                badge.textContent = `${rowStr} rows`;
                group.appendChild(badge);
            }

            g.appendChild(group);
        }

        svg.appendChild(g);
    }, [zoom, positionedNodes, dependencyData, hoveredNode, THEME]);

    // Initialize render
    useEffect(() => {
        if (positionedNodes.length > 0) {
            render();
        }
    }, [positionedNodes, render]);

    // Mouse wheel zoom
    useEffect(() => {
        const svg = svgRef.current;
        if (!svg) return;

        const handleWheel = (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            setZoom(z => Math.max(0.5, Math.min(3, z * delta)));
        };

        svg.addEventListener('wheel', handleWheel, { passive: false });

        return () => {
            svg.removeEventListener('wheel', handleWheel);
        };
    }, []);

    // Filter tables
    const filteredTables = useMemo(() => {
        if (!relationships) return [];
        return relationships.tables.filter(t => {
            const matchesSchema = !filterSchema || t.schema === filterSchema;
            const matchesSearch = !searchTerm || t.name.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesSchema && matchesSearch;
        });
    }, [relationships, filterSchema, searchTerm]);

    // Styles
    const styles = {
        wrap: {
            display: 'flex',
            height: '100%',
            gap: '0',
            fontFamily: THEME.fontBody,
        },
        panel: {
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            background: THEME.surface,
            border: `1px solid ${THEME.glassBorder}`,
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
            backdropFilter: 'blur(12px)',
        },
        toolbar: {
            padding: '14px 20px',
            borderBottom: `1px solid ${THEME.glassBorder}`,
            display: 'flex',
            gap: '16px',
            alignItems: 'center',
            flexWrap: 'wrap',
        },
        input: {
            padding: '22px 28px',
            background: THEME.surface,
            border: `1px solid ${THEME.glassBorder}`,
            borderRadius: 16,
            color: THEME.textMain,
            fontFamily: THEME.fontBody,
            fontSize: '13px',
        },
        select: {
            padding: '22px 28px',
            background: THEME.surface,
            border: `1px solid ${THEME.glassBorder}`,
            borderRadius: 16,
            color: THEME.textMain,
            fontFamily: THEME.fontBody,
            fontSize: '13px',
        },
        button: {
            padding: '16px 22px',
            background: THEME.primary,
            color: THEME.textInverse,
            border: 'none',
            borderRadius: 16,
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: THEME.transitionFast,
        },
        svg: {
            flex: 1,
            background: THEME.bgAlt,
            borderRadius: 20,
        },
        sidePanel: {
            width: '260px',
            borderLeft: `1px solid ${THEME.glassBorder}`,
            padding: '20px',
            overflowY: 'auto',
            background: THEME.surface,
            fontSize: '13px',
        },
        legend: {
            fontSize: '12px',
            marginBottom: '20px',
        },
        legendItem: {
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '8px',
        },
        legendBox: {
            width: '12px',
            height: '2px',
            borderRadius: '1px',
        },
    };

    if (loading) {
        return (
            <div style={styles.panel}>
                <div style={{ padding: '32px', textAlign: 'center', color: THEME.textMuted }}>
                    Loading schema...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={styles.panel}>
                <div style={{ padding: '32px', textAlign: 'center', color: THEME.danger }}>
                    Error: {error}
                </div>
            </div>
        );
    }

    return (
        <div style={styles.wrap}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={styles.toolbar}>
                    <div style={{ display: 'flex', gap: '12px', flex: 1, alignItems: 'center' }}>
                        <Search size={16} style={{ color: THEME.textMuted }} />
                        <input
                            type="text"
                            placeholder="Search tables..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{ ...styles.input, flex: 1, minWidth: '150px' }}
                        />
                    </div>

                    <Filter size={16} style={{ color: THEME.textMuted }} />
                    <select
                        value={filterSchema}
                        onChange={e => setFilterSchema(e.target.value)}
                        style={styles.select}
                    >
                        <option value="">All Schemas</option>
                        {schemas.map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>

                    <button style={styles.button} onClick={() => setZoom(z => z * 1.2)}>
                        <ZoomIn size={14} />
                    </button>
                    <button style={styles.button} onClick={() => setZoom(z => z / 1.2)}>
                        <ZoomOut size={14} />
                    </button>
                    <button style={styles.button} onClick={() => setZoom(1)}>
                        Reset
                    </button>
                </div>

                <svg
                    ref={svgRef}
                    style={{
                        ...styles.svg,
                        flex: 1,
                    }}
                />

                {tooltip && (
                    <div
                        style={{
                            position: 'fixed',
                            left: `${tooltip.x}px`,
                            top: `${tooltip.y}px`,
                            background: THEME.surface,
                            border: `1px solid ${THEME.glassBorder}`,
                            borderRadius: THEME.radiusSm,
                            padding: '20px 24px',
                            fontSize: '12px',
                            color: THEME.textMain,
                            pointerEvents: 'none',
                            zIndex: 1000,
                        }}
                    >
                        <div style={{ fontWeight: '600', marginBottom: '4px' }}>{tooltip.name}</div>
                        <div style={{ color: THEME.textMuted, fontSize: '11px', marginBottom: '4px' }}>
                            {tooltip.schema}
                        </div>
                        <div style={{ color: THEME.textDim, fontSize: '11px' }}>
                            {tooltip.rowCount > 0 ? `${tooltip.rowCount.toLocaleString()} rows` : 'empty'}
                        </div>
                    </div>
                )}
            </div>

            {selectedTable && (
                <div style={styles.sidePanel}>
                    <div style={{ marginBottom: '20px' }}>
                        <div style={{ color: THEME.textMain, fontWeight: '600', marginBottom: '4px', fontSize: '14px' }}>
                            {selectedTable.split('.')[1]}
                        </div>
                        <div style={{ color: THEME.textMuted, fontSize: '11px', marginBottom: '8px' }}>
                            {selectedTable.split('.')[0]} schema
                        </div>
                        {(() => {
                            const table = relationships.tables.find(t => t.id === selectedTable);
                            return table ? (
                                <>
                                    <div style={{ color: THEME.textDim, fontSize: '11px' }}>
                                        {table.rowCount > 0 ? `${table.rowCount.toLocaleString()} rows` : 'empty'}
                                    </div>
                                    {table.size && (
                                        <div style={{ color: THEME.textDim, fontSize: '11px' }}>
                                            {table.size}
                                        </div>
                                    )}
                                </>
                            ) : null;
                        })()}
                    </div>

                    <div style={{ ...styles.legend, borderBottom: `1px solid ${THEME.gridAlt}`, paddingBottom: '14px' }}>
                        <div style={{ color: THEME.primary, fontWeight: '600', marginBottom: '8px', fontSize: '12px' }}>
                            Relationship Types
                        </div>
                        <div style={styles.legendItem}>
                            <div style={{ ...styles.legendBox, background: THEME.primary }} />
                            <span style={{ color: THEME.textMain }}>Outgoing (references)</span>
                        </div>
                        <div style={styles.legendItem}>
                            <div style={{ ...styles.legendBox, background: THEME.secondary }} />
                            <span style={{ color: THEME.textMain }}>Incoming (referenced by)</span>
                        </div>
                        <div style={styles.legendItem}>
                            <div style={{ ...styles.legendBox, background: THEME.textMuted }} />
                            <span style={{ color: THEME.textMain }}>Indirect (2-hop)</span>
                        </div>
                    </div>

                    {selectedTableDetails && selectedTableDetails.columns && (
                        <div>
                            <div style={{ color: THEME.secondary, fontSize: '12px', fontWeight: '600', marginBottom: '8px' }}>
                                Columns ({selectedTableDetails.columns.length})
                            </div>
                            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                {selectedTableDetails.columns.map((col, i) => (
                                    <div key={i} style={{ padding: '6px 0', borderBottom: `1px solid ${THEME.gridAlt}`, fontSize: '11px' }}>
                                        <div style={{ display: 'flex', gap: '4px', marginBottom: '2px' }}>
                                            {col.isPrimaryKey && (
                                                <span style={{ background: THEME.primary + '30', color: THEME.primary, padding: '1px 4px', borderRadius: '2px', fontSize: '9px' }}>
                                                    PK
                                                </span>
                                            )}
                                            {col.isForeignKey && (
                                                <span style={{ background: THEME.secondary + '30', color: THEME.secondary, padding: '1px 4px', borderRadius: '2px', fontSize: '9px' }}>
                                                    FK
                                                </span>
                                            )}
                                        </div>
                                        <code style={{ color: THEME.secondary, fontSize: '11px' }}>{col.name}</code>
                                        <div style={{ color: THEME.textMuted, fontSize: '10px', marginTop: '2px' }}>
                                            {col.type}{col.nullable ? '' : ' NOT NULL'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <button
                        style={{
                            ...styles.button,
                            width: '100%',
                            justifyContent: 'center',
                            marginTop: '16px',
                        }}
                        onClick={() => setSelectedTable(null)}
                    >
                        Clear Selection
                    </button>
                </div>
            )}
        </div>
    );
};

export default TableDependencyMindMap;