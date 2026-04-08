import { Module } from '@nestjs/common';
import { CatalogModule } from './catalog/catalog.module';
import { AnalyzeModule } from './analyze/analyze.module';
import { CacheModule } from './cache/cache.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [CatalogModule, AnalyzeModule, CacheModule],
  controllers: [HealthController],
})
export class AppModule {}
