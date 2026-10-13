// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * services/explainParsers.js
 * ──────────────────────────
 * Normalize MySQL `EXPLAIN FORMAT=JSON` and MongoDB `explain('executionStats')`
 * output into the same flat-node shape that `flattenPostgresPlan` produces,
 * so the React <ExplainVisualizer> can render all three engines identically.
 *
 * Normalized shape:
 *   { id, depth, nodeType, relation, totalCost, planRows, actualRows,
 *     actualTotalTime, loops, extra }
 */

// ─────────────────────────────────────────────────────────────────────────────
// MySQL FORMAT=JSON → normalized tree
// The MySQL plan has nested "query_block" objects with "table", "nested_loop",
// "grouping_operation", "ordering_operation", "materialized_from_subquery".
// ─────────────────────────────────────────────────────────────────────────────
export function flattenMysqlPlan(plan) {
    const out = [];
    const root = plan?.query_block || plan;
    walkMysql(root, 0, '0', out);
    return out;
}

function walkMysql(node, depth, id, out, labelOverride) {
    if (!node || typeof node !== 'object') return;

    if (node.nested_loop) {
        out.push({
            id, depth, nodeType: 'Nested Loop',
            planRows: node.cost_info?.query_cost ? undefined : undefined,
            totalCost: parseFloat(node.cost_info?.query_cost) || undefined,
        });
        node.nested_loop.forEach((child, i) =>
            walkMysql(child, depth + 1, `${id}.${i}`, out));
        return;
    }
    if (node.table) {
        const t = node.table;
        out.push({
            id, depth,
            nodeType: t.access_type
                ? `Table Scan (${t.access_type})`
                : 'Table Access',
            relation: t.table_name,
            planRows: t.rows_examined_per_scan ?? t.rows,
            actualRows: t.rows_produced_per_join ?? t.rows,
            totalCost: parseFloat(t.cost_info?.read_cost) || undefined,
            extra: {
                key: t.key,
                usedKeyParts: t.used_key_parts,
                filtered: t.filtered,
                attachedCondition: t.attached_condition,
            },
        });
        if (t.attached_subqueries) {
            t.attached_subqueries.forEach((sq, i) =>
                walkMysql(sq, depth + 1, `${id}.sq${i}`, out));
        }
        return;
    }
    if (node.grouping_operation) {
        out.push({ id, depth, nodeType: 'Grouping' });
        walkMysql(node.grouping_operation, depth + 1, `${id}.0`, out);
        return;
    }
    if (node.ordering_operation) {
        out.push({ id, depth, nodeType: 'Ordering' });
        walkMysql(node.ordering_operation, depth + 1, `${id}.0`, out);
        return;
    }
    if (node.materialized_from_subquery) {
        out.push({ id, depth, nodeType: 'Materialized Subquery' });
        walkMysql(node.materialized_from_subquery, depth + 1, `${id}.0`, out);
        return;
    }
    if (node.query_block) {
        walkMysql(node.query_block, depth, id, out);
        return;
    }
    if (labelOverride) {
        out.push({ id, depth, nodeType: labelOverride });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MongoDB explain('executionStats') → normalized tree
// Reads queryPlanner.winningPlan + executionStats.executionStages.
// ─────────────────────────────────────────────────────────────────────────────
export function flattenMongoPlan(explainJson) {
    const winningPlan = explainJson?.queryPlanner?.winningPlan;
    const execStages = explainJson?.executionStats?.executionStages;
    const out = [];
    walkMongoStage(execStages || winningPlan, 0, '0', out);
    // Also surface the namespace / overall time as a synthetic root card.
    out.unshift({
        id: 'root',
        depth: 0,
        nodeType: 'Query',
        relation: explainJson?.queryPlanner?.namespace,
        actualTotalTime: explainJson?.executionStats?.executionTimeMillis,
        actualRows: explainJson?.executionStats?.nReturned,
        extra: {
            totalDocsExamined: explainJson?.executionStats?.totalDocsExamined,
            totalKeysExamined: explainJson?.executionStats?.totalKeysExamined,
            indexOnly: explainJson?.queryPlanner?.winningPlan?.inputStage?.indexName
                ? true : false,
        },
    });
    return out;
}

function walkMongoStage(stage, depth, id, out) {
    if (!stage) return;
    out.push({
        id, depth,
        nodeType: stage.stage || stage.nodeType || 'Stage',
        relation: stage.indexName || undefined,
        actualRows: stage.nReturned,
        actualTotalTime: stage.executionTimeMillisEstimate,
        extra: {
            keysExamined: stage.keysExamined,
            docsExamined: stage.docsExamined,
            direction: stage.direction,
            indexName: stage.indexName,
            indexBounds: stage.indexBounds,
        },
    });
    const children = [];
    if (stage.inputStage) children.push(stage.inputStage);
    if (Array.isArray(stage.inputStages)) children.push(...stage.inputStages);
    children.forEach((c, i) => walkMongoStage(c, depth + 1, `${id}.${i}`, out));
}

// ─────────────────────────────────────────────────────────────────────────────
// Unified entry point — pick parser by engine label.
// ─────────────────────────────────────────────────────────────────────────────
export function flattenPlanForEngine(engine, plan) {
    switch (engine) {
        case 'mysql':    return flattenMysqlPlan(plan);
        case 'mongodb':  return flattenMongoPlan(plan);
        default:         return null;
    }
}
