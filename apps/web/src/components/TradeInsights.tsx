import { useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TradeAnalysisResponse, TradeMover } from '../types';
import { copyChartHtml, downloadChartHtml, exportSvgChartAsHtml } from './chartExport';
import { formatPeriodLabel } from '../utils';

interface Props {
  data: TradeAnalysisResponse;
}

const TRADE_SHARE_COLORS = ['#2563eb', '#f97316', '#16a34a', '#dc2626', '#7c3aed', '#eab308'];

function formatTradeChange(mover: TradeMover): string {
  const sign = mover.change >= 0 ? '+' : '';
  return `${sign}${mover.change.toFixed(1)} mil. EUR`;
}

function renderMoverCard(
  title: string,
  mover: TradeMover | null,
  emptyMessage: string,
  tone: 'increase' | 'decrease',
) {
  if (!mover) {
    return (
      <div className={`grocery-card grocery-card-${tone}`}>
        <h3>{title}</h3>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  const pct = mover.pctChange === undefined ? 'N/A' : `${mover.pctChange >= 0 ? '+' : ''}${mover.pctChange.toFixed(1)}%`;

  return (
    <div className={`grocery-card grocery-card-${tone}`}>
      <h3>{title}</h3>
      <strong>{mover.categoryLabel}</strong>
      <p>{formatTradeChange(mover)} ({pct})</p>
      <p>{mover.startValue.toFixed(1)} na {mover.endValue.toFixed(1)} mil. EUR</p>
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
            <th>Kategória</th>
            <th>Zmena</th>
            <th>Začiatok</th>
            <th>Koniec</th>
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

function renderTradeShareChart(title: string, movers: TradeMover[], periodLabel: string) {
  const rankedCategories = [...movers]
    .filter((mover) => mover.endValue > 0)
    .sort((a, b) => b.endValue - a.endValue);

  const topCategories = rankedCategories.slice(0, 5);

  if (topCategories.length === 0) {
    return null;
  }

  const total = rankedCategories.reduce((sum, mover) => sum + mover.endValue, 0);
  const topTotal = topCategories.reduce((sum, mover) => sum + mover.endValue, 0);
  const pieData = topCategories.map((mover) => ({
    name: mover.categoryLabel,
    value: Number(mover.endValue.toFixed(1)),
    share: total > 0 ? (mover.endValue / total) * 100 : 0,
  }));

  if (total > topTotal) {
    pieData.push({
      name: 'Ostatné kategórie',
      value: Number((total - topTotal).toFixed(1)),
      share: total > 0 ? ((total - topTotal) / total) * 100 : 0,
    });
  }

  return (
    <div className="trade-pie-card">
      <div className="grocery-chart-copy">
        <h3>{title}</h3>
        <p>Najväčšie kategórie podľa hodnoty v koncovom období {periodLabel}.</p>
      </div>
      <div className="trade-pie-wrap">
        <ResponsiveContainer width="100%" height={340}>
          <PieChart margin={{ top: 2, right: 8, bottom: 8, left: 8 }}>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={56}
              outerRadius={102}
              paddingAngle={2}
            >
              {pieData.map((entry, index) => (
                <Cell key={entry.name} fill={TRADE_SHARE_COLORS[index % TRADE_SHARE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, _name, item) => {
                const payload = item.payload as { share?: number };
                return [`${value.toFixed(1)} mil. EUR (${(payload.share ?? 0).toFixed(1)}%)`, 'Hodnota'];
              }}
              contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="trade-pie-legend">
        {pieData.map((entry, index) => (
          <div key={entry.name} className="trade-pie-legend-item">
            <span
              className="trade-pie-legend-swatch"
              style={{ backgroundColor: TRADE_SHARE_COLORS[index % TRADE_SHARE_COLORS.length] }}
            />
            <span className="trade-pie-legend-text">
              {entry.name} ({entry.share.toFixed(1)} %)
            </span>
          </div>
        ))}
      </div>
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
      name: `Dovoz: ${mover.categoryLabel}`,
      change: Number(mover.change.toFixed(1)),
      fill: '#dc2626',
    })),
    ...topImportIncreases.map((mover) => ({
      name: `Dovoz: ${mover.categoryLabel}`,
      change: Number(mover.change.toFixed(1)),
      fill: '#16a34a',
    })),
    ...topExportDecreases.map((mover) => ({
      name: `Vývoz: ${mover.categoryLabel}`,
      change: Number(mover.change.toFixed(1)),
      fill: '#dc2626',
    })),
    ...topExportIncreases.map((mover) => ({
      name: `Vývoz: ${mover.categoryLabel}`,
      change: Number(mover.change.toFixed(1)),
      fill: '#16a34a',
    })),
  ];
  const exportTitle = `Prehľad zmien kategórií dovozu a vývozu (${formatPeriodLabel(data.comparedFrom)} – ${formatPeriodLabel(data.comparedTo)})`;

  const getExportHtml = () =>
    exportSvgChartAsHtml({
      container: chartRef.current,
      title: exportTitle,
      unit: 'mil. EUR',
      seriesNames: chartMovers.map((mover) => mover.name),
      source: 'SU SR DATAcube',
    });

  const handleCopy = async () => {
    try {
      await copyChartHtml(getExportHtml());
      setExportStatus('HTML skopírované do schránky.');
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : 'Chyba pri kopírovaní HTML grafu.');
    }
  };

  const handleDownload = () => {
    try {
      downloadChartHtml(getExportHtml(), exportTitle);
      setExportStatus('HTML súbor bol stiahnutý.');
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : 'Chyba pri exporte grafu do HTML.');
    }
  };

  return (
    <section className="groceries-section">
      <div className="groceries-header">
        <h2>Pohyby kategórií dovozu a vývozu</h2>
        <p>
          Porovnané za obdobie {formatPeriodLabel(data.comparedFrom)} – {formatPeriodLabel(data.comparedTo)} na základe zahraničného obchodu
          SR podľa kategórií BEC Rev. 4 (SÚ SR).
        </p>
        {selectedRangeChanged && (
          <p className="groceries-note">
            Vami vybraté obdobie bolo {formatPeriodLabel(data.requestedFrom)} – {formatPeriodLabel(data.requestedTo)}, ale dáta o obchode sú
            momentálne dostupné len za {formatPeriodLabel(data.comparedFrom)} – {formatPeriodLabel(data.comparedTo)} v rámci tohto okna.
          </p>
        )}
      </div>

      <div className="grocery-grid grocery-grid-four">
        {renderMoverCard('Najväčší nárast dovozu', data.importTopIncrease, 'V tomto období nebol zaznamenaný žiadny nárast dovozu.', 'increase')}
        {renderMoverCard('Najväčší pokles dovozu', data.importTopDecrease, 'V tomto období nebol zaznamenaný žiadny pokles dovozu.', 'decrease')}
        {renderMoverCard('Najväčší nárast vývozu', data.exportTopIncrease, 'V tomto období nebol zaznamenaný žiadny nárast vývozu.', 'increase')}
        {renderMoverCard('Najväčší pokles vývozu', data.exportTopDecrease, 'V tomto období nebol zaznamenaný žiadny pokles vývozu.', 'decrease')}
      </div>

      {chartMovers.length > 0 && (
        <div ref={chartRef} className="grocery-chart-card">
          <div className="mini-chart-header">
            <div className="grocery-chart-copy">
              <h3>Prehľad zmien kategórií</h3>
              <p>Najväčšie nárasty a poklesy naprieč kategóriami dovozu a vývozu vo vybranom období.</p>
            </div>
            <div className="chart-actions">
              <button type="button" className="chart-action" onClick={handleCopy}>Kopírovať HTML</button>
              <button type="button" className="chart-action" onClick={handleDownload}>Stiahnuť HTML</button>
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
                  formatter={(value: number) => `${value.toFixed(1)} mil. EUR`}
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

      <div className="trade-pie-grid">
        {renderTradeShareChart(
          `Najväčšie kategórie dovozu (${formatPeriodLabel(data.comparedTo)})`,
          data.importMovers,
          formatPeriodLabel(data.comparedTo),
        )}
        {renderTradeShareChart(
          `Najväčšie kategórie vývozu (${formatPeriodLabel(data.comparedTo)})`,
          data.exportMovers,
          formatPeriodLabel(data.comparedTo),
        )}
      </div>

      {(data.importMovers.length > 0 || data.exportMovers.length > 0) && (
        <details className="raw-data">
          <summary>
            Tabuľky kategórií obchodu ({data.importMovers.length} kategórií dovozu, {data.exportMovers.length} kategórií vývozu)
          </summary>
          <div className="grocery-tables">
            {renderMoverTable('Kategórie dovozu', data.importMovers)}
            {renderMoverTable('Kategórie vývozu', data.exportMovers)}
          </div>
        </details>
      )}
    </section>
  );
}
