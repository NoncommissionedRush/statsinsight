import { Body, Controller, Post } from '@nestjs/common';
import { RealEstateAnalysisRequest } from '@statinsight/types';
import { RealEstateAnalysisService } from './real-estate-analysis.service';

@Controller('real-estate-analysis')
export class RealEstateAnalysisController {
  constructor(private readonly realEstateAnalysisService: RealEstateAnalysisService) {}

  @Post()
  analyze(@Body() body: RealEstateAnalysisRequest) {
    return this.realEstateAnalysisService.analyze(body.from, body.to);
  }
}
