import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type {
  AiAnalysisRequest,
  AiAnalysisResponse,
  AiChatMessage,
  GroceryMover,
  RealEstateMover,
  TradeMover,
  Insight,
  TimeSeries,
  TimePoint,
} from '@statinsight/types';

let client: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (!client) {
    client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  }
  return client;
}

function buildDatasetContext(req: AiAnalysisRequest): string {
  const validPoints = req.points.filter((p: TimePoint) => p.value !== null);
  const latest = validPoints[validPoints.length - 1];
  const earliest = validPoints[0];

  let prompt = `You are an economic analyst specializing in Central European economies. Below is statistical data for Slovakia.

Dataset: ${req.datasetLabel} (${req.unit})
Time range: ${req.from} to ${req.to}
`;

  if (earliest && latest) {
    prompt += `Starting value: ${earliest.value} (${earliest.label || earliest.time})
Latest value: ${latest.value} (${latest.label || latest.time})
Number of data points: ${validPoints.length}
`;
  }

  if (req.insights.length > 0) {
    prompt += `\nStatistical insights:\n`;
    req.insights.forEach((insight: Insight) => {
      prompt += `- ${insight.title}: ${insight.description}\n`;
    });
  }

  if (req.compareSeries && req.compareSeries.length > 0) {
    prompt += `\nCountry comparisons:\n`;
    req.compareSeries.forEach((series: TimeSeries) => {
      const country = series.dimensions?.geo || series.datasetLabel;
      const compValid = series.points.filter((p: TimePoint) => p.value !== null);
      const compLatest = compValid[compValid.length - 1];
      if (compLatest) {
        prompt += `- ${country}: latest value ${compLatest.value} ${series.unit} (${compLatest.label || compLatest.time})\n`;
      }
    });
  }

  if (req.groceryMovers && req.groceryMovers.length > 0) {
    prompt += `\nGrocery price changes (biggest movers):\n`;
    const top5 = req.groceryMovers.slice(0, 5);
    top5.forEach((m: GroceryMover) => {
      const pct = m.pctChange != null ? ` (${m.pctChange > 0 ? '+' : ''}${m.pctChange.toFixed(1)}%)` : '';
      prompt += `- ${m.itemLabel}: ${m.startValue} → ${m.endValue} ${m.unit}${pct}\n`;
    });
    const bottom = req.groceryMovers.slice(-3);
    if (bottom.length > 0 && bottom[0] !== top5[top5.length - 1]) {
      prompt += `Additional notable decliners:\n`;
      bottom.forEach((m: GroceryMover) => {
        const pct = m.pctChange != null ? ` (${m.pctChange > 0 ? '+' : ''}${m.pctChange.toFixed(1)}%)` : '';
        prompt += `- ${m.itemLabel}: ${m.startValue} → ${m.endValue} ${m.unit}${pct}\n`;
      });
    }
  }

  if (req.realEstateMovers && req.realEstateMovers.length > 0) {
    prompt += `\nReal estate price index changes:\n`;
    req.realEstateMovers.forEach((m: RealEstateMover) => {
      const pct = m.pctChange != null ? ` (${m.pctChange > 0 ? '+' : ''}${m.pctChange.toFixed(1)}%)` : '';
      prompt += `- ${m.propertyLabel}: ${m.startValue} → ${m.endValue}${pct}\n`;
    });
  }

  if (req.tradeImportMovers && req.tradeImportMovers.length > 0) {
    prompt += `\nImport category changes:\n`;
    req.tradeImportMovers.slice(0, 5).forEach((m: TradeMover) => {
      const pct = m.pctChange != null ? ` (${m.pctChange > 0 ? '+' : ''}${m.pctChange.toFixed(1)}%)` : '';
      prompt += `- ${m.categoryLabel}: ${m.startValue} → ${m.endValue} mil. EUR${pct}\n`;
    });
  }

  if (req.tradeExportMovers && req.tradeExportMovers.length > 0) {
    prompt += `\nExport category changes:\n`;
    req.tradeExportMovers.slice(0, 5).forEach((m: TradeMover) => {
      const pct = m.pctChange != null ? ` (${m.pctChange > 0 ? '+' : ''}${m.pctChange.toFixed(1)}%)` : '';
      prompt += `- ${m.categoryLabel}: ${m.startValue} → ${m.endValue} mil. EUR${pct}\n`;
    });
  }

  return prompt;
}

function buildConversation(history: AiChatMessage[] | undefined): string {
  if (!history || history.length === 0) {
    return '';
  }

  return history
    .map((message) => `${message.role === 'assistant' ? 'Assistant' : 'User'}: ${message.text}`)
    .join('\n');
}

function buildPrompt(req: AiAnalysisRequest): string {
  const datasetContext = buildDatasetContext(req);
  const question = req.question?.trim();
  const conversation = buildConversation(req.history);

  if (!question) {
    return `${datasetContext}

Respond in valid JSON with this exact shape:
{
  "analysis": "string",
  "followUpQuestions": ["string", "string", "string"]
}

Requirements:
- Write the analysis in Slovak language.
- The analysis should be 3-5 sentences, concise, accessible, and plain text.
- Where relevant, mention world events, economic policies, or regional factors that could explain the trends.
- Suggest 2-3 short follow-up questions in Slovak that a user could ask next based on this dataset.
- Do not use markdown.
- Return only JSON.`;
  }

  return `${datasetContext}

Previous conversation in Slovak:
${conversation || 'No previous conversation.'}

Answer this follow-up user question in Slovak:
${question}

Respond in valid JSON with this exact shape:
{
  "analysis": "string",
  "followUpQuestions": ["string", "string", "string"]
}

Requirements:
- Answer only based on the dataset context and prior conversation above.
- If the data is insufficient, say that clearly in Slovak and avoid inventing facts.
- Keep the answer concise, plain text, and directly responsive to the user's question.
- Suggest 2-3 additional short follow-up questions in Slovak that naturally continue the conversation.
- Do not use markdown.
- Return only JSON.`;
}

function sanitizeFollowUps(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function parseModelResponse(text: string): AiAnalysisResponse {
  try {
    const parsed = JSON.parse(text) as Partial<AiAnalysisResponse>;
    return {
      analysis: typeof parsed.analysis === 'string' && parsed.analysis.trim()
        ? parsed.analysis.trim()
        : 'AI analýza zlyhala. Skúste to prosím neskôr.',
      followUpQuestions: sanitizeFollowUps(parsed.followUpQuestions),
    };
  } catch {
    return {
      analysis: text.trim() || 'AI analýza zlyhala. Skúste to prosím neskôr.',
      followUpQuestions: [],
    };
  }
}

@Injectable()
export class AiAnalysisService {
  async analyze(req: AiAnalysisRequest): Promise<AiAnalysisResponse> {
    if (!process.env.GEMINI_API_KEY) {
      console.warn('[ai-analysis] GEMINI_API_KEY not set, skipping AI analysis');
      return {
        analysis: 'AI analýza nie je dostupná (chýba GEMINI_API_KEY).',
        followUpQuestions: [],
      };
    }

    const prompt = buildPrompt(req);

    try {
      const model = getClient().getGenerativeModel({ model: 'gemini-flash-latest' });

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
        },
      });

      return parseModelResponse(result.response.text());
    } catch (err) {
      console.error('[ai-analysis] Gemini call failed:', err);
      return {
        analysis: 'AI analýza zlyhala. Skúste to prosím neskôr.',
        followUpQuestions: [],
      };
    }
  }
}
