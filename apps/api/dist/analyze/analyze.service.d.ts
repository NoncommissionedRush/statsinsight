import { AnalyzeResponse } from '@statinsight/types';
import { CatalogService } from '../catalog/catalog.service';
import { CacheService } from '../cache/cache.service';
export declare class AnalyzeService {
    private readonly catalog;
    private readonly cache;
    constructor(catalog: CatalogService, cache: CacheService);
    analyze(catalogId: string, compareCountries?: string[]): Promise<AnalyzeResponse>;
    private fetchCompareSeries;
    private normalizeCompareCountries;
}
