import { useState, useEffect } from 'react';
import { getCatalog, analyze } from './api';
import { buildChartPayload, computeInsights } from './analytics';
import { DatasetPicker } from './components/DatasetPicker';
import { ChartView } from './components/ChartView';
import { InsightCards } from './components/InsightCards';
import { TimeRangePicker } from './components/TimeRangePicker';
import type { CatalogEntry, AnalyzeResponse } from './types';
import './App.css';

function App() {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCatalog()
      .then(setCatalog)
      .catch((e) => setError(`Failed to load catalog: ${e.message}`));
  }, []);

  useEffect(() => {
    if (!result || result.series.points.length === 0) {
      setRangeStart(null);
      setRangeEnd(null);
      return;
    }

    setRangeStart(result.series.points[0].time);
    setRangeEnd(result.series.points[result.series.points.length - 1].time);
  }, [result]);

  const handleSelect = async (id: string) => {
    setSelected(id);
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await analyze(id);
      setResult(data);
    } catch (e: any) {
      setError(`Analysis failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const rangeOptions = result?.series.points.map((point) => ({
    value: point.time,
    label: point.label || point.time,
  })) ?? [];

  const startIndex = result && rangeStart
    ? result.series.points.findIndex((point) => point.time === rangeStart)
    : -1;
  const endIndex = result && rangeEnd
    ? result.series.points.findIndex((point) => point.time === rangeEnd)
    : -1;

  const hasValidRange = startIndex >= 0 && endIndex >= 0 && startIndex <= endIndex;
  const filteredPoints = result && hasValidRange
    ? result.series.points.slice(startIndex, endIndex + 1)
    : result?.series.points ?? [];

  const filteredResult = result
    ? {
        ...result,
        series: {
          ...result.series,
          points: filteredPoints,
        },
        chart: buildChartPayload({
          ...result.series,
          points: filteredPoints,
        }),
        insights: computeInsights(filteredPoints, result.series.unit),
      }
    : null;

  const handleRangeStartChange = (nextStart: string) => {
    if (!result) return;

    const nextStartIndex = result.series.points.findIndex((point) => point.time === nextStart);
    const currentEndIndex = rangeEnd
      ? result.series.points.findIndex((point) => point.time === rangeEnd)
      : result.series.points.length - 1;

    setRangeStart(nextStart);
    if (nextStartIndex > currentEndIndex) {
      setRangeEnd(nextStart);
    }
  };

  const handleRangeEndChange = (nextEnd: string) => {
    if (!result) return;

    const nextEndIndex = result.series.points.findIndex((point) => point.time === nextEnd);
    const currentStartIndex = rangeStart
      ? result.series.points.findIndex((point) => point.time === rangeStart)
      : 0;

    setRangeEnd(nextEnd);
    if (nextEndIndex < currentStartIndex) {
      setRangeStart(nextEnd);
    }
  };

  return (
    <div className="app">
      <header>
        <h1>StatInsight</h1>
        <p className="subtitle">Statistical Data Insight Tool for SK</p>
      </header>

      <main>
        <DatasetPicker
          catalog={catalog}
          selected={selected}
          loading={loading}
          onSelect={handleSelect}
        />

        {loading && (
          <div className="loading">
            <div className="spinner" />
            <p>Fetching and analyzing data...</p>
          </div>
        )}

        {error && <div className="error">{error}</div>}

        {result && filteredResult && !loading && rangeStart && rangeEnd && (
          <div className="results">
            <TimeRangePicker
              options={rangeOptions}
              from={rangeStart}
              to={rangeEnd}
              totalPoints={result.series.points.length}
              visiblePoints={filteredResult.series.points.length}
              onFromChange={handleRangeStartChange}
              onToChange={handleRangeEndChange}
            />

            <ChartView chart={filteredResult.chart} />
            <InsightCards insights={filteredResult.insights} />

            <details className="raw-data">
              <summary>Raw data ({filteredResult.series.points.length} data points)</summary>
              <table>
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResult.series.points.map((p, i) => (
                    <tr key={i}>
                      <td>{p.label || p.time}</td>
                      <td>{p.value !== null ? p.value.toFixed(2) : 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </div>
        )}
      </main>

      <footer>
        <p>
          Sources: <a href="https://ec.europa.eu/eurostat" target="_blank" rel="noreferrer">Eurostat</a>
          {' | '}
          <a href="https://datacube.statistics.sk" target="_blank" rel="noreferrer">SU SR DATAcube</a>
        </p>
      </footer>
    </div>
  );
}

export default App;
