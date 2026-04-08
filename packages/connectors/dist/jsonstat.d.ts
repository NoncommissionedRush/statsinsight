import { TimePoint } from '@statinsight/types';
interface ParseOptions {
    timeDimIds: string[];
    fixedDims: Record<string, string>;
}
/**
 * Parse a JSON-stat 2.0 response into TimePoint[].
 * Supports single time dimension (Eurostat) or composite time (SUSR year+quarter).
 */
export declare function parseJsonStat(raw: any, opts: ParseOptions): TimePoint[];
/**
 * Auto-detect the time dimension ID(s) from a JSON-stat response.
 */
export declare function detectTimeDimensions(raw: any): string[];
export {};
