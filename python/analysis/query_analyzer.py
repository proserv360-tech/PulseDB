"""
QueryAnalyzer - SQL query analysis and optimization suggestions.

Provides regex-based SQL parsing to identify query patterns, complexity,
and suggest optimizations without external SQL parser dependencies.
"""

import re
from dataclasses import dataclass, field
from typing import Any


@dataclass
class QueryAnalysis:
    """Analysis result for a single query."""
    query_type: str = "UNKNOWN"  # SELECT, INSERT, UPDATE, DELETE
    tables: list[str] = field(default_factory=list)
    complexity: str = "simple"  # simple, moderate, complex
    has_subquery: bool = False
    has_join: bool = False
    join_count: int = 0
    where_conditions: list[str] = field(default_factory=list)
    suggested_indexes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary representation."""
        return {
            "query_type": self.query_type,
            "tables": self.tables,
            "complexity": self.complexity,
            "has_subquery": self.has_subquery,
            "has_join": self.has_join,
            "join_count": self.join_count,
            "where_conditions": self.where_conditions,
            "suggested_indexes": self.suggested_indexes,
        }


class QueryAnalyzer:
    """
    Analyzes SQL queries for patterns, complexity, and optimization opportunities.

    Provides regex-based SQL parsing to identify table references, WHERE conditions,
    JOINs, subqueries, and other patterns. Generates complexity ratings and suggests
    indexes and query rewrites for better performance.
    """

    def __init__(self):
        """Initialize the analyzer with regex patterns."""
        # Normalize patterns for case-insensitive matching
        self.select_pattern = re.compile(r'\bSELECT\b', re.IGNORECASE)
        self.insert_pattern = re.compile(r'\bINSERT\b', re.IGNORECASE)
        self.update_pattern = re.compile(r'\bUPDATE\b', re.IGNORECASE)
        self.delete_pattern = re.compile(r'\bDELETE\b', re.IGNORECASE)
        self.from_pattern = re.compile(r'\bFROM\s+([a-zA-Z0-9_,.\s]+)(?:\s+(?:WHERE|JOIN|GROUP|ORDER|LIMIT|;|$))', re.IGNORECASE)
        self.join_pattern = re.compile(r'\b(INNER\s+JOIN|LEFT\s+JOIN|RIGHT\s+JOIN|FULL\s+JOIN|CROSS\s+JOIN|JOIN)\b', re.IGNORECASE)
        self.where_pattern = re.compile(r'\bWHERE\s+(.+?)(?=GROUP|ORDER|LIMIT|;|$)', re.IGNORECASE | re.DOTALL)
        self.subquery_pattern = re.compile(r'\([\s]*SELECT', re.IGNORECASE)
        self.into_pattern = re.compile(r'\bINTO\s+([a-zA-Z0-9_]+)', re.IGNORECASE)
        self.table_ref_pattern = re.compile(r'([a-zA-Z0-9_]+)\s+(?:AS\s+)?([a-zA-Z0-9_]*)', re.IGNORECASE)

    def analyze(self, sql: str) -> dict[str, Any]:
        """
        Parse SQL and return detailed analysis.

        Args:
            sql: SQL query string to analyze

        Returns:
            Dictionary with query analysis results
        """
        analysis = QueryAnalysis()

        # Normalize SQL - remove leading/trailing whitespace
        sql = sql.strip()

        # Determine query type
        if self.select_pattern.search(sql):
            analysis.query_type = "SELECT"
        elif self.insert_pattern.search(sql):
            analysis.query_type = "INSERT"
        elif self.update_pattern.search(sql):
            analysis.query_type = "UPDATE"
        elif self.delete_pattern.search(sql):
            analysis.query_type = "DELETE"
        else:
            analysis.query_type = "UNKNOWN"

        # Extract tables from FROM clause
        analysis.tables = self._extract_tables(sql)

        # Extract tables from INSERT INTO
        if analysis.query_type == "INSERT":
            insert_tables = self.into_pattern.findall(sql)
            if insert_tables:
                analysis.tables = insert_tables

        # Check for subqueries
        analysis.has_subquery = bool(self.subquery_pattern.search(sql))

        # Check for joins
        joins = self.join_pattern.findall(sql)
        analysis.has_join = len(joins) > 0
        analysis.join_count = len(joins)

        # Extract WHERE conditions
        analysis.where_conditions = self._extract_where_conditions(sql)

        # Determine complexity
        analysis.complexity = self._calculate_complexity(analysis)

        # Suggest indexes
        analysis.suggested_indexes = self._suggest_indexes(sql, analysis)

        return analysis.to_dict()

    def find_slow_patterns(self, queries: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """
        Identify queries with common slow patterns.

        Args:
            queries: List of query analysis dictionaries

        Returns:
            List of slow queries with pattern descriptions
        """
        slow_queries = []

        for i, query_dict in enumerate(queries):
            patterns = []

            # Check for SELECT *
            if "select_star" in query_dict and query_dict["select_star"]:
                patterns.append("SELECT * used - inefficient for large tables")

            # Check for missing WHERE clause
            if query_dict.get("query_type") == "SELECT" and not query_dict.get("where_conditions"):
                patterns.append("Missing WHERE clause - scans entire table")

            # Check for LIKE with leading wildcard
            where_conds = query_dict.get("where_conditions", [])
            for cond in where_conds:
                if "LIKE '%'" in cond.upper() or "LIKE '%%" in cond.upper():
                    patterns.append(f"LIKE with leading wildcard: {cond} - cannot use index")

            # Check for nested subqueries
            if query_dict.get("has_subquery"):
                patterns.append("Contains subquery - may have poor performance")

            # Check for cartesian joins
            if query_dict.get("join_count", 0) > 2:
                patterns.append(f"Multiple joins ({query_dict['join_count']}) - potential cartesian product")

            if patterns:
                slow_queries.append({
                    "query_index": i,
                    "patterns": patterns,
                    "severity": "high" if len(patterns) > 2 else "medium"
                })

        return slow_queries

    def suggest_rewrites(self, sql: str) -> list[str]:
        """
        Suggest query improvements and rewrites.

        Args:
            sql: SQL query string to analyze

        Returns:
            List of improvement suggestions
        """
        suggestions = []
        sql_upper = sql.upper()

        # Check for SELECT *
        if re.search(r'SELECT\s+\*', sql_upper):
            suggestions.append(
                "Replace SELECT * with specific columns to reduce data transfer and improve index usage"
            )

        # Check for NOT IN with subquery
        if re.search(r'NOT\s+IN\s*\(\s*SELECT', sql_upper):
            suggestions.append(
                "Replace NOT IN with LEFT JOIN ... IS NULL for better performance with large subqueries"
            )

        # Check for OR conditions without parentheses
        if re.search(r'\bOR\b.*\bAND\b|\bAND\b.*\bOR\b', sql_upper):
            suggestions.append(
                "Use parentheses to clarify OR/AND precedence and help query optimizer"
            )

        # Check for LIKE with wildcard
        if re.search(r"LIKE\s+'%", sql_upper):
            suggestions.append(
                "Consider using full-text search or trigram indexes for LIKE patterns with leading wildcards"
            )

        # Check for DISTINCT on large result sets
        if re.search(r'SELECT\s+DISTINCT', sql_upper):
            suggestions.append(
                "DISTINCT can be expensive - consider GROUP BY if deduplication is needed on specific columns"
            )

        # Check for multiple JOINs
        join_count = len(re.findall(r'\bJOIN\b', sql_upper))
        if join_count > 3:
            suggestions.append(
                f"Query has {join_count} JOINs - consider breaking into smaller queries or materializing intermediate results"
            )

        # Check for function calls in WHERE
        if re.search(r'WHERE\s+[A-Z_]+\(', sql_upper):
            suggestions.append(
                "Function calls in WHERE clause prevent index usage - consider denormalization or computed columns"
            )

        # Check for implicit type conversion
        if re.search(r"=\s*'[0-9]+'", sql_upper):
            suggestions.append(
                "String literals for numeric comparisons may prevent index usage - use numeric literals or cast explicitly"
            )

        return suggestions

    def _extract_tables(self, sql: str) -> list[str]:
        """
        Extract table names from FROM clause.

        Args:
            sql: SQL query string to parse.

        Returns:
            List of table names found in the FROM clause.
        """
        tables = []
        match = self.from_pattern.search(sql)
        if match:
            table_clause = match.group(1)
            # Split by comma and clean up
            table_names = [t.strip() for t in table_clause.split(',')]
            for table_name in table_names:
                # Get first word (table name, ignoring alias)
                parts = table_name.split()
                if parts:
                    tables.append(parts[0])
        return tables

    def _extract_where_conditions(self, sql: str) -> list[str]:
        """
        Extract WHERE clause conditions.

        Args:
            sql: SQL query string to parse.

        Returns:
            List of individual conditions found in the WHERE clause.
        """
        conditions = []
        match = self.where_pattern.search(sql)
        if match:
            where_clause = match.group(1)
            # Split by AND/OR
            parts = re.split(r'\s+(?:AND|OR)\s+', where_clause, flags=re.IGNORECASE)
            conditions = [p.strip() for p in parts if p.strip()]
        return conditions

    def _calculate_complexity(self, analysis: QueryAnalysis) -> str:
        """
        Determine query complexity based on features.

        Args:
            analysis: QueryAnalysis object with query attributes.

        Returns:
            Complexity level: "simple", "moderate", or "complex".
        """
        score = 0

        # Base complexity for query type
        if analysis.query_type in ["INSERT", "UPDATE", "DELETE"]:
            score += 1

        # Add points for complexity factors
        if analysis.has_join:
            score += analysis.join_count
        if analysis.has_subquery:
            score += 2
        if len(analysis.where_conditions) > 3:
            score += 1
        if len(analysis.tables) > 2:
            score += 1

        # Categorize
        if score <= 1:
            return "simple"
        elif score <= 3:
            return "moderate"
        else:
            return "complex"

    def _suggest_indexes(self, sql: str, analysis: QueryAnalysis) -> list[str]:
        """
        Suggest indexes based on query patterns.

        Args:
            sql: SQL query string to analyze.
            analysis: QueryAnalysis object with query attributes.

        Returns:
            List of index creation suggestions.
        """
        suggestions = []

        # Suggest indexes for WHERE conditions
        for condition in analysis.where_conditions:
            # Extract column names from conditions
            match = re.search(r'(\w+)\s*(?:=|<|>|<=|>=|LIKE|IN)', condition, re.IGNORECASE)
            if match:
                column = match.group(1)
                for table in analysis.tables:
                    suggestions.append(f"CREATE INDEX ON {table}({column})")

        # Suggest indexes for JOIN columns
        if analysis.has_join:
            join_matches = re.findall(r'ON\s+(\w+)\s*=\s*(\w+)', sql, re.IGNORECASE)
            for col1, col2 in join_matches:
                suggestions.append(f"Ensure indexes on join columns: {col1}, {col2}")

        # Suggest covering index for frequently selected columns
        if analysis.query_type == "SELECT" and analysis.tables:
            suggestions.append(
                f"Consider covering index on {analysis.tables[0]} if query is frequently executed"
            )

        # Remove duplicates while preserving order
        seen = set()
        unique_suggestions = []
        for suggestion in suggestions:
            if suggestion not in seen:
                seen.add(suggestion)
                unique_suggestions.append(suggestion)

        return unique_suggestions[:5]  # Limit to top 5 suggestions
