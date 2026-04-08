interface Props {
  analysis: string | null;
  loading: boolean;
  error: string | null;
  onAnalyze: () => void;
  /** True when the data has changed since last analysis (button should indicate refresh) */
  stale: boolean;
}

export function AIAnalysis({ analysis, loading, error, onAnalyze, stale }: Props) {
  const buttonLabel = loading
    ? 'Analyzujem...'
    : analysis && !stale
    ? 'Obnoviť analýzu'
    : 'Analyzovať s AI';

  return (
    <div className="ai-analysis">
      <div className="ai-analysis-header">
        <h2>AI Analýza</h2>
        <button
          className="ai-analyze-btn"
          onClick={onAnalyze}
          disabled={loading}
        >
          {buttonLabel}
        </button>
      </div>

      {loading && (
        <div className="ai-analysis-loading">
          <div className="spinner" />
          <p>Gemini analyzuje dáta...</p>
        </div>
      )}

      {error && !loading && (
        <p className="ai-analysis-error">{error}</p>
      )}

      {analysis && !loading && (
        <p className="ai-analysis-text">{analysis}</p>
      )}

      {!analysis && !loading && !error && (
        <p className="ai-analysis-placeholder">
          Kliknite na tlačidlo pre AI analýzu zobrazených dát.
        </p>
      )}
    </div>
  );
}
