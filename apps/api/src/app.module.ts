import { Module } from '@nestjs/common';
import { CatalogModule } from './catalog/catalog.module';
import { AnalyzeModule } from './analyze/analyze.module';
import { CacheModule } from './cache/cache.module';
import { HealthController } from './health/health.controller';
import { GroceryAnalysisModule } from './grocery-analysis/grocery-analysis.module';

@Module({
  imports: [CatalogModule, AnalyzeModule, CacheModule, GroceryAnalysisModule],
  controllers: [HealthController],
})
export class AppModule {}
