#!/usr/bin/env python3
"""
Chart generation script for PostgreSQL, MySQL, and MongoDB metrics.
Generates professional static charts with dark theme and custom styling.
"""

import json
import argparse
import sys
from pathlib import Path
from typing import Dict, Any, List, Tuple
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import Rectangle
from matplotlib.ticker import FuncFormatter, MaxNLocator


# Color palette
COLORS = {
    'cyan': '#38bdf8',
    'violet': '#8b5cf6',
    'amber': '#f59e0b',
    'emerald': '#34d399',
    'rose': '#f43f5e',
}

# Dark theme colors
DARK_BG = '#0f172a'
TEXT_COLOR = '#e2e8f0'
GRID_COLOR = '#ffffff'
GRID_ALPHA = 0.1


def setup_dark_theme():
    """Configure matplotlib for dark theme."""
    plt.style.use('dark_background')
    plt.rcParams['figure.facecolor'] = DARK_BG
    plt.rcParams['axes.facecolor'] = DARK_BG
    plt.rcParams['text.color'] = TEXT_COLOR
    plt.rcParams['axes.edgecolor'] = TEXT_COLOR
    plt.rcParams['grid.color'] = GRID_COLOR
    plt.rcParams['grid.alpha'] = GRID_ALPHA
    plt.rcParams['legend.facecolor'] = DARK_BG
    plt.rcParams['legend.edgecolor'] = TEXT_COLOR
    plt.rcParams['font.family'] = 'sans-serif'
    plt.rcParams['font.sans-serif'] = ['Inter', 'Segoe UI', 'Helvetica', 'Arial']
    plt.rcParams['font.size'] = 10


def save_chart(fig: plt.Figure, filepath: Path, dpi: int = 300):
    """Save chart with high quality."""
    filepath.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(
        str(filepath),
        dpi=dpi,
        bbox_inches='tight',
        facecolor=DARK_BG,
        edgecolor='none',
        pad_inches=0.3
    )
    plt.close(fig)


def load_json_data(filepath: Path) -> Dict[str, Any]:
    """Load JSON metrics file."""
    with open(filepath, 'r') as f:
        return json.load(f)


# ============================================================================
# PostgreSQL Charts
# ============================================================================

def pg_connections_history(data: Dict[str, Any], output_dir: Path):
    """Line chart of connection history (24h)."""
    fig, ax = plt.subplots(figsize=(12, 6), dpi=100)

    history = data['connections']['history']
    hours = list(range(len(history)))

    ax.plot(hours, history, color=COLORS['cyan'], linewidth=2.5, marker='o', markersize=6)
    ax.fill_between(hours, history, alpha=0.2, color=COLORS['cyan'])

    ax.set_title('PostgreSQL Connection History (24h)', fontsize=14, fontweight='bold', pad=20)
    ax.set_xlabel('Hour', fontsize=11)
    ax.set_ylabel('Active Connections', fontsize=11)
    ax.grid(True, alpha=GRID_ALPHA)
    ax.set_ylim(bottom=0)

    fig.tight_layout()
    save_chart(fig, output_dir / 'pg_connections_history.png')


def pg_tps_history(data: Dict[str, Any], output_dir: Path):
    """Line chart of TPS history."""
    fig, ax = plt.subplots(figsize=(12, 6), dpi=100)

    tps_history = data['transactions']['tps_history']
    hours = list(range(len(tps_history)))

    ax.plot(hours, tps_history, color=COLORS['violet'], linewidth=2.5, marker='s', markersize=6)
    ax.fill_between(hours, tps_history, alpha=0.2, color=COLORS['violet'])

    ax.set_title('PostgreSQL Transactions Per Second (24h)', fontsize=14, fontweight='bold', pad=20)
    ax.set_xlabel('Hour', fontsize=11)
    ax.set_ylabel('TPS', fontsize=11)
    ax.grid(True, alpha=GRID_ALPHA)
    ax.set_ylim(bottom=0)

    fig.tight_layout()
    save_chart(fig, output_dir / 'pg_tps_history.png')


def pg_latency_percentiles(data: Dict[str, Any], output_dir: Path):
    """Multi-line chart of P50/P95/P99 latency."""
    fig, ax = plt.subplots(figsize=(12, 6), dpi=100)

    p50 = data['latency']['p50_history']
    p95 = data['latency']['p95_history']
    p99 = data['latency']['p99_history']
    hours = list(range(len(p50)))

    ax.plot(hours, p50, color=COLORS['cyan'], label='P50', linewidth=2.5, marker='o', markersize=5)
    ax.plot(hours, p95, color=COLORS['amber'], label='P95', linewidth=2.5, marker='s', markersize=5)
    ax.plot(hours, p99, color=COLORS['rose'], label='P99', linewidth=2.5, marker='^', markersize=5)

    ax.set_title('PostgreSQL Latency Percentiles (24h)', fontsize=14, fontweight='bold', pad=20)
    ax.set_xlabel('Hour', fontsize=11)
    ax.set_ylabel('Latency (ms)', fontsize=11)
    ax.legend(loc='upper left', framealpha=0.95)
    ax.grid(True, alpha=GRID_ALPHA)
    ax.set_ylim(bottom=0)

    fig.tight_layout()
    save_chart(fig, output_dir / 'pg_latency_percentiles.png')


def pg_query_scan_types(data: Dict[str, Any], output_dir: Path):
    """Pie chart of Sequential vs Index scans."""
    fig, ax = plt.subplots(figsize=(10, 8), dpi=100)

    sizes = [
        data['queries']['sequential_scans_pct'],
        data['queries']['index_scans_pct']
    ]
    labels = ['Sequential Scans', 'Index Scans']
    colors = [COLORS['rose'], COLORS['emerald']]

    wedges, texts, autotexts = ax.pie(
        sizes, labels=labels, colors=colors, autopct='%1.1f%%',
        startangle=90, textprops={'fontsize': 11, 'weight': 'bold'}
    )

    for autotext in autotexts:
        autotext.set_color('white')
        autotext.set_fontsize(10)

    ax.set_title('PostgreSQL Query Scan Types', fontsize=14, fontweight='bold', pad=20)

    fig.tight_layout()
    save_chart(fig, output_dir / 'pg_query_scan_types.png')


def pg_wait_events(data: Dict[str, Any], output_dir: Path):
    """Pie chart of wait event breakdown."""
    fig, ax = plt.subplots(figsize=(10, 8), dpi=100)

    wait_events = data['sessions']['wait_events']
    sizes = list(wait_events.values())
    labels = [k.replace('_pct', '').replace('_', ' ').title() for k in wait_events.keys()]
    colors_list = [COLORS['cyan'], COLORS['violet'], COLORS['amber'], COLORS['emerald'], COLORS['rose']]

    wedges, texts, autotexts = ax.pie(
        sizes, labels=labels, colors=colors_list, autopct='%1.1f%%',
        startangle=90, textprops={'fontsize': 10, 'weight': 'bold'}
    )

    for autotext in autotexts:
        autotext.set_color('white')
        autotext.set_fontsize(9)

    ax.set_title('PostgreSQL Wait Events Breakdown', fontsize=14, fontweight='bold', pad=20)

    fig.tight_layout()
    save_chart(fig, output_dir / 'pg_wait_events.png')


def pg_cpu_memory(data: Dict[str, Any], output_dir: Path):
    """Dual subplot: CPU + Memory history."""
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6), dpi=100)

    cpu_history = data['system']['cpu']['history']
    mem_history = data['system']['memory']['history']
    hours = list(range(len(cpu_history)))

    # CPU subplot
    ax1.plot(hours, cpu_history, color=COLORS['cyan'], linewidth=2.5, marker='o', markersize=6)
    ax1.fill_between(hours, cpu_history, alpha=0.2, color=COLORS['cyan'])
    ax1.set_title('CPU Usage (%)', fontsize=12, fontweight='bold')
    ax1.set_xlabel('Hour', fontsize=10)
    ax1.set_ylabel('CPU %', fontsize=10)
    ax1.grid(True, alpha=GRID_ALPHA)
    ax1.set_ylim(0, 100)

    # Memory subplot
    ax2.plot(hours, mem_history, color=COLORS['violet'], linewidth=2.5, marker='s', markersize=6)
    ax2.fill_between(hours, mem_history, alpha=0.2, color=COLORS['violet'])
    ax2.set_title('Memory Usage (GB)', fontsize=12, fontweight='bold')
    ax2.set_xlabel('Hour', fontsize=10)
    ax2.set_ylabel('RAM (GB)', fontsize=10)
    ax2.grid(True, alpha=GRID_ALPHA)
    ax2.set_ylim(11, 13)

    fig.suptitle('PostgreSQL System Resources (24h)', fontsize=14, fontweight='bold', y=1.02)
    fig.tight_layout()
    save_chart(fig, output_dir / 'pg_cpu_memory.png')


def pg_disk_io(data: Dict[str, Any], output_dir: Path):
    """Area chart of read/write throughput."""
    fig, ax = plt.subplots(figsize=(12, 6), dpi=100)

    read_history = data['system']['disk']['history_read']
    write_history = data['system']['disk']['history_write']
    hours = np.arange(len(read_history))

    ax.fill_between(hours, 0, read_history, alpha=0.6, color=COLORS['cyan'], label='Read (MB/s)')
    ax.fill_between(hours, read_history, np.array(read_history) + np.array(write_history),
                     alpha=0.6, color=COLORS['amber'], label='Write (MB/s)')

    ax.set_title('PostgreSQL Disk I/O Throughput (24h)', fontsize=14, fontweight='bold', pad=20)
    ax.set_xlabel('Hour', fontsize=11)
    ax.set_ylabel('Throughput (MB/s)', fontsize=11)
    ax.legend(loc='upper left', framealpha=0.95)
    ax.grid(True, alpha=GRID_ALPHA)
    ax.set_ylim(bottom=0)

    fig.tight_layout()
    save_chart(fig, output_dir / 'pg_disk_io.png')


def pg_storage_breakdown(data: Dict[str, Any], output_dir: Path):
    """Donut chart of storage breakdown."""
    fig, ax = plt.subplots(figsize=(10, 8), dpi=100)

    storage = data['storage']['storage_breakdown']
    sizes = list(storage.values())
    labels = [k.replace('_', ' ').title() for k in storage.keys()]
    colors_list = [COLORS['cyan'], COLORS['violet'], COLORS['amber'], COLORS['emerald'], COLORS['rose']]

    wedges, texts, autotexts = ax.pie(
        sizes, labels=labels, colors=colors_list, autopct='%1.1f%%',
        startangle=90, textprops={'fontsize': 10, 'weight': 'bold'},
        pctdistance=0.85
    )

    # Create donut hole
    centre_circle = plt.Circle((0, 0), 0.70, fc=DARK_BG)
    ax.add_artist(centre_circle)

    for autotext in autotexts:
        autotext.set_color('white')
        autotext.set_fontsize(9)

    ax.set_title('PostgreSQL Storage Breakdown', fontsize=14, fontweight='bold', pad=20)

    fig.tight_layout()
    save_chart(fig, output_dir / 'pg_storage_breakdown.png')


def pg_top_tables(data: Dict[str, Any], output_dir: Path):
    """Horizontal bar of top 8 tables by size."""
    fig, ax = plt.subplots(figsize=(12, 7), dpi=100)

    top_tables = data['storage']['top_tables'][:8]
    names = [t['name'] for t in top_tables]
    sizes = [t['size_mb'] for t in top_tables]

    bars = ax.barh(names, sizes, color=COLORS['violet'], edgecolor=TEXT_COLOR, linewidth=1.5)

    # Add value labels
    for i, (bar, size) in enumerate(zip(bars, sizes)):
        ax.text(size, bar.get_y() + bar.get_height()/2, f' {size:,.0f} MB',
                va='center', ha='left', fontsize=10, fontweight='bold')

    ax.set_xlabel('Size (MB)', fontsize=11, fontweight='bold')
    ax.set_title('PostgreSQL Top 8 Tables by Size', fontsize=14, fontweight='bold', pad=20)
    ax.grid(True, alpha=GRID_ALPHA, axis='x')
    ax.invert_yaxis()

    fig.tight_layout()
    save_chart(fig, output_dir / 'pg_top_tables.png')


# ============================================================================
# MySQL Charts
# ============================================================================

def mysql_qps_tps(data: Dict[str, Any], output_dir: Path):
    """Dual line: QPS + TPS history."""
    fig, ax = plt.subplots(figsize=(12, 6), dpi=100)

    qps_history = data['vitals']['qps_history']
    tps_history = data['vitals']['tps_history']
    hours = list(range(len(qps_history)))

    ax.plot(hours, qps_history, color=COLORS['cyan'], linewidth=2.5, marker='o', markersize=6, label='QPS')
    ax.plot(hours, tps_history, color=COLORS['violet'], linewidth=2.5, marker='s', markersize=6, label='TPS')

    ax.set_title('MySQL Queries Per Second & Transactions Per Second (24h)', fontsize=14, fontweight='bold', pad=20)
    ax.set_xlabel('Hour', fontsize=11)
    ax.set_ylabel('Operations/sec', fontsize=11)
    ax.legend(loc='upper left', framealpha=0.95)
    ax.grid(True, alpha=GRID_ALPHA)
    ax.set_ylim(bottom=0)

    fig.tight_layout()
    save_chart(fig, output_dir / 'mysql_qps_tps.png')


def mysql_command_breakdown(data: Dict[str, Any], output_dir: Path):
    """Pie chart: SELECT/INSERT/UPDATE/DELETE."""
    fig, ax = plt.subplots(figsize=(10, 8), dpi=100)

    commands = data['performance']['command_breakdown']
    sizes = list(commands.values())
    labels = list(commands.keys())
    colors_list = [COLORS['cyan'], COLORS['violet'], COLORS['amber'], COLORS['rose']]

    wedges, texts, autotexts = ax.pie(
        sizes, labels=labels, colors=colors_list, autopct='%1.1f%%',
        startangle=90, textprops={'fontsize': 11, 'weight': 'bold'}
    )

    for autotext in autotexts:
        autotext.set_color('white')
        autotext.set_fontsize(10)

    ax.set_title('MySQL Command Breakdown', fontsize=14, fontweight='bold', pad=20)

    fig.tight_layout()
    save_chart(fig, output_dir / 'mysql_command_breakdown.png')


def mysql_cpu_memory(data: Dict[str, Any], output_dir: Path):
    """Dual subplot: CPU + Memory."""
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6), dpi=100)

    cpu_history = data['resources']['cpu_history']
    mem_history = data['resources']['memory_history']
    hours = list(range(len(cpu_history)))

    # CPU subplot
    ax1.plot(hours, cpu_history, color=COLORS['cyan'], linewidth=2.5, marker='o', markersize=6)
    ax1.fill_between(hours, cpu_history, alpha=0.2, color=COLORS['cyan'])
    ax1.set_title('CPU Usage (%)', fontsize=12, fontweight='bold')
    ax1.set_xlabel('Hour', fontsize=10)
    ax1.set_ylabel('CPU %', fontsize=10)
    ax1.grid(True, alpha=GRID_ALPHA)
    ax1.set_ylim(0, 100)

    # Memory subplot
    ax2.plot(hours, mem_history, color=COLORS['violet'], linewidth=2.5, marker='s', markersize=6)
    ax2.fill_between(hours, mem_history, alpha=0.2, color=COLORS['violet'])
    ax2.set_title('Memory Usage (%)', fontsize=12, fontweight='bold')
    ax2.set_xlabel('Hour', fontsize=10)
    ax2.set_ylabel('Memory %', fontsize=10)
    ax2.grid(True, alpha=GRID_ALPHA)
    ax2.set_ylim(0, 100)

    fig.suptitle('MySQL System Resources (24h)', fontsize=14, fontweight='bold', y=1.02)
    fig.tight_layout()
    save_chart(fig, output_dir / 'mysql_cpu_memory.png')


def mysql_buffer_pool(data: Dict[str, Any], output_dir: Path):
    """Line chart of buffer pool utilization."""
    fig, ax = plt.subplots(figsize=(12, 6), dpi=100)

    pool_history = data['innodb']['pool_history']
    hours = list(range(len(pool_history)))

    ax.plot(hours, pool_history, color=COLORS['emerald'], linewidth=2.5, marker='o', markersize=6)
    ax.fill_between(hours, pool_history, alpha=0.2, color=COLORS['emerald'])

    ax.set_title('MySQL InnoDB Buffer Pool Utilization (24h)', fontsize=14, fontweight='bold', pad=20)
    ax.set_xlabel('Hour', fontsize=11)
    ax.set_ylabel('Utilization (%)', fontsize=11)
    ax.grid(True, alpha=GRID_ALPHA)
    ax.set_ylim(0, 100)

    fig.tight_layout()
    save_chart(fig, output_dir / 'mysql_buffer_pool.png')


def mysql_connections(data: Dict[str, Any], output_dir: Path):
    """Line chart of connection history."""
    fig, ax = plt.subplots(figsize=(12, 6), dpi=100)

    history = data['connections_pool']['history']
    hours = list(range(len(history)))

    ax.plot(hours, history, color=COLORS['amber'], linewidth=2.5, marker='s', markersize=6)
    ax.fill_between(hours, history, alpha=0.2, color=COLORS['amber'])

    ax.set_title('MySQL Connection History (24h)', fontsize=14, fontweight='bold', pad=20)
    ax.set_xlabel('Hour', fontsize=11)
    ax.set_ylabel('Active Connections', fontsize=11)
    ax.grid(True, alpha=GRID_ALPHA)
    ax.set_ylim(bottom=0)

    fig.tight_layout()
    save_chart(fig, output_dir / 'mysql_connections.png')


def mysql_schema_objects(data: Dict[str, Any], output_dir: Path):
    """Bar chart of schema object counts."""
    fig, ax = plt.subplots(figsize=(12, 6), dpi=100)

    schema = data['schema']
    keys = ['tables', 'views', 'procedures', 'triggers', 'events', 'functions']
    values = [schema.get(k, 0) for k in keys]
    labels = [k.title() for k in keys]

    colors_list = [COLORS['cyan'], COLORS['violet'], COLORS['amber'], COLORS['emerald'], COLORS['rose'], '#a78bfa']
    bars = ax.bar(labels, values, color=colors_list, edgecolor=TEXT_COLOR, linewidth=1.5)

    # Add value labels
    for bar, value in zip(bars, values):
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2., height,
                f'{value:,.0f}', ha='center', va='bottom', fontsize=10, fontweight='bold')

    ax.set_ylabel('Count', fontsize=11, fontweight='bold')
    ax.set_title('MySQL Schema Object Counts', fontsize=14, fontweight='bold', pad=20)
    ax.grid(True, alpha=GRID_ALPHA, axis='y')

    fig.tight_layout()
    save_chart(fig, output_dir / 'mysql_schema_objects.png')


def mysql_latency_trend(data: Dict[str, Any], output_dir: Path):
    """Line chart of latency history."""
    fig, ax = plt.subplots(figsize=(12, 6), dpi=100)

    latency_history = data['performance']['latency_history']
    hours = list(range(len(latency_history)))

    ax.plot(hours, latency_history, color=COLORS['rose'], linewidth=2.5, marker='^', markersize=6)
    ax.fill_between(hours, latency_history, alpha=0.2, color=COLORS['rose'])

    ax.set_title('MySQL Average Query Latency Trend (24h)', fontsize=14, fontweight='bold', pad=20)
    ax.set_xlabel('Hour', fontsize=11)
    ax.set_ylabel('Latency (ms)', fontsize=11)
    ax.grid(True, alpha=GRID_ALPHA)
    ax.set_ylim(bottom=0)

    fig.tight_layout()
    save_chart(fig, output_dir / 'mysql_latency_trend.png')


# ============================================================================
# MongoDB Charts
# ============================================================================

def mongo_operations(data: Dict[str, Any], output_dir: Path):
    """Multi-line: total/read/write ops history."""
    fig, ax = plt.subplots(figsize=(12, 6), dpi=100)

    ops_history = data['operations']['ops_history']
    read_history = data['operations']['read_history']
    write_history = data['operations']['write_history']
    hours = list(range(len(ops_history)))

    ax.plot(hours, ops_history, color=COLORS['cyan'], linewidth=2.5, marker='o', markersize=6, label='Total Ops')
    ax.plot(hours, read_history, color=COLORS['emerald'], linewidth=2.5, marker='s', markersize=6, label='Read Ops')
    ax.plot(hours, write_history, color=COLORS['rose'], linewidth=2.5, marker='^', markersize=6, label='Write Ops')

    ax.set_title('MongoDB Operations History (24h)', fontsize=14, fontweight='bold', pad=20)
    ax.set_xlabel('Hour', fontsize=11)
    ax.set_ylabel('Operations/sec', fontsize=11)
    ax.legend(loc='upper left', framealpha=0.95)
    ax.grid(True, alpha=GRID_ALPHA)
    ax.set_ylim(bottom=0)

    fig.tight_layout()
    save_chart(fig, output_dir / 'mongo_operations.png')


def mongo_ops_breakdown(data: Dict[str, Any], output_dir: Path):
    """Pie chart: read/write/command split."""
    fig, ax = plt.subplots(figsize=(10, 8), dpi=100)

    sizes = [
        data['operations']['read_ops_per_sec'],
        data['operations']['write_ops_per_sec'],
        data['operations']['command_ops_per_sec']
    ]
    labels = ['Read Ops', 'Write Ops', 'Command Ops']
    colors_list = [COLORS['emerald'], COLORS['rose'], COLORS['amber']]

    wedges, texts, autotexts = ax.pie(
        sizes, labels=labels, colors=colors_list, autopct='%1.1f%%',
        startangle=90, textprops={'fontsize': 11, 'weight': 'bold'}
    )

    for autotext in autotexts:
        autotext.set_color('white')
        autotext.set_fontsize(10)

    ax.set_title('MongoDB Operations Breakdown', fontsize=14, fontweight='bold', pad=20)

    fig.tight_layout()
    save_chart(fig, output_dir / 'mongo_ops_breakdown.png')


def mongo_latency_percentiles(data: Dict[str, Any], output_dir: Path):
    """Multi-line P50/P95/P99."""
    fig, ax = plt.subplots(figsize=(12, 6), dpi=100)

    p50 = data['latency']['p50_history']
    p95 = data['latency']['p95_history']
    p99 = data['latency']['p99_history']
    hours = list(range(len(p50)))

    ax.plot(hours, p50, color=COLORS['cyan'], label='P50', linewidth=2.5, marker='o', markersize=5)
    ax.plot(hours, p95, color=COLORS['amber'], label='P95', linewidth=2.5, marker='s', markersize=5)
    ax.plot(hours, p99, color=COLORS['rose'], label='P99', linewidth=2.5, marker='^', markersize=5)

    ax.set_title('MongoDB Latency Percentiles (24h)', fontsize=14, fontweight='bold', pad=20)
    ax.set_xlabel('Hour', fontsize=11)
    ax.set_ylabel('Latency (ms)', fontsize=11)
    ax.legend(loc='upper left', framealpha=0.95)
    ax.grid(True, alpha=GRID_ALPHA)
    ax.set_ylim(bottom=0)

    fig.tight_layout()
    save_chart(fig, output_dir / 'mongo_latency_percentiles.png')


def mongo_cpu_memory(data: Dict[str, Any], output_dir: Path):
    """Dual subplot: CPU + Memory."""
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6), dpi=100)

    cpu_history = data['system_resources']['cpu_history']
    mem_history = data['system_resources']['memory_history']
    hours = list(range(len(cpu_history)))

    # CPU subplot
    ax1.plot(hours, cpu_history, color=COLORS['cyan'], linewidth=2.5, marker='o', markersize=6)
    ax1.fill_between(hours, cpu_history, alpha=0.2, color=COLORS['cyan'])
    ax1.set_title('CPU Usage (%)', fontsize=12, fontweight='bold')
    ax1.set_xlabel('Hour', fontsize=10)
    ax1.set_ylabel('CPU %', fontsize=10)
    ax1.grid(True, alpha=GRID_ALPHA)
    ax1.set_ylim(0, 100)

    # Memory subplot
    ax2.plot(hours, mem_history, color=COLORS['violet'], linewidth=2.5, marker='s', markersize=6)
    ax2.fill_between(hours, mem_history, alpha=0.2, color=COLORS['violet'])
    ax2.set_title('Memory Usage (%)', fontsize=12, fontweight='bold')
    ax2.set_xlabel('Hour', fontsize=10)
    ax2.set_ylabel('Memory %', fontsize=10)
    ax2.grid(True, alpha=GRID_ALPHA)
    ax2.set_ylim(0, 100)

    fig.suptitle('MongoDB System Resources (24h)', fontsize=14, fontweight='bold', y=1.02)
    fig.tight_layout()
    save_chart(fig, output_dir / 'mongo_cpu_memory.png')


def mongo_wiredtiger_cache(data: Dict[str, Any], output_dir: Path):
    """Line chart of cache utilization."""
    fig, ax = plt.subplots(figsize=(12, 6), dpi=100)

    cache_history = data['wiredtiger']['cache_history']
    hours = list(range(len(cache_history)))

    ax.plot(hours, cache_history, color=COLORS['violet'], linewidth=2.5, marker='o', markersize=6)
    ax.fill_between(hours, cache_history, alpha=0.2, color=COLORS['violet'])

    ax.set_title('MongoDB WiredTiger Cache Utilization (24h)', fontsize=14, fontweight='bold', pad=20)
    ax.set_xlabel('Hour', fontsize=11)
    ax.set_ylabel('Utilization (%)', fontsize=11)
    ax.grid(True, alpha=GRID_ALPHA)
    ax.set_ylim(0, 100)

    fig.tight_layout()
    save_chart(fig, output_dir / 'mongo_wiredtiger_cache.png')


def mongo_shard_sizes(data: Dict[str, Any], output_dir: Path):
    """Horizontal bar: shard comparison."""
    fig, ax = plt.subplots(figsize=(12, 7), dpi=100)

    shards = data['sharding']['shards']
    names = [s['name'] for s in shards]
    sizes = [s['size_gb'] for s in shards]

    bars = ax.barh(names, sizes, color=COLORS['emerald'], edgecolor=TEXT_COLOR, linewidth=1.5)

    # Add value labels
    for i, (bar, size) in enumerate(zip(bars, sizes)):
        ax.text(size, bar.get_y() + bar.get_height()/2, f' {size:,.0f} GB',
                va='center', ha='left', fontsize=10, fontweight='bold')

    ax.set_xlabel('Size (GB)', fontsize=11, fontweight='bold')
    ax.set_title('MongoDB Shard Sizes', fontsize=14, fontweight='bold', pad=20)
    ax.grid(True, alpha=GRID_ALPHA, axis='x')
    ax.invert_yaxis()

    fig.tight_layout()
    save_chart(fig, output_dir / 'mongo_shard_sizes.png')


def mongo_database_sizes(data: Dict[str, Any], output_dir: Path):
    """Donut chart of database sizes."""
    fig, ax = plt.subplots(figsize=(10, 8), dpi=100)

    databases = data['storage']['databases']
    names = [d['name'] for d in databases]
    sizes = [d['size_gb'] for d in databases]
    colors_list = [COLORS['cyan'], COLORS['violet'], COLORS['amber'], COLORS['emerald'], COLORS['rose'], '#a78bfa']

    wedges, texts, autotexts = ax.pie(
        sizes, labels=names, colors=colors_list, autopct='%1.1f%%',
        startangle=90, textprops={'fontsize': 10, 'weight': 'bold'},
        pctdistance=0.85
    )

    # Create donut hole
    centre_circle = plt.Circle((0, 0), 0.70, fc=DARK_BG)
    ax.add_artist(centre_circle)

    for autotext in autotexts:
        autotext.set_color('white')
        autotext.set_fontsize(9)

    ax.set_title('MongoDB Database Sizes', fontsize=14, fontweight='bold', pad=20)

    fig.tight_layout()
    save_chart(fig, output_dir / 'mongo_database_sizes.png')


# ============================================================================
# Main Chart Generation Orchestration
# ============================================================================

def generate_all_charts(data_dir: Path, output_dir: Path):
    """Generate all charts."""
    setup_dark_theme()

    # Load data
    print("Loading metrics...")
    postgres_data = load_json_data(data_dir / 'postgres-metrics.json')
    mysql_data = load_json_data(data_dir / 'mysql-metrics.json')
    mongodb_data = load_json_data(data_dir / 'mongodb-metrics.json')

    charts_dir = output_dir / 'charts'

    # PostgreSQL charts
    print("\nGenerating PostgreSQL charts...")
    pg_connections_history(postgres_data, charts_dir)
    print("  ✓ pg_connections_history.png")

    pg_tps_history(postgres_data, charts_dir)
    print("  ✓ pg_tps_history.png")

    pg_latency_percentiles(postgres_data, charts_dir)
    print("  ✓ pg_latency_percentiles.png")

    pg_query_scan_types(postgres_data, charts_dir)
    print("  ✓ pg_query_scan_types.png")

    pg_wait_events(postgres_data, charts_dir)
    print("  ✓ pg_wait_events.png")

    pg_cpu_memory(postgres_data, charts_dir)
    print("  ✓ pg_cpu_memory.png")

    pg_disk_io(postgres_data, charts_dir)
    print("  ✓ pg_disk_io.png")

    pg_storage_breakdown(postgres_data, charts_dir)
    print("  ✓ pg_storage_breakdown.png")

    pg_top_tables(postgres_data, charts_dir)
    print("  ✓ pg_top_tables.png")

    # MySQL charts
    print("\nGenerating MySQL charts...")
    mysql_qps_tps(mysql_data, charts_dir)
    print("  ✓ mysql_qps_tps.png")

    mysql_command_breakdown(mysql_data, charts_dir)
    print("  ✓ mysql_command_breakdown.png")

    mysql_cpu_memory(mysql_data, charts_dir)
    print("  ✓ mysql_cpu_memory.png")

    mysql_buffer_pool(mysql_data, charts_dir)
    print("  ✓ mysql_buffer_pool.png")

    mysql_connections(mysql_data, charts_dir)
    print("  ✓ mysql_connections.png")

    mysql_schema_objects(mysql_data, charts_dir)
    print("  ✓ mysql_schema_objects.png")

    mysql_latency_trend(mysql_data, charts_dir)
    print("  ✓ mysql_latency_trend.png")

    # MongoDB charts
    print("\nGenerating MongoDB charts...")
    mongo_operations(mongodb_data, charts_dir)
    print("  ✓ mongo_operations.png")

    mongo_ops_breakdown(mongodb_data, charts_dir)
    print("  ✓ mongo_ops_breakdown.png")

    mongo_latency_percentiles(mongodb_data, charts_dir)
    print("  ✓ mongo_latency_percentiles.png")

    mongo_cpu_memory(mongodb_data, charts_dir)
    print("  ✓ mongo_cpu_memory.png")

    mongo_wiredtiger_cache(mongodb_data, charts_dir)
    print("  ✓ mongo_wiredtiger_cache.png")

    mongo_shard_sizes(mongodb_data, charts_dir)
    print("  ✓ mongo_shard_sizes.png")

    mongo_database_sizes(mongodb_data, charts_dir)
    print("  ✓ mongo_database_sizes.png")

    print(f"\nAll charts generated successfully! ({charts_dir})")
    return charts_dir


def main():
    """Entry point."""
    parser = argparse.ArgumentParser(
        description='Generate static chart images for database metrics.'
    )
    parser.add_argument(
        '--output-dir',
        type=Path,
        default=Path(__file__).parent.parent,
        help='Output directory (default: parent of scripts directory)'
    )

    args = parser.parse_args()

    # Derive data directory from output directory
    data_dir = args.output_dir / 'data'

    if not data_dir.exists():
        print(f"Error: Data directory not found: {data_dir}")
        sys.exit(1)

    try:
        generate_all_charts(data_dir, args.output_dir)
    except Exception as e:
        print(f"Error generating charts: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
