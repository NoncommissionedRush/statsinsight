import { Module } from '@nestjs/common';
import { CacheModule } from '../cache/cache.module';
import { RealEstateAnalysisController } from './real-estate-analysis.controller';
import { RealEstateAnalysisService } from './real-estate-analysis.service';

@Module({
  imports: [CacheModule],
  controllers: [RealEstateAnalysisController],
  providers: [RealEstateAnalysisService],
  exports: [RealEstateAnalysisService],
})
export class RealEstateAnalysisModule {}
