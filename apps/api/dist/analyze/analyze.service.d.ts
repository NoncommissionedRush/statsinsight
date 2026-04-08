import { AnalyzeResponse } from '@statinsight/types';
import { CatalogService } from '../catalog/catalog.service';
import { CacheService } from '../cache/cache.service';
import { RealEstateAnalysisService } from '../real-estate-analysis/real-estate-analysis.service';
export declare class AnalyzeService {
    private readonly catalog;
    private readonly cache;
    private readonly realEstateAnalysis;
    constructor(catalog: CatalogService, cache: CacheService, realEstateAnalysis: RealEstateAnalysisService);
    analyze(catalogId: string, compareCountries?: string[]): Promise<AnalyzeResponse>;
    private fetchCompareSeries;
    private normalizeCompareCountries;
}
