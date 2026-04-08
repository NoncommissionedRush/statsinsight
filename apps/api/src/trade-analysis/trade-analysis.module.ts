import { Module } from '@nestjs/common';
import { CacheModule } from '../cache/cache.module';
import { TradeAnalysisController } from './trade-analysis.controller';
import { TradeAnalysisService } from './trade-analysis.service';

@Module({
  imports: [CacheModule],
  controllers: [TradeAnalysisController],
  providers: [TradeAnalysisService],
  exports: [TradeAnalysisService],
})
export class TradeAnalysisModule {}
