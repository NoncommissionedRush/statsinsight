import type { AiAnalysisRequest } from '@statinsight/types';
export declare class AiAnalysisService {
    analyze(req: AiAnalysisRequest): Promise<{
        analysis: string;
    }>;
}
