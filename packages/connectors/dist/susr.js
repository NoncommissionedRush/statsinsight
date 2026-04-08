"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchSusr = fetchSusr;
const jsonstat_1 = require("./jsonstat");
const BASE_URL = 'https://data.statistics.sk/api/v2/dataset';
async function fetchSusr(datasetCode, config) {
    const path = config.pathSegments.join('/');
    const url = `${BASE_URL}/${datasetCode}/${path}?lang=en&type=json`;
    const res = await fetch(url);
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`SUSR API error ${res.status}: ${text.slice(0, 200)}`);
    }
    const raw = await res.json();
    const timeDimIds = config.timeDimId
        ? [config.timeDimId]
        : (0, jsonstat_1.detectTimeDimensions)(raw);
    const fixedDims = config.fixedDims || {};
    const points = (0, jsonstat_1.parseJsonStat)(raw, { timeDimIds, fixedDims });
    return {
        source: 'susr',
        datasetCode,
        datasetLabel: raw.label || datasetCode,
        unit: '',
        dimensions: fixedDims,
        points,
    };
}
