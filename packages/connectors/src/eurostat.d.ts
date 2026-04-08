import { TimeSeries } from '@statinsight/types';
export declare function fetchEurostat(datasetCode: string, filters: Record<string, string>): Promise<TimeSeries>;
