import type { AiAnalysisRequest } from '@statinsight/types';
import { AiAnalysisService } from './ai-analysis.service';
export declare class AiAnalysisController {
    private readonly aiAnalysisService;
    constructor(aiAnalysisService: AiAnalysisService);
    analyze(body: AiAnalysisRequest): Promise<import("@statinsight/types").AiAnalysisResponse>;
}
