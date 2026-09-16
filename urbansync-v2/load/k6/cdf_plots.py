"""S8: CDF plots + p50/p95/p99 tables from raw k6 --out json files (*.json.gz).

Usage (from urbansync-v2/): python load/k6/cdf_plots.py docs/evidence/sla
Writes <today>-cdf-*.png and <today>-k6-percentiles.md into the same directory.
Curves pool all runs of a scenario; tables report each run and the median of the runs.
Percentiles use numpy's linear interpolation, so they can differ slightly from k6's own summary.

Timing artifact filter: k6 run under WSL2 recorded ~0.6% of requests with http_req_waiting == 0
(first byte "before" the request was sent), giving impossible sub-millisecond durations over the
internet. Those points are dropped and counted per run. k6 on the VM (cold-start runs) had none.
"""
import datetime
import glob
import gzip
import json
import os
import re
import sys
from collections import defaultdict
from statistics import median

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

DIR = sys.argv[1] if len(sys.argv) > 1 else "docs/evidence/sla"
TODAY = datetime.date.today().isoformat()

# Reference palette (dataviz skill), light mode, validated for 4 adjacent slots.
SURFACE, INK, INK2, GRID = "#fcfcfb", "#0b0b0b", "#52514e", "#e6e5e0"
SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"]
PCTS = (50, 95, 99)


DROPPED = {}  # file -> count of zero-waiting artifacts removed


def load(pattern, pick):
    """{run: {key: [ms, ...]}} for every file matching pattern; pick(point) -> key or None."""
    out = {}
    for f in sorted(glob.glob(os.path.join(DIR, pattern))):
        run = re.search(r"-run(\d)\.json\.gz$", f).group(1)
        points, waiting = [], {}
        for line in gzip.open(f, "rt"):
            d = json.loads(line)
            if d.get("type") != "Point":
                continue
            ident = (d["data"]["time"], d["data"]["tags"].get("name"))
            if d["metric"] == "http_req_waiting":
                waiting[ident] = d["data"]["value"]
            key = pick(d)
            if key:
                points.append((key, d["data"]["value"], ident))
        vals = defaultdict(list)
        dropped = 0
        for key, value, ident in points:
            if waiting.get(ident, 1) == 0:   # same request (time + url) had zero waiting: artifact
                dropped += 1
                continue
            vals[key].append(value)
        DROPPED[os.path.basename(f)] = dropped
        out[run] = vals
    return out


def baseline_key(d):
    t = d["data"]["tags"]
    if d["metric"] != "http_req_duration" or t.get("group") == "::setup":
        return None
    return "/api/" + t["name"].split("/api/", 1)[1]


def cold_key(d):
    return {"knative_cold_start_ms": "first request after idle", "knative_warm_ms": "warm"}.get(d["metric"])


def style(ax, title, xlabel):
    ax.set_facecolor(SURFACE)
    ax.figure.set_facecolor(SURFACE)
    ax.set_xscale("log")
    ax.set_ylim(0, 1.0)
    ax.yaxis.set_major_formatter(matplotlib.ticker.PercentFormatter(1.0))
    ax.xaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(
        lambda v, _: f"{v / 1000:g} s" if v >= 1000 else f"{v:g} ms"))
    for y in (0.5, 0.95, 0.99):
        ax.axhline(y, color=GRID, lw=1, zorder=0)
        ax.text(1.005, y, f"p{round(y * 100)}", transform=ax.get_yaxis_transform(),
                va="center", ha="left", fontsize=8, color=INK2)
    ax.grid(axis="x", color=GRID, lw=1)
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    for s in ("left", "bottom"):
        ax.spines[s].set_color(GRID)
    ax.tick_params(colors=INK2, labelsize=9)
    ax.set_title(title, loc="left", fontsize=12, color=INK, pad=12)
    ax.set_xlabel(xlabel, color=INK2, fontsize=9)
    ax.set_ylabel("share of requests at or below", color=INK2, fontsize=9)


def cdf(ax, values, color, label, label_q=0.5, marker=None, left=False):
    x = np.sort(values)
    y = np.arange(1, len(x) + 1) / len(x)
    ax.step(x, y, where="post", color=color, lw=2, label=label,
            marker=marker, markersize=6, markeredgecolor=SURFACE, markeredgewidth=1.5,
            solid_capstyle="round", zorder=3)
    xi = x[min(np.searchsorted(y, label_q), len(x) - 1)]   # direct label, staggered per series
    ax.annotate(label, (xi, label_q), xytext=(-8 if left else 8, -4), textcoords="offset points",
                ha="right" if left else "left", fontsize=8, color=INK, zorder=4)


def table(title, runs):
    """Markdown rows: each key × each run, then the median of the runs."""
    keys = sorted({k for r in runs.values() for k in r})
    lines = [f"\n### {title}\n", "| Series | Run | n | p50 | p95 | p99 |", "|---|---|---|---|---|---|"]
    fmt = lambda v: f"{v / 1000:.2f} s" if v >= 1000 else f"{v:.1f} ms"
    for k in keys:
        per_run = []
        for run, vals in sorted(runs.items()):
            if k not in vals:
                continue
            p = np.percentile(vals[k], PCTS)
            per_run.append(p)
            lines.append(f"| {k} | {run} | {len(vals[k])} | " + " | ".join(fmt(v) for v in p) + " |")
        med = [median(p[i] for p in per_run) for i in range(3)]
        lines.append(f"| **{k}** | **median of {len(per_run)}** | | " + " | ".join(f"**{fmt(v)}**" for v in med) + " |")
    return lines


def pooled(runs, key):
    return [v for r in runs.values() for v in r.get(key, [])]


md = [f"# k6 percentiles (S8), generated {TODAY}", "",
      "Generated by `load/k6/cdf_plots.py` from the raw `*.json.gz` k6 outputs in this directory.",
      "p50/p95/p99 per run, then the median of the per-run values. Numpy linear interpolation."]

baseline = load("*-baseline-run[0-9].json.gz", baseline_key)
if baseline:
    fig, ax = plt.subplots(figsize=(8, 4.8), dpi=150)
    for i, ep in enumerate(["/api/login", "/api/buildings", "/api/apartments", "/api/expenses"]):
        cdf(ax, pooled(baseline, ep), SERIES[i], ep, label_q=(0.3, 0.9, 0.7, 0.8)[i], left=(i == 3))
    style(ax, f"Baseline load (k6, up to 60 VUs), latency per endpoint, {len(baseline)} runs pooled",
          "response time (log scale)")
    ax.legend(frameon=False, fontsize=8, loc="lower right", labelcolor=INK)
    fig.tight_layout()
    fig.savefig(os.path.join(DIR, f"{TODAY}-cdf-baseline-endpoints.png"), facecolor=SURFACE)

    fig, ax = plt.subplots(figsize=(8, 4.8), dpi=150)
    for i, (run, vals) in enumerate(sorted(baseline.items())):
        cdf(ax, vals["/api/login"], SERIES[i], f"run {run}", label_q=(0.25, 0.5, 0.75)[i])
    style(ax, "Baseline load, POST /api/login, run to run repeatability", "response time (log scale)")
    ax.legend(frameon=False, fontsize=8, loc="lower right", labelcolor=INK)
    fig.tight_layout()
    fig.savefig(os.path.join(DIR, f"{TODAY}-cdf-baseline-login-runs.png"), facecolor=SURFACE)
    md += table("Baseline: http_req_duration per endpoint", baseline)

cold = {s: load(f"*-coldstart-{s}-run[0-9].json.gz", cold_key) for s in ("minscale0", "minscale1")}
if any(cold.values()):
    fig, ax = plt.subplots(figsize=(8, 4.8), dpi=150)
    # (label quantile, label on the left) per slot, chosen so the four direct labels don't collide
    placement = [(0.35, False), (0.6, False), (0.3, False), (0.85, True)]
    slot = 0
    for scen, runs in cold.items():
        for series in ("first request after idle", "warm"):
            if runs:
                q, left = placement[slot]
                cdf(ax, pooled(runs, series), SERIES[slot], f"min-scale {scen[-1]}, {series}", label_q=q,
                    left=left, marker="o" if series != "warm" else None)
            slot += 1
    style(ax, "Knative receipt-annotator GET /health: cold start vs warm", "response time (log scale)")
    ax.legend(frameon=False, fontsize=8, loc="lower right", labelcolor=INK)
    fig.tight_layout()
    fig.savefig(os.path.join(DIR, f"{TODAY}-cdf-coldstart.png"), facecolor=SURFACE)
    for scen, runs in cold.items():
        if runs:
            md += table(f"Cold start, {scen}", runs)

md += ["\n### Runs\n", "| File | Requests | Failed | req/s | Dropped (waiting = 0) |", "|---|---|---|---|---|"]
for f, dropped in DROPPED.items():
    m = json.load(open(os.path.join(DIR, f.replace(".json.gz", "-summary.json"))))["metrics"]
    md.append(f"| {f} | {m['http_reqs']['count']} | {m['http_req_failed']['passes']} | "
              f"{m['http_reqs']['rate']:.1f} | {dropped} |")
open(os.path.join(DIR, f"{TODAY}-k6-percentiles.md"), "w", encoding="utf-8").write("\n".join(md) + "\n")
print("wrote", sorted(os.path.basename(p) for p in glob.glob(os.path.join(DIR, f"{TODAY}-cdf-*.png"))))
