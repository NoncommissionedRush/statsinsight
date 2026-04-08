import { BadRequestException, Injectable } from '@nestjs/common';
import { execFile } from 'node:child_process';
import * as path from 'node:path';
import { promisify } from 'node:util';
import type {
  CatalogEntry,
  TimeSeries,
  TradeAnalysisResponse,
  TradeMover,
} from '@statinsight/types';
import { CacheService } from '../cache/cache.service';

const execFileAsync = promisify(execFile);
const SNAPSHOT_CACHE_KEY = 'trade-datacube-snapshots:v1';
const TOTAL_CATEGORY_LABEL = 'Spolu';
const IMPORT_LABEL = 'Dovoz';
const EXPORT_LABEL = 'Vývoz';

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

    const buildSeries = (flowLabel: 'Dovoz' | 'Vývoz', displaySeries: string): TimeSeries => ({
      source: 'datacube',
      datasetCode: entry.datasetCode,
      datasetLabel: displaySeries,
      unit: entry.unit,
      dimensions: {
        geo: 'SK',
        category: TOTAL_CATEGORY_LABEL,
        flow: flowLabel,
        displaySeries,
      },
      points: dataset.availablePeriods.map((period) => {
        const match = dataset.snapshots[period]?.find(
          (item) => item.categoryLabel === TOTAL_CATEGORY_LABEL && item.flowLabel === flowLabel,
        );

        return {
          time: period,
          label: period,
          value: match?.value ?? null,
        };
      }),
    });

    const importSeries = buildSeries(IMPORT_LABEL, 'Imports');
    const exportSeries = buildSeries(EXPORT_LABEL, 'Exports');

    if (!importSeries.points.some((point) => point.value !== null)) {
      throw new BadRequestException('The DATAcube trade view returned no import totals.');
    }

    return {
      series: importSeries,
      compareSeries: [exportSeries],
    };
  }

  async analyze(from: string, to: string): Promise<TradeAnalysisResponse> {
    const dataset = await this.loadSnapshotDataset();
    if (from > to) {
      throw new BadRequestException('The selected range is invalid for trade comparison.');
    }

    const periodsInRange = dataset.availablePeriods.filter((period) => period >= from && period <= to);
    if (periodsInRange.length === 0) {
      const first = dataset.availablePeriods[0];
      const last = dataset.availablePeriods[dataset.availablePeriods.length - 1];
      throw new BadRequestException(
        `Trade data is unavailable within ${from} to ${to}. DATAcube currently exposes ${first} to ${last} in this public trade view.`,
      );
    }

    const comparedFrom = periodsInRange[0];
    const comparedTo = periodsInRange[periodsInRange.length - 1];
    const startSnapshot = this.getSnapshotForPeriod(dataset, comparedFrom);
    const endSnapshot = this.getSnapshotForPeriod(dataset, comparedTo);

    const importMovers = this.computeMovers(startSnapshot, endSnapshot, IMPORT_LABEL);
    const exportMovers = this.computeMovers(startSnapshot, endSnapshot, EXPORT_LABEL);

    return {
      requestedFrom: from,
      requestedTo: to,
      comparedFrom,
      comparedTo,
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

    const scriptPath = path.resolve(__dirname, '../../scripts/fetch-trade-datacube.mjs');

    try {
      const { stdout } = await execFileAsync('node', [scriptPath], {
        maxBuffer: 8 * 1024 * 1024,
        timeout: 90_000,
      });
      const parsed = JSON.parse(stdout.trim()) as SnapshotPayload;
      if (!parsed.availablePeriods?.length) {
        throw new Error('The DATAcube trade view returned no visible periods.');
      }
      this.cache.set(SNAPSHOT_CACHE_KEY, parsed);
      return parsed;
    } catch (error: any) {
      const stderr = typeof error?.stderr === 'string' ? error.stderr.trim() : '';
      const stdout = typeof error?.stdout === 'string' ? error.stdout.trim() : '';
      const message = stderr || stdout || error?.message || 'The DATAcube trade fetch failed unexpectedly.';
      throw new BadRequestException(`Failed to fetch trade data from DATAcube: ${message}`);
    }
  }

  private getSnapshotForPeriod(dataset: SnapshotPayload, period: string) {
    const items = dataset.snapshots[period];
    if (!items) {
      const first = dataset.availablePeriods[0];
      const last = dataset.availablePeriods[dataset.availablePeriods.length - 1];
      throw new BadRequestException(
        `Trade data is unavailable for ${period}. DATAcube currently exposes ${first} to ${last} in this public trade view.`,
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
}
