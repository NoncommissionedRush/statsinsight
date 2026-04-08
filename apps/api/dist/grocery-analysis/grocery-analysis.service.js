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
exports.GroceryAnalysisService = void 0;
const common_1 = require("@nestjs/common");
const node_child_process_1 = require("node:child_process");
const path = __importStar(require("node:path"));
const node_util_1 = require("node:util");
const cache_service_1 = require("../cache/cache.service");
const execFileAsync = (0, node_util_1.promisify)(node_child_process_1.execFile);
const SNAPSHOT_CACHE_KEY = 'grocery-datacube-snapshots:v2';
let GroceryAnalysisService = class GroceryAnalysisService {
    cache;
    constructor(cache) {
        this.cache = cache;
    }
    async analyze(from, to) {
        const start = this.parsePeriodStart(from);
        const end = this.parsePeriodEnd(to);
        if (start.normalized > end.normalized) {
            throw new common_1.BadRequestException('The selected range is invalid for grocery comparison.');
        }
        const dataset = await this.loadSnapshotDataset();
        const compared = this.resolveComparedRange(dataset, start.normalized, end.normalized);
        const startSnapshot = this.getSnapshotForPeriod(dataset, compared.from);
        const endSnapshot = this.getSnapshotForPeriod(dataset, compared.to);
        const movers = this.computeMovers(startSnapshot, endSnapshot);
        return {
            requestedFrom: from,
            requestedTo: to,
            comparedFrom: compared.from,
            comparedTo: compared.to,
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
        const scriptPath = path.resolve(__dirname, '../../scripts/fetch-grocery-datacube.mjs');
        try {
            const { stdout } = await execFileAsync('node', [scriptPath], {
                maxBuffer: 8 * 1024 * 1024,
                timeout: 90_000,
            });
            const parsed = JSON.parse(stdout.trim());
            if (!parsed.availablePeriods?.length) {
                throw new Error('The DATAcube grocery view returned no visible periods.');
            }
            this.cache.set(SNAPSHOT_CACHE_KEY, parsed);
            return parsed;
        }
        catch (error) {
            const stderr = typeof error?.stderr === 'string' ? error.stderr.trim() : '';
            const stdout = typeof error?.stdout === 'string' ? error.stdout.trim() : '';
            const message = stderr || stdout || error?.message || 'The DATAcube grocery fetch failed unexpectedly.';
            throw new common_1.BadRequestException(`Failed to fetch grocery prices from DATAcube: ${message}`);
        }
    }
    getSnapshotForPeriod(dataset, period) {
        const items = dataset.snapshots[period];
        if (!items) {
            const available = dataset.availablePeriods;
            const first = available[0];
            const last = available[available.length - 1];
            throw new common_1.BadRequestException(`Grocery prices are unavailable for ${period}. DATAcube currently exposes ${first} to ${last} in this public grocery view.`);
        }
        return new Map(items.map((item) => [item.itemCode, item]));
    }
    resolveComparedRange(dataset, from, to) {
        const periodsInRange = dataset.availablePeriods.filter((period) => period >= from && period <= to);
        if (periodsInRange.length === 0) {
            const available = dataset.availablePeriods;
            const first = available[0];
            const last = available[available.length - 1];
            throw new common_1.BadRequestException(`Grocery prices are unavailable within ${from} to ${to}. DATAcube currently exposes these grocery months between ${first} and ${last}: ${available.join(', ')}.`);
        }
        return {
            from: periodsInRange[0],
            to: periodsInRange[periodsInRange.length - 1],
        };
    }
    computeMovers(startSnapshot, endSnapshot) {
        const movers = [];
        for (const [itemCode, startItem] of startSnapshot.entries()) {
            const endItem = endSnapshot.get(itemCode);
            if (!endItem)
                continue;
            if (startItem.unit !== endItem.unit)
                continue;
            const change = endItem.value - startItem.value;
            const pctChange = startItem.value !== 0 ? (change / Math.abs(startItem.value)) * 100 : undefined;
            movers.push({
                itemCode,
                itemLabel: startItem.itemLabel,
                unit: startItem.unit,
                startValue: startItem.value,
                endValue: endItem.value,
                change,
                pctChange,
            });
        }
        return movers.sort((a, b) => b.change - a.change);
    }
    parsePeriodStart(input) {
        const directMonth = input.match(/^(\d{4})-(\d{1,2})$/);
        if (directMonth) {
            return {
                normalized: `${directMonth[1]}-${String(Number(directMonth[2])).padStart(2, '0')}`,
            };
        }
        const susrMonth = input.match(/^(\d{4})-(\d{1,2})\.$/);
        if (susrMonth) {
            return {
                normalized: `${susrMonth[1]}-${String(Number(susrMonth[2])).padStart(2, '0')}`,
            };
        }
        const quarter = input.match(/^(\d{4})-(\d)\.\s*Q\.$/i) || input.match(/^(\d{4})-Q(\d)$/i);
        if (quarter) {
            const startMonth = (Number(quarter[2]) - 1) * 3 + 1;
            return {
                normalized: `${quarter[1]}-${String(startMonth).padStart(2, '0')}`,
            };
        }
        const year = input.match(/^(\d{4})$/);
        if (year) {
            return {
                normalized: `${year[1]}-01`,
            };
        }
        throw new common_1.BadRequestException(`Unsupported start period format: ${input}`);
    }
    parsePeriodEnd(input) {
        const directMonth = input.match(/^(\d{4})-(\d{1,2})$/);
        if (directMonth) {
            return {
                normalized: `${directMonth[1]}-${String(Number(directMonth[2])).padStart(2, '0')}`,
            };
        }
        const susrMonth = input.match(/^(\d{4})-(\d{1,2})\.$/);
        if (susrMonth) {
            return {
                normalized: `${susrMonth[1]}-${String(Number(susrMonth[2])).padStart(2, '0')}`,
            };
        }
        const quarter = input.match(/^(\d{4})-(\d)\.\s*Q\.$/i) || input.match(/^(\d{4})-Q(\d)$/i);
        if (quarter) {
            const endMonth = Number(quarter[2]) * 3;
            return {
                normalized: `${quarter[1]}-${String(endMonth).padStart(2, '0')}`,
            };
        }
        const year = input.match(/^(\d{4})$/);
        if (year) {
            return {
                normalized: `${year[1]}-12`,
            };
        }
        throw new common_1.BadRequestException(`Unsupported end period format: ${input}`);
    }
};
exports.GroceryAnalysisService = GroceryAnalysisService;
exports.GroceryAnalysisService = GroceryAnalysisService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [cache_service_1.CacheService])
], GroceryAnalysisService);
//# sourceMappingURL=grocery-analysis.service.js.map