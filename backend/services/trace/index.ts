/**
 * trace/index.js — barrel export for OTel trace-to-query correlation.
 */
export {
    parseTraceparent,
    extractFromRequest,
    extractFromSql,
    extractFromApplicationName,
    formatTraceparent,
} from './traceContext.js';

export {
    ADD_TRACE_COLUMNS_SQL,
    resolveTraceContext,
    ingestQueryEvent,
    getQueriesForTrace,
    summariseTrace,
} from './traceCorrelation.js';
