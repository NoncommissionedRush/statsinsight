export interface SusrConfig {
    pathSegments: string[];
    timeDimId?: string;
    fixedDims?: Record<string, string>;
}
export interface CatalogEntry {
    id: string;
    source: 'susr' | 'eurostat' | 'datacube';
    datasetCode: string;
    label: string;
    description: string;
    unit: string;
    defaultFilters: Record<string, string>;
    susrConfig?: SusrConfig;
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
export type InsightKind = 'period_delta' | 'average_change' | 'pct_change' | 'rolling_avg_deviation' | 'trend_reversal' | 'largest_move';
export interface Insight {
    kind: InsightKind;
    title: string;
    description: string;
    value?: number;
    period?: string;
}
export interface AnalyzeRequest {
    catalogId: string;
    compareCountries?: string[];
}
export interface GroceryAnalysisRequest {
    from: string;
    to: string;
}
export interface RealEstateAnalysisRequest {
    from: string;
    to: string;
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
export interface AnalyzeResponse {
    series: TimeSeries;
    compareSeries?: TimeSeries[];
    insights: Insight[];
    chart: ChartPayload;
}
export interface ChartPayload {
    labels: string[];
    values: (number | null)[];
    unit: string;
    title: string;
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
}
export interface AiAnalysisResponse {
    analysis: string;
}
