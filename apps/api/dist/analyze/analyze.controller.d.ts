import { AnalyzeService } from './analyze.service';
import { AnalyzeRequest } from '@statinsight/types';
export declare class AnalyzeController {
    private readonly analyzeService;
    constructor(analyzeService: AnalyzeService);
    analyze(body: AnalyzeRequest): Promise<import("@statinsight/types").AnalyzeResponse>;
}
