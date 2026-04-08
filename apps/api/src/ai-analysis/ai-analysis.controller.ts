import { Body, Controller, Post } from '@nestjs/common';
import type { AiAnalysisRequest } from '@statinsight/types';
import { AiAnalysisService } from './ai-analysis.service';

@Controller('ai-analysis')
export class AiAnalysisController {
  constructor(private readonly aiAnalysisService: AiAnalysisService) {}

  @Post()
  analyze(@Body() body: AiAnalysisRequest) {
    return this.aiAnalysisService.analyze(body);
  }
}
