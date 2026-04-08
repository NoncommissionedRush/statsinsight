import { Body, Controller, Post } from '@nestjs/common';
import type { TradeAnalysisRequest } from '@statinsight/types';
import { TradeAnalysisService } from './trade-analysis.service';

@Controller('trade-analysis')
export class TradeAnalysisController {
  constructor(private readonly tradeAnalysisService: TradeAnalysisService) {}

  @Post()
  analyze(@Body() body: TradeAnalysisRequest) {
    return this.tradeAnalysisService.analyze(body.from, body.to);
  }
}
