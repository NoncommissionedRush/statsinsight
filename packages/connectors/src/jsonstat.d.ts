import { TimePoint } from '@statinsight/types';
interface ParseOptions {
    timeDimIds: string[];
    fixedDims: Record<string, string>;
}
export declare function parseJsonStat(raw: any, opts: ParseOptions): TimePoint[];
export declare function detectTimeDimensions(raw: any): string[];
export {};
