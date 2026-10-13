"""
SQL query classification using heuristic rules and pattern analysis.
Classifies query type, complexity, risk level, and resource impact.
"""

from typing import Any
import re


class QueryClassifier:
    """
    Classifies SQL queries by type, complexity, risk, and resource impact.

    Methods:
    - classify: Classify single query
    - batch_classify: Classify multiple queries
    """

    def __init__(self):
        """
        Initialize the query classifier.

        Initializes an empty cache for storing classification results
        to improve performance on repeated queries.
        """
        self.query_cache: dict[str, dict[str, Any]] = {}

    def classify(self, sql: str) -> dict[str, Any]:
        """
        Classify a SQL query.

        Args:
            sql: SQL query string

        Returns:
            dict with keys:
                - type: Query type (SELECT, INSERT, UPDATE, DELETE, DDL, TRANSACTION, etc.)
                - complexity_score: 0-100 (higher = more complex)
                - risk_level: 'low', 'medium', 'high', or 'critical'
                - estimated_cost: Relative cost estimate
                - resource_impact: Dict with cpu, io, memory estimates
                - recommendations: List of optimization suggestions
        """
        # Normalize SQL
        normalized = self._normalize_sql(sql)

        # Check cache
        cache_key = self._hash_key(normalized)
        if cache_key in self.query_cache:
            return self.query_cache[cache_key]

        # Determine query type
        query_type = self._classify_type(normalized)

        # Calculate complexity score
        complexity_score = self._calculate_complexity(normalized)

        # Determine risk level
        risk_level = self._assess_risk(normalized, query_type)

        # Estimate cost
        estimated_cost = self._estimate_cost(normalized, complexity_score)

        # Analyze resource impact
        resource_impact = self._analyze_resources(normalized)

        # Generate recommendations
        recommendations = self._generate_recommendations(
            normalized, query_type, complexity_score, risk_level
        )

        result = {
            'type': query_type,
            'complexity_score': complexity_score,
            'risk_level': risk_level,
            'estimated_cost': estimated_cost,
            'resource_impact': resource_impact,
            'recommendations': recommendations
        }

        # Cache result
        self.query_cache[cache_key] = result

        return result

    def batch_classify(self, queries: list[str]) -> list[dict[str, Any]]:
        """
        Classify multiple queries.

        Args:
            queries: List of SQL query strings

        Returns:
            List of classification dicts
        """
        return [self.classify(q) for q in queries]

    def _normalize_sql(self, sql: str) -> str:
        """Normalize SQL for analysis."""
        # Remove comments
        sql = re.sub(r'--.*$', '', sql, flags=re.MULTILINE)
        sql = re.sub(r'/\*.*?\*/', '', sql, flags=re.DOTALL)

        # Normalize whitespace
        sql = ' '.join(sql.split())

        return sql.strip()

    @staticmethod
    def _hash_key(sql: str) -> str:
        """Generate a hash key for caching."""
        import hashlib
        return hashlib.md5(sql.encode()).hexdigest()

    def _classify_type(self, sql: str) -> str:
        """Classify the query type."""
        sql_upper = sql.upper()

        if re.match(r'^SELECT\s', sql_upper):
            return 'SELECT'
        elif re.match(r'^INSERT\s', sql_upper):
            return 'INSERT'
        elif re.match(r'^UPDATE\s', sql_upper):
            return 'UPDATE'
        elif re.match(r'^DELETE\s', sql_upper):
            return 'DELETE'
        elif re.match(r'^(CREATE|ALTER|DROP|TRUNCATE)\s', sql_upper):
            return 'DDL'
        elif re.match(r'^(BEGIN|START|COMMIT|ROLLBACK)\s', sql_upper):
            return 'TRANSACTION'
        elif re.match(r'^(GRANT|REVOKE)\s', sql_upper):
            return 'PERMISSION'
        else:
            return 'UNKNOWN'

    def _calculate_complexity(self, sql: str) -> int:
        """Calculate complexity score (0-100)."""
        score = 10  # Base score

        sql_upper = sql.upper()

        # Join complexity
        join_count = len(re.findall(r'\bJOIN\b', sql_upper))
        score += min(30, join_count * 5)

        # Subquery complexity
        subquery_count = sql.count('(SELECT')
        score += min(20, subquery_count * 8)

        # Aggregation complexity
        agg_functions = len(re.findall(r'\b(COUNT|SUM|AVG|MIN|MAX|GROUP_CONCAT)\s*\(', sql_upper))
        if 'GROUP BY' in sql_upper:
            score += agg_functions * 5 + 10
        else:
            score += agg_functions * 2

        # Window functions
        if 'OVER' in sql_upper:
            score += 15

        # CTE complexity
        if 'WITH' in sql_upper:
            score += 10

        # Set operations
        if any(op in sql_upper for op in ['UNION', 'INTERSECT', 'EXCEPT']):
            score += 10

        # Sorting and limiting
        if 'ORDER BY' in sql_upper:
            score += 5
        if 'LIMIT' in sql_upper:
            score += 2

        return min(100, score)

    def _assess_risk(self, sql: str, query_type: str) -> str:
        """Assess risk level of the query."""
        sql_upper = sql.upper()

        # Critical risks
        if query_type == 'DDL':
            if 'DROP' in sql_upper:
                return 'critical'
            return 'high'

        if query_type in ['DELETE', 'UPDATE'] and 'WHERE' not in sql_upper:
            return 'critical'

        if re.search(r'(TRUNCATE|DROP)\s', sql_upper):
            return 'critical'

        # High risk
        if query_type in ['DELETE', 'UPDATE']:
            return 'high'

        if re.search(r'INTO\s+\w+\s+VALUES', sql_upper, re.IGNORECASE):
            return 'high'

        # Medium risk
        if query_type == 'INSERT':
            if re.search(r'SELECT.*FROM', sql_upper):
                return 'medium'

        if any(func in sql_upper for func in ['EXEC', 'EXECUTE', 'CALL']):
            return 'medium'

        # Low risk (SELECT is generally safe)
        return 'low'

    def _estimate_cost(self, sql: str, complexity_score: int) -> str:
        """Estimate relative query cost."""
        if complexity_score < 20:
            return 'very_low'
        elif complexity_score < 40:
            return 'low'
        elif complexity_score < 60:
            return 'medium'
        elif complexity_score < 80:
            return 'high'
        else:
            return 'very_high'

    def _analyze_resources(self, sql: str) -> dict[str, str]:
        """Analyze resource impact."""
        sql_upper = sql.upper()

        resource_impact = {
            'cpu': 'low',
            'io': 'low',
            'memory': 'low'
        }

        # CPU impact from joins and aggregations
        join_count = len(re.findall(r'\bJOIN\b', sql_upper))
        if join_count >= 3:
            resource_impact['cpu'] = 'high'
        elif join_count >= 2:
            resource_impact['cpu'] = 'medium'

        # I/O impact from table scans
        if 'FULL OUTER JOIN' in sql_upper:
            resource_impact['io'] = 'high'
        elif 'CROSS JOIN' in sql_upper:
            resource_impact['io'] = 'high'
        elif join_count >= 2:
            resource_impact['io'] = 'medium'

        # Memory impact from sorting and temp tables
        if 'ORDER BY' in sql_upper or 'GROUP BY' in sql_upper:
            resource_impact['memory'] = 'medium'

        if 'DISTINCT' in sql_upper:
            resource_impact['memory'] = 'medium'

        if 'UNION' in sql_upper or 'INTERSECT' in sql_upper:
            resource_impact['memory'] = 'high'

        return resource_impact

    def _generate_recommendations(
        self,
        sql: str,
        query_type: str,
        complexity_score: int,
        risk_level: str
    ) -> list[str]:
        """Generate optimization recommendations."""
        recommendations = []

        sql_upper = sql.upper()

        # Risk-based recommendations
        if risk_level == 'critical':
            recommendations.append('HIGH PRIORITY: Add WHERE clause to prevent unintended data loss')
            recommendations.append('Add LIMIT clause to test query safety')

        if risk_level == 'high':
            recommendations.append('Test this query on a non-production database first')
            recommendations.append('Consider breaking into smaller operations')

        # Complexity-based recommendations
        if complexity_score > 70:
            recommendations.append('Query is complex. Consider breaking into simpler queries')
            recommendations.append('Verify all joins are necessary')

        # Pattern-based recommendations
        if 'SELECT *' in sql:
            recommendations.append('Specify only needed columns instead of SELECT *')

        if not re.search(r'WHERE\b', sql_upper) and query_type == 'SELECT':
            recommendations.append('Consider adding WHERE clause to reduce result set')

        # Index optimization
        if 'OR' in sql_upper and '(' not in sql_upper:
            recommendations.append('Consider using IN operator instead of OR for better index usage')

        # Join optimization
        join_count = len(re.findall(r'\bJOIN\b', sql_upper))
        if join_count >= 3:
            recommendations.append('Consider materialized views or CTEs for multiple joins')

        # Aggregation optimization
        if 'GROUP BY' in sql_upper and 'HAVING' not in sql_upper:
            recommendations.append('Consider adding HAVING clause for early filtering')

        # Subquery optimization
        if bool(re.findall(r'\(SELECT', sql_upper)):
            recommendations.append('Verify subqueries cannot be converted to JOINs')

        # Default recommendation
        if not recommendations:
            recommendations.append('Query appears well-optimized')

        return recommendations[:5]  # Limit to 5 recommendations
