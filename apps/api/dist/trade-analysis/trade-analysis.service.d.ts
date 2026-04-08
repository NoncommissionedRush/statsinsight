import type { CatalogEntry, TimeSeries, TradeAnalysisResponse } from '@statinsight/types';
import { CacheService } from '../cache/cache.service';
export declare class TradeAnalysisService {
    private readonly cache;
    constructor(cache: CacheService);
    private cleanCategoryLabel;
    buildTradeSeries(entry: CatalogEntry): Promise<{
        series: TimeSeries;
        compareSeries: TimeSeries[];
    }>;
    analyze(from: string, to: string): Promise<TradeAnalysisResponse>;
    private loadSnapshotDataset;
    private getSnapshotForPeriod;
    private computeMovers;
}
