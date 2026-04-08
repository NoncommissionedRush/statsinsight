import { useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { GroceryAnalysisResponse, GroceryMover } from '../types';
import { copyChartHtml, downloadChartHtml, exportSvgChartAsHtml } from './chartExport';

interface Props {
  data: GroceryAnalysisResponse;
}

function formatChange(mover: GroceryMover): string {
  const sign = mover.change >= 0 ? '+' : '';
  return `${sign}${mover.change.toFixed(2)} ${mover.unit}`;
}

function formatPercent(mover: GroceryMover): string | null {
  if (mover.pctChange === undefined) return null;
  const sign = mover.pctChange >= 0 ? '+' : '';
  return `${sign}${mover.pctChange.toFixed(1)}%`;
}

function renderMoverCard(title: string, mover: GroceryMover | null, emptyMessage: string, metric: 'absolute' | 'percent' = 'absolute') {
  if (!mover) {
    return (
      <div className="grocery-card">
        <h3>{title}</h3>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  const primary = metric === 'percent' ? formatPercent(mover) : formatChange(mover);
  const secondary = metric === 'percent' ? formatChange(mover) : formatPercent(mover);

  return (
    <div className="grocery-card">
      <h3>{title}</h3>
      <strong>{mover.itemLabel}</strong>
      <p>
        {primary}
        {secondary ? ` (${secondary})` : ''}
      </p>
      <p>
        {mover.startValue.toFixed(2)} to {mover.endValue.toFixed(2)} {mover.unit}
      </p>
    </div>
  );
}

function renderMoverTable(title: string, movers: GroceryMover[]) {
  if (movers.length === 0) return null;

  return (
    <div className="grocery-table-block">
      <h3>{title}</h3>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Change</th>
            <th>Start</th>
            <th>End</th>
          </tr>
        </thead>
        <tbody>
          {movers.map((mover) => (
            <tr key={`${title}-${mover.itemCode}`}>
              <td>{mover.itemLabel}</td>
              <td>
                {formatChange(mover)}
                {formatPercent(mover) ? ` (${formatPercent(mover)})` : ''}
              </td>
              <td>{mover.startValue.toFixed(2)}</td>
              <td>{mover.endValue.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function GroceryInsights({ data }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const selectedRangeChanged =
    data.requestedFrom !== data.comparedFrom || data.requestedTo !== data.comparedTo;
  const moversWithPct = data.movers.filter((mover) => mover.pctChange !== undefined);
  const topPctIncrease = moversWithPct.reduce<GroceryMover | null>(
    (best, mover) => (best === null || (mover.pctChange ?? -Infinity) > (best.pctChange ?? -Infinity) ? mover : best),
    null,
  );
  const topPctDecrease = moversWithPct.reduce<GroceryMover | null>(
    (best, mover) => (best === null || (mover.pctChange ?? Infinity) < (best.pctChange ?? Infinity) ? mover : best),
    null,
  );

  const topIncreases = data.movers.filter((mover) => mover.change > 0).slice(0, 5);
  const topDecreases = [...data.movers]
    .filter((mover) => mover.change < 0)
    .sort((a, b) => a.change - b.change)
    .slice(0, 5);

  const chartMovers = [...topDecreases, ...topIncreases].map((mover) => ({
    name: mover.itemLabel,
    change: Number(mover.change.toFixed(2)),
    fill: mover.change >= 0 ? '#dc2626' : '#2563eb',
  }));
  const exportTitle = `Grocery Price Change Overview (${data.comparedFrom} to ${data.comparedTo})`;

  const getExportHtml = () =>
    exportSvgChartAsHtml({
      container: chartRef.current,
      title: exportTitle,
      unit: 'change in price',
      seriesNames: chartMovers.map((mover) => mover.name),
      source: 'SU SR DATAcube',
    });

  const handleCopy = async () => {
    try {
      await copyChartHtml(getExportHtml());
      setExportStatus('Embeddable HTML copied to clipboard.');
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : 'Failed to copy chart HTML.');
    }
  };

  const handleDownload = () => {
    try {
      downloadChartHtml(getExportHtml(), exportTitle);
      setExportStatus('HTML file downloaded.');
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : 'Failed to export chart HTML.');
    }
  };

  return (
    <section className="groceries-section">
      <div className="groceries-header">
        <h2>Grocery Price Movers</h2>
        <p>
          Compared across {data.comparedFrom} to {data.comparedTo} using Slovak Statistics monthly
          average consumer prices for selected food and drink items.
        </p>
        {selectedRangeChanged && (
          <p className="groceries-note">
            Your selected range was {data.requestedFrom} to {data.requestedTo}, but grocery data is
            currently available only for {data.comparedFrom} to {data.comparedTo} within that window.
          </p>
        )}
      </div>

      <div className="grocery-grid grocery-grid-four">
        {renderMoverCard(
          'Largest Increase',
          data.topIncrease,
          'No grocery price increase was detected in this range.',
        )}
        {renderMoverCard(
          'Largest Decrease',
          data.topDecrease,
          'No grocery price decrease was detected in this range.',
        )}
        {renderMoverCard(
          'Largest % Increase',
          topPctIncrease,
          'No grocery percentage increase was detected in this range.',
          'percent',
        )}
        {renderMoverCard(
          'Largest % Decrease',
          topPctDecrease,
          'No grocery percentage decrease was detected in this range.',
          'percent',
        )}
      </div>

      {chartMovers.length > 0 && (
        <div ref={chartRef} className="grocery-chart-card">
          <div className="mini-chart-header">
            <div className="grocery-chart-copy">
              <h3>Price Change Overview</h3>
              <p>Largest decreases and increases in the selected grocery range.</p>
            </div>
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
          <div className="grocery-chart-wrap">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartMovers} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <ReferenceLine x={0} stroke="#94a3b8" />
                <XAxis type="number" tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={160}
                  tick={{ fill: '#334155', fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value: number) => value.toFixed(2)}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
                <Bar dataKey="change" radius={[6, 6, 6, 6]}>
                  {chartMovers.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {(topIncreases.length > 0 || topDecreases.length > 0) && (
        <details className="raw-data">
          <summary>
            Grocery movers tables ({topIncreases.length} increases, {topDecreases.length} decreases)
          </summary>
          <div className="grocery-tables">
            {renderMoverTable('Top Increases', topIncreases)}
            {renderMoverTable('Top Decreases', topDecreases)}
          </div>
        </details>
      )}
    </section>
  );
}
