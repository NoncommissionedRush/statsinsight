import type { AiAnalysisRequest, AiAnalysisResponse } from '@statinsight/types';
export declare class AiAnalysisService {
    analyze(req: AiAnalysisRequest): Promise<AiAnalysisResponse>;
}
