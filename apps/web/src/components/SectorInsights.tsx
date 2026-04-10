import { useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SectorAnalysisResponse, SectorMover } from '../types';
import { copyChartHtml, downloadChartHtml, exportSvgChartAsHtml } from './chartExport';
import { formatPeriodLabel } from '../utils';

interface Props {
  data: SectorAnalysisResponse;
  title: string;
  intro: string;
  unitLabel: string;
  changeDecimals?: number;
  valueDecimals?: number;
}

function normalizeQuarterLike(value: string) {
  const match = value.match(/(\d{4}).*?([1-4]).*Q/i);
  if (match) return `${match[1]}-Q${match[2]}`;
  return value;
}

function formatNumber(value: number, decimals: number) {
  return value.toFixed(decimals);
}

function formatChange(mover: SectorMover, unitLabel: string, decimals: number): string {
  const sign = mover.change >= 0 ? '+' : '';
  return `${sign}${formatNumber(mover.change, decimals)} ${unitLabel}`;
}

function formatPercent(mover: SectorMover): string | null {
  if (mover.pctChange === undefined) return null;
  const sign = mover.pctChange >= 0 ? '+' : '';
  return `${sign}${mover.pctChange.toFixed(1)}%`;
}

function renderMoverCard(
  title: string,
  mover: SectorMover | null,
  emptyMessage: string,
  unitLabel: string,
  changeDecimals: number,
  valueDecimals: number,
  metric: 'absolute' | 'percent' = 'absolute',
  tone: 'increase' | 'decrease' = 'increase',
) {
  if (!mover) {
    return (
      <div className={`grocery-card grocery-card-${tone}`}>
        <h3>{title}</h3>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  const primary = metric === 'percent' ? formatPercent(mover) : formatChange(mover, unitLabel, changeDecimals);
  const secondary = metric === 'percent' ? formatChange(mover, unitLabel, changeDecimals) : formatPercent(mover);

  return (
    <div className={`grocery-card grocery-card-${tone}`}>
      <h3>{title}</h3>
      <strong>{mover.seriesLabel}</strong>
      <p>
        {primary}
        {secondary ? ` (${secondary})` : ''}
      </p>
      <p>
        {formatNumber(mover.startValue, valueDecimals)} na {formatNumber(mover.endValue, valueDecimals)} {unitLabel}
      </p>
    </div>
  );
}

function renderMoverTable(
  title: string,
  movers: SectorMover[],
  unitLabel: string,
  changeDecimals: number,
  valueDecimals: number,
) {
  if (movers.length === 0) return null;

  return (
    <div className="grocery-table-block">
      <h3>{title}</h3>
      <table>
        <thead>
          <tr>
            <th>Sektor</th>
            <th>Zmena</th>
            <th>Začiatok</th>
            <th>Koniec</th>
          </tr>
        </thead>
        <tbody>
          {movers.map((mover) => (
            <tr key={`${title}-${mover.seriesCode}`}>
              <td>{mover.seriesLabel}</td>
              <td>
                {formatChange(mover, unitLabel, changeDecimals)}
                {formatPercent(mover) ? ` (${formatPercent(mover)})` : ''}
              </td>
              <td>{formatNumber(mover.startValue, valueDecimals)}</td>
              <td>{formatNumber(mover.endValue, valueDecimals)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SectorInsights({
  data,
  title,
  intro,
  unitLabel,
  changeDecimals = 1,
  valueDecimals = 1,
}: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const levelChartRef = useRef<HTMLDivElement>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const selectedRangeChanged =
    normalizeQuarterLike(data.requestedFrom) !== normalizeQuarterLike(data.comparedFrom) ||
    normalizeQuarterLike(data.requestedTo) !== normalizeQuarterLike(data.comparedTo);
  const strongestIncrease = data.topIncrease ?? data.movers[0] ?? null;
  const strongestDecrease = data.topDecrease ?? data.movers[data.movers.length - 1] ?? null;
  const increaseTitle =
    strongestIncrease && strongestIncrease.change < 0 ? 'Najmenší pokles' : 'Najväčší nárast';
  const decreaseTitle =
    strongestDecrease && strongestDecrease.change > 0 ? 'Najmenší rast' : 'Najväčší pokles';
  const moversWithPct = data.movers.filter((mover) => mover.pctChange !== undefined);
  const topPctIncrease = moversWithPct.reduce<SectorMover | null>(
    (best, mover) => (best === null || (mover.pctChange ?? -Infinity) > (best.pctChange ?? -Infinity) ? mover : best),
    strongestIncrease,
  );
  const topPctDecrease = moversWithPct.reduce<SectorMover | null>(
    (best, mover) => (best === null || (mover.pctChange ?? Infinity) < (best.pctChange ?? Infinity) ? mover : best),
    strongestDecrease,
  );
  const pctIncreaseTitle =
    topPctIncrease && (topPctIncrease.pctChange ?? 0) < 0 ? 'Najmenší % pokles' : 'Najväčší % nárast';
  const pctDecreaseTitle =
    topPctDecrease && (topPctDecrease.pctChange ?? 0) > 0 ? 'Najmenší % rast' : 'Najväčší % pokles';

  const topIncreases = data.movers.filter((mover) => mover.change > 0).slice(0, 5);
  const topDecreases = [...data.movers]
    .filter((mover) => mover.change < 0)
    .sort((a, b) => a.change - b.change)
    .slice(0, 5);
  const changeChartData = [...topDecreases, ...topIncreases].map((mover) => ({
    name: mover.seriesLabel,
    change: Number(mover.change.toFixed(changeDecimals)),
    fill: mover.change >= 0 ? '#16a34a' : '#dc2626',
  }));
  const levelChartData = [...data.movers]
    .sort((a, b) => b.endValue - a.endValue)
    .slice(0, 8)
    .map((mover) => ({
      name: mover.seriesLabel,
      value: Number(mover.endValue.toFixed(valueDecimals)),
    }));
  const exportTitle = `${title} (${formatPeriodLabel(data.comparedFrom)} – ${formatPeriodLabel(data.comparedTo)})`;

  const getChangeChartHtml = () =>
    exportSvgChartAsHtml({
      container: chartRef.current,
      title: exportTitle,
      unit: unitLabel,
      seriesNames: changeChartData.map((item) => item.name),
      source: 'Štatistický úrad SR API',
    });

  const getLevelChartHtml = () =>
    exportSvgChartAsHtml({
      container: levelChartRef.current,
      title: `${title} - úrovne v koncovom období`,
      unit: unitLabel,
      seriesNames: levelChartData.map((item) => item.name),
      source: 'Štatistický úrad SR API',
    });

  const handleCopy = async () => {
    try {
      await copyChartHtml(getChangeChartHtml());
      setExportStatus('HTML skopírované do schránky.');
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : 'Chyba pri kopírovaní HTML grafu.');
    }
  };

  const handleDownload = () => {
    try {
      downloadChartHtml(getChangeChartHtml(), exportTitle);
      setExportStatus('HTML súbor bol stiahnutý.');
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : 'Chyba pri exporte grafu do HTML.');
    }
  };

  return (
    <section className="groceries-section">
      <div className="groceries-header">
        <h2>{title}</h2>
        <p>
          {intro} {formatPeriodLabel(data.comparedFrom)} – {formatPeriodLabel(data.comparedTo)}.
        </p>
        {selectedRangeChanged && (
          <p className="groceries-note">
            Vami vybraté obdobie bolo {formatPeriodLabel(data.requestedFrom)} – {formatPeriodLabel(data.requestedTo)}, ale sektorové dáta sú
            momentálne porovnané v okne {formatPeriodLabel(data.comparedFrom)} – {formatPeriodLabel(data.comparedTo)}.
          </p>
        )}
      </div>

      <div className="grocery-grid grocery-grid-four">
        {renderMoverCard(
          increaseTitle,
          strongestIncrease,
          'V tomto období nebol zaznamenaný žiadny nárast.',
          unitLabel,
          changeDecimals,
          valueDecimals,
          'absolute',
          'increase',
        )}
        {renderMoverCard(
          decreaseTitle,
          strongestDecrease,
          'V tomto období nebol zaznamenaný žiadny pokles.',
          unitLabel,
          changeDecimals,
          valueDecimals,
          'absolute',
          'decrease',
        )}
        {renderMoverCard(
          pctIncreaseTitle,
          topPctIncrease,
          'V tomto období nebol zaznamenaný žiadny percentuálny nárast.',
          unitLabel,
          changeDecimals,
          valueDecimals,
          'percent',
          'increase',
        )}
        {renderMoverCard(
          pctDecreaseTitle,
          topPctDecrease,
          'V tomto období nebol zaznamenaný žiadny percentuálny pokles.',
          unitLabel,
          changeDecimals,
          valueDecimals,
          'percent',
          'decrease',
        )}
      </div>

      {changeChartData.length > 0 && (
        <div ref={chartRef} className="grocery-chart-card">
          <div className="mini-chart-header">
            <div className="grocery-chart-copy">
              <h3>Najväčšie sektorové zmeny</h3>
              <p>Najvýraznejšie nárasty a poklesy vo vybranom období.</p>
            </div>
            <div className="chart-actions">
              <button type="button" className="chart-action" onClick={handleCopy}>Kopírovať HTML</button>
              <button type="button" className="chart-action" onClick={handleDownload}>Stiahnuť HTML</button>
            </div>
          </div>
          {exportStatus && <p className="chart-export-status">{exportStatus}</p>}
          <div className="grocery-chart-wrap">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={changeChartData} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <ReferenceLine x={0} stroke="#94a3b8" />
                <XAxis type="number" tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={200} tick={{ fill: '#334155', fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number) => `${value.toFixed(changeDecimals)} ${unitLabel}`}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
                <Bar dataKey="change" radius={[6, 6, 6, 6]}>
                  {changeChartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {levelChartData.length > 0 && (
        <div ref={levelChartRef} className="grocery-chart-card">
          <div className="mini-chart-header">
            <div className="grocery-chart-copy">
              <h3>Najvyššie úrovne v koncovom období</h3>
              <p>Sektory s najvyššou hodnotou na konci porovnávaného obdobia.</p>
            </div>
            <div className="chart-actions">
              <button type="button" className="chart-action" onClick={() => copyChartHtml(getLevelChartHtml())}>Kopírovať HTML</button>
              <button type="button" className="chart-action" onClick={() => downloadChartHtml(getLevelChartHtml(), `${title}-urovne`)}>Stiahnuť HTML</button>
            </div>
          </div>
          <div className="grocery-chart-wrap">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={levelChartData} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={200} tick={{ fill: '#334155', fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number) => `${value.toFixed(valueDecimals)} ${unitLabel}`}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
                <Bar dataKey="value" radius={[6, 6, 6, 6]} fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {data.movers.length > 0 && (
        <details className="raw-data">
          <summary>Sektorové tabuľky ({data.movers.length} sektorov)</summary>
          <div className="grocery-tables">
            {renderMoverTable('Najväčšie nárasty', topIncreases, unitLabel, changeDecimals, valueDecimals)}
            {renderMoverTable('Najväčšie poklesy', topDecreases, unitLabel, changeDecimals, valueDecimals)}
            {renderMoverTable('Všetky sektory', data.movers, unitLabel, changeDecimals, valueDecimals)}
          </div>
        </details>
      )}
    </section>
  );
}
