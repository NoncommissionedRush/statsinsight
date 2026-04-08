import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { ChartPayload } from '../types';

interface Props {
  chart: ChartPayload;
}

export function ChartView({ chart }: Props) {
  const data = chart.labels.map((label, i) => ({
    name: label,
    value: chart.values[i],
  }));

  // Compute average for reference line
  const validValues = chart.values.filter((v): v is number => v !== null);
  const avg = validValues.length > 0
    ? validValues.reduce((s, v) => s + v, 0) / validValues.length
    : null;

  return (
    <div className="chart-container">
      <h2>{chart.title}</h2>
      <ResponsiveContainer width="100%" height={400}>
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
            formatter={(value: number) => [value.toFixed(2), chart.unit]}
            labelStyle={{ fontWeight: 'bold' }}
          />
          {avg !== null && (
            <ReferenceLine
              y={avg}
              stroke="#999"
              strokeDasharray="5 5"
              label={{ value: `Avg: ${avg.toFixed(2)}`, position: 'right', fontSize: 11 }}
            />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke="#2563eb"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 6 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
