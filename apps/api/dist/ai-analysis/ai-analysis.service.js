"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiAnalysisService = void 0;
const common_1 = require("@nestjs/common");
const generative_ai_1 = require("@google/generative-ai");
let client = null;
function getClient() {
    if (!client) {
        client = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
    return client;
}
function buildPrompt(req) {
    const validPoints = req.points.filter((p) => p.value !== null);
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
        req.insights.forEach((insight) => {
            prompt += `- ${insight.title}: ${insight.description}\n`;
        });
    }
    if (req.compareSeries && req.compareSeries.length > 0) {
        prompt += `\nCountry comparisons:\n`;
        req.compareSeries.forEach((series) => {
            const country = series.dimensions?.geo || series.datasetLabel;
            const compValid = series.points.filter((p) => p.value !== null);
            const compLatest = compValid[compValid.length - 1];
            if (compLatest) {
                prompt += `- ${country}: latest value ${compLatest.value} ${series.unit} (${compLatest.label || compLatest.time})\n`;
            }
        });
    }
    if (req.groceryMovers && req.groceryMovers.length > 0) {
        prompt += `\nGrocery price changes (biggest movers):\n`;
        const top5 = req.groceryMovers.slice(0, 5);
        top5.forEach((m) => {
            const pct = m.pctChange != null ? ` (${m.pctChange > 0 ? '+' : ''}${m.pctChange.toFixed(1)}%)` : '';
            prompt += `- ${m.itemLabel}: ${m.startValue} → ${m.endValue} ${m.unit}${pct}\n`;
        });
        const bottom = req.groceryMovers.slice(-3);
        if (bottom.length > 0 && bottom[0] !== top5[top5.length - 1]) {
            prompt += `Biggest decreases:\n`;
            bottom.forEach((m) => {
                const pct = m.pctChange != null ? ` (${m.pctChange > 0 ? '+' : ''}${m.pctChange.toFixed(1)}%)` : '';
                prompt += `- ${m.itemLabel}: ${m.startValue} → ${m.endValue} ${m.unit}${pct}\n`;
            });
        }
    }
    if (req.realEstateMovers && req.realEstateMovers.length > 0) {
        prompt += `\nReal estate price index changes:\n`;
        req.realEstateMovers.forEach((m) => {
            const pct = m.pctChange != null ? ` (${m.pctChange > 0 ? '+' : ''}${m.pctChange.toFixed(1)}%)` : '';
            prompt += `- ${m.propertyLabel}: ${m.startValue} → ${m.endValue}${pct}\n`;
        });
    }
    if (req.tradeImportMovers && req.tradeImportMovers.length > 0) {
        prompt += `\nImport category changes:\n`;
        req.tradeImportMovers.slice(0, 5).forEach((m) => {
            const pct = m.pctChange != null ? ` (${m.pctChange > 0 ? '+' : ''}${m.pctChange.toFixed(1)}%)` : '';
            prompt += `- ${m.categoryLabel}: ${m.startValue} → ${m.endValue} mil. EUR${pct}\n`;
        });
    }
    if (req.tradeExportMovers && req.tradeExportMovers.length > 0) {
        prompt += `\nExport category changes:\n`;
        req.tradeExportMovers.slice(0, 5).forEach((m) => {
            const pct = m.pctChange != null ? ` (${m.pctChange > 0 ? '+' : ''}${m.pctChange.toFixed(1)}%)` : '';
            prompt += `- ${m.categoryLabel}: ${m.startValue} → ${m.endValue} mil. EUR${pct}\n`;
        });
    }
    prompt += `
In 3-5 sentences in Slovak language, provide a high-level analysis of what this data shows. Where relevant, mention what world events, economic policies, or regional factors might explain the observed trends. Be concise and accessible to a general audience. Do not use any markdown formatting — respond with plain text only.`;
    return prompt;
}
let AiAnalysisService = class AiAnalysisService {
    async analyze(req) {
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
        }
        catch (err) {
            console.error('[ai-analysis] Gemini call failed:', err);
            return { analysis: 'AI analýza zlyhala. Skúste to prosím neskôr.' };
        }
    }
};
exports.AiAnalysisService = AiAnalysisService;
exports.AiAnalysisService = AiAnalysisService = __decorate([
    (0, common_1.Injectable)()
], AiAnalysisService);
//# sourceMappingURL=ai-analysis.service.js.map