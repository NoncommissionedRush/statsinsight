import { GroceryAnalysisRequest } from '@statinsight/types';
import { GroceryAnalysisService } from './grocery-analysis.service';
export declare class GroceryAnalysisController {
    private readonly groceryAnalysisService;
    constructor(groceryAnalysisService: GroceryAnalysisService);
    analyze(body: GroceryAnalysisRequest): Promise<import("@statinsight/types").GroceryAnalysisResponse>;
}
