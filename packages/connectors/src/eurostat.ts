import { TimeSeries } from '@statinsight/types';
import { parseJsonStat, detectTimeDimensions } from './jsonstat';

const BASE_URL =
  'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data';

export async function fetchEurostat(
  datasetCode: string,
  filters: Record<string, string>,
): Promise<TimeSeries> {
  const params = new URLSearchParams({ lang: 'EN', ...filters });
  const url = `${BASE_URL}/${datasetCode}?${params}`;

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Eurostat API error ${res.status}: ${text.slice(0, 200)}`);
  }

  const raw = await res.json();
  const timeDimIds = detectTimeDimensions(raw);
  const points = parseJsonStat(raw, { timeDimIds, fixedDims: filters });

  return {
    source: 'eurostat',
    datasetCode,
    datasetLabel: raw.label || datasetCode,
    unit: filters.unit || '',
    dimensions: filters,
    points,
  };
}
