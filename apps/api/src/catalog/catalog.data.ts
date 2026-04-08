import { CatalogEntry } from '@statinsight/types';

export const CATALOG: CatalogEntry[] = [
  {
    id: 'eurostat:prc_hicp_manr',
    source: 'eurostat',
    datasetCode: 'prc_hicp_manr',
    label: 'Inflation (HICP Annual Rate) - Slovakia',
    description: 'Harmonised consumer price index, annual rate of change',
    unit: '%',
    defaultFilters: { geo: 'SK', lastTimePeriod: '24', coicop: 'CP00' },
  },
  {
    id: 'eurostat:une_rt_m',
    source: 'eurostat',
    datasetCode: 'une_rt_m',
    label: 'Unemployment Rate (Monthly) - Slovakia',
    description: 'Seasonally adjusted monthly unemployment rate',
    unit: '%',
    defaultFilters: {
      geo: 'SK',
      lastTimePeriod: '24',
      sex: 'T',
      age: 'TOTAL',
      s_adj: 'SA',
      unit: 'PC_ACT',
    },
  },
  {
    id: 'eurostat:demo_pjan',
    source: 'eurostat',
    datasetCode: 'demo_pjan',
    label: 'Population (Annual) - Slovakia',
    description: 'Population on 1 January by age and sex',
    unit: 'persons',
    defaultFilters: { geo: 'SK', lastTimePeriod: '10', sex: 'T', age: 'TOTAL' },
  },
  {
    id: 'susr:pr0101qs',
    source: 'susr',
    datasetCode: 'pr0101qs',
    label: 'Unemployment Rate (Quarterly) - Slovakia',
    description: 'Unemployment by the Labour Force Sample Survey (since 2021)',
    unit: '%',
    defaultFilters: {},
    susrConfig: {
      pathSegments: ['last5', '1. Q.,2. Q.,3. Q.,4. Q.', 'UKAZ03', 'NACE01'],
    },
  },
];
