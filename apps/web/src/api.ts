import type {
  CatalogEntry,
  AnalyzeResponse,
  GroceryAnalysisResponse,
  RealEstateAnalysisResponse,
  SectorAnalysisResponse,
  TradeAnalysisResponse,
  AiAnalysisRequest,
  AiAnalysisResponse,
} from './types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

async function getErrorMessage(res: Response, fallback: string): Promise<string> {
  const text = await res.text().catch(() => '');
  if (!text) return fallback;

  try {
    const parsed = JSON.parse(text) as { message?: string | string[]; error?: string };
    if (Array.isArray(parsed.message)) return parsed.message.join(', ');
    if (parsed.message) return parsed.message;
    if (parsed.error) return parsed.error;
  } catch {
    return text;
  }

  return fallback;
}

export async function getCatalog(): Promise<CatalogEntry[]> {
  const res = await fetch(apiUrl('/api/catalog'));
  if (!res.ok) {
    throw new Error(await getErrorMessage(res, `Nepodarilo sa načítať katalóg: ${res.status}`));
  }
  return res.json();
}

export async function analyze(catalogId: string, compareCountries: string[] = []): Promise<AnalyzeResponse> {
  const res = await fetch(apiUrl('/api/analyze'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ catalogId, compareCountries }),
  });
  if (!res.ok) {
    throw new Error(await getErrorMessage(res, `Analýza zlyhala: ${res.status}`));
  }
  return res.json();
}

export async function analyzeGroceries(from: string, to: string): Promise<GroceryAnalysisResponse> {
  const res = await fetch(apiUrl('/api/grocery-analysis'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to }),
  });
  if (!res.ok) {
    throw new Error(await getErrorMessage(res, `Analýza potravín zlyhala: ${res.status}`));
  }
  return res.json();
}

export async function analyzeRealEstate(from: string, to: string): Promise<RealEstateAnalysisResponse> {
  const res = await fetch(apiUrl('/api/real-estate-analysis'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to }),
  });
  if (!res.ok) {
    throw new Error(await getErrorMessage(res, `Analýza nehnuteľností zlyhala: ${res.status}`));
  }
  return res.json();
}

export async function analyzeTrade(from: string, to: string): Promise<TradeAnalysisResponse> {
  const res = await fetch(apiUrl('/api/trade-analysis'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to }),
  });
  if (!res.ok) {
    throw new Error(await getErrorMessage(res, `Analýza obchodu zlyhala: ${res.status}`));
  }
  return res.json();
}

export async function analyzeSector(datasetId: string, from: string, to: string): Promise<SectorAnalysisResponse> {
  const res = await fetch(apiUrl('/api/sector-analysis'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ datasetId, from, to }),
  });
  if (!res.ok) {
    throw new Error(await getErrorMessage(res, `Analýza sektorov zlyhala: ${res.status}`));
  }
  return res.json();
}

export async function analyzeWithAI(request: AiAnalysisRequest): Promise<AiAnalysisResponse> {
  const res = await fetch(apiUrl('/api/ai-analysis'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    throw new Error(await getErrorMessage(res, `AI analýza zlyhala: ${res.status}`));
  }
  return res.json();
}
