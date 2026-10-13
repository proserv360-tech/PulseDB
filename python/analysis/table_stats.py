"""
TableStatsAnalyzer - PostgreSQL table statistics analysis.

Analyzes table growth, bloat, index efficiency, and generates
recommendations for maintenance (vacuum, analyze, reindex).
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any


@dataclass
class TableStats:
    """Statistics for a single table."""
    name: str
    row_count: int = 0
    size_bytes: int = 0
    live_tuple_count: int = 0
    dead_tuple_count: int = 0
    last_vacuum: datetime = None
    last_autovacuum: datetime = None
    indexes: list[dict[str, Any]] = field(default_factory=list)
    bloat_ratio: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary representation."""
        return {
            "name": self.name,
            "row_count": self.row_count,
            "size_bytes": self.size_bytes,
            "live_tuple_count": self.live_tuple_count,
            "dead_tuple_count": self.dead_tuple_count,
            "bloat_ratio": self.bloat_ratio,
            "last_vacuum": self.last_vacuum.isoformat() if self.last_vacuum else None,
            "last_autovacuum": self.last_autovacuum.isoformat() if self.last_autovacuum else None,
            "indexes": self.indexes,
        }


class TableStatsAnalyzer:
    """
    Analyzes PostgreSQL table statistics and generates optimization recommendations.

    Computes table metrics including bloat ratios, dead tuples, row trends, and
    index efficiency. Provides maintenance recommendations including vacuum, analyze,
    and index operations based on statistical thresholds.
    """

    def __init__(self):
        """Initialize the analyzer."""
        self.bloat_threshold = 0.2  # 20% bloat threshold
        self.dead_tuple_threshold = 0.15  # 15% dead tuples threshold
        self.vacuum_age_threshold = timedelta(days=7)  # Recommend vacuum if older than 7 days

    def analyze(self, table_data: dict[str, Any]) -> dict[str, Any]:
        """
        Compute statistics for a single table.

        Args:
            table_data: Dictionary with table metadata and statistics

        Returns:
            Dictionary with computed metrics and recommendations
        """
        stats = TableStats(
            name=table_data.get("name", "unknown"),
            row_count=table_data.get("row_count", 0),
            size_bytes=table_data.get("size_bytes", 0),
            live_tuple_count=table_data.get("live_tuples", 0),
            dead_tuple_count=table_data.get("dead_tuples", 0),
            indexes=table_data.get("indexes", []),
        )

        # Parse datetime strings if provided
        if table_data.get("last_vacuum"):
            try:
                stats.last_vacuum = datetime.fromisoformat(table_data["last_vacuum"])
            except (ValueError, TypeError):
                stats.last_vacuum = None

        if table_data.get("last_autovacuum"):
            try:
                stats.last_autovacuum = datetime.fromisoformat(table_data["last_autovacuum"])
            except (ValueError, TypeError):
                stats.last_autovacuum = None

        # Calculate bloat ratio
        total_tuples = stats.live_tuple_count + stats.dead_tuple_count
        if total_tuples > 0:
            stats.bloat_ratio = stats.dead_tuple_count / total_tuples
        else:
            stats.bloat_ratio = 0.0

        # Analyze indexes
        self._analyze_indexes(stats)

        # Calculate row count trend (if history provided)
        row_trend = self._calculate_row_trend(table_data.get("history", []))

        # Calculate size growth rate
        size_growth = self._calculate_size_growth(table_data.get("history", []))

        # Generate recommendations
        recommendations = self._generate_recommendations(stats, row_trend)

        return {
            "table_name": stats.name,
            "metrics": stats.to_dict(),
            "row_count_trend": row_trend,
            "size_growth_rate": size_growth,
            "dead_tuple_ratio": stats.bloat_ratio,
            "recommendations": recommendations,
        }

    def generate_report(self, tables: list[dict[str, Any]]) -> dict[str, Any]:
        """
        Aggregate statistics across tables.

        Args:
            tables: List of table data dictionaries

        Returns:
            Aggregated report with findings and recommendations
        """
        if not tables:
            return {
                "total_tables": 0,
                "total_size_bytes": 0,
                "tables": [],
                "most_bloated": [],
                "least_used_indexes": [],
                "priority_recommendations": [],
            }

        # Analyze each table
        table_analyses = [self.analyze(table) for table in tables]

        # Calculate aggregates
        total_size = sum(t.get("metrics", {}).get("size_bytes", 0) for t in table_analyses)
        total_rows = sum(t.get("metrics", {}).get("row_count", 0) for t in table_analyses)

        # Find most bloated tables
        most_bloated = sorted(
            table_analyses,
            key=lambda x: x.get("metrics", {}).get("bloat_ratio", 0),
            reverse=True
        )[:5]

        # Find least used indexes
        least_used_indexes = self._find_least_used_indexes(table_analyses)

        # Compile priority recommendations
        priority_recs = self._compile_priority_recommendations(table_analyses)

        return {
            "total_tables": len(tables),
            "total_size_bytes": total_size,
            "total_rows": total_rows,
            "average_bloat_ratio": (
                sum(t.get("metrics", {}).get("bloat_ratio", 0) for t in table_analyses)
                / len(table_analyses)
                if table_analyses
                else 0
            ),
            "tables": table_analyses,
            "most_bloated": [
                {
                    "table_name": t.get("table_name"),
                    "bloat_ratio": t.get("metrics", {}).get("bloat_ratio", 0),
                    "size_bytes": t.get("metrics", {}).get("size_bytes", 0),
                    "dead_tuples": t.get("metrics", {}).get("dead_tuple_count", 0),
                }
                for t in most_bloated
            ],
            "least_used_indexes": least_used_indexes,
            "priority_recommendations": priority_recs,
        }

    def _analyze_indexes(self, stats: TableStats) -> None:
        """
        Analyze index usage and efficiency.

        Args:
            stats: TableStats object to analyze indexes for.
        """
        for index in stats.indexes:
            # Calculate index size relative to table
            index_size = index.get("size_bytes", 0)
            if stats.size_bytes > 0:
                size_ratio = index_size / stats.size_bytes
                index["size_ratio"] = size_ratio
            else:
                index["size_ratio"] = 0

            # Track scan statistics
            index_scans = index.get("idx_scan", 0)
            index["is_unused"] = index_scans == 0

    def _calculate_row_trend(self, history: list[dict[str, Any]]) -> dict[str, Any]:
        """
        Calculate row count trend from historical data.

        Args:
            history: List of historical snapshots with row_count and timestamp.

        Returns:
            Dictionary with trend direction and change percentage.
        """
        if not history or len(history) < 2:
            return {
                "trend": "unknown",
                "change_percent": 0,
                "data_points": len(history),
            }

        # Sort by timestamp
        sorted_history = sorted(
            history,
            key=lambda x: x.get("timestamp", ""),
        )

        first_count = sorted_history[0].get("row_count", 0)
        last_count = sorted_history[-1].get("row_count", 0)

        if first_count == 0:
            change_percent = 0
        else:
            change_percent = ((last_count - first_count) / first_count) * 100

        if change_percent > 10:
            trend = "growing"
        elif change_percent < -10:
            trend = "shrinking"
        else:
            trend = "stable"

        return {
            "trend": trend,
            "change_percent": round(change_percent, 2),
            "data_points": len(history),
        }

    def _calculate_size_growth(self, history: list[dict[str, Any]]) -> dict[str, Any]:
        """
        Calculate table size growth rate.

        Args:
            history: List of historical snapshots with size_bytes and timestamp.

        Returns:
            Dictionary with growth rate per day and total growth in bytes.
        """
        if not history or len(history) < 2:
            return {
                "growth_rate_percent_per_day": 0,
                "data_points": len(history),
            }

        sorted_history = sorted(
            history,
            key=lambda x: x.get("timestamp", ""),
        )

        first_entry = sorted_history[0]
        last_entry = sorted_history[-1]

        first_size = first_entry.get("size_bytes", 0)
        last_size = last_entry.get("size_bytes", 0)

        # Calculate days between first and last
        try:
            first_time = datetime.fromisoformat(first_entry.get("timestamp", ""))
            last_time = datetime.fromisoformat(last_entry.get("timestamp", ""))
            days = (last_time - first_time).days
        except (ValueError, TypeError):
            days = 1

        if days <= 0 or first_size == 0:
            growth_rate = 0
        else:
            size_change = last_size - first_size
            growth_rate = (size_change / first_size / days) * 100

        return {
            "growth_rate_percent_per_day": round(growth_rate, 3),
            "total_growth_bytes": last_size - first_size,
            "data_points": len(history),
        }

    def _generate_recommendations(
        self,
        stats: TableStats,
        row_trend: dict[str, Any],
    ) -> list[str]:
        """
        Generate table-specific recommendations.

        Args:
            stats: TableStats object to generate recommendations for.
            row_trend: Row trend data from _calculate_row_trend.

        Returns:
            List of maintenance and optimization recommendations.
        """
        recommendations = []

        # Bloat check
        if stats.bloat_ratio > self.bloat_threshold:
            recommendations.append(
                f"Table has {stats.bloat_ratio * 100:.1f}% bloat - run VACUUM FULL"
            )

        # Dead tuple check
        if stats.dead_tuple_count > self.dead_tuple_threshold * stats.live_tuple_count:
            recommendations.append(
                "High dead tuple ratio - run VACUUM and ANALYZE"
            )

        # Vacuum age check
        if stats.last_vacuum:
            age = datetime.now() - stats.last_vacuum
            if age > self.vacuum_age_threshold:
                recommendations.append(
                    f"Not vacuumed in {age.days} days - schedule VACUUM"
                )

        # Row growth check
        if row_trend.get("trend") == "growing":
            growth = row_trend.get("change_percent", 0)
            if growth > 50:
                recommendations.append(
                    f"Table growing rapidly ({growth:.1f}%) - monitor disk space"
                )

        # No indexes
        if not stats.indexes:
            recommendations.append(
                "No indexes found - consider adding indexes on frequently queried columns"
            )

        return recommendations

    def _find_least_used_indexes(
        self,
        table_analyses: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """
        Find indexes with low usage.

        Args:
            table_analyses: List of table analysis results.

        Returns:
            List of unused indexes sorted by size (largest first).
        """
        unused_indexes = []

        for table_analysis in table_analyses:
            table_name = table_analysis.get("table_name")
            for index in table_analysis.get("metrics", {}).get("indexes", []):
                if index.get("is_unused"):
                    unused_indexes.append({
                        "index_name": index.get("name", "unknown"),
                        "table_name": table_name,
                        "size_bytes": index.get("size_bytes", 0),
                        "scans": index.get("idx_scan", 0),
                    })

        return sorted(
            unused_indexes,
            key=lambda x: x.get("size_bytes", 0),
            reverse=True,
        )[:10]

    def _compile_priority_recommendations(
        self,
        table_analyses: list[dict[str, Any]],
    ) -> list[str]:
        """
        Compile highest priority recommendations across all tables.

        Args:
            table_analyses: List of table analysis results.

        Returns:
            List of high-priority recommendations for the entire database.
        """
        priority_recs = []
        bloat_count = 0
        vacuum_needed = 0
        fast_growth = 0

        for analysis in table_analyses:
            recs = analysis.get("recommendations", [])
            for rec in recs:
                if "bloat" in rec.lower():
                    bloat_count += 1
                elif "vacuum" in rec.lower():
                    vacuum_needed += 1
                elif "growing rapidly" in rec.lower():
                    fast_growth += 1

        if bloat_count > 0:
            priority_recs.append(
                f"{bloat_count} table(s) have high bloat - prioritize VACUUM FULL on largest tables"
            )

        if vacuum_needed > 0:
            priority_recs.append(
                f"{vacuum_needed} table(s) need vacuuming - enable autovacuum or schedule maintenance"
            )

        if fast_growth > 0:
            priority_recs.append(
                f"{fast_growth} table(s) growing rapidly - monitor disk usage and plan capacity"
            )

        if len(table_analyses) > 0:
            unused_count = len([
                i for a in table_analyses
                for i in a.get("metrics", {}).get("indexes", [])
                if i.get("is_unused")
            ])
            if unused_count > 0:
                priority_recs.append(
                    f"Drop {unused_count} unused index(es) to reduce maintenance overhead"
                )

        return priority_recs if priority_recs else ["All tables are in good condition"]
