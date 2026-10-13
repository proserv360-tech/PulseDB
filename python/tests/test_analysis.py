import sys
from pathlib import Path

# Add parent directories to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from analysis.query_analyzer import QueryAnalyzer
from analysis.table_stats import TableStatsAnalyzer
from analysis.performance_report import PerformanceReport


class TestQueryAnalyzer:
    """Test suite for QueryAnalyzer"""

    def setup_method(self):
        """Setup test fixtures"""
        self.analyzer = QueryAnalyzer()

    def test_analyze_select_query(self):
        """Test analyzing a simple SELECT query"""
        query = "SELECT id, name, email FROM users WHERE active = true"
        result = self.analyzer.analyze(query)

        assert result["query_type"] == "SELECT"
        assert result["complexity"] == "simple"
        assert result["join_count"] == 0

    def test_analyze_select_with_join(self):
        """Test analyzing SELECT query with JOIN"""
        query = """
            SELECT u.id, u.name, o.order_id
            FROM users u
            JOIN orders o ON u.id = o.user_id
        """
        result = self.analyzer.analyze(query)

        assert result["query_type"] == "SELECT"
        assert result["has_join"] is True
        assert result["join_count"] == 1

    def test_analyze_insert_query(self):
        """Test analyzing an INSERT query"""
        query = "INSERT INTO users (name, email) VALUES ('John', 'john@example.com')"
        result = self.analyzer.analyze(query)

        assert result["query_type"] == "INSERT"
        assert "users" in result["tables"]

    def test_analyze_update_query(self):
        """Test analyzing an UPDATE query"""
        query = "UPDATE users SET active = false WHERE id = 1"
        result = self.analyzer.analyze(query)

        assert result["query_type"] == "UPDATE"
        assert len(result["where_conditions"]) > 0

    def test_analyze_delete_query(self):
        """Test analyzing a DELETE query"""
        query = "DELETE FROM users WHERE id = 1"
        result = self.analyzer.analyze(query)

        assert result["query_type"] == "DELETE"
        assert "users" in result["tables"]

    def test_analyze_empty_query(self):
        """Test analyzing empty SQL"""
        query = ""
        result = self.analyzer.analyze(query)

        assert result["query_type"] == "UNKNOWN"

    def test_analyze_complex_query_with_subquery(self):
        """Test analyzing query with subquery"""
        query = """
            SELECT u.id, u.name
            FROM users u
            WHERE u.id IN (SELECT user_id FROM orders WHERE amount > 100)
        """
        result = self.analyzer.analyze(query)

        assert result["query_type"] == "SELECT"
        assert result["has_subquery"] is True

    def test_find_slow_patterns_select_star(self):
        """Test detecting SELECT * pattern"""
        queries = [
            {
                "query_type": "SELECT",
                "select_star": True,
                "where_conditions": []
            }
        ]
        patterns = self.analyzer.find_slow_patterns(queries)

        # Should find at least the SELECT * issue
        assert len(patterns) > 0

    def test_find_slow_patterns_missing_where(self):
        """Test detecting missing WHERE clause"""
        queries = [
            {
                "query_type": "SELECT",
                "where_conditions": [],
                "select_star": False
            }
        ]
        patterns = self.analyzer.find_slow_patterns(queries)

        assert len(patterns) > 0
        # Check if any pattern mentions WHERE or scans table
        assert any("WHERE" in str(p) or "scans" in str(p).lower() for p in patterns)

    def test_find_slow_patterns_multiple_joins(self):
        """Test detecting excessive JOINs"""
        queries = [
            {
                "query_type": "SELECT",
                "join_count": 5,
                "where_conditions": [],
                "has_subquery": False
            }
        ]
        patterns = self.analyzer.find_slow_patterns(queries)

        assert len(patterns) > 0

    def test_find_slow_patterns_clean_query(self):
        """Test query with no slow patterns"""
        sql = "SELECT id, name FROM users WHERE active = true"
        analysis = self.analyzer.analyze(sql)
        result = self.analyzer.find_slow_patterns([analysis])

        # This query should be fairly clean
        assert isinstance(result, list)

    def test_suggest_rewrites_select_star(self):
        """Test rewrite suggestion for SELECT *"""
        query = "SELECT * FROM users"
        suggestions = self.analyzer.suggest_rewrites(query)

        assert len(suggestions) > 0
        assert any("SELECT *" in s for s in suggestions)

    def test_suggest_rewrites_not_in_subquery(self):
        """Test rewrite suggestion for NOT IN with subquery"""
        query = "SELECT * FROM users WHERE id NOT IN (SELECT user_id FROM blocked)"
        suggestions = self.analyzer.suggest_rewrites(query)

        assert len(suggestions) > 0

    def test_suggest_rewrites_multiple_joins(self):
        """Test rewrite suggestion for excessive JOINs"""
        query = """
            SELECT * FROM a
            JOIN b ON a.id = b.id
            JOIN c ON b.id = c.id
            JOIN d ON c.id = d.id
            JOIN e ON d.id = e.id
        """
        suggestions = self.analyzer.suggest_rewrites(query)

        assert len(suggestions) > 0
        assert any("JOIN" in s for s in suggestions)


class TestTableStatsAnalyzer:
    """Test suite for TableStatsAnalyzer"""

    def setup_method(self):
        """Setup test fixtures"""
        self.analyzer = TableStatsAnalyzer()

    def test_analyze_empty_table(self):
        """Test analyzing an empty table"""
        data = {
            "name": "empty_table",
            "row_count": 0,
            "size_bytes": 0,
            "live_tuples": 0,
            "dead_tuples": 0,
            "indexes": [],
        }
        result = self.analyzer.analyze(data)

        assert result["table_name"] == "empty_table"
        assert result["metrics"]["row_count"] == 0
        assert result["dead_tuple_ratio"] == 0.0

    def test_analyze_sample_table(self):
        """Test analyzing a table with sample data"""
        data = {
            "name": "users",
            "row_count": 1000,
            "size_bytes": 1048576,  # 1 MB
            "live_tuples": 950,
            "dead_tuples": 50,
            "indexes": [
                {"name": "idx_id", "size_bytes": 65536, "idx_scan": 100},
                {"name": "idx_email", "size_bytes": 131072, "idx_scan": 50},
            ],
        }
        result = self.analyzer.analyze(data)

        assert result["table_name"] == "users"
        assert result["metrics"]["row_count"] == 1000
        assert result["dead_tuple_ratio"] > 0
        assert len(result["metrics"]["indexes"]) == 2

    def test_analyze_table_with_bloat(self):
        """Test analyzing table with high bloat ratio"""
        data = {
            "name": "bloated_table",
            "row_count": 1000,
            "size_bytes": 1000000,
            "live_tuples": 500,
            "dead_tuples": 500,
            "indexes": [],
        }
        result = self.analyzer.analyze(data)

        assert result["dead_tuple_ratio"] >= 0.5
        assert len(result["recommendations"]) > 0

    def test_generate_report_multiple_tables(self):
        """Test generating report for multiple tables"""
        tables = [
            {
                "name": "users",
                "row_count": 1000,
                "size_bytes": 1048576,
                "live_tuples": 950,
                "dead_tuples": 50,
                "indexes": [],
            },
            {
                "name": "orders",
                "row_count": 5000,
                "size_bytes": 5242880,
                "live_tuples": 4900,
                "dead_tuples": 100,
                "indexes": [],
            },
        ]
        report = self.analyzer.generate_report(tables)

        assert report["total_tables"] == 2
        assert report["total_rows"] == 6000
        assert report["total_size_bytes"] > 0
        assert len(report["tables"]) == 2

    def test_generate_report_empty_list(self):
        """Test generating report with empty table list"""
        report = self.analyzer.generate_report([])

        assert report["total_tables"] == 0
        assert report["total_size_bytes"] == 0
        assert len(report["tables"]) == 0


class TestPerformanceReport:
    """Test suite for PerformanceReport"""

    def setup_method(self):
        """Setup test fixtures"""
        self.reporter = PerformanceReport()

    def test_generate_healthy_system(self):
        """Test generating report for healthy system"""
        metrics = {
            "cpu_usage_percent": 30.0,
            "memory_usage_percent": 50.0,
            "memory_used_mb": 4096,
            "memory_available_mb": 4096,
            "active_connections": 20,
            "idle_connections": 10,
            "max_connections": 100,
            "avg_query_time_ms": 5.0,
            "slow_query_count": 0,
            "cache_hit_ratio": 0.99,
            "tps": 1000.0,
        }
        report = self.reporter.generate(metrics)

        assert report["summary"]["health_status"] == "healthy"
        assert report["summary"]["overall_rating"] >= 8
        assert "cpu_analysis" in report
        assert "memory_analysis" in report
        assert "connection_analysis" in report
        assert "cache_analysis" in report

    def test_generate_warning_system(self):
        """Test generating report for system with warnings"""
        metrics = {
            "cpu_usage_percent": 85.0,
            "memory_usage_percent": 80.0,
            "memory_used_mb": 7680,
            "memory_available_mb": 1024,
            "active_connections": 75,
            "idle_connections": 10,
            "max_connections": 100,
            "avg_query_time_ms": 50.0,
            "slow_query_count": 10,
            "cache_hit_ratio": 0.95,
            "tps": 500.0,
        }
        report = self.reporter.generate(metrics)

        assert report["summary"]["health_status"] == "warning"
        assert len(report["recommendations"]) > 0

    def test_generate_critical_system(self):
        """Test generating report for critical system"""
        metrics = {
            "cpu_usage_percent": 95.0,
            "memory_usage_percent": 98.0,
            "memory_used_mb": 8000,
            "memory_available_mb": 256,
            "active_connections": 95,
            "idle_connections": 5,
            "max_connections": 100,
            "avg_query_time_ms": 100.0,
            "slow_query_count": 50,
            "cache_hit_ratio": 0.90,
            "tps": 100.0,
        }
        report = self.reporter.generate(metrics)

        assert report["summary"]["health_status"] == "critical"
        assert report["summary"]["overall_rating"] < 5

    def test_compare_periods(self):
        """Test comparing two time periods"""
        current = {
            "cpu_usage_percent": 70.0,
            "memory_usage_percent": 60.0,
            "memory_used_mb": 5000,
            "memory_available_mb": 3000,
            "active_connections": 50,
            "idle_connections": 20,
            "max_connections": 100,
            "avg_query_time_ms": 25.0,
            "slow_query_count": 5,
            "cache_hit_ratio": 0.97,
            "tps": 800.0,
        }
        previous = {
            "cpu_usage_percent": 40.0,
            "memory_usage_percent": 45.0,
            "memory_used_mb": 3500,
            "memory_available_mb": 4500,
            "active_connections": 30,
            "idle_connections": 15,
            "max_connections": 100,
            "avg_query_time_ms": 15.0,
            "slow_query_count": 2,
            "cache_hit_ratio": 0.98,
            "tps": 900.0,
        }
        comparison = self.reporter.compare_periods(current, previous)

        assert "period_comparison" in comparison
        assert "changes" in comparison
        assert "regressions" in comparison or "improvements" in comparison
        assert "current_metrics" in comparison
        assert "previous_metrics" in comparison

    def test_export_markdown(self):
        """Test exporting report to markdown"""
        metrics = {
            "cpu_usage_percent": 50.0,
            "memory_usage_percent": 60.0,
            "memory_used_mb": 5000,
            "memory_available_mb": 3000,
            "active_connections": 30,
            "idle_connections": 10,
            "max_connections": 100,
            "avg_query_time_ms": 10.0,
            "slow_query_count": 1,
            "cache_hit_ratio": 0.98,
            "tps": 900.0,
        }
        report = self.reporter.generate(metrics)
        markdown = self.reporter.export_markdown(report)

        assert isinstance(markdown, str)
        assert "# PostgreSQL Performance Report" in markdown
        assert "## CPU Analysis" in markdown
        assert "## Memory Analysis" in markdown
        assert "## Connection Analysis" in markdown
        assert "## Cache Hit Ratio" in markdown
        assert "## Recommendations" in markdown
        assert "## Detailed Metrics" in markdown
        assert "|" in markdown  # Check for table format
