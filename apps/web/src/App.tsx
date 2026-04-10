import { useState, useEffect } from 'react';
import { getCatalog, analyze, analyzeGroceries, analyzeRealEstate, analyzeTrade, analyzeSector, analyzeWithAI } from './api';
import { buildChartPayload, computeInsights } from './analytics';
import { CountryComparisonPicker } from './components/CountryComparisonPicker';
import { DatasetPicker } from './components/DatasetPicker';
import { ChartView } from './components/ChartView';
import { GroceryInsights } from './components/GroceryInsights';
import { InsightCards } from './components/InsightCards';
import { RealEstateInsights } from './components/RealEstateInsights';
import { TradeInsights } from './components/TradeInsights';
import { TimeRangePicker } from './components/TimeRangePicker';
import { AIAnalysis } from './components/AIAnalysis';
import { SectorInsights } from './components/SectorInsights';
import { COUNTRY_OPTIONS } from './countries';
import type {
  CatalogEntry,
  AnalyzeResponse,
  GroceryAnalysisResponse,
  RealEstateAnalysisResponse,
  SectorAnalysisResponse,
  TradeAnalysisResponse,
  AiAnalysisRequest,
  AiChatMessage,
} from './types';
import './App.css';

const GROCERY_INSIGHTS_DATASET_ID = 'eurostat:prc_hicp_manr';
const REAL_ESTATE_DATASET_ID = 'susr:sp1002qs';
const TRADE_DATASET_ID = 'susr:zo0020ms';
const WAGES_DATASET_ID = 'susr:pr0204qs';
const VACANCIES_DATASET_ID = 'susr:pr2003qs';
const INDUSTRY_DATASET_ID = 'susr:pm0042ms';
const SECTOR_INSIGHTS_DATASET_IDS = new Set([
  WAGES_DATASET_ID,
  VACANCIES_DATASET_ID,
  INDUSTRY_DATASET_ID,
]);
const COUNTRY_COMPARISON_DATASET_IDS = new Set([
  'eurostat:prc_hicp_manr',
  'eurostat:une_rt_m',
  'eurostat:namq_10_gdp',
]);
const SOURCE_LABELS: Record<string, string> = {
  eurostat: 'Eurostat',
  susr: 'SU SR',
  datacube: 'SU SR DATAcube',
};

function App() {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [compareCountries, setCompareCountries] = useState<string[]>([]);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [groceryResult, setGroceryResult] = useState<GroceryAnalysisResponse | null>(null);
  const [groceryLoading, setGroceryLoading] = useState(false);
  const [groceryError, setGroceryError] = useState<string | null>(null);
  const [realEstateResult, setRealEstateResult] = useState<RealEstateAnalysisResponse | null>(null);
  const [realEstateLoading, setRealEstateLoading] = useState(false);
  const [realEstateError, setRealEstateError] = useState<string | null>(null);
  const [tradeResult, setTradeResult] = useState<TradeAnalysisResponse | null>(null);
  const [tradeLoading, setTradeLoading] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [sectorResult, setSectorResult] = useState<SectorAnalysisResponse | null>(null);
  const [sectorLoading, setSectorLoading] = useState(false);
  const [sectorError, setSectorError] = useState<string | null>(null);
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiFollowUpQuestions, setAiFollowUpQuestions] = useState<string[]>([]);
  const [aiConversation, setAiConversation] = useState<AiChatMessage[]>([]);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiStale, setAiStale] = useState(false);
  const selectedEntry = catalog.find((entry) => entry.id === selected) || null;
  const showGroceryInsights = selected === GROCERY_INSIGHTS_DATASET_ID;
  const showRealEstateInsights = selected === REAL_ESTATE_DATASET_ID;
  const showTradeInsights = selected === TRADE_DATASET_ID;
  const showSectorInsights = selected !== null && SECTOR_INSIGHTS_DATASET_IDS.has(selected);
  const showCountryComparison =
    selectedEntry?.source === 'eurostat' && COUNTRY_COMPARISON_DATASET_IDS.has(selectedEntry.id);
  const sourceCount = new Set(catalog.map((entry) => entry.source)).size;
  const selectedSourceLabel = selectedEntry ? SOURCE_LABELS[selectedEntry.source] ?? selectedEntry.source : null;
  const comparisonLabel = compareCountries.length > 0 ? `${compareCountries.length} krajiny` : 'Bez porovnania';

  useEffect(() => {
    getCatalog()
      .then(setCatalog)
      .catch((e) => setError(`Nepodarilo sa načítať katalóg: ${e.message}`));
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
    setRangeStart(null);
    setRangeEnd(null);
    setGroceryResult(null);
    setGroceryError(null);
    setRealEstateResult(null);
    setRealEstateError(null);
    setTradeResult(null);
    setTradeError(null);
    setSectorResult(null);
    setSectorError(null);
    setCompareCountries([]);
    setAiAnalysis(null);
    setAiFollowUpQuestions([]);
    setAiConversation([]);
    setAiQuestion('');
    setAiError(null);
    setAiStale(false);
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
          setError(`Analýza zlyhala: ${e.message}`);
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
          setGroceryError(`Analýza potravín nedostupná: ${e.message}`);
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

  useEffect(() => {
    if (!result || !rangeStart || !rangeEnd || !showRealEstateInsights) {
      setRealEstateResult(null);
      setRealEstateError(null);
      setRealEstateLoading(false);
      return;
    }

    let cancelled = false;
    setRealEstateLoading(true);
    setRealEstateError(null);

    analyzeRealEstate(rangeStart, rangeEnd)
      .then((data) => {
        if (!cancelled) {
          setRealEstateResult(data);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setRealEstateResult(null);
          setRealEstateError(`Analýza nehnuteľností nedostupná: ${e.message}`);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setRealEstateLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [result, rangeStart, rangeEnd, showRealEstateInsights]);

  useEffect(() => {
    if (!result || !rangeStart || !rangeEnd || !showTradeInsights) {
      setTradeResult(null);
      setTradeError(null);
      setTradeLoading(false);
      return;
    }

    let cancelled = false;
    setTradeLoading(true);
    setTradeError(null);

    analyzeTrade(rangeStart, rangeEnd)
      .then((data) => {
        if (!cancelled) {
          setTradeResult(data);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setTradeResult(null);
          setTradeError(`Analýza obchodu nedostupná: ${e.message}`);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setTradeLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [result, rangeStart, rangeEnd, showTradeInsights]);

  useEffect(() => {
    if (!selected || !result || !rangeStart || !rangeEnd || !showSectorInsights) {
      setSectorResult(null);
      setSectorError(null);
      setSectorLoading(false);
      return;
    }

    let cancelled = false;
    setSectorLoading(true);
    setSectorError(null);

    analyzeSector(selected, rangeStart, rangeEnd)
      .then((data) => {
        if (!cancelled) {
          setSectorResult(data);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setSectorResult(null);
          setSectorError(`Sektorová analýza nedostupná: ${e.message}`);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSectorLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selected, result, rangeStart, rangeEnd, showSectorInsights]);

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
        insights: computeInsights(filteredPoints, result.series.unit, result.series.dimensions.displaySeries),
      }
    : null;

  const tradeImportInsights = showTradeInsights && filteredResult
    ? computeInsights(
        filteredResult.series.points,
        filteredResult.series.unit,
        filteredResult.series.dimensions.displaySeries,
      )
    : [];

  const tradeExportSeries = showTradeInsights
    ? filteredResult?.compareSeries?.[0] ?? null
    : null;

  const tradeExportInsights = tradeExportSeries
    ? computeInsights(
        tradeExportSeries.points,
        tradeExportSeries.unit,
        tradeExportSeries.dimensions.displaySeries,
      )
    : [];

  const createAiRequest = (question?: string): AiAnalysisRequest | null => {
    if (!filteredResult || !rangeStart || !rangeEnd) return null;

    return {
      datasetLabel: filteredResult.series.datasetLabel,
      unit: filteredResult.series.unit,
      from: rangeStart,
      to: rangeEnd,
      points: filteredResult.series.points,
      insights: filteredResult.insights,
      compareSeries: filteredResult.compareSeries,
      groceryMovers: groceryResult?.movers,
      realEstateMovers: realEstateResult?.movers,
      tradeImportMovers: tradeResult?.importMovers,
      tradeExportMovers: tradeResult?.exportMovers,
      question,
      history: question
        ? [
            ...(aiAnalysis ? [{ role: 'assistant' as const, text: aiAnalysis }] : []),
            ...aiConversation,
          ]
        : undefined,
    };
  };

  const runAiAnalyze = () => {
    const req = createAiRequest();
    if (!req) return;

    setAiLoading(true);
    setAiError(null);
    setAiStale(false);

    analyzeWithAI(req)
      .then((res) => {
        setAiAnalysis(res.analysis);
        setAiFollowUpQuestions(res.followUpQuestions);
        setAiConversation([]);
        setAiQuestion('');
      })
      .catch((e: Error) => {
        setAiError(`AI analýza zlyhala: ${e.message}`);
      })
      .finally(() => {
        setAiLoading(false);
      });
  };

  const handleAiAnalyze = () => {
    runAiAnalyze();
  };

  const handleAiQuestion = (question: string) => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || aiStale) return;

    const req = createAiRequest(trimmedQuestion);
    if (!req) return;

    setAiLoading(true);
    setAiError(null);

    analyzeWithAI(req)
      .then((res) => {
        setAiConversation((current) => [
          ...current,
          { role: 'user', text: trimmedQuestion },
          { role: 'assistant', text: res.analysis },
        ]);
        setAiFollowUpQuestions(res.followUpQuestions);
        setAiQuestion('');
      })
      .catch((e: Error) => {
        setAiError(`AI odpoveď zlyhala: ${e.message}`);
      })
      .finally(() => {
        setAiLoading(false);
      });
  };

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
    if (aiAnalysis) setAiStale(true);
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
    if (aiAnalysis) setAiStale(true);
  };

  const handleCountryToggle = (code: string) => {
    setCompareCountries((current) =>
      current.includes(code)
        ? current.filter((item) => item !== code)
        : [...current, code],
    );
    if (aiAnalysis) setAiStale(true);
  };

  const sectorInsightMeta =
    selected === WAGES_DATASET_ID
      ? {
          title: 'Mzdové rozdiely podľa odvetví',
          intro: 'Porovnanie priemernej mesačnej mzdy naprieč odvetviami za obdobie',
          unitLabel: 'EUR',
          changeDecimals: 0,
          valueDecimals: 0,
        }
      : selected === VACANCIES_DATASET_ID
        ? {
            title: 'Voľné pracovné miesta podľa sektorov',
            intro: 'Porovnanie miery voľných pracovných miest podľa sektorov za obdobie',
            unitLabel: '%',
            changeDecimals: 1,
            valueDecimals: 1,
          }
        : selected === INDUSTRY_DATASET_ID
          ? {
              title: 'Priemyselná produkcia podľa odvetví',
              intro: 'Porovnanie medziročného indexu priemyselnej produkcie podľa odvetví za obdobie',
              unitLabel: 'index',
              changeDecimals: 1,
              valueDecimals: 1,
            }
          : null;

  return (
    <div className="app-shell">
      <div className="app-shell-orb app-shell-orb-one" />
      <div className="app-shell-orb app-shell-orb-two" />
      <div className="app">
        <header className="hero">
          <div className="hero-copy">
            <span className="hero-kicker">National statistics, redesigned</span>
            <h1>StatInsight</h1>
            <p className="subtitle">
              Moderný analytický priestor pre objavovanie trendov v slovenských dátach, porovnaniach a AI vysvetleniach.
            </p>
            <div className="hero-actions">
              <span className="hero-chip">Živé grafy</span>
              <span className="hero-chip">AI interpretácia</span>
              <span className="hero-chip">Export do HTML</span>
            </div>
          </div>

          <div className="hero-panel">
            <p className="hero-panel-label">Rýchly prehľad</p>
            <div className="hero-stats">
              <div className="hero-stat">
                <strong>{catalog.length}</strong>
                <span>Dostupných datasetov</span>
              </div>
              <div className="hero-stat">
                <strong>{sourceCount}</strong>
                <span>Dátových zdrojov</span>
              </div>
              <div className="hero-stat">
                <strong>{selectedEntry ? 'Aktívny' : 'Čaká sa'}</strong>
                <span>Stav výberu</span>
              </div>
            </div>

            <div className="hero-spotlight">
              <span className="hero-spotlight-label">Aktuálny fokus</span>
              {selectedEntry ? (
                <>
                  <h2>{selectedEntry.label}</h2>
                  <p>{selectedEntry.description}</p>
                  <div className="hero-spotlight-meta">
                    <span>{selectedSourceLabel}</span>
                    <span>{selectedEntry.unit}</span>
                    <span>{comparisonLabel}</span>
                  </div>
                </>
              ) : (
                <>
                  <h2>Vyberte dataset</h2>
                  <p>Začnite z katalógu nižšie a rozbaľte dashboard pre konkrétny časový rad.</p>
                  <div className="hero-spotlight-meta">
                    <span>Kurátorovaný katalóg</span>
                    <span>Responsive dashboard</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="main-layout">
          <section className="surface-panel surface-panel-datasets">
            <DatasetPicker
              catalog={catalog}
              selected={selected}
              loading={loading}
              onSelect={handleSelect}
            />
          </section>

          {loading && !result && (
            <div className="loading">
              <div className="spinner" />
              <p>Načítavam a analyzujem dáta...</p>
            </div>
          )}

          {error && <div className="error">{error}</div>}

          {!result && !loading && !error && (
            <section className="empty-state">
              <div>
                <p className="empty-state-kicker">Pripravené na analýzu</p>
                <h2>Vyberte si pohľad na ekonomiku, ceny alebo bývanie</h2>
                <p>
                  Po výbere datasetu sa zobrazí interaktívny graf, automatické postrehy, doplnkové analytické bloky a AI vrstva na ďalšie otázky.
                </p>
              </div>
              <div className="empty-state-grid">
                <article className="empty-state-card">
                  <span>01</span>
                  <h3>Objavte trend</h3>
                  <p>Prejdite od surového časového radu ku grafu a highlightom v jednom toku.</p>
                </article>
                <article className="empty-state-card">
                  <span>02</span>
                  <h3>Zaostrite obdobie</h3>
                  <p>Vyrežte si len relevantný časový úsek a okamžite uvidíte upravené insighty.</p>
                </article>
                <article className="empty-state-card">
                  <span>03</span>
                  <h3>Pýtajte sa AI</h3>
                  <p>Nechajte si vysvetliť anomálie, porovnania aj praktické súvislosti priamo nad dátami.</p>
                </article>
              </div>
            </section>
          )}

          {result && filteredResult && rangeStart && rangeEnd && (
            <div className="results">
              <section className="results-overview">
                <div>
                  <p className="results-kicker">Aktívna analýza</p>
                  <h2>{filteredResult.series.datasetLabel}</h2>
                  <p className="results-description">
                    {selectedEntry?.description ?? 'Vybraný dataset je pripravený na podrobné preskúmanie.'}
                  </p>
                </div>
                <div className="results-meta">
                  <span>{selectedSourceLabel}</span>
                  <span>{filteredResult.series.unit}</span>
                  <span>{filteredResult.series.points.length} bodov</span>
                </div>
              </section>

            {showCountryComparison && (
              <CountryComparisonPicker
                options={COUNTRY_OPTIONS}
                selected={compareCountries}
                onToggle={handleCountryToggle}
              />
            )}

            {loading && <p className="results-status">Aktualizujem porovnávacie dáta...</p>}

            <TimeRangePicker
              options={rangeOptions}
              from={rangeStart}
              to={rangeEnd}
              totalPoints={result.series.points.length}
              visiblePoints={filteredResult.series.points.length}
              onFromChange={handleRangeStartChange}
              onToChange={handleRangeEndChange}
            />

            <ChartView
              chart={filteredResult.chart}
              compareSeries={filteredResult.compareSeries}
              source={SOURCE_LABELS[filteredResult.series.source] ?? filteredResult.series.source}
            />
            {showTradeInsights ? (
              <div className="trade-insights-grid">
                <InsightCards insights={tradeImportInsights} title="Postrehy – Import" />
                <InsightCards insights={tradeExportInsights} title="Postrehy – Export" />
              </div>
            ) : (
              <InsightCards insights={filteredResult.insights} />
            )}

            {showGroceryInsights && (
              <section className="groceries-shell">
                {groceryLoading && <p className="groceries-status">Analyzujem pohyby cien potravín...</p>}
                {groceryError && <p className="groceries-status error-text">{groceryError}</p>}
                {groceryResult && !groceryLoading && <GroceryInsights data={groceryResult} />}
              </section>
            )}

            {showRealEstateInsights && (
              <section className="real-estate-shell">
                {realEstateLoading && <p className="groceries-status">Analyzujem pohyby cien nehnuteľností...</p>}
                {realEstateError && <p className="groceries-status error-text">{realEstateError}</p>}
                {realEstateResult && !realEstateLoading && <RealEstateInsights data={realEstateResult} />}
              </section>
            )}

            {showTradeInsights && (
              <section className="trade-shell">
                {tradeLoading && <p className="groceries-status">Analyzujem pohyby kategórií importu a exportu...</p>}
                {tradeError && <p className="groceries-status error-text">{tradeError}</p>}
                {tradeResult && !tradeLoading && <TradeInsights data={tradeResult} />}
              </section>
            )}

            {showSectorInsights && sectorInsightMeta && (
              <section className="groceries-shell">
                {sectorLoading && <p className="groceries-status">Analyzujem sektorové rozdiely...</p>}
                {sectorError && <p className="groceries-status error-text">{sectorError}</p>}
                {sectorResult && !sectorLoading && (
                  <SectorInsights
                    data={sectorResult}
                    title={sectorInsightMeta.title}
                    intro={sectorInsightMeta.intro}
                    unitLabel={sectorInsightMeta.unitLabel}
                    changeDecimals={sectorInsightMeta.changeDecimals}
                    valueDecimals={sectorInsightMeta.valueDecimals}
                  />
                )}
              </section>
            )}

            <AIAnalysis
              analysis={aiAnalysis}
              followUpQuestions={aiFollowUpQuestions}
              conversation={aiConversation}
              question={aiQuestion}
              loading={aiLoading}
              error={aiError}
              onAnalyze={handleAiAnalyze}
              onQuestionChange={setAiQuestion}
              onAskQuestion={handleAiQuestion}
              stale={aiStale}
            />

            <details className="raw-data">
              <summary>Zdrojové dáta ({filteredResult.series.points.length} dátových bodov)</summary>
              <table>
                <thead>
                  <tr>
                    <th>Obdobie</th>
                    <th>Hodnota</th>
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

        <footer className="app-footer">
          <p>
            Zdroje: <a href="https://ec.europa.eu/eurostat" target="_blank" rel="noreferrer">Eurostat</a>
            {' | '}
            <a href="https://data.statistics.sk/api/html/help-en.html" target="_blank" rel="noreferrer">Štatistický úrad SR API</a>
          </p>
        </footer>
      </div>
    </div>
  );
}

export default App;
