import type { TradeAnalysisRequest } from '@statinsight/types';
import { TradeAnalysisService } from './trade-analysis.service';
export declare class TradeAnalysisController {
    private readonly tradeAnalysisService;
    constructor(tradeAnalysisService: TradeAnalysisService);
    analyze(body: TradeAnalysisRequest): Promise<import("@statinsight/types").TradeAnalysisResponse>;
}
