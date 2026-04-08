"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchEurostat = fetchEurostat;
const jsonstat_1 = require("./jsonstat");
const BASE_URL = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data';
async function fetchEurostat(datasetCode, filters) {
    const params = new URLSearchParams({ lang: 'EN', ...filters });
    const url = `${BASE_URL}/${datasetCode}?${params}`;
    const res = await fetch(url);
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Eurostat API error ${res.status}: ${text.slice(0, 200)}`);
    }
    const raw = await res.json();
    const timeDimIds = (0, jsonstat_1.detectTimeDimensions)(raw);
    const points = (0, jsonstat_1.parseJsonStat)(raw, { timeDimIds, fixedDims: filters });
    return {
        source: 'eurostat',
        datasetCode,
        datasetLabel: raw.label || datasetCode,
        unit: filters.unit || '',
        dimensions: filters,
        points,
    };
}
