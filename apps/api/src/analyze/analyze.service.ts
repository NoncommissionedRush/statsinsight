import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { fetchEurostat, fetchSusr } from '@statinsight/connectors';
import { computeInsights, buildChartPayload } from '@statinsight/analytics';
import { AnalyzeResponse, TimeSeries } from '@statinsight/types';
import { CatalogService } from '../catalog/catalog.service';
import { CacheService } from '../cache/cache.service';
import { RealEstateAnalysisService } from '../real-estate-analysis/real-estate-analysis.service';

const COUNTRY_COMPARISON_DATASET_IDS = new Set([
  'eurostat:prc_hicp_manr',
  'eurostat:une_rt_m',
  'eurostat:namq_10_gdp',
]);

@Injectable()
export class AnalyzeService {
  constructor(
    private readonly catalog: CatalogService,
    private readonly cache: CacheService,
    private readonly realEstateAnalysis: RealEstateAnalysisService,
  ) {}

  async analyze(catalogId: string, compareCountries: string[] = []): Promise<AnalyzeResponse> {
    const entry = this.catalog.findById(catalogId);
    if (!entry) {
      throw new NotFoundException(`Dataset "${catalogId}" not found in catalog`);
    }

    const normalizedCompareCountries = this.normalizeCompareCountries(compareCountries);

    // Check cache
    const cacheKey = `analyze:${catalogId}:${normalizedCompareCountries.join(',')}`;
    const cached = this.cache.get<AnalyzeResponse>(cacheKey);
    if (cached) return cached;

    // Fetch data
    let series: TimeSeries;
    let compareSeries: TimeSeries[] | undefined;
    try {
      if (entry.source === 'eurostat') {
        series = await fetchEurostat(entry.datasetCode, entry.defaultFilters);
        compareSeries = await this.fetchCompareSeries(entry, normalizedCompareCountries);
      } else if (entry.source === 'datacube') {
        series = await this.realEstateAnalysis.buildHeadlineSeries(entry);
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

    const response: AnalyzeResponse = { series, compareSeries, insights, chart };

    // Cache result
    this.cache.set(cacheKey, response);

    return response;
  }

  private async fetchCompareSeries(entry: ReturnType<CatalogService['findById']>, countries: string[]) {
    if (!entry || entry.source !== 'eurostat') return undefined;
    if (!COUNTRY_COMPARISON_DATASET_IDS.has(entry.id)) return undefined;
    if (countries.length === 0) return undefined;

    const baseGeo = entry.defaultFilters.geo;
    const compareGeos = countries.filter((country) => country !== baseGeo);
    if (compareGeos.length === 0) return undefined;

    const seriesList = await Promise.all(
      compareGeos.map(async (geo) => {
        const filters = { ...entry.defaultFilters, geo };
        const series = await fetchEurostat(entry.datasetCode, filters);
        series.datasetLabel = `${entry.label.replace(' - Slovakia', '')} - ${geo}`;
        series.unit = entry.unit;
        return series;
      }),
    );

    return seriesList;
  }

  private normalizeCompareCountries(countries: string[]) {
    return [...new Set(countries.map((country) => country.trim().toUpperCase()).filter(Boolean))].sort();
  }
}
