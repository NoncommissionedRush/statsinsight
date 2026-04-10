import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  CatalogEntry,
  TimeSeries,
  TradeAnalysisResponse,
  TradeMover,
} from '@statinsight/types';
import { CacheService } from '../cache/cache.service';

const SNAPSHOT_CACHE_KEY = 'trade-susr-snapshots:v2';
const TOTAL_CATEGORY_LABEL = 'Spolu';
const IMPORT_LABEL = 'Dovoz';
const EXPORT_LABEL = 'Vývoz';
const API_URL =
  'https://data.statistics.sk/api/v2/dataset/zo0020ms/last2/U01,U02,U03,U04,U05,U06,U07,U08,U09,U10,U11,U12/all/all/STAT01?lang=sk&type=json';

interface SnapshotItem {
  seriesCode: string;
  regionLabel: string;
  categoryLabel: string;
  flowLabel: 'Dovoz' | 'Vývoz';
  value: number;
}

interface SnapshotPayload {
  availablePeriods: string[];
  snapshots: Record<string, SnapshotItem[]>;
}

@Injectable()
export class TradeAnalysisService {
  constructor(private readonly cache: CacheService) {}

  private cleanCategoryLabel(label: string): string {
    return label.replace(/^\d+(?:\s+\d+)*\s+/, '').trim();
  }

  async buildTradeSeries(entry: CatalogEntry): Promise<{ series: TimeSeries; compareSeries: TimeSeries[] }> {
    const dataset = await this.loadSnapshotDataset();
    const periods = dataset.availablePeriods
      .map((period) => ({
        original: period,
        normalized: this.normalizePeriod(period),
      }))
      .sort((a, b) => a.normalized.localeCompare(b.normalized));

    const buildSeries = (flowLabel: 'Dovoz' | 'Vývoz', displaySeries: string): TimeSeries => ({
      source: entry.source,
      datasetCode: entry.datasetCode,
      datasetLabel: displaySeries,
      unit: entry.unit,
      dimensions: {
        geo: 'SK',
        category: TOTAL_CATEGORY_LABEL,
        flow: flowLabel,
        displaySeries,
      },
      points: periods.map(({ original, normalized }) => {
        const match = dataset.snapshots[original]?.find(
          (item) => item.categoryLabel === TOTAL_CATEGORY_LABEL && item.flowLabel === flowLabel,
        );

        return {
          time: normalized,
          label: normalized,
          value: match?.value ?? null,
        };
      }),
    });

    const importSeries = buildSeries(IMPORT_LABEL, 'Dovoz');
    const exportSeries = buildSeries(EXPORT_LABEL, 'Vývoz');

    if (!importSeries.points.some((point) => point.value !== null)) {
      throw new BadRequestException('The Statistics Office API returned no import totals.');
    }

    return {
      series: importSeries,
      compareSeries: [exportSeries],
    };
  }

  async analyze(from: string, to: string): Promise<TradeAnalysisResponse> {
    const dataset = await this.loadSnapshotDataset();
    const normalizedFrom = this.normalizePeriod(from);
    const normalizedTo = this.normalizePeriod(to);
    const [rangeFrom, rangeTo] =
      normalizedFrom <= normalizedTo ? [normalizedFrom, normalizedTo] : [normalizedTo, normalizedFrom];

    const periodsInRange = dataset.availablePeriods
      .map((period) => ({
        original: period,
        normalized: this.normalizePeriod(period),
      }))
      .filter((period) => period.normalized >= rangeFrom && period.normalized <= rangeTo)
      .sort((a, b) => a.normalized.localeCompare(b.normalized));
    if (periodsInRange.length === 0) {
      const first = dataset.availablePeriods[0];
      const last = dataset.availablePeriods[dataset.availablePeriods.length - 1];
      throw new BadRequestException(
        `Trade data is unavailable within ${rangeFrom} to ${rangeTo}. The Statistics Office API currently exposes ${this.normalizePeriod(first)} to ${this.normalizePeriod(last)} in this public trade view.`,
      );
    }

    const comparedFrom = periodsInRange[0];
    const comparedTo = periodsInRange[periodsInRange.length - 1];
    const startSnapshot = this.getSnapshotForPeriod(dataset, comparedFrom.original);
    const endSnapshot = this.getSnapshotForPeriod(dataset, comparedTo.original);

    const importMovers = this.computeMovers(startSnapshot, endSnapshot, IMPORT_LABEL);
    const exportMovers = this.computeMovers(startSnapshot, endSnapshot, EXPORT_LABEL);

    return {
      requestedFrom: from,
      requestedTo: to,
      comparedFrom: comparedFrom.normalized,
      comparedTo: comparedTo.normalized,
      importTopIncrease: importMovers.find((mover) => mover.change > 0) ?? null,
      importTopDecrease: [...importMovers].reverse().find((mover) => mover.change < 0) ?? null,
      exportTopIncrease: exportMovers.find((mover) => mover.change > 0) ?? null,
      exportTopDecrease: [...exportMovers].reverse().find((mover) => mover.change < 0) ?? null,
      importMovers,
      exportMovers,
    };
  }

  private async loadSnapshotDataset(): Promise<SnapshotPayload> {
    const cached = this.cache.get<SnapshotPayload>(SNAPSHOT_CACHE_KEY);
    if (cached) return cached;

    try {
      const response = await fetch(API_URL);
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`SUSR API error ${response.status}: ${text.slice(0, 200)}`);
      }

      const raw = await response.json();
      const parsed = this.parseSnapshotDataset(raw);
      if (!parsed.availablePeriods.length) {
        throw new Error('The Statistics Office API returned no visible periods.');
      }

      this.cache.set(SNAPSHOT_CACHE_KEY, parsed);
      return parsed;
    } catch (error: any) {
      const message = error?.message || 'The official Statistics Office API fetch failed unexpectedly.';
      throw new BadRequestException(`Failed to fetch trade data from the Statistics Office API: ${message}`);
    }
  }

  private parseSnapshotDataset(raw: any): SnapshotPayload {
    const yearDim = raw.dimension?.zo0020ms_rok;
    const monthDim = raw.dimension?.zo0020ms_mes;
    const flowDim = raw.dimension?.zo0020ms_ukaz;
    const categoryDim = raw.dimension?.zo0020ms_ukaz2;
    const countryDim = raw.dimension?.zo0020ms_stat;
    const values = raw.value;

    if (!yearDim || !monthDim || !flowDim || !categoryDim || !countryDim || !Array.isArray(values)) {
      throw new Error('Invalid trade response shape from SUSR API.');
    }

    const years = this.getOrderedCodes(yearDim.category.index);
    const months = this.getOrderedCodes(monthDim.category.index);
    const flows = this.getOrderedCodes(flowDim.category.index);
    const categories = this.getOrderedCodes(categoryDim.category.index);
    const totalCountryIndex = countryDim.category.index.STAT01;
    const sizes = raw.size as number[];
    const snapshots: Record<string, SnapshotItem[]> = {};
    const availablePeriods: string[] = [];

    for (const year of years) {
      const normalizedYear = this.parseYearNumber(year);
      for (const month of months) {
        const period = `${normalizedYear}-${String(this.parseMonthNumber(month)).padStart(2, '0')}`;
        availablePeriods.push(period);
        const items: SnapshotItem[] = [];

        for (const flow of flows) {
          for (const category of categories) {
            const flatIndex = this.computeFlatIndex(
              sizes,
              yearDim.category.index[year],
              monthDim.category.index[month],
              flowDim.category.index[flow],
              categoryDim.category.index[category],
              totalCountryIndex,
              0,
            );
            const value = this.getValue(values, flatIndex);
            if (value === null) continue;

            items.push({
              seriesCode: `${flow}:${category}`,
              regionLabel: countryDim.category.label?.STAT01 ?? TOTAL_CATEGORY_LABEL,
              categoryLabel: categoryDim.category.label?.[category] ?? category,
              flowLabel: (flowDim.category.label?.[flow] ?? flow) as 'Dovoz' | 'Vývoz',
              value,
            });
          }
        }

        snapshots[period] = items;
      }
    }

    availablePeriods.sort((a, b) => a.localeCompare(b));

    return { availablePeriods, snapshots };
  }

  private getSnapshotForPeriod(dataset: SnapshotPayload, period: string) {
    const items = dataset.snapshots[period];
    if (!items) {
      const first = dataset.availablePeriods[0];
      const last = dataset.availablePeriods[dataset.availablePeriods.length - 1];
      throw new BadRequestException(
        `Trade data is unavailable for ${period}. The Statistics Office API currently exposes ${first} to ${last} in this public trade view.`,
      );
    }

    return new Map(items.map((item) => [item.seriesCode, item]));
  }

  private computeMovers(
    startSnapshot: Map<string, SnapshotItem>,
    endSnapshot: Map<string, SnapshotItem>,
    flowLabel: 'Dovoz' | 'Vývoz',
  ): TradeMover[] {
    const movers: TradeMover[] = [];

    for (const [seriesCode, startItem] of startSnapshot.entries()) {
      if (startItem.flowLabel !== flowLabel) continue;
      if (startItem.categoryLabel === TOTAL_CATEGORY_LABEL) continue;

      const endItem = endSnapshot.get(seriesCode);
      if (!endItem || endItem.flowLabel !== flowLabel) continue;

      const change = endItem.value - startItem.value;
      const pctChange = startItem.value !== 0 ? (change / Math.abs(startItem.value)) * 100 : undefined;

      movers.push({
        seriesCode,
        categoryLabel: this.cleanCategoryLabel(startItem.categoryLabel),
        flowLabel,
        startValue: startItem.value,
        endValue: endItem.value,
        change,
        pctChange,
      });
    }

    return movers.sort((a, b) => b.change - a.change);
  }

  private computeFlatIndex(sizes: number[], ...indices: number[]) {
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

  private getOrderedCodes(indexMap: Record<string, number>) {
    return Object.keys(indexMap).sort((a, b) => indexMap[a] - indexMap[b]);
  }

  private parseMonthNumber(value: string) {
    const match = value.match(/(\d{1,2})/);
    if (!match) {
      throw new Error(`Unsupported month value: ${value}`);
    }
    return Number(match[1]);
  }

  private parseYearNumber(value: string) {
    const match = value.match(/(\d{4})/);
    if (!match) {
      throw new Error(`Unsupported year value: ${value}`);
    }
    return Number(match[1]);
  }

  private normalizePeriod(value: string) {
    const yearMatch = value.match(/(\d{4})/);
    const monthMatch = value.match(/-(\d{2})$/) || value.match(/(\d{2})$/);
    if (!yearMatch || !monthMatch) {
      throw new Error(`Unsupported trade period format: ${value}`);
    }
    return `${yearMatch[1]}-${monthMatch[1]}`;
  }
}
