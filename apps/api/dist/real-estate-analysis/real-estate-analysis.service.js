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
exports.RealEstateAnalysisService = void 0;
const common_1 = require("@nestjs/common");
const node_child_process_1 = require("node:child_process");
const path = __importStar(require("node:path"));
const node_util_1 = require("node:util");
const cache_service_1 = require("../cache/cache.service");
const execFileAsync = (0, node_util_1.promisify)(node_child_process_1.execFile);
const SNAPSHOT_CACHE_KEY = 'real-estate-datacube-snapshots:v1';
const HEADLINE_PROPERTY_LABEL = 'Nehnuteľnosti spolu';
const HEADLINE_MEASURE_LABEL = 'Priemer roku 2010 = 100';
let RealEstateAnalysisService = class RealEstateAnalysisService {
    cache;
    constructor(cache) {
        this.cache = cache;
    }
    async buildHeadlineSeries(entry) {
        const dataset = await this.loadSnapshotDataset();
        const points = dataset.availablePeriods.map((period) => {
            const match = dataset.snapshots[period]?.find((item) => item.propertyLabel === HEADLINE_PROPERTY_LABEL &&
                item.measureLabel === HEADLINE_MEASURE_LABEL);
            return {
                time: period,
                label: period,
                value: match?.value ?? null,
            };
        });
        if (!points.some((point) => point.value !== null)) {
            throw new common_1.BadRequestException('The DATAcube real estate view returned no headline index values.');
        }
        return {
            source: 'datacube',
            datasetCode: entry.datasetCode,
            datasetLabel: entry.label,
            unit: entry.unit,
            dimensions: {
                geo: 'SK',
                property: HEADLINE_PROPERTY_LABEL,
                measure: HEADLINE_MEASURE_LABEL,
            },
            points,
        };
    }
    async analyze(from, to) {
        const start = this.parseQuarter(from);
        const end = this.parseQuarter(to);
        if (this.quarterKey(start) > this.quarterKey(end)) {
            throw new common_1.BadRequestException('The selected range is invalid for real estate comparison.');
        }
        const dataset = await this.loadSnapshotDataset();
        const compared = this.resolveComparedRange(dataset, start, end);
        const startSnapshot = this.getSnapshotForPeriod(dataset, compared.from.normalized);
        const endSnapshot = this.getSnapshotForPeriod(dataset, compared.to.normalized);
        const movers = this.computeMovers(startSnapshot, endSnapshot);
        return {
            requestedFrom: from,
            requestedTo: to,
            comparedFrom: compared.from.normalized,
            comparedTo: compared.to.normalized,
            measureLabel: HEADLINE_MEASURE_LABEL,
            topIncrease: movers.length > 0 ? movers[0] : null,
            topDecrease: movers.length > 0 ? movers[movers.length - 1] : null,
            movers,
        };
    }
    async loadSnapshotDataset() {
        const cached = this.cache.get(SNAPSHOT_CACHE_KEY);
        if (cached) {
            return cached;
        }
        const scriptPath = path.resolve(__dirname, '../../scripts/fetch-real-estate-datacube.mjs');
        try {
            const { stdout } = await execFileAsync('node', [scriptPath], {
                maxBuffer: 8 * 1024 * 1024,
                timeout: 90_000,
            });
            const parsed = JSON.parse(stdout.trim());
            if (!parsed.availablePeriods?.length) {
                throw new Error('The DATAcube real estate view returned no visible periods.');
            }
            this.cache.set(SNAPSHOT_CACHE_KEY, parsed);
            return parsed;
        }
        catch (error) {
            const stderr = typeof error?.stderr === 'string' ? error.stderr.trim() : '';
            const stdout = typeof error?.stdout === 'string' ? error.stdout.trim() : '';
            const message = stderr || stdout || error?.message || 'The DATAcube real estate fetch failed unexpectedly.';
            throw new common_1.BadRequestException(`Failed to fetch real estate prices from DATAcube: ${message}`);
        }
    }
    getSnapshotForPeriod(dataset, period) {
        const items = dataset.snapshots[period];
        if (!items) {
            const first = dataset.availablePeriods[0];
            const last = dataset.availablePeriods[dataset.availablePeriods.length - 1];
            throw new common_1.BadRequestException(`Real estate prices are unavailable for ${period}. DATAcube currently exposes ${first} to ${last} in this public real estate view.`);
        }
        return new Map(items
            .filter((item) => item.measureLabel === HEADLINE_MEASURE_LABEL)
            .map((item) => [item.seriesCode, item]));
    }
    resolveComparedRange(dataset, from, to) {
        const periodsInRange = dataset.availablePeriods
            .map((period) => this.parseQuarter(period))
            .filter((period) => {
            const key = this.quarterKey(period);
            return key >= this.quarterKey(from) && key <= this.quarterKey(to);
        });
        if (periodsInRange.length === 0) {
            const first = dataset.availablePeriods[0];
            const last = dataset.availablePeriods[dataset.availablePeriods.length - 1];
            throw new common_1.BadRequestException(`Real estate prices are unavailable within ${from.normalized} to ${to.normalized}. DATAcube currently exposes quarterly data between ${first} and ${last}.`);
        }
        return {
            from: periodsInRange[0],
            to: periodsInRange[periodsInRange.length - 1],
        };
    }
    computeMovers(startSnapshot, endSnapshot) {
        const movers = [];
        for (const [seriesCode, startItem] of startSnapshot.entries()) {
            const endItem = endSnapshot.get(seriesCode);
            if (!endItem)
                continue;
            const change = endItem.value - startItem.value;
            const pctChange = startItem.value !== 0 ? (change / Math.abs(startItem.value)) * 100 : undefined;
            movers.push({
                seriesCode,
                propertyLabel: startItem.propertyLabel,
                measureLabel: startItem.measureLabel,
                startValue: startItem.value,
                endValue: endItem.value,
                change,
                pctChange,
            });
        }
        return movers.sort((a, b) => b.change - a.change);
    }
    parseQuarter(input) {
        const quarter = input.match(/^(\d{4})-(\d)\.\s*Q\.$/i) || input.match(/^(\d{4})-Q(\d)$/i);
        if (!quarter) {
            throw new common_1.BadRequestException(`Unsupported real estate quarter format: ${input}`);
        }
        return {
            normalized: `${quarter[1]}-Q${quarter[2]}`,
            year: Number(quarter[1]),
            quarter: Number(quarter[2]),
        };
    }
    quarterKey(period) {
        return period.year * 10 + period.quarter;
    }
};
exports.RealEstateAnalysisService = RealEstateAnalysisService;
exports.RealEstateAnalysisService = RealEstateAnalysisService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [cache_service_1.CacheService])
], RealEstateAnalysisService);
//# sourceMappingURL=real-estate-analysis.service.js.map