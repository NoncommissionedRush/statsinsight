import { TimePoint } from '@statinsight/types';

interface ParseOptions {
  timeDimIds: string[];
  fixedDims: Record<string, string>;
}

function getValueAtIndex(raw: any, flat: number): number | null {
  const val = Array.isArray(raw.value) ? raw.value[flat] : raw.value[String(flat)];
  return val !== undefined && val !== null ? Number(val) : null;
}

function getDimCodes(dim: any): string[] {
  const catIndex = dim.category.index;
  if (Array.isArray(catIndex)) return catIndex;
  return Object.keys(catIndex).sort((a, b) => catIndex[a] - catIndex[b]);
}

function getDimIndex(dim: any, code: string): number {
  const catIndex = dim.category.index;
  if (Array.isArray(catIndex)) return catIndex.indexOf(code);
  return catIndex[code];
}

/**
 * Parse a JSON-stat 2.0 response into TimePoint[].
 * Supports single time dimension (Eurostat) or composite time (SUSR year+quarter).
 */
export function parseJsonStat(
  raw: any,
  opts: ParseOptions,
): TimePoint[] {
  const ids: string[] = raw.id;
  const sizes: number[] = raw.size;
  const dims = raw.dimension;

  if (!ids || !sizes || !dims) {
    throw new Error('Invalid JSON-stat response: missing id, size, or dimension');
  }

  const timeDimPositions = opts.timeDimIds.map((id) => {
    const pos = ids.indexOf(id);
    if (pos === -1) throw new Error(`Dimension "${id}" not found in: ${ids.join(', ')}`);
    return pos;
  });
  const timeDimSet = new Set(timeDimPositions);

  // Resolve fixed index for each non-time dimension
  const fixedIndices: number[] = ids.map((id, i) => {
    if (timeDimSet.has(i)) return -1;
    const dim = dims[id];
    const catIndex = dim.category.index;

    if (opts.fixedDims[id] !== undefined) {
      const idx = typeof catIndex === 'object' && !Array.isArray(catIndex)
        ? catIndex[opts.fixedDims[id]]
        : undefined;
      if (idx !== undefined) return idx;
    }

    // Default to first category
    return Array.isArray(catIndex) ? 0 : catIndex[Object.keys(catIndex)[0]] ?? 0;
  });

  // Build cartesian product of time dimension codes
  const timeDimCodes = opts.timeDimIds.map((id) => getDimCodes(dims[id]));

  function cartesian(arrays: string[][]): string[][] {
    if (arrays.length === 0) return [[]];
    const [first, ...rest] = arrays;
    const restProduct = cartesian(rest);
    return first.flatMap((val) => restProduct.map((arr) => [val, ...arr]));
  }

  const timeCombinations = cartesian(timeDimCodes);
  const points: TimePoint[] = [];

  for (const combo of timeCombinations) {
    // Compute flat index
    const indices = [...fixedIndices];
    for (let t = 0; t < opts.timeDimIds.length; t++) {
      indices[timeDimPositions[t]] = getDimIndex(dims[opts.timeDimIds[t]], combo[t]);
    }

    let flat = 0;
    for (let d = 0; d < ids.length; d++) {
      flat = flat * sizes[d] + indices[d];
    }

    const val = getValueAtIndex(raw, flat);

    // Build composite time label
    const timeStr = combo.length === 1 ? combo[0] : combo.join('-');
    const labels = combo.map((code, t) => {
      const dimLabels = dims[opts.timeDimIds[t]].category?.label;
      return dimLabels?.[code] || code;
    });
    const label = labels.join(' ');

    points.push({ time: timeStr, value: val, label });
  }

  // Sort chronologically
  points.sort((a, b) => a.time.localeCompare(b.time));

  return points;
}

/**
 * Auto-detect the time dimension ID(s) from a JSON-stat response.
 */
export function detectTimeDimensions(raw: any): string[] {
  // Eurostat: role.time array
  if (raw.role?.time?.length) {
    return raw.role.time;
  }

  // SUSR: look for year and quarter dimensions
  const ids: string[] = raw.id || [];
  const timeDims: string[] = [];
  for (const id of ids) {
    if (/_rok$/i.test(id)) timeDims.push(id);
  }
  for (const id of ids) {
    if (/_stv$/i.test(id) || /_kvar$/i.test(id) || /_mes$/i.test(id)) timeDims.push(id);
  }
  if (timeDims.length > 0) return timeDims;

  // Fallback: last dimension
  if (ids.length > 0) return [ids[ids.length - 1]];

  throw new Error('Cannot detect time dimension');
}
