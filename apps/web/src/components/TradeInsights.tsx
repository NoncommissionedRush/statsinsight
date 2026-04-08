import { useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TradeAnalysisResponse, TradeMover } from '../types';
import { copyChartHtml, downloadChartHtml, exportSvgChartAsHtml } from './chartExport';

interface Props {
  data: TradeAnalysisResponse;
}

function formatTradeChange(mover: TradeMover): string {
  const sign = mover.change >= 0 ? '+' : '';
  return `${sign}${mover.change.toFixed(1)} million EUR`;
}

function renderMoverCard(title: string, mover: TradeMover | null, emptyMessage: string) {
  if (!mover) {
    return (
      <div className="grocery-card">
        <h3>{title}</h3>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  const pct = mover.pctChange === undefined ? 'N/A' : `${mover.pctChange >= 0 ? '+' : ''}${mover.pctChange.toFixed(1)}%`;

  return (
    <div className="grocery-card">
      <h3>{title}</h3>
      <strong>{mover.categoryLabel}</strong>
      <p>{formatTradeChange(mover)} ({pct})</p>
      <p>{mover.startValue.toFixed(1)} to {mover.endValue.toFixed(1)} million EUR</p>
    </div>
  );
}

function renderMoverTable(title: string, movers: TradeMover[]) {
  if (movers.length === 0) return null;

  return (
    <div className="grocery-table-block">
      <h3>{title}</h3>
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th>Change</th>
            <th>Start</th>
            <th>End</th>
          </tr>
        </thead>
        <tbody>
          {movers.map((mover) => (
            <tr key={`${title}-${mover.seriesCode}`}>
              <td>{mover.categoryLabel}</td>
              <td>
                {formatTradeChange(mover)}
                {mover.pctChange !== undefined
                  ? ` (${mover.pctChange >= 0 ? '+' : ''}${mover.pctChange.toFixed(1)}%)`
                  : ''}
              </td>
              <td>{mover.startValue.toFixed(1)}</td>
              <td>{mover.endValue.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TradeInsights({ data }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const selectedRangeChanged =
    data.requestedFrom !== data.comparedFrom || data.requestedTo !== data.comparedTo;

  const topImportIncreases = data.importMovers.filter((mover) => mover.change > 0).slice(0, 2);
  const topImportDecreases = [...data.importMovers]
    .filter((mover) => mover.change < 0)
    .sort((a, b) => a.change - b.change)
    .slice(0, 2);
  const topExportIncreases = data.exportMovers.filter((mover) => mover.change > 0).slice(0, 2);
  const topExportDecreases = [...data.exportMovers]
    .filter((mover) => mover.change < 0)
    .sort((a, b) => a.change - b.change)
    .slice(0, 2);

  const chartMovers = [
    ...topImportDecreases.map((mover) => ({
      name: `Import: ${mover.categoryLabel}`,
      change: Number(mover.change.toFixed(1)),
      fill: '#dc2626',
    })),
    ...topImportIncreases.map((mover) => ({
      name: `Import: ${mover.categoryLabel}`,
      change: Number(mover.change.toFixed(1)),
      fill: '#16a34a',
    })),
    ...topExportDecreases.map((mover) => ({
      name: `Export: ${mover.categoryLabel}`,
      change: Number(mover.change.toFixed(1)),
      fill: '#dc2626',
    })),
    ...topExportIncreases.map((mover) => ({
      name: `Export: ${mover.categoryLabel}`,
      change: Number(mover.change.toFixed(1)),
      fill: '#16a34a',
    })),
  ];
  const exportTitle = `Import Export Category Changes (${data.comparedFrom} to ${data.comparedTo})`;

  const getExportHtml = () =>
    exportSvgChartAsHtml({
      container: chartRef.current,
      title: exportTitle,
      unit: 'million EUR',
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
        <h2>Import/Export Category Movers</h2>
        <p>
          Compared across {data.comparedFrom} to {data.comparedTo} using Slovak Statistics foreign trade
          by BEC Rev. 4 categories.
        </p>
        {selectedRangeChanged && (
          <p className="groceries-note">
            Your selected range was {data.requestedFrom} to {data.requestedTo}, but trade data is
            currently available only for {data.comparedFrom} to {data.comparedTo} within that window.
          </p>
        )}
      </div>

      <div className="grocery-grid grocery-grid-four">
        {renderMoverCard('Largest Import Increase', data.importTopIncrease, 'No import increase was detected in this range.')}
        {renderMoverCard('Largest Import Decrease', data.importTopDecrease, 'No import decrease was detected in this range.')}
        {renderMoverCard('Largest Export Increase', data.exportTopIncrease, 'No export increase was detected in this range.')}
        {renderMoverCard('Largest Export Decrease', data.exportTopDecrease, 'No export decrease was detected in this range.')}
      </div>

      {chartMovers.length > 0 && (
        <div ref={chartRef} className="grocery-chart-card">
          <div className="mini-chart-header">
            <div className="grocery-chart-copy">
              <h3>Category Change Overview</h3>
              <p>Largest increases and decreases across import and export categories in the selected range.</p>
            </div>
            <div className="chart-actions">
              <button type="button" className="chart-action" onClick={handleCopy}>Copy HTML</button>
              <button type="button" className="chart-action" onClick={handleDownload}>Download HTML</button>
            </div>
          </div>
          {exportStatus && <p className="chart-export-status">{exportStatus}</p>}
          <div className="grocery-chart-wrap">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartMovers} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <ReferenceLine x={0} stroke="#94a3b8" />
                <XAxis type="number" tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={220} tick={{ fill: '#334155', fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number) => `${value.toFixed(1)} million EUR`}
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

      {(data.importMovers.length > 0 || data.exportMovers.length > 0) && (
        <details className="raw-data">
          <summary>
            Trade category tables ({data.importMovers.length} import categories, {data.exportMovers.length} export categories)
          </summary>
          <div className="grocery-tables">
            {renderMoverTable('Import Categories', data.importMovers)}
            {renderMoverTable('Export Categories', data.exportMovers)}
          </div>
        </details>
      )}
    </section>
  );
}
