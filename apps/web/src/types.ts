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
  compareSeries?: TimeSeries[];
  insights: Insight[];
  chart: ChartPayload;
}

export interface GroceryMover {
  itemCode: string;
  itemLabel: string;
  unit: string;
  startValue: number;
  endValue: number;
  change: number;
  pctChange?: number;
}

export interface GroceryAnalysisResponse {
  requestedFrom: string;
  requestedTo: string;
  comparedFrom: string;
  comparedTo: string;
  topIncrease: GroceryMover | null;
  topDecrease: GroceryMover | null;
  movers: GroceryMover[];
}
