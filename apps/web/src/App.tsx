import { useState, useEffect } from 'react';
import { getCatalog, analyze, analyzeGroceries } from './api';
import { buildChartPayload, computeInsights } from './analytics';
import { CountryComparisonPicker } from './components/CountryComparisonPicker';
import { DatasetPicker } from './components/DatasetPicker';
import { ChartView } from './components/ChartView';
import { GroceryInsights } from './components/GroceryInsights';
import { InsightCards } from './components/InsightCards';
import { TimeRangePicker } from './components/TimeRangePicker';
import { COUNTRY_OPTIONS } from './countries';
import type { CatalogEntry, AnalyzeResponse, GroceryAnalysisResponse } from './types';
import './App.css';

const GROCERY_INSIGHTS_DATASET_ID = 'eurostat:prc_hicp_manr';
const COUNTRY_COMPARISON_DATASET_IDS = new Set([
  'eurostat:prc_hicp_manr',
  'eurostat:une_rt_m',
  'eurostat:namq_10_gdp',
]);

function App() {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [compareCountries, setCompareCountries] = useState<string[]>([]);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [groceryResult, setGroceryResult] = useState<GroceryAnalysisResponse | null>(null);
  const [groceryLoading, setGroceryLoading] = useState(false);
  const [groceryError, setGroceryError] = useState<string | null>(null);
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedEntry = catalog.find((entry) => entry.id === selected) || null;
  const showGroceryInsights = selected === GROCERY_INSIGHTS_DATASET_ID;
  const showCountryComparison =
    selectedEntry?.source === 'eurostat' && COUNTRY_COMPARISON_DATASET_IDS.has(selectedEntry.id);

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

  const handleSelect = (id: string) => {
    setSelected(id);
    setResult(null);
    setGroceryResult(null);
    setGroceryError(null);
    setCompareCountries([]);
  };

  useEffect(() => {
    if (!selected) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    analyze(selected, compareCountries)
      .then((data) => {
        if (!cancelled) {
          setResult(data);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setError(`Analysis failed: ${e.message}`);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selected, compareCountries]);

  useEffect(() => {
    if (!result || !rangeStart || !rangeEnd || !showGroceryInsights) {
      setGroceryResult(null);
      setGroceryError(null);
      setGroceryLoading(false);
      return;
    }

    let cancelled = false;
    setGroceryLoading(true);
    setGroceryError(null);

    analyzeGroceries(rangeStart, rangeEnd)
      .then((data) => {
        if (!cancelled) {
          setGroceryResult(data);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setGroceryResult(null);
          setGroceryError(`Grocery analysis unavailable: ${e.message}`);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setGroceryLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [result, rangeStart, rangeEnd, showGroceryInsights]);

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
        compareSeries: result.compareSeries?.map((series) => {
          const compareStartIndex = rangeStart
            ? series.points.findIndex((point) => point.time === rangeStart)
            : 0;
          const compareEndIndex = rangeEnd
            ? series.points.findIndex((point) => point.time === rangeEnd)
            : series.points.length - 1;

          return {
            ...series,
            points:
              compareStartIndex >= 0 && compareEndIndex >= compareStartIndex
                ? series.points.slice(compareStartIndex, compareEndIndex + 1)
                : series.points,
          };
        }),
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

  const handleCountryToggle = (code: string) => {
    setCompareCountries((current) =>
      current.includes(code)
        ? current.filter((item) => item !== code)
        : [...current, code],
    );
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

        {loading && !result && (
          <div className="loading">
            <div className="spinner" />
            <p>Fetching and analyzing data...</p>
          </div>
        )}

        {error && <div className="error">{error}</div>}

        {result && filteredResult && rangeStart && rangeEnd && (
          <div className="results">
            {showCountryComparison && (
              <CountryComparisonPicker
                options={COUNTRY_OPTIONS}
                selected={compareCountries}
                onToggle={handleCountryToggle}
              />
            )}

            {loading && <p className="results-status">Updating comparison data...</p>}

            <TimeRangePicker
              options={rangeOptions}
              from={rangeStart}
              to={rangeEnd}
              totalPoints={result.series.points.length}
              visiblePoints={filteredResult.series.points.length}
              onFromChange={handleRangeStartChange}
              onToChange={handleRangeEndChange}
            />

            <ChartView chart={filteredResult.chart} compareSeries={filteredResult.compareSeries} />
            <InsightCards insights={filteredResult.insights} />

            {showGroceryInsights && (
              <section className="groceries-shell">
                {groceryLoading && <p className="groceries-status">Analyzing grocery price movers...</p>}
                {groceryError && <p className="groceries-status error-text">{groceryError}</p>}
                {groceryResult && !groceryLoading && <GroceryInsights data={groceryResult} />}
              </section>
            )}

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
