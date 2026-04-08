import { RealEstateAnalysisRequest } from '@statinsight/types';
import { RealEstateAnalysisService } from './real-estate-analysis.service';
export declare class RealEstateAnalysisController {
    private readonly realEstateAnalysisService;
    constructor(realEstateAnalysisService: RealEstateAnalysisService);
    analyze(body: RealEstateAnalysisRequest): Promise<import("@statinsight/types").RealEstateAnalysisResponse>;
}
