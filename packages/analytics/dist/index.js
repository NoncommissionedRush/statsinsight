"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeInsights = computeInsights;
exports.buildChartPayload = buildChartPayload;
function formatDeltaUnit(unit) {
    return unit === '%' ? ' percentuálne body' : '';
}
const SLOVAK_MONTHS = [
    'Január', 'Február', 'Marec', 'Apríl', 'Máj', 'Jún',
    'Júl', 'August', 'September', 'Október', 'November', 'December',
];
function formatPeriodLabel(label) {
    const m = label.match(/^(\d{4})-(\d{2})$/);
    if (m) {
        const month = parseInt(m[2], 10);
        if (month >= 1 && month <= 12)
            return `${SLOVAK_MONTHS[month - 1]} ${m[1]}`;
    }
    return label;
}
function subjectLabel(subject) {
    return subject || 'Hodnota';
}
// Masculine subjects require different verb endings in Slovak
const MASCULINE_SUBJECTS = new Set(['Dovoz', 'Vývoz', 'Index', 'Rast']);
function grammaticalGender(subject) {
    if (subject && MASCULINE_SUBJECTS.has(subject))
        return 'm';
    return 'f';
}
function periodDelta(points, unit, subject) {
    if (points.length < 2)
        return null;
    const curr = points[points.length - 1];
    const prev = points[points.length - 2];
    if (curr.value === null || prev.value === null)
        return null;
    const delta = curr.value - prev.value;
    const g = grammaticalGender(subject);
    const direction = delta >= 0
        ? (g === 'm' ? 'vzrástol' : 'vzrástla')
        : (g === 'm' ? 'klesol' : 'klesla');
    return {
        kind: 'period_delta',
        title: 'Posledná zmena',
        description: `${subjectLabel(subject)} ${direction} o ${Math.abs(delta).toFixed(2)}${formatDeltaUnit(unit)} z ${formatPeriodLabel(prev.label || prev.time)} na ${formatPeriodLabel(curr.label || curr.time)}.`,
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
    const direction = avgDelta >= 0 ? 'nárast' : 'pokles';
    return {
        kind: 'average_change',
        title: 'Priemerná zmena',
        description: `Priemerný ${direction}${subject ? ' (' + subject.toLowerCase() + ')' : ''} za obdobie bol ${Math.abs(avgDelta).toFixed(2)}${formatDeltaUnit(unit)} v rámci zvoleného rozsahu.`,
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
    const g = grammaticalGender(subject);
    const direction = pct >= 0
        ? (g === 'm' ? 'vzrástol' : 'vzrástla')
        : (g === 'm' ? 'klesol' : 'klesla');
    return {
        kind: 'pct_change',
        title: 'Percentuálna zmena',
        description: `${subjectLabel(subject)} ${direction} o ${Math.abs(pct).toFixed(1)}% z ${formatPeriodLabel(prev.label || prev.time)} na ${formatPeriodLabel(curr.label || curr.time)}.`,
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
    // Standard deviation
    const variance = recent.reduce((s, p) => s + (p.value - avg) ** 2, 0) / window;
    const stdDev = Math.sqrt(variance);
    if (stdDev === 0)
        return null;
    const deviation = (latest.value - avg) / stdDev;
    if (Math.abs(deviation) < 1)
        return null; // Only report if > 1 std dev
    const direction = deviation > 0 ? 'nad' : 'pod';
    return {
        kind: 'rolling_avg_deviation',
        title: 'Odchýlka od kĺzavého priemeru',
        description: `${grammaticalGender(subject) === 'm' ? 'Aktuálny' : 'Aktuálna'} ${subject ? subject.toLowerCase() : 'hodnota'} je ${Math.abs(deviation).toFixed(1)} smerodajných odchýlok ${direction} ${window}-obdobným priemerom (${avg.toFixed(2)}).`,
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
    // Check if sign changed in the last delta vs previous
    const lastSign = Math.sign(deltas[deltas.length - 1]);
    const prevSign = Math.sign(deltas[deltas.length - 2]);
    if (lastSign === 0 || prevSign === 0 || lastSign === prevSign)
        return null;
    const direction = lastSign > 0 ? 'klesajúci na rastúci' : 'rastúci na klesajúci';
    return {
        kind: 'trend_reversal',
        title: 'Zistený obrat trendu',
        description: `Trend hodnoty ${subjectLabel(subject)} sa obrátil z ${direction} v ${formatPeriodLabel(recent[recent.length - 1].label || recent[recent.length - 1].time)}.`,
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
        title: 'Najväčší pohyb v rozsahu',
        description: `${subjectLabel(subject)} ${grammaticalGender(subject) === 'm' ? 'sa zmenil' : 'sa zmenila'} o ${direction}${delta.toFixed(2)}${formatDeltaUnit(unit)} medzi ${formatPeriodLabel(from.label || from.time)} a ${formatPeriodLabel(to.label || to.time)}.`,
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
            (series.dimensions.geo === 'SK' ? 'Slovensko' : series.datasetLabel),
    };
}
