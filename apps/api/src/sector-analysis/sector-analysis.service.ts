import { BadRequestException, Injectable } from '@nestjs/common';
import type { SectorAnalysisResponse, SectorMover } from '@statinsight/types';
import { CacheService } from '../cache/cache.service';

type PeriodKind = 'month' | 'quarter';

interface DatasetConfig {
  cacheKey: string;
  requestUrl: string;
  categoryDimId: string;
  excludedCodes: Set<string>;
  measureLabel: string;
  periodKind: PeriodKind;
  fallbackPeriodCodes?: string[];
  cleanLabel?: (label: string) => string;
}

interface SnapshotItem {
  seriesCode: string;
  seriesLabel: string;
  value: number;
}

interface SnapshotPayload {
  availablePeriods: string[];
  snapshots: Record<string, SnapshotItem[]>;
}

const QUARTER_CODES = ['1. Q.', '2. Q.', '3. Q.', '4. Q.'];
const VACANCY_QUARTER_CODES = ['1.Q.', '2.Q.', '3.Q.', '4.Q.'];
const MONTH_CODES = ['1.', '2.', '3.', '4.', '5.', '6.', '7.', '8.', '9.', '10.', '11.', '12.'];
const API_ROOT = 'https://data.statistics.sk/api/v2/dataset';

const DATASET_CONFIGS: Record<string, DatasetConfig> = {
  'susr:pr0204qs': {
    cacheKey: 'sector-analysis:wages:v7',
    requestUrl: `${API_ROOT}/pr0205qs/last5/1.%20Q.,2.%20Q.,3.%20Q.,4.%20Q./all/Eur?lang=sk&type=json`,
    categoryDimId: 'pr0205qs_ukaz',
    excludedCodes: new Set(['UKAZ01']),
    measureLabel: 'Priemerná mesačná mzda podľa odvetví',
    periodKind: 'quarter',
    fallbackPeriodCodes: QUARTER_CODES,
    cleanLabel: (label) => label.replace(/^(v tom:\s*|z toho:\s*)/i, '').trim(),
  },
  'susr:pr2003qs': {
    cacheKey: 'sector-analysis:vacancies:v7',
    requestUrl: `${API_ROOT}/pr2003qs/last5/${VACANCY_QUARTER_CODES.join(',')}/15oby24/all?lang=sk&type=json`,
    categoryDimId: 'pr2003qs_ukaz2',
    excludedCodes: new Set(['nace2']),
    measureLabel: 'Miera voľných pracovných miest podľa sektorov',
    periodKind: 'quarter',
    fallbackPeriodCodes: VACANCY_QUARTER_CODES,
  },
  'susr:pm0042ms': {
    cacheKey: 'sector-analysis:industry:v7',
    requestUrl: `${API_ROOT}/pm0042ms/last2/1.,2.,3.,4.,5.,6.,7.,8.,9.,10.,11.,12./SPECU_Y_ROMR/all/UNIT_INDEX/U_PM_0001?lang=sk&type=json`,
    categoryDimId: 'pm0042ms_nace2',
    excludedCodes: new Set(['05-39']),
    measureLabel: 'Priemyselná produkcia podľa odvetví',
    periodKind: 'month',
    fallbackPeriodCodes: MONTH_CODES,
    cleanLabel: (label) => label.replace(/\s+\d+\)\s*$/g, '').trim(),
  },
};

@Injectable()
export class SectorAnalysisService {
  constructor(private readonly cache: CacheService) {}

  async analyze(datasetId: string, from: string, to: string): Promise<SectorAnalysisResponse> {
    const config = DATASET_CONFIGS[datasetId];
    if (!config) {
      throw new BadRequestException(`Unsupported sector breakdown dataset: ${datasetId}`);
    }

    const dataset = await this.loadSnapshotDataset(config);
    const normalizedFrom = this.normalizeInputPeriod(from, config.periodKind);
    const normalizedTo = this.normalizeInputPeriod(to, config.periodKind);
    const [rangeFrom, rangeTo] =
      normalizedFrom <= normalizedTo ? [normalizedFrom, normalizedTo] : [normalizedTo, normalizedFrom];

    const periodsInRange = dataset.availablePeriods.filter((period) => period >= rangeFrom && period <= rangeTo);
    if (periodsInRange.length === 0) {
      const first = dataset.availablePeriods[0];
      const last = dataset.availablePeriods[dataset.availablePeriods.length - 1];
      throw new BadRequestException(
        `Sector data is unavailable within ${rangeFrom} to ${rangeTo}. The Statistics Office API currently exposes ${first} to ${last}.`,
      );
    }

    const comparedFrom = periodsInRange[0];
    const comparedTo = periodsInRange[periodsInRange.length - 1];
    const startSnapshot = this.getSnapshotForPeriod(dataset, comparedFrom);
    const endSnapshot = this.getSnapshotForPeriod(dataset, comparedTo);
    const movers = this.computeMovers(startSnapshot, endSnapshot);

    return {
      requestedFrom: from,
      requestedTo: to,
      comparedFrom,
      comparedTo,
      measureLabel: config.measureLabel,
      topIncrease: movers.find((mover) => mover.change > 0) ?? null,
      topDecrease: [...movers].reverse().find((mover) => mover.change < 0) ?? null,
      movers,
    };
  }

  private async loadSnapshotDataset(config: DatasetConfig): Promise<SnapshotPayload> {
    const cached = this.cache.get<SnapshotPayload>(config.cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(config.requestUrl);
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`SUSR API error ${response.status}: ${text.slice(0, 200)}`);
      }

      const raw = await response.json();
      const parsed = this.parseSnapshotDataset(raw, config);
      if (!parsed.availablePeriods.length) {
        throw new Error(
          `The Statistics Office API returned no visible periods. Debug: ids=${JSON.stringify(raw.id ?? [])}; size=${JSON.stringify(raw.size ?? [])}; firstValues=${JSON.stringify(Array.isArray(raw.value) ? raw.value.slice(0, 12) : raw.value)}`,
        );
      }

      this.cache.set(config.cacheKey, parsed);
      return parsed;
    } catch (error: any) {
      const message = error?.message || 'The official Statistics Office API fetch failed unexpectedly.';
      throw new BadRequestException(`Failed to fetch sector data from the Statistics Office API: ${message}`);
    }
  }

  private parseSnapshotDataset(raw: any, config: DatasetConfig): SnapshotPayload {
    const ids: string[] = raw.id || [];
    const dims = raw.dimension;
    const sizes: number[] = raw.size || [];
    const values = raw.value;
    const yearDimId = ids.find((id) => /(_rok|_year)$/i.test(id));
    const periodDimId = ids.find((id) => /(_stv|_month|_mes)$/i.test(id));

    if (!ids.length || !dims || !sizes.length || !Array.isArray(values) || !yearDimId || !periodDimId) {
      throw new Error('Invalid sector response shape from SUSR API.');
    }

    const yearDim = dims[yearDimId];
    const periodDim = dims[periodDimId];
    const categoryDim = dims[config.categoryDimId];
    if (!yearDim || !periodDim || !categoryDim) {
      throw new Error('Missing required dimensions in sector response.');
    }

    const yearIndex = this.getCategoryIndexMap(yearDim, yearDimId);
    const periodIndex = this.getCategoryIndexMap(periodDim, periodDimId, config.fallbackPeriodCodes);
    const categoryIndex = this.getCategoryIndexMap(categoryDim, config.categoryDimId);
    const yearCodes = this.getOrderedCodes(yearIndex);
    const periodCodes = this.getOrderedCodes(periodIndex);
    const allCategoryCodes = this.getOrderedCodes(categoryIndex);
    const categories = allCategoryCodes.filter(
      (code) => !config.excludedCodes.has(code),
    );
    const yearPos = ids.indexOf(yearDimId);
    const periodPos = ids.indexOf(periodDimId);
    const categoryPos = ids.indexOf(config.categoryDimId);
    const availablePeriods = new Set<string>();
    const snapshots: Record<string, SnapshotItem[]> = {};

    for (const [yearOrder, yearCode] of yearCodes.entries()) {
      for (const [periodOrder, periodCode] of periodCodes.entries()) {
        const normalizedPeriod = this.normalizeRawPeriod(yearCode, periodCode, config.periodKind);
        const items: SnapshotItem[] = [];

        for (const category of categories) {
          const categoryOrder = allCategoryCodes.indexOf(category);
          const rawLabel = categoryDim.category.label?.[category] ?? category;
          const seriesLabel = config.cleanLabel ? config.cleanLabel(rawLabel) : rawLabel;
          const indices = ids.map(() => 0);
          indices[yearPos] = yearOrder;
          indices[periodPos] = periodOrder;
          indices[categoryPos] = categoryOrder;

          const flatIndex = this.computeFlatIndex(sizes, indices);
          const value = this.getValue(values, flatIndex);
          if (value === null) continue;

          items.push({
            seriesCode: category,
            seriesLabel,
            value,
          });
        }

        if (items.length > 0) {
          availablePeriods.add(normalizedPeriod);
          snapshots[normalizedPeriod] = items;
        }
      }
    }

    const uniquePeriods = [...availablePeriods].sort((a, b) => a.localeCompare(b));
    return { availablePeriods: uniquePeriods, snapshots };
  }

  private getSnapshotForPeriod(dataset: SnapshotPayload, period: string): Map<string, SnapshotItem> {
    const items = dataset.snapshots[period];
    if (!items) {
      const first = dataset.availablePeriods[0];
      const last = dataset.availablePeriods[dataset.availablePeriods.length - 1];
      throw new BadRequestException(
        `Sector data is unavailable for ${period}. The Statistics Office API currently exposes ${first} to ${last}.`,
      );
    }

    return new Map(items.map((item) => [item.seriesCode, item]));
  }

  private computeMovers(
    startSnapshot: Map<string, SnapshotItem>,
    endSnapshot: Map<string, SnapshotItem>,
  ): SectorMover[] {
    const movers: SectorMover[] = [];

    for (const [seriesCode, startItem] of startSnapshot.entries()) {
      const endItem = endSnapshot.get(seriesCode);
      if (!endItem) continue;

      const change = endItem.value - startItem.value;
      const pctChange = startItem.value !== 0 ? (change / Math.abs(startItem.value)) * 100 : undefined;

      movers.push({
        seriesCode,
        seriesLabel: startItem.seriesLabel,
        startValue: startItem.value,
        endValue: endItem.value,
        change,
        pctChange,
      });
    }

    return movers.sort((a, b) => b.change - a.change);
  }

  private normalizeInputPeriod(input: string, kind: PeriodKind) {
    return kind === 'quarter' ? this.normalizeQuarterInput(input) : this.normalizeMonthInput(input);
  }

  private normalizeRawPeriod(yearCode: string, periodCode: string, kind: PeriodKind) {
    const year = this.parseYear(yearCode);
    if (kind === 'quarter') {
      const quarter = this.parseQuarter(periodCode);
      return `${year}-Q${quarter}`;
    }

    const month = this.parseMonth(periodCode);
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  private normalizeQuarterInput(input: string) {
    const year = this.parseYear(input);
    const quarter = this.parseQuarter(input);
    return `${year}-Q${quarter}`;
  }

  private normalizeMonthInput(input: string) {
    const year = this.parseYear(input);
    const month = this.parseMonth(input);
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  private parseYear(value: string) {
    const match = value.match(/(\d{4})/);
    if (!match) {
      throw new BadRequestException(`Unsupported year format: ${value}`);
    }
    return Number(match[1]);
  }

  private parseQuarter(value: string) {
    const match = value.match(/Q([1-4])/i) || value.match(/([1-4])\.\s*Q\.?/i);
    if (!match) {
      throw new BadRequestException(`Unsupported quarter format: ${value}`);
    }
    return Number(match[1]);
  }

  private parseMonth(value: string) {
    const directMonth = value.match(/-(\d{1,2})(?:\.)?$/);
    if (directMonth) {
      return Number(directMonth[1]);
    }

    const codeMonth = value.match(/^U(\d{2})$/i);
    if (codeMonth) {
      return Number(codeMonth[1]);
    }

    const plainMonth = value.match(/^(\d{1,2})\.$/);
    if (plainMonth) {
      return Number(plainMonth[1]);
    }

    throw new BadRequestException(`Unsupported month format: ${value}`);
  }

  private getOrderedCodes(indexMap: Record<string, number>) {
    return Object.keys(indexMap).sort((a, b) => indexMap[a] - indexMap[b]);
  }

  private computeFlatIndex(sizes: number[], indices: number[]) {
    let flat = 0;
    for (let i = 0; i < sizes.length; i++) {
      flat = flat * sizes[i] + indices[i];
    }
    return flat;
  }

  private getValue(values: any[], flatIndex: number): number | null {
    const raw = values[flatIndex];
    return raw === undefined || raw === null ? null : Number(raw);
  }

  private getCategoryIndexMap(dim: any, dimId: string, fallbackCodes?: string[]): Record<string, number> {
    const category = dim?.category;
    const index = category?.index;

    if (Array.isArray(index)) {
      return Object.fromEntries(index.map((code, position) => [code, position]));
    }

    if (index && typeof index === 'object') {
      return index as Record<string, number>;
    }

    const labels = category?.label;
    if (labels && typeof labels === 'object') {
      return Object.fromEntries(Object.keys(labels).map((code, position) => [code, position]));
    }

    if (fallbackCodes?.length) {
      return Object.fromEntries(fallbackCodes.map((code, position) => [code, position]));
    }

    throw new Error(`Missing category index map in sector dataset response for ${dimId}.`);
  }
}
