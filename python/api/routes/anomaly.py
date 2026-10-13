"""Anomaly detection endpoints.

Statistical anomaly detection on FATHOM metric time-series — rolling z-score,
exponentially-weighted moving averages (EWMA), and a simple hour-of-week
seasonal residual. Deliberately statistics-based (no model training) so it
works out-of-the-box on day one of a workspace's history.

Endpoints:
    POST /api/anomaly/detect       - detect anomalies in a series
    POST /api/anomaly/baseline     - compute a baseline summary
    POST /api/anomaly/forecast     - simple forecast for near-term horizon
"""

from __future__ import annotations

import math
from datetime import datetime
from typing import List

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/anomaly", tags=["anomaly"])


class Point(BaseModel):
    t: datetime
    v: float


class DetectRequest(BaseModel):
    """A series plus detector parameters."""
    points: List[Point] = Field(..., min_length=20)
    method: str = Field(
        "zscore",
        description="zscore | ewma | seasonal",
    )
    window: int = Field(60, description="Rolling window size (samples)")
    threshold: float = Field(
        3.0,
        description="Anomaly threshold in standard deviations (zscore/ewma)",
    )
    seasonality: str = Field(
        "hour_of_week",
        description="Only used when method='seasonal'",
    )


class Anomaly(BaseModel):
    t: datetime
    v: float
    score: float
    expected: float
    reason: str


class DetectResponse(BaseModel):
    method: str
    count: int
    anomalies: List[Anomaly]


@router.post("/detect", response_model=DetectResponse)
def detect(req: DetectRequest) -> DetectResponse:
    values = [p.v for p in req.points]
    if req.method == "zscore":
        anomalies = _detect_zscore(req.points, values, req.window, req.threshold)
    elif req.method == "ewma":
        anomalies = _detect_ewma(req.points, values, req.window, req.threshold)
    elif req.method == "seasonal":
        anomalies = _detect_seasonal(req.points, req.threshold)
    else:
        anomalies = []
    return DetectResponse(
        method=req.method,
        count=len(anomalies),
        anomalies=anomalies,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Rolling z-score
# ─────────────────────────────────────────────────────────────────────────────
def _detect_zscore(points, values, window, threshold) -> list[Anomaly]:
    out: list[Anomaly] = []
    for i in range(len(values)):
        if i < window:
            continue
        sample = values[i - window : i]
        mean = sum(sample) / len(sample)
        var = sum((x - mean) ** 2 for x in sample) / max(len(sample) - 1, 1)
        std = math.sqrt(var)
        if std == 0:
            continue
        score = abs(values[i] - mean) / std
        if score >= threshold:
            out.append(Anomaly(
                t=points[i].t, v=values[i], score=score,
                expected=mean,
                reason=f"|x-µ|/σ = {score:.2f} (threshold {threshold})",
            ))
    return out


# ─────────────────────────────────────────────────────────────────────────────
# EWMA + residual scoring
# Alpha is fixed relative to window size for predictable smoothing.
# ─────────────────────────────────────────────────────────────────────────────
def _detect_ewma(points, values, window, threshold) -> list[Anomaly]:
    if not values:
        return []
    alpha = 2.0 / (window + 1)
    ewma = values[0]
    ewstd = 0.0
    out: list[Anomaly] = []
    for i, v in enumerate(values):
        diff = v - ewma
        ewma = ewma + alpha * diff
        ewstd = (1 - alpha) * (ewstd + alpha * diff * diff)
        std = math.sqrt(max(ewstd, 0))
        if i < window or std == 0:
            continue
        score = abs(v - ewma) / std
        if score >= threshold:
            out.append(Anomaly(
                t=points[i].t, v=v, score=score,
                expected=ewma,
                reason=f"EWMA residual {score:.2f}σ",
            ))
    return out


# ─────────────────────────────────────────────────────────────────────────────
# Seasonal residual: subtract the mean for the matching hour-of-week,
# then threshold the residual by its own standard deviation.
# ─────────────────────────────────────────────────────────────────────────────
def _detect_seasonal(points, threshold) -> list[Anomaly]:
    buckets: dict[int, list[float]] = {}
    for p in points:
        key = p.t.weekday() * 24 + p.t.hour
        buckets.setdefault(key, []).append(p.v)
    means = {k: sum(vs) / len(vs) for k, vs in buckets.items()}
    # Global residual std for thresholding.
    residuals = [p.v - means[p.t.weekday() * 24 + p.t.hour] for p in points]
    mean_r = sum(residuals) / len(residuals)
    var_r = sum((r - mean_r) ** 2 for r in residuals) / max(len(residuals) - 1, 1)
    std_r = math.sqrt(var_r)
    if std_r == 0:
        return []
    out: list[Anomaly] = []
    for i, p in enumerate(points):
        key = p.t.weekday() * 24 + p.t.hour
        expected = means[key]
        resid = p.v - expected
        score = abs(resid - mean_r) / std_r
        if score >= threshold:
            out.append(Anomaly(
                t=p.t, v=p.v, score=score,
                expected=expected,
                reason=f"seasonal residual {score:.2f}σ at {key // 24}/{key % 24}:00",
            ))
    return out


# ─────────────────────────────────────────────────────────────────────────────
# Baseline summary (stable floor/ceiling for a given window).
# ─────────────────────────────────────────────────────────────────────────────
class BaselineRequest(BaseModel):
    points: List[Point]


class BaselineResponse(BaseModel):
    count: int
    mean: float
    std: float
    p05: float
    p50: float
    p95: float
    p99: float


@router.post("/baseline", response_model=BaselineResponse)
def baseline(req: BaselineRequest) -> BaselineResponse:
    vs = sorted(p.v for p in req.points)
    n = len(vs)
    if n == 0:
        return BaselineResponse(count=0, mean=0, std=0, p05=0, p50=0, p95=0, p99=0)
    mean = sum(vs) / n
    var = sum((x - mean) ** 2 for x in vs) / max(n - 1, 1)
    def q(p):
        idx = max(0, min(n - 1, int(p * (n - 1))))
        return vs[idx]
    return BaselineResponse(
        count=n, mean=mean, std=math.sqrt(var),
        p05=q(0.05), p50=q(0.50), p95=q(0.95), p99=q(0.99),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Very simple forecast — last EWMA + linear trend from last `window` points.
# Intentionally naive; the goal is a sane near-term projection, not a model.
# ─────────────────────────────────────────────────────────────────────────────
class ForecastRequest(BaseModel):
    points: List[Point]
    horizon: int = Field(12, description="How many steps to project")
    window: int = Field(60)


class ForecastPoint(BaseModel):
    step: int
    value: float
    lower: float
    upper: float


class ForecastResponse(BaseModel):
    forecast: List[ForecastPoint]


@router.post("/forecast", response_model=ForecastResponse)
def forecast(req: ForecastRequest) -> ForecastResponse:
    vals = [p.v for p in req.points]
    if len(vals) < 2:
        return ForecastResponse(forecast=[])
    window = min(req.window, len(vals))
    alpha = 2.0 / (window + 1)
    level = vals[0]
    trend = 0.0
    for v in vals:
        prev_level = level
        level = alpha * v + (1 - alpha) * (level + trend)
        trend = alpha * (level - prev_level) + (1 - alpha) * trend
    # Band: use sample std of residuals over the window.
    residuals = []
    lev, t = vals[0], 0.0
    for v in vals[-window:]:
        prev = lev
        lev = alpha * v + (1 - alpha) * (lev + t)
        t = alpha * (lev - prev) + (1 - alpha) * t
        residuals.append(v - lev)
    mean_r = sum(residuals) / len(residuals)
    var_r = sum((r - mean_r) ** 2 for r in residuals) / max(len(residuals) - 1, 1)
    std_r = math.sqrt(var_r)
    out = []
    for i in range(1, req.horizon + 1):
        pt = level + i * trend
        out.append(ForecastPoint(step=i, value=pt, lower=pt - 2 * std_r, upper=pt + 2 * std_r))
    return ForecastResponse(forecast=out)
