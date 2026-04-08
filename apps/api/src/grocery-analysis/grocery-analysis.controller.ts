import { Body, Controller, Post } from '@nestjs/common';
import { GroceryAnalysisRequest } from '@statinsight/types';
import { GroceryAnalysisService } from './grocery-analysis.service';

@Controller('grocery-analysis')
export class GroceryAnalysisController {
  constructor(private readonly groceryAnalysisService: GroceryAnalysisService) {}

  @Post()
  analyze(@Body() body: GroceryAnalysisRequest) {
    return this.groceryAnalysisService.analyze(body.from, body.to);
  }
}
