import { GroceryAnalysisResponse } from '@statinsight/types';
import { CacheService } from '../cache/cache.service';
export declare class GroceryAnalysisService {
    private readonly cache;
    constructor(cache: CacheService);
    analyze(from: string, to: string): Promise<GroceryAnalysisResponse>;
    private loadSnapshotDataset;
    private getSnapshotForPeriod;
    private resolveComparedRange;
    private computeMovers;
    private parsePeriodStart;
    private parsePeriodEnd;
}
