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
const real_estate_analysis_service_1 = require("../real-estate-analysis/real-estate-analysis.service");
const COUNTRY_COMPARISON_DATASET_IDS = new Set([
    'eurostat:prc_hicp_manr',
    'eurostat:une_rt_m',
    'eurostat:namq_10_gdp',
]);
let AnalyzeService = class AnalyzeService {
    catalog;
    cache;
    realEstateAnalysis;
    constructor(catalog, cache, realEstateAnalysis) {
        this.catalog = catalog;
        this.cache = cache;
        this.realEstateAnalysis = realEstateAnalysis;
    }
    async analyze(catalogId, compareCountries = []) {
        const entry = this.catalog.findById(catalogId);
        if (!entry) {
            throw new common_1.NotFoundException(`Dataset "${catalogId}" not found in catalog`);
        }
        const normalizedCompareCountries = this.normalizeCompareCountries(compareCountries);
        const cacheKey = `analyze:${catalogId}:${normalizedCompareCountries.join(',')}`;
        const cached = this.cache.get(cacheKey);
        if (cached)
            return cached;
        let series;
        let compareSeries;
        try {
            if (entry.source === 'eurostat') {
                series = await (0, connectors_1.fetchEurostat)(entry.datasetCode, entry.defaultFilters);
                compareSeries = await this.fetchCompareSeries(entry, normalizedCompareCountries);
            }
            else if (entry.source === 'datacube') {
                series = await this.realEstateAnalysis.buildHeadlineSeries(entry);
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
        const insights = (0, analytics_1.computeInsights)(series.points, series.unit);
        const chart = (0, analytics_1.buildChartPayload)(series);
        const response = { series, compareSeries, insights, chart };
        this.cache.set(cacheKey, response);
        return response;
    }
    async fetchCompareSeries(entry, countries) {
        if (!entry || entry.source !== 'eurostat')
            return undefined;
        if (!COUNTRY_COMPARISON_DATASET_IDS.has(entry.id))
            return undefined;
        if (countries.length === 0)
            return undefined;
        const baseGeo = entry.defaultFilters.geo;
        const compareGeos = countries.filter((country) => country !== baseGeo);
        if (compareGeos.length === 0)
            return undefined;
        const seriesList = await Promise.all(compareGeos.map(async (geo) => {
            const filters = { ...entry.defaultFilters, geo };
            const series = await (0, connectors_1.fetchEurostat)(entry.datasetCode, filters);
            series.datasetLabel = `${entry.label.replace(' - Slovakia', '')} - ${geo}`;
            series.unit = entry.unit;
            return series;
        }));
        return seriesList;
    }
    normalizeCompareCountries(countries) {
        return [...new Set(countries.map((country) => country.trim().toUpperCase()).filter(Boolean))].sort();
    }
};
exports.AnalyzeService = AnalyzeService;
exports.AnalyzeService = AnalyzeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [catalog_service_1.CatalogService,
        cache_service_1.CacheService,
        real_estate_analysis_service_1.RealEstateAnalysisService])
], AnalyzeService);
//# sourceMappingURL=analyze.service.js.map