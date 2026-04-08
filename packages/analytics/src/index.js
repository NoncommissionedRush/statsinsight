"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeInsights = computeInsights;
exports.buildChartPayload = buildChartPayload;
function formatDeltaUnit(unit) {
    return unit === '%' ? ' percentage points' : '';
}
function subjectLabel(subject) {
    return subject || 'Value';
}
function periodDelta(points, unit, subject) {
    if (points.length < 2)
        return null;
    const curr = points[points.length - 1];
    const prev = points[points.length - 2];
    if (curr.value === null || prev.value === null)
        return null;
    const delta = curr.value - prev.value;
    const direction = delta >= 0 ? 'increased' : 'decreased';
    return {
        kind: 'period_delta',
        title: 'Latest Change',
        description: `${subjectLabel(subject)} ${direction} by ${Math.abs(delta).toFixed(2)}${formatDeltaUnit(unit)} from ${prev.label || prev.time} to ${curr.label || curr.time}.`,
        value: delta,
        period: curr.time,
    };
}
function averageChange(points, unit, subject) {
    if (points.length < 2)
        return null;
    const deltas = [];
    for (let i = 1; i < points.length; i++) {
        const curr = points[i].value;
        const prev = points[i - 1].value;
        if (curr === null || prev === null)
            continue;
        deltas.push(curr - prev);
    }
    if (deltas.length === 0)
        return null;
    const avgDelta = deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length;
    const direction = avgDelta >= 0 ? 'increase' : 'decrease';
    return {
        kind: 'average_change',
        title: 'Average Change',
        description: `Average ${subject ? subject.toLowerCase() + ' ' : ''}${direction} per period was ${Math.abs(avgDelta).toFixed(2)}${formatDeltaUnit(unit)} across the selected range.`,
        value: avgDelta,
        period: points[points.length - 1].time,
    };
}
function pctChange(points, subject) {
    if (points.length < 2)
        return null;
    const curr = points[points.length - 1];
    const prev = points[points.length - 2];
    if (curr.value === null || prev.value === null || prev.value === 0)
        return null;
    const pct = ((curr.value - prev.value) / Math.abs(prev.value)) * 100;
    const direction = pct >= 0 ? 'up' : 'down';
    return {
        kind: 'pct_change',
        title: 'Percentage Change',
        description: `${subjectLabel(subject)} was ${direction === 'up' ? 'up' : 'down'} ${Math.abs(pct).toFixed(1)}% from the previous period.`,
        value: pct,
        period: curr.time,
    };
}
function rollingAvgDeviation(points, window = 6, subject) {
    const valid = points.filter((p) => p.value !== null);
    if (valid.length < window + 1)
        return null;
    const recent = valid.slice(-window);
    const avg = recent.reduce((s, p) => s + p.value, 0) / window;
    const latest = valid[valid.length - 1];
    if (latest.value === null)
        return null;
    const variance = recent.reduce((s, p) => s + (p.value - avg) ** 2, 0) / window;
    const stdDev = Math.sqrt(variance);
    if (stdDev === 0)
        return null;
    const deviation = (latest.value - avg) / stdDev;
    if (Math.abs(deviation) < 1)
        return null;
    const direction = deviation > 0 ? 'above' : 'below';
    return {
        kind: 'rolling_avg_deviation',
        title: 'Rolling Average Deviation',
        description: `Current ${subject ? subject.toLowerCase() : 'value'} is ${Math.abs(deviation).toFixed(1)} standard deviations ${direction} the ${window}-period average (${avg.toFixed(2)}).`,
        value: deviation,
        period: latest.time,
    };
}
function trendReversal(points, subject) {
    const valid = points.filter((p) => p.value !== null);
    if (valid.length < 4)
        return null;
    const recent = valid.slice(-4);
    const deltas = [];
    for (let i = 1; i < recent.length; i++) {
        deltas.push(recent[i].value - recent[i - 1].value);
    }
    const lastSign = Math.sign(deltas[deltas.length - 1]);
    const prevSign = Math.sign(deltas[deltas.length - 2]);
    if (lastSign === 0 || prevSign === 0 || lastSign === prevSign)
        return null;
    const direction = lastSign > 0 ? 'declining to rising' : 'rising to declining';
    return {
        kind: 'trend_reversal',
        title: 'Trend Reversal Detected',
        description: `${subjectLabel(subject)} trend reversed from ${direction} at ${recent[recent.length - 1].label || recent[recent.length - 1].time}.`,
        period: recent[recent.length - 1].time,
    };
}
function largestMove(points, unit, subject) {
    const valid = points.filter((p) => p.value !== null);
    if (valid.length < 2)
        return null;
    let maxAbsDelta = 0;
    let maxIdx = -1;
    for (let i = 1; i < valid.length; i++) {
        const delta = Math.abs(valid[i].value - valid[i - 1].value);
        if (delta > maxAbsDelta) {
            maxAbsDelta = delta;
            maxIdx = i;
        }
    }
    if (maxIdx === -1 || maxAbsDelta === 0)
        return null;
    const from = valid[maxIdx - 1];
    const to = valid[maxIdx];
    const delta = to.value - from.value;
    const direction = delta >= 0 ? '+' : '';
    return {
        kind: 'largest_move',
        title: 'Largest Move in Range',
        description: `${subjectLabel(subject)} moved ${direction}${delta.toFixed(2)}${formatDeltaUnit(unit)} between ${from.label || from.time} and ${to.label || to.time}.`,
        value: delta,
        period: to.time,
    };
}
function computeInsights(points, unit, subject) {
    const valid = points.filter((p) => p.value !== null);
    if (valid.length < 2)
        return [];
    const insights = [];
    const fns = [
        periodDelta,
        averageChange,
        (seriesPoints, _unit, seriesSubject) => pctChange(seriesPoints, seriesSubject),
        (seriesPoints, _unit, seriesSubject) => rollingAvgDeviation(seriesPoints, 6, seriesSubject),
        (seriesPoints, _unit, seriesSubject) => trendReversal(seriesPoints, seriesSubject),
        largestMove,
    ];
    for (const fn of fns) {
        const result = fn(valid, unit, subject);
        if (result)
            insights.push(result);
    }
    return insights;
}
function buildChartPayload(series) {
    return {
        labels: series.points.map((p) => p.label || p.time),
        values: series.points.map((p) => p.value),
        unit: series.unit,
        title: series.datasetLabel,
        primarySeriesName: series.dimensions.displaySeries ||
            (series.dimensions.geo === 'SK' ? 'Slovakia' : series.datasetLabel),
    };
}
//# sourceMappingURL=index.js.map