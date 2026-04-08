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

interface Props {
  chart: ChartPayload;
  compareSeries?: TimeSeries[];
}

const COMPARE_COLORS = ['#dc2626', '#059669', '#d97706', '#7c3aed', '#0891b2', '#ea580c'];

function buildSeriesLabel(series: TimeSeries): string {
  const geo = series.dimensions.geo;
  if (geo && COUNTRY_LABELS[geo]) return COUNTRY_LABELS[geo];
  return geo || series.datasetLabel;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'chart';
}

function buildExportHtml({
  title,
  unit,
  seriesNames,
  svgMarkup,
}: {
  title: string;
  unit: string;
  seriesNames: string[];
  svgMarkup: string;
}) {
  const exportedAt = new Date().toISOString().slice(0, 10);
  const seriesLine = seriesNames.join(', ');

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      :root {
        color-scheme: light;
        --text: #0f172a;
        --muted: #64748b;
        --border: #e2e8f0;
        --background: #ffffff;
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        padding: 0;
        font-family: Inter, "Segoe UI", sans-serif;
        background: transparent;
        color: var(--text);
      }

      .chart-embed {
        width: min(100%, 900px);
        margin: 0 auto;
        border: 1px solid var(--border);
        border-radius: 16px;
        background: var(--background);
        padding: 24px;
      }

      .chart-embed h1 {
        margin: 0 0 8px;
        font-size: 24px;
        line-height: 1.2;
      }

      .chart-embed p {
        margin: 0;
        color: var(--muted);
        font-size: 14px;
        line-height: 1.5;
      }

      .chart-meta {
        display: grid;
        gap: 4px;
        margin-bottom: 18px;
      }

      .chart-svg {
        width: 100%;
      }

      .chart-svg svg {
        display: block;
        width: 100%;
        height: auto;
      }
    </style>
  </head>
  <body>
    <figure class="chart-embed">
      <div class="chart-meta">
        <h1>${title}</h1>
        <p>Unit: ${unit || 'value'}</p>
        <p>Series: ${seriesLine}</p>
        <p>Exported from StatInsight on ${exportedAt}</p>
      </div>
      <div class="chart-svg">
        ${svgMarkup}
      </div>
    </figure>
  </body>
</html>`;
}

export function ChartView({ chart, compareSeries = [] }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const data = chart.labels.map((label, index) => {
    const row: Record<string, string | number | null> = {
      name: label,
      Slovakia: chart.values[index],
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
  const seriesNames = ['Slovakia', ...compareSeries.map(buildSeriesLabel)];

  const getExportHtml = () => {
    const svg = chartRef.current?.querySelector('svg');
    if (!(svg instanceof SVGSVGElement)) {
      throw new Error('Chart is still rendering. Please try again in a moment.');
    }

    const clonedSvg = svg.cloneNode(true) as SVGSVGElement;
    clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clonedSvg.setAttribute('role', 'img');
    clonedSvg.setAttribute('aria-label', chart.title);
    clonedSvg.style.width = '100%';
    clonedSvg.style.height = 'auto';

    return buildExportHtml({
      title: chart.title,
      unit: chart.unit,
      seriesNames,
      svgMarkup: clonedSvg.outerHTML,
    });
  };

  const handleDownload = () => {
    try {
      const html = getExportHtml();
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${slugify(chart.title)}.html`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setExportStatus('HTML file downloaded.');
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : 'Failed to export chart HTML.');
    }
  };

  const handleCopy = async () => {
    try {
      const html = getExportHtml();
      await navigator.clipboard.writeText(html);
      setExportStatus('Embeddable HTML copied to clipboard.');
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : 'Failed to copy chart HTML.');
    }
  };

  return (
    <div ref={chartRef} className="chart-container">
      <div className="chart-header">
        <h2>{chart.title}</h2>
        <div className="chart-actions">
          <button type="button" className="chart-action" onClick={handleCopy}>
            Copy HTML
          </button>
          <button type="button" className="chart-action" onClick={handleDownload}>
            Download HTML
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
              label={{ value: `SK Avg: ${avg.toFixed(2)}`, position: 'right', fontSize: 11 }}
            />
          )}
          <Line
            type="monotone"
            dataKey="Slovakia"
            name="Slovakia"
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
