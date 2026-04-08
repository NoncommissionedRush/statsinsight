import type { Insight } from '../types';

interface Props {
  insights: Insight[];
  title?: string;
}

const KIND_ICONS: Record<string, string> = {
  period_delta: 'delta',
  average_change: 'avg',
  pct_change: '%',
  rolling_avg_deviation: '~',
  trend_reversal: 'rev',
  largest_move: 'max',
};

export function InsightCards({ insights, title = 'Insights' }: Props) {
  if (insights.length === 0) {
    return <p className="no-insights">No notable insights detected for this dataset.</p>;
  }

  return (
    <div className="insights">
      <h2>{title}</h2>
      <div className="insight-grid">
        {insights.map((insight, i) => (
          <div key={i} className="insight-card">
            <div className="insight-badge">{KIND_ICONS[insight.kind] || '?'}</div>
            <div className="insight-content">
              <h4>{insight.title}</h4>
              <p>{insight.description}</p>
              {insight.period && <span className="insight-period">{insight.period}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
