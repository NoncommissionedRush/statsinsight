export interface CatalogEntry {
  id: string;
  source: 'susr' | 'eurostat' | 'datacube';
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
  source: 'susr' | 'eurostat' | 'datacube';
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
  primarySeriesName?: string;
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

export interface RealEstateMover {
  seriesCode: string;
  propertyLabel: string;
  measureLabel: string;
  startValue: number;
  endValue: number;
  change: number;
  pctChange?: number;
}

export interface RealEstateAnalysisResponse {
  requestedFrom: string;
  requestedTo: string;
  comparedFrom: string;
  comparedTo: string;
  measureLabel: string;
  topIncrease: RealEstateMover | null;
  topDecrease: RealEstateMover | null;
  movers: RealEstateMover[];
}

export interface TradeMover {
  seriesCode: string;
  categoryLabel: string;
  flowLabel: 'Dovoz' | 'Vývoz';
  startValue: number;
  endValue: number;
  change: number;
  pctChange?: number;
}

export interface TradeAnalysisResponse {
  requestedFrom: string;
  requestedTo: string;
  comparedFrom: string;
  comparedTo: string;
  importTopIncrease: TradeMover | null;
  importTopDecrease: TradeMover | null;
  exportTopIncrease: TradeMover | null;
  exportTopDecrease: TradeMover | null;
  importMovers: TradeMover[];
  exportMovers: TradeMover[];
}

export interface AiAnalysisRequest {
  datasetLabel: string;
  unit: string;
  from: string;
  to: string;
  points: TimePoint[];
  insights: Insight[];
  compareSeries?: TimeSeries[];
  groceryMovers?: GroceryMover[];
  realEstateMovers?: RealEstateMover[];
  tradeImportMovers?: TradeMover[];
  tradeExportMovers?: TradeMover[];
  question?: string;
  history?: AiChatMessage[];
}

export interface AiChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface AiAnalysisResponse {
  analysis: string;
  followUpQuestions: string[];
}
