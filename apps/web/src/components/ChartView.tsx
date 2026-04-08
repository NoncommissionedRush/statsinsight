import { useRef, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { COUNTRY_LABELS } from '../countries';
import type { ChartPayload, TimeSeries } from '../types';
import { copyChartHtml, downloadChartHtml, exportSvgChartAsHtml } from './chartExport';

interface Props {
  chart: ChartPayload;
  compareSeries?: TimeSeries[];
  source?: string;
}

const COMPARE_COLORS = ['#dc2626', '#059669', '#d97706', '#7c3aed', '#0891b2', '#ea580c'];

function buildSeriesLabel(series: TimeSeries): string {
  if (series.dimensions.displaySeries) return series.dimensions.displaySeries;
  const geo = series.dimensions.geo;
  if (geo && COUNTRY_LABELS[geo]) return COUNTRY_LABELS[geo];
  return geo || series.datasetLabel;
}

export function ChartView({ chart, compareSeries = [], source = '' }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const primarySeriesName = chart.primarySeriesName || 'Slovensko';
  const data = chart.labels.map((label, index) => {
    const row: Record<string, string | number | null> = {
      name: label,
      [primarySeriesName]: chart.values[index],
    };

    for (const series of compareSeries) {
      row[buildSeriesLabel(series)] = series.points[index]?.value ?? null;
    }

    return row;
  });

  const validValues = chart.values.filter((value): value is number => value !== null);
  const avg = validValues.length > 0
    ? validValues.reduce((sum, value) => sum + value, 0) / validValues.length
    : null;
  const seriesNames = [primarySeriesName, ...compareSeries.map(buildSeriesLabel)];

  const getExportHtml = () => {
    return exportSvgChartAsHtml({
      container: chartRef.current,
      title: chart.title,
      unit: chart.unit,
      seriesNames,
      source,
    });
  };

  const handleDownload = () => {
    try {
      const html = getExportHtml();
      downloadChartHtml(html, chart.title);
      setExportStatus('HTML súbor bol stiahnutý.');
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : 'Chyba pri exporte grafu do HTML.');
    }
  };

  const handleCopy = async () => {
    try {
      const html = getExportHtml();
      await copyChartHtml(html);
      setExportStatus('HTML skopírované do schránky.');
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : 'Chyba pri kopírovaní HTML grafu.');
    }
  };

  return (
    <div ref={chartRef} className="chart-container">
      <div className="chart-header">
        <h2>{chart.title}</h2>
        <div className="chart-actions">
          <button type="button" className="chart-action" onClick={handleCopy}>
            Kopírovať HTML
          </button>
          <button type="button" className="chart-action" onClick={handleDownload}>
            Stiahnuť HTML
          </button>
        </div>
      </div>
      {exportStatus && <p className="chart-export-status">{exportStatus}</p>}
      <ResponsiveContainer width="100%" height={420}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            label={{ value: chart.unit, angle: -90, position: 'insideLeft', offset: -5 }}
          />
          <Tooltip
            formatter={(value) => [
              typeof value === 'number' ? value.toFixed(2) : 'N/A',
              chart.unit,
            ]}
            labelStyle={{ fontWeight: 'bold' }}
          />
          <Legend />
          {avg !== null && (
            <ReferenceLine
              y={avg}
              stroke="#94a3b8"
              strokeDasharray="5 5"
              label={{ value: `${primarySeriesName} Priem.: ${avg.toFixed(2)}`, position: 'right', fontSize: 11 }}
            />
          )}
          <Line
            type="monotone"
            dataKey={primarySeriesName}
            name={primarySeriesName}
            stroke="#2563eb"
            strokeWidth={3}
            dot={{ r: 3 }}
            activeDot={{ r: 6 }}
            connectNulls
          />
          {compareSeries.map((series, index) => (
            <Line
              key={buildSeriesLabel(series)}
              type="monotone"
              dataKey={buildSeriesLabel(series)}
              name={buildSeriesLabel(series)}
              stroke={COMPARE_COLORS[index % COMPARE_COLORS.length]}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
