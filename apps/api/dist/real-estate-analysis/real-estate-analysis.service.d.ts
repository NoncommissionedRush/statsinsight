import type { CatalogEntry, RealEstateAnalysisResponse, TimeSeries } from '@statinsight/types';
import { CacheService } from '../cache/cache.service';
export declare class RealEstateAnalysisService {
    private readonly cache;
    constructor(cache: CacheService);
    buildHeadlineSeries(entry: CatalogEntry): Promise<TimeSeries>;
    analyze(from: string, to: string): Promise<RealEstateAnalysisResponse>;
    private loadSnapshotDataset;
    private getSnapshotForPeriod;
    private resolveComparedRange;
    private computeMovers;
    private parseQuarter;
    private quarterKey;
}
