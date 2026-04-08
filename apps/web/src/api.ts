import type {
  CatalogEntry,
  AnalyzeResponse,
  GroceryAnalysisResponse,
  RealEstateAnalysisResponse,
} from './types';

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
  const res = await fetch('/api/catalog');
  if (!res.ok) {
    throw new Error(await getErrorMessage(res, `Failed to fetch catalog: ${res.status}`));
  }
  return res.json();
}

export async function analyze(catalogId: string, compareCountries: string[] = []): Promise<AnalyzeResponse> {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ catalogId, compareCountries }),
  });
  if (!res.ok) {
    throw new Error(await getErrorMessage(res, `Failed to analyze: ${res.status}`));
  }
  return res.json();
}

export async function analyzeGroceries(from: string, to: string): Promise<GroceryAnalysisResponse> {
  const res = await fetch('/api/grocery-analysis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to }),
  });
  if (!res.ok) {
    throw new Error(await getErrorMessage(res, `Failed to analyze groceries: ${res.status}`));
  }
  return res.json();
}

export async function analyzeRealEstate(from: string, to: string): Promise<RealEstateAnalysisResponse> {
  const res = await fetch('/api/real-estate-analysis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to }),
  });
  if (!res.ok) {
    throw new Error(await getErrorMessage(res, `Failed to analyze real estate: ${res.status}`));
  }
  return res.json();
}
