import { TimeSeries, SusrConfig } from '@statinsight/types';
import { parseJsonStat, detectTimeDimensions } from './jsonstat';

const BASE_URL = 'https://data.statistics.sk/api/v2/dataset';

export async function fetchSusr(
  datasetCode: string,
  config: SusrConfig,
): Promise<TimeSeries> {
  const path = config.pathSegments.join('/');
  const url = `${BASE_URL}/${datasetCode}/${path}?lang=en&type=json`;

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`SUSR API error ${res.status}: ${text.slice(0, 200)}`);
  }

  const raw = await res.json();

  const timeDimIds = config.timeDimId
    ? [config.timeDimId]
    : detectTimeDimensions(raw);
  const fixedDims = config.fixedDims || {};

  const points = parseJsonStat(raw, { timeDimIds, fixedDims });

  return {
    source: 'susr',
    datasetCode,
    datasetLabel: raw.label || datasetCode,
    unit: '',
    dimensions: fixedDims,
    points,
  };
}
