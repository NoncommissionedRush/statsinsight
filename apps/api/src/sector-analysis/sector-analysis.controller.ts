import { Body, Controller, Post } from '@nestjs/common';
import type { SectorAnalysisRequest } from '@statinsight/types';
import { SectorAnalysisService } from './sector-analysis.service';

@Controller('sector-analysis')
export class SectorAnalysisController {
  constructor(private readonly sectorAnalysisService: SectorAnalysisService) {}

  @Post()
  analyze(@Body() body: SectorAnalysisRequest) {
    return this.sectorAnalysisService.analyze(body.datasetId, body.from, body.to);
  }
}
