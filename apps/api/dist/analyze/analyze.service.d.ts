import { AnalyzeResponse } from '@statinsight/types';
import { CatalogService } from '../catalog/catalog.service';
import { CacheService } from '../cache/cache.service';
import { RealEstateAnalysisService } from '../real-estate-analysis/real-estate-analysis.service';
import { TradeAnalysisService } from '../trade-analysis/trade-analysis.service';
export declare class AnalyzeService {
    private readonly catalog;
    private readonly cache;
    private readonly realEstateAnalysis;
    private readonly tradeAnalysis;
    constructor(catalog: CatalogService, cache: CacheService, realEstateAnalysis: RealEstateAnalysisService, tradeAnalysis: TradeAnalysisService);
    analyze(catalogId: string, compareCountries?: string[]): Promise<AnalyzeResponse>;
    private fetchCompareSeries;
    private normalizeCompareCountries;
}
