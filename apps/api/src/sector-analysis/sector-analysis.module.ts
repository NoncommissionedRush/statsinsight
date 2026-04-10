import { Module } from '@nestjs/common';
import { CacheModule } from '../cache/cache.module';
import { SectorAnalysisController } from './sector-analysis.controller';
import { SectorAnalysisService } from './sector-analysis.service';

@Module({
  imports: [CacheModule],
  controllers: [SectorAnalysisController],
  providers: [SectorAnalysisService],
})
export class SectorAnalysisModule {}
