import { Controller, Post, Body } from '@nestjs/common';
import { AnalyzeService } from './analyze.service';
import { AnalyzeRequest } from '@statinsight/types';

@Controller('analyze')
export class AnalyzeController {
  constructor(private readonly analyzeService: AnalyzeService) {}

  @Post()
  analyze(@Body() body: AnalyzeRequest) {
    return this.analyzeService.analyze(body.catalogId, body.compareCountries || []);
  }
}
