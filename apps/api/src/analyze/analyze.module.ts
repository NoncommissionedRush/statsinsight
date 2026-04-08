import { Module } from '@nestjs/common';
import { AnalyzeController } from './analyze.controller';
import { AnalyzeService } from './analyze.service';
import { CatalogModule } from '../catalog/catalog.module';
import { RealEstateAnalysisModule } from '../real-estate-analysis/real-estate-analysis.module';

@Module({
  imports: [CatalogModule, RealEstateAnalysisModule],
  controllers: [AnalyzeController],
  providers: [AnalyzeService],
})
export class AnalyzeModule {}
