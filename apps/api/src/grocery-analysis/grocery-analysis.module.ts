import { Module } from '@nestjs/common';
import { CacheModule } from '../cache/cache.module';
import { GroceryAnalysisController } from './grocery-analysis.controller';
import { GroceryAnalysisService } from './grocery-analysis.service';

@Module({
  imports: [CacheModule],
  controllers: [GroceryAnalysisController],
  providers: [GroceryAnalysisService],
})
export class GroceryAnalysisModule {}
