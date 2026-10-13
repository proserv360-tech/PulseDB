import React from 'react';

/**
 * SkeletonLoader.jsx
 * Reusable skeleton loading components with TailwindCSS animations
 * Used for displaying placeholder content while data is loading
 */

export function SkeletonLoader({ rows = 3, className = '' }) {
    return (
        <div className={`space-y-4 ${className}`}>
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="animate-pulse">
                    <div className="h-4 bg-white/[0.06] rounded-lg w-full mb-2" />
                    <div className="h-3 bg-white/[0.04] rounded-lg w-3/4" />
                </div>
            ))}
        </div>
    );
}

export function MetricCardSkeleton() {
    return (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6 animate-pulse">
            <div className="h-3 bg-white/[0.06] rounded w-1/3 mb-4" />
            <div className="h-8 bg-white/[0.08] rounded w-1/2 mb-2" />
            <div className="h-3 bg-white/[0.04] rounded w-2/3" />
        </div>
    );
}

export function ChartSkeleton({ height = 200 }) {
    return (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6 animate-pulse">
            <div className="h-3 bg-white/[0.06] rounded w-1/4 mb-4" />
            <div
                className="bg-white/[0.04] rounded-xl"
                style={{ height }}
            />
        </div>
    );
}

export function TableSkeleton({ rows = 5 }) {
    return (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
            {/* Header */}
            <div className="px-6 py-3 border-b border-white/[0.06] flex gap-8">
                {[1, 2, 3, 4].map(i => (
                    <div
                        key={i}
                        className="h-3 bg-white/[0.08] rounded w-20 animate-pulse"
                    />
                ))}
            </div>

            {/* Rows */}
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="px-6 py-3 border-b border-white/[0.04] flex gap-8 animate-pulse">
                    {[1, 2, 3, 4].map(j => (
                        <div
                            key={j}
                            className="h-3 bg-white/[0.04] rounded w-20"
                            style={{ animationDelay: `${i * 100}ms` }}
                        />
                    ))}
                </div>
            ))}
        </div>
    );
}

/**
 * Generic Skeleton component for custom dimensions
 */
export function Skeleton({
    width = '100%',
    height = '100%',
    className = '',
    animated = true,
}) {
    return (
        <div
            className={`bg-white/[0.06] rounded-lg ${animated ? 'animate-pulse' : ''} ${className}`}
            style={{ width, height }}
        />
    );
}

/**
 * Grid of skeleton cards
 */
export function SkeletonGrid({ count = 6, columns = 3 }) {
    return (
        <div
            className={`grid gap-4`}
            style={{
                gridTemplateColumns: `repeat(${columns}, 1fr)`,
            }}
        >
            {Array.from({ length: count }).map((_, i) => (
                <MetricCardSkeleton key={i} />
            ))}
        </div>
    );
}

export default SkeletonLoader;
