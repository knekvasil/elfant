"""Calibration — fit features to post-season grades.

Takes the audit dataset (projection features + actual points per completed
season) and fits a ridge regression predicting actual fantasy points from the
projection features. The sample is tiny (a few completed seasons of one
league), so the only honest evaluation is train-on-one-season /
test-on-the-other; we report both directions and compare against the raw
projection as a baseline.

Deliberately dependency-free: a closed-form ridge solver in pure Python.
"""

from __future__ import annotations

import csv
import math

POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"]
KINDS = ["vet", "rookie", "unknown"]

RIDGE_ALPHA = 1.0

_FEATURE_COLS = (
    "projected_points", "base_points", "games", "confidence", "age",
    "draft_round", "seasons_used",
    "attempts", "carries", "targets", "receptions",
    "passing_yards", "rushing_yards", "receiving_yards",
    "passing_tds", "rushing_tds", "receiving_tds",
)

_STAT_FEATURE_KEYS = (
    "attempts", "carries", "targets", "receptions",
    "passing_yards", "rushing_yards", "receiving_yards",
    "passing_tds", "rushing_tds", "receiving_tds",
)


def load_rows_from_players(players: list[dict]) -> list[dict]:
    """Flatten audit player rows (nested statline/usage) into feature rows."""
    out = []
    for p in players:
        stat = p.get("statline") or {}
        usage = p.get("usage") or {}
        row = {
            "position": (p.get("position") or "").strip(),
            "kind": (p.get("kind") or "unknown").strip(),
            "actual_points": float(p.get("actual_points") or 0),
            "actual_games": float(p.get("actual_games") or 0),
        }
        for col in _FEATURE_COLS:
            row[col] = 0.0
        for col in ("projected_points", "base_points", "games", "confidence",
                    "age", "draft_round"):
            row[col] = float(p.get(col) or 0)
        row["seasons_used"] = float(usage.get("seasons_used", 0) or 0)
        for key in _STAT_FEATURE_KEYS:
            row[key] = float(stat.get(key, 0) or 0)
        out.append(row)
    return out


def load_rows(path: str) -> list[dict]:
    """Read an audit CSV into dict rows (numbers coerced)."""
    with open(path, newline="") as fh:
        raw = list(csv.DictReader(fh))
    out = []
    for r in raw:
        row = dict(r)
        for col in _FEATURE_COLS:
            row[col] = float(r.get(col) or 0)
        row["actual_points"] = float(r.get("actual_points") or 0)
        row["actual_games"] = float(r.get("actual_games") or 0)
        row["position"] = (r.get("position") or "").strip()
        row["kind"] = (r.get("kind") or "unknown").strip()
        out.append(row)
    return out


def _features(row: dict) -> list[float]:
    """One feature vector per player row."""
    return (
        [1.0 if row["position"] == p else 0.0 for p in POSITIONS]
        + [1.0 if row["kind"] == k else 0.0 for k in KINDS]
        + [row[c] for c in _FEATURE_COLS]
    )


def _solve(a: list[list[float]], b: list[float]) -> list[float]:
    """Solve Ax=b via Gaussian elimination with partial pivoting."""
    n = len(a)
    m = [row[:] + [b[i]] for i, row in enumerate(a)]
    for col in range(n):
        pivot = max(range(col, n), key=lambda r: abs(m[r][col]))
        if abs(m[pivot][col]) < 1e-12:
            continue
        m[col], m[pivot] = m[pivot], m[col]
        for r in range(col + 1, n):
            f = m[r][col] / m[col][col]
            for c in range(col, n + 1):
                m[r][c] -= f * m[col][c]
    x = [0.0] * n
    for i in range(n - 1, -1, -1):
        s = m[i][n] - sum(m[i][j] * x[j] for j in range(i + 1, n))
        x[i] = s / m[i][i] if m[i][i] else 0.0
    return x


def fit_ridge(rows: list[dict], alpha: float = RIDGE_ALPHA) -> tuple[list[float], list[str]]:
    """Fit ridge weights on feature rows; returns (weights, feature names)."""
    names = (
        [f"pos:{p}" for p in POSITIONS]
        + [f"kind:{k}" for k in KINDS]
        + list(_FEATURE_COLS)
    )
    X = [_features(r) for r in rows]
    y = [r["actual_points"] for r in rows]
    n = len(X)
    p = len(X[0])
    XtX = [[sum(X[k][i] * X[k][j] for k in range(n)) for j in range(p)] for i in range(p)]
    Xty = [sum(X[k][i] * y[k] for k in range(n)) for i in range(p)]
    for i in range(p):
        XtX[i][i] += alpha
    return _solve(XtX, Xty), names


def predict(rows: list[dict], weights: list[float]) -> list[float]:
    return [sum(w * v for w, v in zip(weights, _features(r))) for r in rows]


def _error_metrics(actual: list[float], pred: list[float]) -> dict:
    n = len(actual)
    if n == 0:
        return {}
    err = [a - p for a, p in zip(actual, pred)]
    mean_actual = sum(actual) / n
    ss_res = sum(e * e for e in err)
    ss_tot = sum((a - mean_actual) ** 2 for a in actual)
    r2 = 1.0 - ss_res / ss_tot if ss_tot else 0.0
    return {
        "n": n,
        "mae": round(sum(abs(e) for e in err) / n, 2),
        "rmse": round(math.sqrt(ss_res / n), 2),
        "r2": round(r2, 4),
    }


def evaluate(
    train_rows: list[dict],
    test_rows: list[dict],
) -> dict:
    """Fit on ``train_rows``, score on ``test_rows`` vs the raw projection."""
    weights, names = fit_ridge(train_rows)
    actual = [r["actual_points"] for r in test_rows]
    baseline = [r["projected_points"] for r in test_rows]
    model = predict(test_rows, weights)
    return {
        "baseline": _error_metrics(actual, baseline),
        "model": _error_metrics(actual, model),
        "weights": list(zip(names, [round(w, 4) for w in weights])),
    }


def cross_validate(rows_by_season: dict[int, list[dict]]) -> dict:
    """Train on each season, test on the other(s); report every direction."""
    seasons = sorted(rows_by_season)
    directions = {}
    for train in seasons:
        for test in seasons:
            if train == test:
                continue
            res = evaluate(rows_by_season[train], rows_by_season[test])
            directions[f"{train}->{test}"] = res
    return directions


def leave_one_out(rows_by_season: dict[int, list[dict]], top_n: int | None = None) -> dict:
    """Leave-one-season-out CV: for each season, train on all the others and
    score on the held-out one.

    With ``top_n``, each season's rows are first trimmed to the top-N by
    projected points (draft-relevant subset).

    Returns ``{"folds": {season: {...}}, "pooled": {...}}`` where each fold
    carries ``baseline``/``model`` metrics plus the per-fold predictions, and
    ``pooled`` aggregates the raw predictions across every fold (one out-of-
    sample prediction per row).
    """
    seasons = sorted(rows_by_season)
    if top_n is not None:
        rows_by_season = {s: _top_n(rs, top_n) for s, rs in rows_by_season.items()}
    folds = {}
    for test in seasons:
        train = [r for s in seasons if s != test for r in rows_by_season[s]]
        weights, names = fit_ridge(train)
        test_rows = rows_by_season[test]
        actual = [r["actual_points"] for r in test_rows]
        baseline_pred = [r["projected_points"] for r in test_rows]
        model_pred = predict(test_rows, weights)
        folds[str(test)] = {
            "baseline": _error_metrics(actual, baseline_pred),
            "model": _error_metrics(actual, model_pred),
            "weights": list(zip(names, [round(w, 4) for w in weights])),
            "actual": actual,
            "baseline_pred": baseline_pred,
            "model_pred": model_pred,
        }

    actual = [v for f in folds.values() for v in f["actual"]]
    baseline_pred = [v for f in folds.values() for v in f["baseline_pred"]]
    model_pred = [v for f in folds.values() for v in f["model_pred"]]
    return {
        "folds": folds,
        "pooled": {
            "n": len(actual),
            "baseline": _error_metrics(actual, baseline_pred),
            "model": _error_metrics(actual, model_pred),
        },
    }


def _top_n(rows: list[dict], n: int) -> list[dict]:
    return sorted(rows, key=lambda r: -r["projected_points"])[:n]


def summarize(rows_by_season: dict[int, list[dict]], top_n: int | None = None) -> dict:
    """Cross-validated summary, optionally on the top-N projected players."""
    if top_n is not None:
        rows_by_season = {s: _top_n(rs, top_n) for s, rs in rows_by_season.items()}
    return cross_validate(rows_by_season)