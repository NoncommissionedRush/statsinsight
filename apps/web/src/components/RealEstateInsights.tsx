import { useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { RealEstateAnalysisResponse, RealEstateMover } from '../types';
import { copyChartHtml, downloadChartHtml, exportSvgChartAsHtml } from './chartExport';
import { formatPeriodLabel } from '../utils';

interface Props {
  data: RealEstateAnalysisResponse;
}

function formatChange(mover: RealEstateMover): string {
  const sign = mover.change >= 0 ? '+' : '';
  return `${sign}${mover.change.toFixed(2)}`;
}

function formatPercent(mover: RealEstateMover): string | null {
  if (mover.pctChange === undefined) return null;
  const sign = mover.pctChange >= 0 ? '+' : '';
  return `${sign}${mover.pctChange.toFixed(1)}%`;
}

function renderMoverCard(title: string, mover: RealEstateMover | null, emptyMessage: string) {
  if (!mover) {
    return (
      <div className="real-estate-card">
        <h3>{title}</h3>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="real-estate-card">
      <h3>{title}</h3>
      <p>
        Absolútna zmena: {formatChange(mover)} indexových bodov
      </p>
      <p>
        Relatívna zmena: {formatPercent(mover) ?? 'N/A'}
      </p>
      <p>Úroveň indexu: {mover.startValue.toFixed(2)} na {mover.endValue.toFixed(2)}</p>
    </div>
  );
}

function renderMoverTable(title: string, movers: RealEstateMover[]) {
  if (movers.length === 0) return null;

  return (
    <div className="grocery-table-block">
      <h3>{title}</h3>
      <table>
        <thead>
          <tr>
            <th>Typ nehnuteľnosti</th>
            <th>Zmena</th>
            <th>Začiatok</th>
            <th>Koniec</th>
          </tr>
        </thead>
        <tbody>
          {movers.map((mover) => (
            <tr key={`${title}-${mover.seriesCode}`}>
              <td>{mover.propertyLabel}</td>
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

export function RealEstateInsights({ data }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const selectedRangeChanged =
    data.requestedFrom !== data.comparedFrom || data.requestedTo !== data.comparedTo;
  const propertyCards = [
    'Nehnuteľnosti spolu',
    'Nové nehnuteľnosti',
    'Existujúce nehnuteľnosti',
  ].map((propertyLabel) => data.movers.find((mover) => mover.propertyLabel === propertyLabel) ?? null);

  const chartMovers = data.movers.map((mover) => ({
    name: mover.propertyLabel,
    change: Number(mover.change.toFixed(2)),
    fill: mover.change >= 0 ? '#dc2626' : '#2563eb',
  }));
  const exportTitle = `Prehľad zmien indexu nehnuteľností (${formatPeriodLabel(data.comparedFrom)} – ${formatPeriodLabel(data.comparedTo)})`;

  const getExportHtml = () =>
    exportSvgChartAsHtml({
      container: chartRef.current,
      title: exportTitle,
      unit: 'indexové body',
      seriesNames: chartMovers.map((mover) => mover.name),
      source: 'Štatistický úrad SR API',
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
    <section className="real-estate-section">
      <div className="real-estate-header">
        <h2>Pohyby cien nehnuteľností</h2>
        <p>
          Porovnané za obdobie {formatPeriodLabel(data.comparedFrom)} – {formatPeriodLabel(data.comparedTo)} na základe štvrťročných
          transakčných cenových indexov SÚ SR ({data.measureLabel}).
        </p>
        {selectedRangeChanged && (
          <p className="real-estate-note">
            Vami vybraté obdobie bolo {formatPeriodLabel(data.requestedFrom)} – {formatPeriodLabel(data.requestedTo)}, ale dáta o nehnuteľnostiach sú
            momentálne dostupné len za {formatPeriodLabel(data.comparedFrom)} – {formatPeriodLabel(data.comparedTo)} v rámci tohto okna.
          </p>
        )}
      </div>

      <div className="real-estate-grid">
        {renderMoverCard(
          'Nehnuteľnosti spolu',
          propertyCards[0],
          'Pre túto kategóriu nie je dostupná žiadna zmena indexu vo vybranom období.',
        )}
        {renderMoverCard(
          'Nové nehnuteľnosti',
          propertyCards[1],
          'Pre túto kategóriu nie je dostupná žiadna zmena indexu vo vybranom období.',
        )}
        {renderMoverCard(
          'Existujúce nehnuteľnosti',
          propertyCards[2],
          'Pre túto kategóriu nie je dostupná žiadna zmena indexu vo vybranom období.',
        )}
      </div>

      {chartMovers.length > 0 && (
        <div ref={chartRef} className="real-estate-chart-card">
          <div className="mini-chart-header">
            <div className="real-estate-chart-copy">
              <h3>Prehľad zmien indexu</h3>
              <p>Celková zmena naprieč sledovanými kategóriami nehnuteľností vo vybranom období.</p>
            </div>
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
          <div className="grocery-chart-wrap">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartMovers} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <ReferenceLine x={0} stroke="#94a3b8" />
                <XAxis type="number" tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={160} tick={{ fill: '#334155', fontSize: 12 }} />
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

      {data.movers.length > 0 && (
        <details className="raw-data">
          <summary>Zmeny kategórií nehnuteľností ({data.movers.length} kategórií)</summary>
          <div className="grocery-tables">
            {renderMoverTable('Všetky kategórie', data.movers)}
          </div>
        </details>
      )}
    </section>
  );
}
