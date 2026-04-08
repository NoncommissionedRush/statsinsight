import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { fetchEurostat, fetchSusr } from '@statinsight/connectors';
import { computeInsights, buildChartPayload } from '@statinsight/analytics';
import { AnalyzeResponse, TimeSeries } from '@statinsight/types';
import { CatalogService } from '../catalog/catalog.service';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class AnalyzeService {
  constructor(
    private readonly catalog: CatalogService,
    private readonly cache: CacheService,
  ) {}

  async analyze(catalogId: string): Promise<AnalyzeResponse> {
    const entry = this.catalog.findById(catalogId);
    if (!entry) {
      throw new NotFoundException(`Dataset "${catalogId}" not found in catalog`);
    }

    // Check cache
    const cacheKey = `analyze:${catalogId}`;
    const cached = this.cache.get<AnalyzeResponse>(cacheKey);
    if (cached) return cached;

    // Fetch data
    let series: TimeSeries;
    try {
      if (entry.source === 'eurostat') {
        series = await fetchEurostat(entry.datasetCode, entry.defaultFilters);
      } else if (entry.source === 'susr') {
        if (!entry.susrConfig) {
          throw new BadRequestException('SUSR entry missing susrConfig');
        }
        series = await fetchSusr(entry.datasetCode, entry.susrConfig);
      } else {
        throw new BadRequestException(`Unknown source: ${entry.source}`);
      }
    } catch (err: any) {
      throw new BadRequestException(`Failed to fetch data: ${err.message}`);
    }

    // Override labels from catalog
    series.datasetLabel = entry.label;
    series.unit = entry.unit;

    // Compute insights
    const insights = computeInsights(series.points, series.unit);
    const chart = buildChartPayload(series);

    const response: AnalyzeResponse = { series, insights, chart };

    // Cache result
    this.cache.set(cacheKey, response);

    return response;
  }
}
