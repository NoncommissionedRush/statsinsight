export interface CatalogEntry {
  id: string;
  source: 'susr' | 'eurostat';
  datasetCode: string;
  label: string;
  description: string;
  unit: string;
}

export interface TimePoint {
  time: string;
  value: number | null;
  label?: string;
}

export interface TimeSeries {
  source: 'susr' | 'eurostat';
  datasetCode: string;
  datasetLabel: string;
  unit: string;
  dimensions: Record<string, string>;
  points: TimePoint[];
}

export interface Insight {
  kind: string;
  title: string;
  description: string;
  value?: number;
  period?: string;
}

export interface ChartPayload {
  labels: string[];
  values: (number | null)[];
  unit: string;
  title: string;
}

export interface AnalyzeResponse {
  series: TimeSeries;
  insights: Insight[];
  chart: ChartPayload;
}
