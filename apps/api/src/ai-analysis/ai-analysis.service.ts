import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type {
  AiAnalysisRequest,
  GroceryMover,
  RealEstateMover,
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

function buildPrompt(req: AiAnalysisRequest): string {
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
      prompt += `Biggest decreases:\n`;
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

  prompt += `
In 3-5 sentences in Slovak language, provide a high-level analysis of what this data shows. Where relevant, mention what world events, economic policies, or regional factors might explain the observed trends. Be concise and accessible to a general audience. Do not use any markdown formatting — respond with plain text only.`;

  return prompt;
}

@Injectable()
export class AiAnalysisService {
  async analyze(req: AiAnalysisRequest): Promise<{ analysis: string }> {
    if (!process.env.GEMINI_API_KEY) {
      console.warn('[ai-analysis] GEMINI_API_KEY not set, skipping AI analysis');
      return { analysis: 'AI analýza nie je dostupná (chýba GEMINI_API_KEY).' };
    }

    const prompt = buildPrompt(req);

    try {
      const model = getClient().getGenerativeModel({ model: 'gemini-flash-latest' });

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2048,
        },
      });
      const analysis = result.response.text().trim();
      return { analysis };
    } catch (err) {
      console.error('[ai-analysis] Gemini call failed:', err);
      return { analysis: 'AI analýza zlyhala. Skúste to prosím neskôr.' };
    }
  }
}
