export const fmtDuration = (ms) => {
    if (ms == null) return '—';
    const n = Number(ms);
    if (n >= 86400000) return `${(n / 86400000).toFixed(1)}d`;
    if (n >= 3600000) return `${(n / 3600000).toFixed(1)}h`;
    if (n >= 60000) return `${(n / 60000).toFixed(1)}m`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}s`;
    if (n >= 1) return `${n.toFixed(1)}ms`;
    return `${(n * 1000).toFixed(0)}μs`;
};

export const fmtBytes = (bytes) => {
    if (bytes == null) return '—';
    const n = Number(bytes);
    if (n >= 1099511627776) return `${(n / 1099511627776).toFixed(1)} TB`;
    if (n >= 1073741824) return `${(n / 1073741824).toFixed(1)} GB`;
    if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`;
    if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${n} B`;
};

export const fmtNum = (n) => {
    if (n == null) return '—';
    const v = Number(n);
    if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
    if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
    return String(v);
};

export const fmtPct = (v, d = 1) => v == null ? '—' : `${Number(v).toFixed(d)}%`;
