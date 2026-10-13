"""
PerformanceReport - PostgreSQL performance analysis and reporting.

Generates comprehensive performance reports with CPU, memory, and connection
analysis, period comparisons, and markdown export capability.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass
class PerformanceMetrics:
    """Container for performance metrics."""
    cpu_usage_percent: float = 0.0
    memory_usage_percent: float = 0.0
    memory_used_mb: float = 0.0
    memory_available_mb: float = 0.0
    active_connections: int = 0
    idle_connections: int = 0
    max_connections: int = 100
    avg_query_time_ms: float = 0.0
    slow_query_count: int = 0
    cache_hit_ratio: float = 0.0
    tps: float = 0.0  # Transactions per second
    timestamp: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary representation."""
        return {
            "cpu_usage_percent": self.cpu_usage_percent,
            "memory_usage_percent": self.memory_usage_percent,
            "memory_used_mb": self.memory_used_mb,
            "memory_available_mb": self.memory_available_mb,
            "active_connections": self.active_connections,
            "idle_connections": self.idle_connections,
            "max_connections": self.max_connections,
            "avg_query_time_ms": self.avg_query_time_ms,
            "slow_query_count": self.slow_query_count,
            "cache_hit_ratio": self.cache_hit_ratio,
            "tps": self.tps,
            "timestamp": self.timestamp.isoformat(),
        }


class PerformanceReport:
    """
    Generates and analyzes PostgreSQL performance reports.

    Analyzes CPU, memory, connections, and cache metrics to assess database
    performance. Provides detailed analysis, period comparisons, and markdown
    exports with actionable recommendations.
    """

    def __init__(self):
        """Initialize the report generator."""
        self.cpu_threshold_warning = 75  # 75% warning
        self.memory_threshold_warning = 80  # 80% warning
        self.connection_threshold_warning = 80  # 80% of max
        self.cache_hit_threshold_warning = 0.99  # Should be >99%

    def generate(self, metrics: dict[str, Any]) -> dict[str, Any]:
        """
        Produce a structured performance report.

        Args:
            metrics: Dictionary with performance metrics

        Returns:
            Structured report with analysis and recommendations
        """
        perf = self._parse_metrics(metrics)

        # Generate analyses
        cpu_analysis = self._analyze_cpu(perf)
        memory_analysis = self._analyze_memory(perf)
        connection_analysis = self._analyze_connections(perf)
        cache_analysis = self._analyze_cache(perf)

        # Compile recommendations
        recommendations = self._compile_recommendations(
            perf, cpu_analysis, memory_analysis, connection_analysis, cache_analysis
        )

        # Overall health assessment
        health_status = self._assess_health(
            cpu_analysis, memory_analysis, connection_analysis, cache_analysis
        )

        return {
            "timestamp": perf.timestamp.isoformat(),
            "summary": {
                "health_status": health_status,
                "overall_rating": self._calculate_rating(
                    cpu_analysis, memory_analysis, connection_analysis, cache_analysis
                ),
            },
            "cpu_analysis": cpu_analysis,
            "memory_analysis": memory_analysis,
            "connection_analysis": connection_analysis,
            "cache_analysis": cache_analysis,
            "recommendations": recommendations,
            "metrics": perf.to_dict(),
        }

    def compare_periods(
        self,
        current: dict[str, Any],
        previous: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Compare two time periods and highlight regressions/improvements.

        Args:
            current: Current period metrics dictionary
            previous: Previous period metrics dictionary

        Returns:
            Comparison report with deltas and trends
        """
        curr_perf = self._parse_metrics(current)
        prev_perf = self._parse_metrics(previous)

        # Calculate deltas
        cpu_delta = curr_perf.cpu_usage_percent - prev_perf.cpu_usage_percent
        memory_delta = curr_perf.memory_usage_percent - prev_perf.memory_usage_percent
        connection_delta = curr_perf.active_connections - prev_perf.active_connections
        cache_delta = curr_perf.cache_hit_ratio - prev_perf.cache_hit_ratio
        tps_delta = curr_perf.tps - prev_perf.tps

        # Assess changes
        changes = {}
        if abs(cpu_delta) > 5:
            changes["cpu"] = {
                "delta_percent": round(cpu_delta, 2),
                "status": "degraded" if cpu_delta > 0 else "improved",
            }

        if abs(memory_delta) > 5:
            changes["memory"] = {
                "delta_percent": round(memory_delta, 2),
                "status": "degraded" if memory_delta > 0 else "improved",
            }

        if abs(connection_delta) > 10:
            changes["connections"] = {
                "delta_count": connection_delta,
                "status": "increasing" if connection_delta > 0 else "decreasing",
            }

        if abs(cache_delta) > 0.01:
            changes["cache_hit_ratio"] = {
                "delta": round(cache_delta, 4),
                "status": "improved" if cache_delta > 0 else "degraded",
            }

        if abs(tps_delta) > 10:
            changes["throughput"] = {
                "delta_tps": round(tps_delta, 2),
                "status": "increased" if tps_delta > 0 else "decreased",
            }

        # Identify regressions
        regressions = []
        if cpu_delta > 10:
            regressions.append(f"CPU usage increased by {cpu_delta:.1f}%")
        if memory_delta > 10:
            regressions.append(f"Memory usage increased by {memory_delta:.1f}%")
        if cache_delta < -0.01:
            regressions.append(f"Cache hit ratio decreased by {cache_delta:.2%}")

        # Identify improvements
        improvements = []
        if cpu_delta < -10:
            improvements.append(f"CPU usage decreased by {abs(cpu_delta):.1f}%")
        if memory_delta < -10:
            improvements.append(f"Memory usage decreased by {abs(memory_delta):.1f}%")
        if cache_delta > 0.01:
            improvements.append(f"Cache hit ratio improved by {cache_delta:.2%}")

        return {
            "period_comparison": {
                "current_timestamp": curr_perf.timestamp.isoformat(),
                "previous_timestamp": prev_perf.timestamp.isoformat(),
            },
            "changes": changes,
            "regressions": regressions,
            "improvements": improvements,
            "current_metrics": curr_perf.to_dict(),
            "previous_metrics": prev_perf.to_dict(),
        }

    def export_markdown(self, report: dict[str, Any]) -> str:
        """
        Convert report to markdown format.

        Args:
            report: Performance report dictionary from generate()

        Returns:
            Markdown formatted report string
        """
        lines = []

        # Header
        timestamp = report.get("timestamp", "Unknown")
        health = report.get("summary", {}).get("health_status", "Unknown")
        rating = report.get("summary", {}).get("overall_rating", "N/A")

        lines.append("# PostgreSQL Performance Report")
        lines.append("")
        lines.append(f"**Generated:** {timestamp}")
        lines.append(f"**Health Status:** {health.upper()}")
        lines.append(f"**Overall Rating:** {rating}/10")
        lines.append("")

        # CPU Analysis
        lines.append("## CPU Analysis")
        cpu = report.get("cpu_analysis", {})
        lines.append(f"- Current Usage: {cpu.get('current_percent', 0):.1f}%")
        lines.append(f"- Status: {cpu.get('status', 'Unknown')}")
        if cpu.get("issues"):
            lines.append("- Issues:")
            for issue in cpu.get("issues", []):
                lines.append(f"  - {issue}")
        lines.append("")

        # Memory Analysis
        lines.append("## Memory Analysis")
        mem = report.get("memory_analysis", {})
        lines.append(f"- Used: {mem.get('used_mb', 0):.0f} MB")
        lines.append(f"- Available: {mem.get('available_mb', 0):.0f} MB")
        lines.append(f"- Usage: {mem.get('usage_percent', 0):.1f}%")
        lines.append(f"- Status: {mem.get('status', 'Unknown')}")
        if mem.get("issues"):
            lines.append("- Issues:")
            for issue in mem.get("issues", []):
                lines.append(f"  - {issue}")
        lines.append("")

        # Connection Analysis
        lines.append("## Connection Analysis")
        conn = report.get("connection_analysis", {})
        lines.append(f"- Active Connections: {conn.get('active', 0)}")
        lines.append(f"- Idle Connections: {conn.get('idle', 0)}")
        lines.append(f"- Max Connections: {conn.get('max', 100)}")
        lines.append(f"- Utilization: {conn.get('utilization_percent', 0):.1f}%")
        lines.append(f"- Status: {conn.get('status', 'Unknown')}")
        if conn.get("issues"):
            lines.append("- Issues:")
            for issue in conn.get("issues", []):
                lines.append(f"  - {issue}")
        lines.append("")

        # Cache Analysis
        lines.append("## Cache Hit Ratio")
        cache = report.get("cache_analysis", {})
        lines.append(f"- Hit Ratio: {cache.get('hit_ratio', 0):.2%}")
        lines.append(f"- Status: {cache.get('status', 'Unknown')}")
        if cache.get("issues"):
            lines.append("- Issues:")
            for issue in cache.get("issues", []):
                lines.append(f"  - {issue}")
        lines.append("")

        # Recommendations
        lines.append("## Recommendations")
        recommendations = report.get("recommendations", [])
        if recommendations:
            for i, rec in enumerate(recommendations, 1):
                lines.append(f"{i}. {rec}")
        else:
            lines.append("- No critical recommendations at this time.")
        lines.append("")

        # Metrics Table
        lines.append("## Detailed Metrics")
        metrics = report.get("metrics", {})
        lines.append("| Metric | Value |")
        lines.append("|--------|-------|")
        lines.append(f"| CPU Usage | {metrics.get('cpu_usage_percent', 0):.1f}% |")
        lines.append(f"| Memory Usage | {metrics.get('memory_usage_percent', 0):.1f}% |")
        lines.append(f"| Avg Query Time | {metrics.get('avg_query_time_ms', 0):.2f} ms |")
        lines.append(f"| Slow Queries | {metrics.get('slow_query_count', 0)} |")
        lines.append(f"| TPS | {metrics.get('tps', 0):.2f} |")
        lines.append("")

        return "\n".join(lines)

    def _parse_metrics(self, metrics: dict[str, Any]) -> PerformanceMetrics:
        """
        Parse metrics dictionary into PerformanceMetrics object.

        Args:
            metrics: Dictionary with performance metric values.

        Returns:
            PerformanceMetrics object with parsed values.
        """
        perf = PerformanceMetrics()

        perf.cpu_usage_percent = float(metrics.get("cpu_usage_percent", 0))
        perf.memory_usage_percent = float(metrics.get("memory_usage_percent", 0))
        perf.memory_used_mb = float(metrics.get("memory_used_mb", 0))
        perf.memory_available_mb = float(metrics.get("memory_available_mb", 0))
        perf.active_connections = int(metrics.get("active_connections", 0))
        perf.idle_connections = int(metrics.get("idle_connections", 0))
        perf.max_connections = int(metrics.get("max_connections", 100))
        perf.avg_query_time_ms = float(metrics.get("avg_query_time_ms", 0))
        perf.slow_query_count = int(metrics.get("slow_query_count", 0))
        perf.cache_hit_ratio = float(metrics.get("cache_hit_ratio", 0))
        perf.tps = float(metrics.get("tps", 0))

        if metrics.get("timestamp"):
            try:
                perf.timestamp = datetime.fromisoformat(metrics["timestamp"])
            except (ValueError, TypeError):
                perf.timestamp = datetime.now()

        return perf

    def _analyze_cpu(self, metrics: PerformanceMetrics) -> dict[str, Any]:
        """
        Analyze CPU usage patterns.

        Args:
            metrics: PerformanceMetrics object with CPU data.

        Returns:
            Dictionary with CPU analysis including status and issues.
        """
        status = "good"
        issues = []

        if metrics.cpu_usage_percent >= self.cpu_threshold_warning:
            status = "warning"
            issues.append(f"High CPU usage: {metrics.cpu_usage_percent:.1f}%")

        if metrics.cpu_usage_percent > 90:
            status = "critical"
            issues.append("CPU usage is critical - immediate attention needed")

        return {
            "current_percent": metrics.cpu_usage_percent,
            "threshold_warning": self.cpu_threshold_warning,
            "status": status,
            "issues": issues,
        }

    def _analyze_memory(self, metrics: PerformanceMetrics) -> dict[str, Any]:
        """
        Analyze memory usage patterns.

        Args:
            metrics: PerformanceMetrics object with memory data.

        Returns:
            Dictionary with memory analysis including status and issues.
        """
        status = "good"
        issues = []

        if metrics.memory_usage_percent >= self.memory_threshold_warning:
            status = "warning"
            issues.append(f"High memory usage: {metrics.memory_usage_percent:.1f}%")

        if metrics.memory_usage_percent > 95:
            status = "critical"
            issues.append("Memory nearly exhausted - risk of OOM")

        return {
            "used_mb": metrics.memory_used_mb,
            "available_mb": metrics.memory_available_mb,
            "usage_percent": metrics.memory_usage_percent,
            "threshold_warning": self.memory_threshold_warning,
            "status": status,
            "issues": issues,
        }

    def _analyze_connections(self, metrics: PerformanceMetrics) -> dict[str, Any]:
        """
        Analyze connection patterns.

        Args:
            metrics: PerformanceMetrics object with connection data.

        Returns:
            Dictionary with connection analysis including status and issues.
        """
        utilization = 0
        if metrics.max_connections > 0:
            total_connections = metrics.active_connections + metrics.idle_connections
            utilization = (total_connections / metrics.max_connections) * 100

        status = "good"
        issues = []

        if utilization >= self.connection_threshold_warning:
            status = "warning"
            issues.append(f"High connection utilization: {utilization:.1f}%")

        if utilization > 95:
            status = "critical"
            issues.append("Connection pool nearly exhausted")

        return {
            "active": metrics.active_connections,
            "idle": metrics.idle_connections,
            "max": metrics.max_connections,
            "utilization_percent": utilization,
            "status": status,
            "issues": issues,
        }

    def _analyze_cache(self, metrics: PerformanceMetrics) -> dict[str, Any]:
        """
        Analyze cache performance.

        Args:
            metrics: PerformanceMetrics object with cache data.

        Returns:
            Dictionary with cache analysis including status and issues.
        """
        status = "good"
        issues = []

        if metrics.cache_hit_ratio < self.cache_hit_threshold_warning:
            status = "warning"
            issues.append(
                f"Low cache hit ratio: {metrics.cache_hit_ratio:.2%} (target: {self.cache_hit_threshold_warning:.2%})"
            )

        if metrics.cache_hit_ratio < 0.95:
            status = "critical"
            issues.append("Cache hit ratio critically low - missing index opportunities")

        return {
            "hit_ratio": metrics.cache_hit_ratio,
            "threshold_target": self.cache_hit_threshold_warning,
            "status": status,
            "issues": issues,
        }

    def _compile_recommendations(
        self,
        metrics: PerformanceMetrics,
        cpu_analysis: dict[str, Any],
        memory_analysis: dict[str, Any],
        connection_analysis: dict[str, Any],
        cache_analysis: dict[str, Any],
    ) -> list[str]:
        """
        Compile actionable recommendations.

        Args:
            metrics: PerformanceMetrics object.
            cpu_analysis: CPU analysis result dictionary.
            memory_analysis: Memory analysis result dictionary.
            connection_analysis: Connection analysis result dictionary.
            cache_analysis: Cache analysis result dictionary.

        Returns:
            List of actionable recommendations for performance improvement.
        """
        recommendations = []

        # CPU recommendations
        if cpu_analysis.get("status") in ["warning", "critical"]:
            recommendations.append(
                "Analyze slow queries and optimize expensive operations"
            )
            recommendations.append(
                "Consider increasing server resources or scaling horizontally"
            )

        # Memory recommendations
        if memory_analysis.get("status") in ["warning", "critical"]:
            recommendations.append(
                "Increase shared_buffers and work_mem settings if server memory allows"
            )
            recommendations.append(
                "Review and tune active session connections"
            )

        # Connection recommendations
        if connection_analysis.get("status") in ["warning", "critical"]:
            recommendations.append(
                "Implement connection pooling (PgBouncer) to manage connections"
            )
            recommendations.append(
                "Investigate long-running transactions and idle connections"
            )

        # Cache recommendations
        if cache_analysis.get("status") in ["warning", "critical"]:
            recommendations.append(
                "Add missing indexes on frequently accessed columns"
            )
            recommendations.append(
                "Consider query optimization and table restructuring"
            )

        # Query performance
        if metrics.slow_query_count > 5:
            recommendations.append(
                f"Investigate {metrics.slow_query_count} slow queries in pg_stat_statements"
            )

        return recommendations if recommendations else ["System performance is healthy"]

    def _assess_health(
        self,
        cpu_analysis: dict[str, Any],
        memory_analysis: dict[str, Any],
        connection_analysis: dict[str, Any],
        cache_analysis: dict[str, Any],
    ) -> str:
        """
        Assess overall system health.

        Args:
            cpu_analysis: CPU analysis result dictionary.
            memory_analysis: Memory analysis result dictionary.
            connection_analysis: Connection analysis result dictionary.
            cache_analysis: Cache analysis result dictionary.

        Returns:
            Health status: "critical", "warning", or "healthy".
        """
        statuses = [
            cpu_analysis.get("status", "unknown"),
            memory_analysis.get("status", "unknown"),
            connection_analysis.get("status", "unknown"),
            cache_analysis.get("status", "unknown"),
        ]

        if "critical" in statuses:
            return "critical"
        elif "warning" in statuses:
            return "warning"
        else:
            return "healthy"

    def _calculate_rating(
        self,
        cpu_analysis: dict[str, Any],
        memory_analysis: dict[str, Any],
        connection_analysis: dict[str, Any],
        cache_analysis: dict[str, Any],
    ) -> float:
        """
        Calculate overall performance rating (0-10).

        Args:
            cpu_analysis: CPU analysis result dictionary.
            memory_analysis: Memory analysis result dictionary.
            connection_analysis: Connection analysis result dictionary.
            cache_analysis: Cache analysis result dictionary.

        Returns:
            Performance rating from 0 to 10.
        """
        rating = 10.0

        # Deduct points for issues
        if cpu_analysis.get("status") == "warning":
            rating -= 2
        elif cpu_analysis.get("status") == "critical":
            rating -= 4

        if memory_analysis.get("status") == "warning":
            rating -= 2
        elif memory_analysis.get("status") == "critical":
            rating -= 4

        if connection_analysis.get("status") == "warning":
            rating -= 1
        elif connection_analysis.get("status") == "critical":
            rating -= 2

        if cache_analysis.get("status") == "warning":
            rating -= 1
        elif cache_analysis.get("status") == "critical":
            rating -= 2

        return max(0, rating)
