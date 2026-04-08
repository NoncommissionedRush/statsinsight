import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { RealEstateAnalysisResponse, RealEstateMover } from '../types';

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
        Absolute change: {formatChange(mover)} index points
      </p>
      <p>
        Relative change: {formatPercent(mover) ?? 'N/A'}
      </p>
      <p>Index level: {mover.startValue.toFixed(2)} to {mover.endValue.toFixed(2)}</p>
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
            <th>Property Type</th>
            <th>Change</th>
            <th>Start</th>
            <th>End</th>
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

  return (
    <section className="real-estate-section">
      <div className="real-estate-header">
        <h2>Real Estate Price Movers</h2>
        <p>
          Compared across {data.comparedFrom} to {data.comparedTo} using Slovak Statistics quarterly
          transaction price indices ({data.measureLabel}).
        </p>
        {selectedRangeChanged && (
          <p className="real-estate-note">
            Your selected range was {data.requestedFrom} to {data.requestedTo}, but real estate data is
            currently available only for {data.comparedFrom} to {data.comparedTo} within that window.
          </p>
        )}
      </div>

      <div className="real-estate-grid">
        {renderMoverCard(
          'Nehnuteľnosti spolu',
          propertyCards[0],
          'No overall index change is available for this category in the selected range.',
        )}
        {renderMoverCard(
          'Nové nehnuteľnosti',
          propertyCards[1],
          'No overall index change is available for this category in the selected range.',
        )}
        {renderMoverCard(
          'Existujúce nehnuteľnosti',
          propertyCards[2],
          'No overall index change is available for this category in the selected range.',
        )}
      </div>

      {chartMovers.length > 0 && (
        <div className="real-estate-chart-card">
          <div className="real-estate-chart-copy">
            <h3>Index Change Overview</h3>
            <p>Overall change across the tracked real-estate categories in the selected range.</p>
          </div>
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
          <summary>Real estate category changes ({data.movers.length} categories)</summary>
          <div className="grocery-tables">
            {renderMoverTable('All Categories', data.movers)}
          </div>
        </details>
      )}
    </section>
  );
}
