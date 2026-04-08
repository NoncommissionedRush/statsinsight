import { BadRequestException, Injectable } from '@nestjs/common';
import { execFile } from 'node:child_process';
import * as path from 'node:path';
import { promisify } from 'node:util';
import type { CatalogEntry, RealEstateAnalysisResponse, RealEstateMover, TimeSeries } from '@statinsight/types';
import { CacheService } from '../cache/cache.service';

const execFileAsync = promisify(execFile);
const SNAPSHOT_CACHE_KEY = 'real-estate-datacube-snapshots:v1';
const HEADLINE_PROPERTY_LABEL = 'Nehnuteľnosti spolu';
const HEADLINE_MEASURE_LABEL = 'Priemer roku 2010 = 100';

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
      throw new BadRequestException('The DATAcube real estate view returned no headline index values.');
    }

    return {
      source: 'datacube',
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

    const scriptPath = path.resolve(__dirname, '../../scripts/fetch-real-estate-datacube.mjs');

    try {
      const { stdout } = await execFileAsync('node', [scriptPath], {
        maxBuffer: 8 * 1024 * 1024,
        timeout: 90_000,
      });

      const parsed = JSON.parse(stdout.trim()) as SnapshotPayload;
      if (!parsed.availablePeriods?.length) {
        throw new Error('The DATAcube real estate view returned no visible periods.');
      }

      this.cache.set(SNAPSHOT_CACHE_KEY, parsed);
      return parsed;
    } catch (error: any) {
      const stderr = typeof error?.stderr === 'string' ? error.stderr.trim() : '';
      const stdout = typeof error?.stdout === 'string' ? error.stdout.trim() : '';
      const message =
        stderr || stdout || error?.message || 'The DATAcube real estate fetch failed unexpectedly.';

      throw new BadRequestException(`Failed to fetch real estate prices from DATAcube: ${message}`);
    }
  }

  private getSnapshotForPeriod(dataset: SnapshotPayload, period: string): Map<string, SnapshotItem> {
    const items = dataset.snapshots[period];
    if (!items) {
      const first = dataset.availablePeriods[0];
      const last = dataset.availablePeriods[dataset.availablePeriods.length - 1];

      throw new BadRequestException(
        `Real estate prices are unavailable for ${period}. DATAcube currently exposes ${first} to ${last} in this public real estate view.`,
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
        `Real estate prices are unavailable within ${from.normalized} to ${to.normalized}. DATAcube currently exposes quarterly data between ${first} and ${last}.`,
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
}
