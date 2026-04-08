"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyzeService = void 0;
const common_1 = require("@nestjs/common");
const connectors_1 = require("@statinsight/connectors");
const analytics_1 = require("@statinsight/analytics");
const catalog_service_1 = require("../catalog/catalog.service");
const cache_service_1 = require("../cache/cache.service");
let AnalyzeService = class AnalyzeService {
    catalog;
    cache;
    constructor(catalog, cache) {
        this.catalog = catalog;
        this.cache = cache;
    }
    async analyze(catalogId) {
        const entry = this.catalog.findById(catalogId);
        if (!entry) {
            throw new common_1.NotFoundException(`Dataset "${catalogId}" not found in catalog`);
        }
        const cacheKey = `analyze:${catalogId}`;
        const cached = this.cache.get(cacheKey);
        if (cached)
            return cached;
        let series;
        try {
            if (entry.source === 'eurostat') {
                series = await (0, connectors_1.fetchEurostat)(entry.datasetCode, entry.defaultFilters);
            }
            else if (entry.source === 'susr') {
                if (!entry.susrConfig) {
                    throw new common_1.BadRequestException('SUSR entry missing susrConfig');
                }
                series = await (0, connectors_1.fetchSusr)(entry.datasetCode, entry.susrConfig);
            }
            else {
                throw new common_1.BadRequestException(`Unknown source: ${entry.source}`);
            }
        }
        catch (err) {
            throw new common_1.BadRequestException(`Failed to fetch data: ${err.message}`);
        }
        series.datasetLabel = entry.label;
        series.unit = entry.unit;
        const insights = (0, analytics_1.computeInsights)(series.points);
        const chart = (0, analytics_1.buildChartPayload)(series);
        const response = { series, insights, chart };
        this.cache.set(cacheKey, response);
        return response;
    }
};
exports.AnalyzeService = AnalyzeService;
exports.AnalyzeService = AnalyzeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [catalog_service_1.CatalogService,
        cache_service_1.CacheService])
], AnalyzeService);
//# sourceMappingURL=analyze.service.js.map