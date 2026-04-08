import { BadRequestException, Injectable } from '@nestjs/common';
import { execFile } from 'node:child_process';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { GroceryAnalysisResponse, GroceryMover } from '@statinsight/types';
import { CacheService } from '../cache/cache.service';

const execFileAsync = promisify(execFile);
const SNAPSHOT_CACHE_KEY = 'grocery-datacube-snapshots:v2';

interface SnapshotItem {
  itemCode: string;
  itemLabel: string;
  unit: string;
  value: number;
}

interface SnapshotPayload {
  availablePeriods: string[];
  snapshots: Record<string, SnapshotItem[]>;
}

interface ParsedPeriod {
  normalized: string;
}

@Injectable()
export class GroceryAnalysisService {
  constructor(private readonly cache: CacheService) {}

  async analyze(from: string, to: string): Promise<GroceryAnalysisResponse> {
    const start = this.parsePeriodStart(from);
    const end = this.parsePeriodEnd(to);

    if (start.normalized > end.normalized) {
      throw new BadRequestException('The selected range is invalid for grocery comparison.');
    }

    const dataset = await this.loadSnapshotDataset();
    const compared = this.resolveComparedRange(dataset, start.normalized, end.normalized);
    const startSnapshot = this.getSnapshotForPeriod(dataset, compared.from);
    const endSnapshot = this.getSnapshotForPeriod(dataset, compared.to);
    const movers = this.computeMovers(startSnapshot, endSnapshot);

    return {
      requestedFrom: from,
      requestedTo: to,
      comparedFrom: compared.from,
      comparedTo: compared.to,
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

    const scriptPath = path.resolve(__dirname, '../../scripts/fetch-grocery-datacube.mjs');

    try {
      const { stdout } = await execFileAsync('node', [scriptPath], {
        maxBuffer: 8 * 1024 * 1024,
        timeout: 90_000,
      });

      const parsed = JSON.parse(stdout.trim()) as SnapshotPayload;
      if (!parsed.availablePeriods?.length) {
        throw new Error('The DATAcube grocery view returned no visible periods.');
      }

      this.cache.set(SNAPSHOT_CACHE_KEY, parsed);
      return parsed;
    } catch (error: any) {
      const stderr = typeof error?.stderr === 'string' ? error.stderr.trim() : '';
      const stdout = typeof error?.stdout === 'string' ? error.stdout.trim() : '';
      const message =
        stderr || stdout || error?.message || 'The DATAcube grocery fetch failed unexpectedly.';

      throw new BadRequestException(`Failed to fetch grocery prices from DATAcube: ${message}`);
    }
  }

  private getSnapshotForPeriod(
    dataset: SnapshotPayload,
    period: string,
  ): Map<string, SnapshotItem> {
    const items = dataset.snapshots[period];
    if (!items) {
      const available = dataset.availablePeriods;
      const first = available[0];
      const last = available[available.length - 1];

      throw new BadRequestException(
        `Grocery prices are unavailable for ${period}. DATAcube currently exposes ${first} to ${last} in this public grocery view.`,
      );
    }

    return new Map(items.map((item) => [item.itemCode, item]));
  }

  private resolveComparedRange(dataset: SnapshotPayload, from: string, to: string) {
    const periodsInRange = dataset.availablePeriods.filter((period) => period >= from && period <= to);

    if (periodsInRange.length === 0) {
      const available = dataset.availablePeriods;
      const first = available[0];
      const last = available[available.length - 1];

      throw new BadRequestException(
        `Grocery prices are unavailable within ${from} to ${to}. DATAcube currently exposes these grocery months between ${first} and ${last}: ${available.join(', ')}.`,
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
  ): GroceryMover[] {
    const movers: GroceryMover[] = [];

    for (const [itemCode, startItem] of startSnapshot.entries()) {
      const endItem = endSnapshot.get(itemCode);
      if (!endItem) continue;
      if (startItem.unit !== endItem.unit) continue;

      const change = endItem.value - startItem.value;
      const pctChange = startItem.value !== 0 ? (change / Math.abs(startItem.value)) * 100 : undefined;

      movers.push({
        itemCode,
        itemLabel: startItem.itemLabel,
        unit: startItem.unit,
        startValue: startItem.value,
        endValue: endItem.value,
        change,
        pctChange,
      });
    }

    return movers.sort((a, b) => b.change - a.change);
  }

  private parsePeriodStart(input: string): ParsedPeriod {
    const directMonth = input.match(/^(\d{4})-(\d{1,2})$/);
    if (directMonth) {
      return {
        normalized: `${directMonth[1]}-${String(Number(directMonth[2])).padStart(2, '0')}`,
      };
    }

    const susrMonth = input.match(/^(\d{4})-(\d{1,2})\.$/);
    if (susrMonth) {
      return {
        normalized: `${susrMonth[1]}-${String(Number(susrMonth[2])).padStart(2, '0')}`,
      };
    }

    const quarter = input.match(/^(\d{4})-(\d)\.\s*Q\.$/i) || input.match(/^(\d{4})-Q(\d)$/i);
    if (quarter) {
      const startMonth = (Number(quarter[2]) - 1) * 3 + 1;
      return {
        normalized: `${quarter[1]}-${String(startMonth).padStart(2, '0')}`,
      };
    }

    const year = input.match(/^(\d{4})$/);
    if (year) {
      return {
        normalized: `${year[1]}-01`,
      };
    }

    throw new BadRequestException(`Unsupported start period format: ${input}`);
  }

  private parsePeriodEnd(input: string): ParsedPeriod {
    const directMonth = input.match(/^(\d{4})-(\d{1,2})$/);
    if (directMonth) {
      return {
        normalized: `${directMonth[1]}-${String(Number(directMonth[2])).padStart(2, '0')}`,
      };
    }

    const susrMonth = input.match(/^(\d{4})-(\d{1,2})\.$/);
    if (susrMonth) {
      return {
        normalized: `${susrMonth[1]}-${String(Number(susrMonth[2])).padStart(2, '0')}`,
      };
    }

    const quarter = input.match(/^(\d{4})-(\d)\.\s*Q\.$/i) || input.match(/^(\d{4})-Q(\d)$/i);
    if (quarter) {
      const endMonth = Number(quarter[2]) * 3;
      return {
        normalized: `${quarter[1]}-${String(endMonth).padStart(2, '0')}`,
      };
    }

    const year = input.match(/^(\d{4})$/);
    if (year) {
      return {
        normalized: `${year[1]}-12`,
      };
    }

    throw new BadRequestException(`Unsupported end period format: ${input}`);
  }
}
