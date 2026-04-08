import { TimePoint, Insight, ChartPayload, TimeSeries } from '@statinsight/types';
export declare function computeInsights(points: TimePoint[], unit?: string): Insight[];
export declare function buildChartPayload(series: TimeSeries): ChartPayload;
