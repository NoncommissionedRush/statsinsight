"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeAnalysisService = void 0;
const common_1 = require("@nestjs/common");
const node_child_process_1 = require("node:child_process");
const path = __importStar(require("node:path"));
const node_util_1 = require("node:util");
const cache_service_1 = require("../cache/cache.service");
const execFileAsync = (0, node_util_1.promisify)(node_child_process_1.execFile);
const SNAPSHOT_CACHE_KEY = 'trade-datacube-snapshots:v1';
const TOTAL_CATEGORY_LABEL = 'Spolu';
const IMPORT_LABEL = 'Dovoz';
const EXPORT_LABEL = 'Vývoz';
let TradeAnalysisService = class TradeAnalysisService {
    cache;
    constructor(cache) {
        this.cache = cache;
    }
    cleanCategoryLabel(label) {
        return label.replace(/^\d+(?:\s+\d+)*\s+/, '').trim();
    }
    async buildTradeSeries(entry) {
        const dataset = await this.loadSnapshotDataset();
        const buildSeries = (flowLabel, displaySeries) => ({
            source: 'datacube',
            datasetCode: entry.datasetCode,
            datasetLabel: displaySeries,
            unit: entry.unit,
            dimensions: {
                geo: 'SK',
                category: TOTAL_CATEGORY_LABEL,
                flow: flowLabel,
                displaySeries,
            },
            points: dataset.availablePeriods.map((period) => {
                const match = dataset.snapshots[period]?.find((item) => item.categoryLabel === TOTAL_CATEGORY_LABEL && item.flowLabel === flowLabel);
                return {
                    time: period,
                    label: period,
                    value: match?.value ?? null,
                };
            }),
        });
        const importSeries = buildSeries(IMPORT_LABEL, 'Imports');
        const exportSeries = buildSeries(EXPORT_LABEL, 'Exports');
        if (!importSeries.points.some((point) => point.value !== null)) {
            throw new common_1.BadRequestException('The DATAcube trade view returned no import totals.');
        }
        return {
            series: importSeries,
            compareSeries: [exportSeries],
        };
    }
    async analyze(from, to) {
        const dataset = await this.loadSnapshotDataset();
        if (from > to) {
            throw new common_1.BadRequestException('The selected range is invalid for trade comparison.');
        }
        const periodsInRange = dataset.availablePeriods.filter((period) => period >= from && period <= to);
        if (periodsInRange.length === 0) {
            const first = dataset.availablePeriods[0];
            const last = dataset.availablePeriods[dataset.availablePeriods.length - 1];
            throw new common_1.BadRequestException(`Trade data is unavailable within ${from} to ${to}. DATAcube currently exposes ${first} to ${last} in this public trade view.`);
        }
        const comparedFrom = periodsInRange[0];
        const comparedTo = periodsInRange[periodsInRange.length - 1];
        const startSnapshot = this.getSnapshotForPeriod(dataset, comparedFrom);
        const endSnapshot = this.getSnapshotForPeriod(dataset, comparedTo);
        const importMovers = this.computeMovers(startSnapshot, endSnapshot, IMPORT_LABEL);
        const exportMovers = this.computeMovers(startSnapshot, endSnapshot, EXPORT_LABEL);
        return {
            requestedFrom: from,
            requestedTo: to,
            comparedFrom,
            comparedTo,
            importTopIncrease: importMovers.find((mover) => mover.change > 0) ?? null,
            importTopDecrease: [...importMovers].reverse().find((mover) => mover.change < 0) ?? null,
            exportTopIncrease: exportMovers.find((mover) => mover.change > 0) ?? null,
            exportTopDecrease: [...exportMovers].reverse().find((mover) => mover.change < 0) ?? null,
            importMovers,
            exportMovers,
        };
    }
    async loadSnapshotDataset() {
        const cached = this.cache.get(SNAPSHOT_CACHE_KEY);
        if (cached)
            return cached;
        const scriptPath = path.resolve(__dirname, '../../scripts/fetch-trade-datacube.mjs');
        try {
            const { stdout } = await execFileAsync('node', [scriptPath], {
                maxBuffer: 8 * 1024 * 1024,
                timeout: 90_000,
            });
            const parsed = JSON.parse(stdout.trim());
            if (!parsed.availablePeriods?.length) {
                throw new Error('The DATAcube trade view returned no visible periods.');
            }
            this.cache.set(SNAPSHOT_CACHE_KEY, parsed);
            return parsed;
        }
        catch (error) {
            const stderr = typeof error?.stderr === 'string' ? error.stderr.trim() : '';
            const stdout = typeof error?.stdout === 'string' ? error.stdout.trim() : '';
            const message = stderr || stdout || error?.message || 'The DATAcube trade fetch failed unexpectedly.';
            throw new common_1.BadRequestException(`Failed to fetch trade data from DATAcube: ${message}`);
        }
    }
    getSnapshotForPeriod(dataset, period) {
        const items = dataset.snapshots[period];
        if (!items) {
            const first = dataset.availablePeriods[0];
            const last = dataset.availablePeriods[dataset.availablePeriods.length - 1];
            throw new common_1.BadRequestException(`Trade data is unavailable for ${period}. DATAcube currently exposes ${first} to ${last} in this public trade view.`);
        }
        return new Map(items.map((item) => [item.seriesCode, item]));
    }
    computeMovers(startSnapshot, endSnapshot, flowLabel) {
        const movers = [];
        for (const [seriesCode, startItem] of startSnapshot.entries()) {
            if (startItem.flowLabel !== flowLabel)
                continue;
            if (startItem.categoryLabel === TOTAL_CATEGORY_LABEL)
                continue;
            const endItem = endSnapshot.get(seriesCode);
            if (!endItem || endItem.flowLabel !== flowLabel)
                continue;
            const change = endItem.value - startItem.value;
            const pctChange = startItem.value !== 0 ? (change / Math.abs(startItem.value)) * 100 : undefined;
            movers.push({
                seriesCode,
                categoryLabel: this.cleanCategoryLabel(startItem.categoryLabel),
                flowLabel,
                startValue: startItem.value,
                endValue: endItem.value,
                change,
                pctChange,
            });
        }
        return movers.sort((a, b) => b.change - a.change);
    }
};
exports.TradeAnalysisService = TradeAnalysisService;
exports.TradeAnalysisService = TradeAnalysisService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [cache_service_1.CacheService])
], TradeAnalysisService);
//# sourceMappingURL=trade-analysis.service.js.map