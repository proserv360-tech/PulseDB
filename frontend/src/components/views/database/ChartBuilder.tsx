import React, { useState, useMemo, useRef, useCallback } from 'react';
import { THEME, useAdaptiveTheme } from '../../../utils/theme';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    AreaChart,
    Area,
    PieChart,
    Pie,
    Cell,
    ScatterChart,
    Scatter,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';
import { BarChart2, TrendingUp, PieChart as PieIcon, Maximize2, Download, X, Table2, Sparkles } from 'lucide-react';

/**
 * ChartBuilder
 * ────────────
 * An integrated chart panel for query results.
 *
 * Features:
 * - Props: { columns: string[], rows: any[][], onClose: () => void }
 * - Auto-detect chart type from columns: time+number = line, category+number = bar
 * - Chart type selector: Line, Bar, Area, Pie, Scatter
 * - X-axis and Y-axis column selectors (dropdowns)
 * - Uses Recharts: LineChart, BarChart, AreaChart, PieChart, ScatterChart
 * - Color theme matching PulseDB (cyan, violet, emerald, amber, rose)
 * - Export button: "Save as PNG" (using canvas toDataURL)
 * - Toggle between Table view and Chart view
 * - Responsive chart sizing
 */

const ChartBuilder = ({ columns = [], rows = [], onClose = null }) => {
    useAdaptiveTheme();

    const [viewMode, setViewMode] = useState('chart'); // 'chart' or 'table'
    const [chartType, setChartType] = useState('line');
    const [xAxisColumn, setXAxisColumn] = useState(columns[0] || '');
    const [yAxisColumn, setYAxisColumn] = useState(columns[1] || '');
    const chartContainerRef = useRef(null);

    // PulseDB color palette
    const chartColors = [
        THEME.primary, // Purple
        THEME.primaryDark, // Teal
        THEME.success, // Emerald
        THEME.warning, // Amber
        THEME.danger, // Rose
        THEME.secondary, // Violet
        THEME.info, // Stellar Blue
    ];

    // Transform rows to objects for easier chart handling
    const transformedData = useMemo(() => {
        if (!columns || columns.length === 0 || !rows || rows.length === 0) {
            return [];
        }

        return rows.map((row, idx) => {
            const obj = {};
            columns.forEach((col, colIdx) => {
                obj[col] = row[colIdx];
            });
            obj._id = idx; // Add unique ID for keys
            return obj;
        });
    }, [columns, rows]);

    // Auto-detect chart type based on column types
    const detectedChartType = useMemo(() => {
        if (transformedData.length === 0) return 'line';

        const firstRow = transformedData[0];
        const xValue = firstRow[xAxisColumn];
        const yValue = firstRow[yAxisColumn];

        const isTimeColumn = (val) => val instanceof Date || (typeof val === 'string' && /\d{4}-\d{2}-\d{2}/.test(val));
        const isNumeric = (val) => typeof val === 'number';
        const isCategorical = (val) => typeof val === 'string' && !isTimeColumn(val);

        if (isTimeColumn(xValue) && isNumeric(yValue)) return 'line';
        if (isCategorical(xValue) && isNumeric(yValue)) return 'bar';
        if (isNumeric(xValue) && isNumeric(yValue)) return 'scatter';

        return 'bar';
    }, [transformedData, xAxisColumn, yAxisColumn]);

    // Numeric columns for Y-axis selection
    const numericColumns = useMemo(() => {
        if (transformedData.length === 0) return [];
        const firstRow = transformedData[0];
        return columns.filter((col) => typeof firstRow[col] === 'number');
    }, [columns, transformedData]);

    // Format value for display
    const formatValue = (value) => {
        if (typeof value === 'number') {
            return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
        }
        return String(value);
    };

    // Export chart as PNG
    const handleExportChart = useCallback(() => {
        if (!chartContainerRef.current) return;

        // Get the SVG or canvas element
        const svgElement = chartContainerRef.current.querySelector('svg');
        if (!svgElement) {
            console.error('Chart SVG not found');
            return;
        }

        // Create canvas
        const canvas = document.createElement('canvas');
        const rect = svgElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;

        // Render SVG to canvas using XML
        const ctx = canvas.getContext('2d');
        const svg = new XMLSerializer().serializeToString(svgElement);
        const img = new Image();

        img.onload = () => {
            ctx.drawImage(img, 0, 0);
            const link = document.createElement('a');
            link.href = canvas.toDataURL('image/png');
            link.download = `chart-${Date.now()}.png`;
            link.click();
        };

        img.src = `data:image/svg+xml;base64,${btoa(svg)}`;
    }, []);

    // Styles
    const styles = {
        container: {
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            background: THEME.surface,
            border: `1px solid ${THEME.glassBorder}`,
            borderRadius: 16,
            overflow: 'hidden',
            fontFamily: THEME.fontBody,
            boxShadow: '0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
            backdropFilter: 'blur(12px)',
            transition: 'all 0.25s ease',
        },
        header: {
            height: 28,
            padding: '14px 20px',
            background: `${THEME.textMain}06`,
            borderBottom: `1px solid ${THEME.glassBorder}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 6,
            fontWeight: '700',
        },
        title: {
            color: THEME.textMuted,
            fontSize: '11px',
            fontWeight: '700',
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            letterSpacing: '0.03em',
        },
        toolbar: {
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
        },
        button: {
            padding: '14px 20px',
            background: THEME.primary,
            color: THEME.textInverse,
            border: 'none',
            borderRadius: 18,
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            transition: THEME.transitionFast,
        },
        buttonSecondary: {
            background: THEME.surface,
            color: THEME.textMain,
            border: `1px solid ${THEME.glassBorder}`,
        },
        controls: {
            padding: '14px 20px',
            background: THEME.surface,
            borderBottom: `1px solid ${THEME.glassBorder}`,
            display: 'flex',
            gap: '18px',
            flexWrap: 'wrap',
            alignItems: 'center',
        },
        controlGroup: {
            display: 'flex',
            gap: '6px',
            alignItems: 'center',
        },
        label: {
            color: THEME.textMuted,
            fontSize: '12px',
            fontWeight: '500',
        },
        select: {
            padding: '20px 24px',
            background: THEME.bgAlt,
            border: `1px solid ${THEME.glassBorder}`,
            borderRadius: 16,
            color: THEME.textMain,
            fontFamily: THEME.fontBody,
            fontSize: '12px',
            cursor: 'pointer',
        },
        content: {
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)',
        },
        chartContainer: {
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px 24px',
            overflow: 'hidden',
        },
        tableContainer: {
            flex: 1,
            overflowY: 'auto',
            overflowX: 'auto',
        },
        table: {
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '12px',
        },
        tableHeader: {
            background: THEME.surface,
            borderBottom: `1px solid ${THEME.glassBorder}`,
            position: 'sticky',
            top: 0,
            zIndex: 10,
        },
        tableHeaderCell: {
            padding: '22px 28px',
            textAlign: 'left',
            color: THEME.primary,
            fontWeight: '600',
            borderRight: `1px solid ${THEME.gridAlt}`,
        },
        tableRow: {
            borderBottom: `1px solid ${THEME.gridAlt}`,
        },
        tableRowHover: {
            background: THEME.surfaceHover,
        },
        tableCell: {
            padding: '22px 28px',
            color: THEME.textMain,
            borderRight: `1px solid ${THEME.gridAlt}`,
            maxWidth: '200px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
        },
        emptyState: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: THEME.textMuted,
            fontSize: '12px',
        },
    };

    // Render appropriate chart
    const renderChart = () => {
        if (transformedData.length === 0) {
            return (
                <div style={styles.emptyState}>
                    <div>No data to display</div>
                </div>
            );
        }

        const commonProps = {
            data: transformedData,
            margin: { top: 20, right: 30, left: 0, bottom: 20 },
        };

        switch (chartType) {
            case 'line':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart {...commonProps}>
                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.gridAlt} />
                            <XAxis
                                dataKey={xAxisColumn}
                                stroke={THEME.textMuted}
                                tick={{ fill: THEME.textMuted, fontSize: 11 }}
                            />
                            <YAxis stroke={THEME.textMuted} tick={{ fill: THEME.textMuted, fontSize: 11 }} />
                            <Tooltip
                                contentStyle={{
                                    background: THEME.surface,
                                    border: `1px solid ${THEME.glassBorder}`,
                                    borderRadius: THEME.radiusSm,
                                    color: THEME.textMain,
                                }}
                            />
                            <Legend wrapperStyle={{ color: THEME.textMuted }} />
                            <Line
                                type="monotone"
                                dataKey={yAxisColumn}
                                stroke={chartColors[0]}
                                dot={false}
                                strokeWidth={2}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                );

            case 'bar':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart {...commonProps}>
                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.gridAlt} />
                            <XAxis
                                dataKey={xAxisColumn}
                                stroke={THEME.textMuted}
                                tick={{ fill: THEME.textMuted, fontSize: 11 }}
                            />
                            <YAxis stroke={THEME.textMuted} tick={{ fill: THEME.textMuted, fontSize: 11 }} />
                            <Tooltip
                                contentStyle={{
                                    background: THEME.surface,
                                    border: `1px solid ${THEME.glassBorder}`,
                                    borderRadius: THEME.radiusSm,
                                    color: THEME.textMain,
                                }}
                            />
                            <Legend wrapperStyle={{ color: THEME.textMuted }} />
                            <Bar dataKey={yAxisColumn} fill={chartColors[0]} radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'area':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart {...commonProps}>
                            <defs>
                                <linearGradient id="colorArea" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={chartColors[0]} stopOpacity={0.8} />
                                    <stop offset="95%" stopColor={chartColors[0]} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.gridAlt} />
                            <XAxis
                                dataKey={xAxisColumn}
                                stroke={THEME.textMuted}
                                tick={{ fill: THEME.textMuted, fontSize: 11 }}
                            />
                            <YAxis stroke={THEME.textMuted} tick={{ fill: THEME.textMuted, fontSize: 11 }} />
                            <Tooltip
                                contentStyle={{
                                    background: THEME.surface,
                                    border: `1px solid ${THEME.glassBorder}`,
                                    borderRadius: THEME.radiusSm,
                                    color: THEME.textMain,
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey={yAxisColumn}
                                stroke={chartColors[0]}
                                fillOpacity={1}
                                fill="url(#colorArea)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                );

            case 'pie':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={transformedData}
                                dataKey={yAxisColumn}
                                nameKey={xAxisColumn}
                                cx="50%"
                                cy="50%"
                                outerRadius={100}
                                label
                            >
                                {transformedData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{
                                    background: THEME.surface,
                                    border: `1px solid ${THEME.glassBorder}`,
                                    borderRadius: THEME.radiusSm,
                                    color: THEME.textMain,
                                }}
                            />
                            <Legend wrapperStyle={{ color: THEME.textMuted }} />
                        </PieChart>
                    </ResponsiveContainer>
                );

            case 'scatter':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart {...commonProps}>
                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.gridAlt} />
                            <XAxis
                                type="number"
                                dataKey={xAxisColumn}
                                stroke={THEME.textMuted}
                                tick={{ fill: THEME.textMuted, fontSize: 11 }}
                            />
                            <YAxis stroke={THEME.textMuted} tick={{ fill: THEME.textMuted, fontSize: 11 }} />
                            <Tooltip
                                contentStyle={{
                                    background: THEME.surface,
                                    border: `1px solid ${THEME.glassBorder}`,
                                    borderRadius: THEME.radiusSm,
                                    color: THEME.textMain,
                                }}
                            />
                            <Scatter dataKey={yAxisColumn} fill={chartColors[0]} />
                        </ScatterChart>
                    </ResponsiveContainer>
                );

            default:
                return <div style={styles.emptyState}>Unsupported chart type</div>;
        }
    };

    if (columns.length === 0 || rows.length === 0) {
        return (
            <div style={styles.container}>
                <div style={styles.header}>
                    <span style={styles.title}>Chart Builder</span>
                    {onClose && (
                        <button
                            style={{ ...styles.button, background: 'transparent', color: THEME.textMuted }}
                            onClick={onClose}
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>
                <div style={styles.emptyState}>
                    <div>No data available to visualize</div>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <span style={styles.title}>Chart Builder ({rows.length} rows)</span>
                <div style={styles.toolbar}>
                    <button
                        style={{
                            ...styles.button,
                            ...styles.buttonSecondary,
                            background: viewMode === 'chart' ? THEME.primary : THEME.surface,
                            color: viewMode === 'chart' ? THEME.textInverse : THEME.textMain,
                        }}
                        onClick={() => setViewMode('chart')}
                    >
                        <TrendingUp size={14} />
                        Chart
                    </button>
                    <button
                        style={{
                            ...styles.button,
                            ...styles.buttonSecondary,
                            background: viewMode === 'table' ? THEME.primary : THEME.surface,
                            color: viewMode === 'table' ? THEME.textInverse : THEME.textMain,
                        }}
                        onClick={() => setViewMode('table')}
                    >
                        <Table2 size={14} />
                        Table
                    </button>
                    {viewMode === 'chart' && (
                        <button style={styles.button} onClick={handleExportChart}>
                            <Download size={14} />
                            PNG
                        </button>
                    )}
                    {onClose && (
                        <button
                            style={{ ...styles.button, background: 'transparent', color: THEME.textMuted }}
                            onClick={onClose}
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>
            </div>

            {/* Controls */}
            {viewMode === 'chart' && (
                <div style={styles.controls}>
                    <div style={styles.controlGroup}>
                        <span style={styles.label}>Chart Type:</span>
                        <select value={chartType} onChange={(e) => setChartType(e.target.value)} style={styles.select}>
                            <option value="line">Line</option>
                            <option value="bar">Bar</option>
                            <option value="area">Area</option>
                            <option value="pie">Pie</option>
                            <option value="scatter">Scatter</option>
                        </select>
                    </div>

                    <div style={styles.controlGroup}>
                        <span style={styles.label}>X-Axis:</span>
                        <select
                            value={xAxisColumn}
                            onChange={(e) => setXAxisColumn(e.target.value)}
                            style={styles.select}
                        >
                            {columns.map((col) => (
                                <option key={col} value={col}>
                                    {col}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div style={styles.controlGroup}>
                        <span style={styles.label}>Y-Axis:</span>
                        <select
                            value={yAxisColumn}
                            onChange={(e) => setYAxisColumn(e.target.value)}
                            style={styles.select}
                        >
                            {numericColumns.length > 0 ? (
                                numericColumns.map((col) => (
                                    <option key={col} value={col}>
                                        {col}
                                    </option>
                                ))
                            ) : (
                                <option value="">{columns.length > 1 ? columns[1] : 'Select column'}</option>
                            )}
                        </select>
                    </div>
                </div>
            )}

            {/* Content */}
            <div style={styles.content}>
                {viewMode === 'chart' ? (
                    <div ref={chartContainerRef} style={styles.chartContainer}>
                        {renderChart()}
                    </div>
                ) : (
                    <div style={styles.tableContainer}>
                        <table style={styles.table}>
                            <thead style={styles.tableHeader}>
                                <tr>
                                    {columns.map((col) => (
                                        <th key={col} style={styles.tableHeaderCell}>
                                            {col}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, rowIdx) => (
                                    <tr key={rowIdx} style={styles.tableRow}>
                                        {columns.map((col, colIdx) => (
                                            <td key={`${rowIdx}-${colIdx}`} style={styles.tableCell}>
                                                {formatValue(row[colIdx])}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChartBuilder;
