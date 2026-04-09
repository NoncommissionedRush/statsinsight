import type { FormEvent } from 'react';
import type { AiChatMessage } from '../types';

interface Props {
  analysis: string | null;
  followUpQuestions: string[];
  conversation: AiChatMessage[];
  question: string;
  loading: boolean;
  error: string | null;
  onAnalyze: () => void;
  onQuestionChange: (value: string) => void;
  onAskQuestion: (question: string) => void;
  stale: boolean;
}

export function AIAnalysis({
  analysis,
  followUpQuestions,
  conversation,
  question,
  loading,
  error,
  onAnalyze,
  onQuestionChange,
  onAskQuestion,
  stale,
}: Props) {
  const buttonLabel = loading
    ? 'Analyzujem...'
    : analysis && !stale
    ? 'Obnoviť analýzu'
    : 'Analyzovať s AI';

  const canAskFollowUp = Boolean(analysis) && !stale;
  const trimmedQuestion = question.trim();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!trimmedQuestion || loading || !canAskFollowUp) return;
    onAskQuestion(trimmedQuestion);
  };

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
        <>
          <p className="ai-analysis-text">{analysis}</p>

          {conversation.length > 0 && (
            <div className="ai-analysis-thread">
              {conversation.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`ai-thread-message ai-thread-message-${message.role}`}
                >
                  <span className="ai-thread-role">
                    {message.role === 'user' ? 'Otázka' : 'Odpoveď'}
                  </span>
                  <p>{message.text}</p>
                </div>
              ))}
            </div>
          )}

          <div className="ai-follow-up">
            <h3>Pokračovať v otázkach</h3>
            <p className="ai-follow-up-copy">
              Môžete položiť vlastnú otázku alebo si vybrať z navrhnutých možností.
            </p>

            {followUpQuestions.length > 0 && (
              <div className="ai-suggested-questions">
                {followUpQuestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="ai-suggestion-chip"
                    onClick={() => onAskQuestion(suggestion)}
                    disabled={loading || !canAskFollowUp}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            <form className="ai-follow-up-form" onSubmit={handleSubmit}>
              <input
                type="text"
                value={question}
                onChange={(event) => onQuestionChange(event.target.value)}
                placeholder="Napíšte doplňujúcu otázku k týmto dátam"
                disabled={loading || !canAskFollowUp}
              />
              <button
                type="submit"
                className="ai-follow-up-btn"
                disabled={loading || !canAskFollowUp || !trimmedQuestion}
              >
                Opýtať sa
              </button>
            </form>

            {stale && (
              <p className="ai-analysis-placeholder">
                Dáta sa zmenili. Pred ďalšou otázkou obnovte AI analýzu.
              </p>
            )}
          </div>
        </>
      )}

      {!analysis && !loading && !error && (
        <p className="ai-analysis-placeholder">
          Kliknite na tlačidlo pre AI analýzu zobrazených dát.
        </p>
      )}
    </div>
  );
}
