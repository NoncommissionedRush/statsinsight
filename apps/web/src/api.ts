import type { CatalogEntry, AnalyzeResponse } from './types';

export async function getCatalog(): Promise<CatalogEntry[]> {
  const res = await fetch('/api/catalog');
  if (!res.ok) throw new Error(`Failed to fetch catalog: ${res.status}`);
  return res.json();
}

export async function analyze(catalogId: string): Promise<AnalyzeResponse> {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ catalogId }),
  });
  if (!res.ok) throw new Error(`Failed to analyze: ${res.status}`);
  return res.json();
}
