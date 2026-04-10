import { Module } from '@nestjs/common';
import { CatalogModule } from './catalog/catalog.module';
import { AnalyzeModule } from './analyze/analyze.module';
import { CacheModule } from './cache/cache.module';
import { HealthController } from './health/health.controller';
import { GroceryAnalysisModule } from './grocery-analysis/grocery-analysis.module';
import { RealEstateAnalysisModule } from './real-estate-analysis/real-estate-analysis.module';
import { AiAnalysisModule } from './ai-analysis/ai-analysis.module';
import { TradeAnalysisModule } from './trade-analysis/trade-analysis.module';
import { SectorAnalysisModule } from './sector-analysis/sector-analysis.module';

@Module({
  imports: [
    CatalogModule,
    AnalyzeModule,
    CacheModule,
    GroceryAnalysisModule,
    RealEstateAnalysisModule,
    TradeAnalysisModule,
    SectorAnalysisModule,
    AiAnalysisModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
