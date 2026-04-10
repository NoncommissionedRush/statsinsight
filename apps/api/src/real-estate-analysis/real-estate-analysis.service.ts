import { BadRequestException, Injectable } from '@nestjs/common';
import type { CatalogEntry, RealEstateAnalysisResponse, RealEstateMover, TimeSeries } from '@statinsight/types';
import { CacheService } from '../cache/cache.service';

const SNAPSHOT_CACHE_KEY = 'real-estate-susr-snapshots:v2';
const HEADLINE_PROPERTY_LABEL = 'Nehnuteľnosti spolu';
const HEADLINE_MEASURE_LABEL = 'Priemer roku 2010 = 100';
const DATASET_CODE = 'sp1002qs';
const API_URL =
  'https://data.statistics.sk/api/v2/dataset/sp1002qs/last5/1.%20Q.,2.%20Q.,3.%20Q.,4.%20Q./all/MJ01?lang=sk&type=json';

interface SnapshotItem {
  seriesCode: string;
  propertyLabel: string;
  measureLabel: string;
  value: number;
}

interface SnapshotPayload {
  availablePeriods: string[];
  snapshots: Record<string, SnapshotItem[]>;
}

@Injectable()
export class RealEstateAnalysisService {
  constructor(private readonly cache: CacheService) {}

  async buildHeadlineSeries(entry: CatalogEntry): Promise<TimeSeries> {
    const dataset = await this.loadSnapshotDataset();
    const points = dataset.availablePeriods.map((period) => {
      const match = dataset.snapshots[period]?.find(
        (item) =>
          item.propertyLabel === HEADLINE_PROPERTY_LABEL &&
          item.measureLabel === HEADLINE_MEASURE_LABEL,
      );

      return {
        time: period,
        label: period,
        value: match?.value ?? null,
      };
    });

    if (!points.some((point) => point.value !== null)) {
      throw new BadRequestException('The Statistics Office API returned no headline real estate index values.');
    }

    return {
      source: entry.source,
      datasetCode: entry.datasetCode,
      datasetLabel: entry.label,
      unit: entry.unit,
      dimensions: {
        geo: 'SK',
        property: HEADLINE_PROPERTY_LABEL,
        measure: HEADLINE_MEASURE_LABEL,
      },
      points,
    };
  }

  async analyze(from: string, to: string): Promise<RealEstateAnalysisResponse> {
    const start = this.parseQuarter(from);
    const end = this.parseQuarter(to);

    if (this.quarterKey(start) > this.quarterKey(end)) {
      throw new BadRequestException('The selected range is invalid for real estate comparison.');
    }

    const dataset = await this.loadSnapshotDataset();
    const compared = this.resolveComparedRange(dataset, start, end);
    const startSnapshot = this.getSnapshotForPeriod(dataset, compared.from.normalized);
    const endSnapshot = this.getSnapshotForPeriod(dataset, compared.to.normalized);
    const movers = this.computeMovers(startSnapshot, endSnapshot);

    return {
      requestedFrom: from,
      requestedTo: to,
      comparedFrom: compared.from.normalized,
      comparedTo: compared.to.normalized,
      measureLabel: HEADLINE_MEASURE_LABEL,
      topIncrease: movers.length > 0 ? movers[0] : null,
      topDecrease: movers.length > 0 ? movers[movers.length - 1] : null,
      movers,
    };
  }

  private async loadSnapshotDataset(): Promise<SnapshotPayload> {
    const cached = this.cache.get<SnapshotPayload>(SNAPSHOT_CACHE_KEY);
    if (cached) {
      return cached;
    }

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
      throw new BadRequestException(`Failed to fetch real estate prices from the Statistics Office API: ${message}`);
    }
  }

  private parseSnapshotDataset(raw: any): SnapshotPayload {
    const yearDim = raw.dimension?.sp1002qs_rok;
    const quarterDim = raw.dimension?.sp1002qs_stv;
    const propertyDim = raw.dimension?.sp1002qs_ukaz;
    const measureDim = raw.dimension?.sp1002qs_mj;
    const values = raw.value;

    if (!yearDim || !quarterDim || !propertyDim || !measureDim || !Array.isArray(values)) {
      throw new Error('Invalid real estate response shape from SUSR API.');
    }

    const years = this.getOrderedCodes(yearDim.category.index);
    const quarters = this.getOrderedCodes(quarterDim.category.index);
    const properties = this.getOrderedCodes(propertyDim.category.index);
    const measures = this.getOrderedCodes(measureDim.category.index);
    const sizes = raw.size as number[];
    const snapshots: Record<string, SnapshotItem[]> = {};
    const availablePeriods: string[] = [];

    for (const year of years) {
      for (const quarter of quarters) {
        const period = `${year}-Q${this.parseQuarterNumber(quarter)}`;
        availablePeriods.push(period);
        const items: SnapshotItem[] = [];

        for (const property of properties) {
          for (const measure of measures) {
            const flatIndex = this.computeFlatIndex(
              sizes,
              yearDim.category.index[year],
              quarterDim.category.index[quarter],
              propertyDim.category.index[property],
              measureDim.category.index[measure],
              0,
            );
            const value = this.getValue(values, flatIndex);
            if (value === null) continue;

            items.push({
              seriesCode: `${property}:${measure}`,
              propertyLabel: propertyDim.category.label?.[property] ?? property,
              measureLabel: measureDim.category.label?.[measure] ?? measure,
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

  private getSnapshotForPeriod(dataset: SnapshotPayload, period: string): Map<string, SnapshotItem> {
    const items = dataset.snapshots[period];
    if (!items) {
      const first = dataset.availablePeriods[0];
      const last = dataset.availablePeriods[dataset.availablePeriods.length - 1];

      throw new BadRequestException(
        `Real estate prices are unavailable for ${period}. The Statistics Office API currently exposes ${first} to ${last} in this public real estate view.`,
      );
    }

    return new Map(
      items
        .filter((item) => item.measureLabel === HEADLINE_MEASURE_LABEL)
        .map((item) => [item.seriesCode, item]),
    );
  }

  private resolveComparedRange(
    dataset: SnapshotPayload,
    from: { normalized: string; year: number; quarter: number },
    to: { normalized: string; year: number; quarter: number },
  ) {
    const periodsInRange = dataset.availablePeriods
      .map((period) => this.parseQuarter(period))
      .filter((period) => {
        const key = this.quarterKey(period);
        return key >= this.quarterKey(from) && key <= this.quarterKey(to);
      });

    if (periodsInRange.length === 0) {
      const first = dataset.availablePeriods[0];
      const last = dataset.availablePeriods[dataset.availablePeriods.length - 1];

      throw new BadRequestException(
        `Real estate prices are unavailable within ${from.normalized} to ${to.normalized}. The Statistics Office API currently exposes quarterly data between ${first} and ${last}.`,
      );
    }

    return {
      from: periodsInRange[0],
      to: periodsInRange[periodsInRange.length - 1],
    };
  }

  private computeMovers(
    startSnapshot: Map<string, SnapshotItem>,
    endSnapshot: Map<string, SnapshotItem>,
  ): RealEstateMover[] {
    const movers: RealEstateMover[] = [];

    for (const [seriesCode, startItem] of startSnapshot.entries()) {
      const endItem = endSnapshot.get(seriesCode);
      if (!endItem) continue;

      const change = endItem.value - startItem.value;
      const pctChange = startItem.value !== 0 ? (change / Math.abs(startItem.value)) * 100 : undefined;

      movers.push({
        seriesCode,
        propertyLabel: startItem.propertyLabel,
        measureLabel: startItem.measureLabel,
        startValue: startItem.value,
        endValue: endItem.value,
        change,
        pctChange,
      });
    }

    return movers.sort((a, b) => b.change - a.change);
  }

  private parseQuarter(input: string) {
    const quarter = input.match(/^(\d{4})-(\d)\.\s*Q\.$/i) || input.match(/^(\d{4})-Q(\d)$/i);
    if (!quarter) {
      throw new BadRequestException(`Unsupported real estate quarter format: ${input}`);
    }

    return {
      normalized: `${quarter[1]}-Q${quarter[2]}`,
      year: Number(quarter[1]),
      quarter: Number(quarter[2]),
    };
  }

  private quarterKey(period: { year: number; quarter: number }) {
    return period.year * 10 + period.quarter;
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

  private parseQuarterNumber(value: string) {
    const match = value.match(/(\d)/);
    if (!match) {
      throw new Error(`Unsupported quarter value: ${value}`);
    }
    return Number(match[1]);
  }
}
