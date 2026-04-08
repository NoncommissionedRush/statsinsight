import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const CHROME_BIN = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const REMOTE_PORT = 9225;
const TARGET_URL =
  'https://datacube.statistics.sk/#!/view/sk/VBD_SK_WIN/sp1002qs/v_sp1002qs_00_00_00_sk';
const USER_DATA_DIR = '/tmp/codex-datacube-real-estate';

function launchChrome() {
  return spawn(
    CHROME_BIN,
    [
      '--headless=new',
      '--disable-gpu',
      `--remote-debugging-port=${REMOTE_PORT}`,
      `--user-data-dir=${USER_DATA_DIR}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
}

async function getJson(path) {
  const res = await fetch(`http://127.0.0.1:${REMOTE_PORT}${path}`);
  if (!res.ok) {
    throw new Error(`DevTools ${path} failed: ${res.status}`);
  }
  return res.json();
}

async function connectWs(url) {
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  return ws;
}

async function createSession() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      await getJson('/json/version');
      break;
    } catch {
      await delay(250);
      if (attempt === 39) {
        throw new Error('Chrome DevTools did not start in time.');
      }
    }
  }

  const targets = await getJson('/json/list');
  const target = targets.find((entry) => entry.type === 'page') ?? targets[0];
  if (!target) {
    throw new Error('No Chrome page target was available.');
  }

  const ws = await connectWs(target.webSocketDebuggerUrl);
  let nextId = 1;
  const pending = new Map();

  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data.toString());
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) {
      reject(new Error(message.error.message));
      return;
    }
    resolve(message.result);
  });

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: TARGET_URL });

  return { ws, send };
}

async function waitForCubeFrame(send) {
  for (let attempt = 0; attempt < 45; attempt += 1) {
    const result = await send('Runtime.evaluate', {
      expression: `(() => {
        const frame =
          document.querySelector('iframe[title*="sp1002qs"]') ||
          document.querySelector('iframe[src*="Cube=sp1002qs"]');
        if (!frame) return null;
        return {
          src: frame.getAttribute('src'),
          readyState: frame.contentDocument?.readyState ?? null,
          hasRequire: typeof frame.contentWindow?.require === 'function',
        };
      })()`,
      returnByValue: true,
      awaitPromise: true,
    });

    const frame = result.result.value;
    if (frame?.src && frame?.hasRequire) {
      return frame;
    }

    await delay(1000);
  }

  throw new Error('The DATAcube real estate iframe did not become ready in time.');
}

async function fetchSnapshots(send) {
  const result = await send('Runtime.evaluate', {
    expression: `(() => {
      const frame =
        document.querySelector('iframe[title*="sp1002qs"]') ||
        document.querySelector('iframe[src*="Cube=sp1002qs"]');
      if (!frame) {
        throw new Error('The real estate DATAcube iframe was not found.');
      }

      const src = frame.getAttribute('src') || '';
      const token = new URL(src, location.origin).hash.match(/SessionToken=([^&]+)/)?.[1];
      if (!token) {
        throw new Error('The real estate DATAcube session token was not available.');
      }

      const parseNumber = (value) => {
        if (typeof value !== 'string') return null;
        const trimmed = value.trim();
        if (!trimmed || trimmed === '.') return null;
        const normalized = trimmed.replace(/\\s+/g, '').replace(',', '.');
        const numeric = Number(normalized);
        return Number.isFinite(numeric) ? numeric : null;
      };

      const expandCells = (cells) => {
        const values = [];
        for (const cell of cells || []) {
          const span = Math.max(1, cell?.span || 1);
          for (let i = 0; i < span; i += 1) {
            values.push(cell?.value ?? '');
          }
        }
        return values;
      };

      const normalizeQuarter = (year, quarterLabel) => {
        const quarter = Number.parseInt(String(quarterLabel).replace(/[^0-9]/g, ''), 10);
        if (!year || !Number.isFinite(quarter)) return null;
        return year + '-Q' + quarter;
      };

      const mergePageIntoSnapshots = (data, snapshots, headerState) => {
        const columnHeaderRows = data?.gridData?.columnHeaderRows || [];
        const rowHeaderColumns = data?.gridData?.rowHeaderColumns || [];
        const dataRows = data?.gridData?.dataRows || [];

        const years = expandCells(columnHeaderRows[0]?.cells || []);
        const quarters = expandCells(columnHeaderRows[1]?.cells || []);
        const periods = years.map((year, index) => normalizeQuarter(year, quarters[index]));

        const propertyLabels = expandCells(rowHeaderColumns[0]?.cells || []);
        const measureLabels = expandCells(rowHeaderColumns[1]?.cells || []);

        if (propertyLabels.length > 0) headerState.propertyLabels = propertyLabels;
        if (measureLabels.length > 0) headerState.measureLabels = measureLabels;

        const activePropertyLabels = headerState.propertyLabels || [];
        const activeMeasureLabels = headerState.measureLabels || [];

        for (const period of periods) {
          if (period && !snapshots[period]) snapshots[period] = [];
        }

        for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex += 1) {
          const propertyLabel = activePropertyLabels[rowIndex] || '';
          const measureLabel = activeMeasureLabels[rowIndex] || '';
          if (!propertyLabel || !measureLabel) continue;

          const seriesCode = propertyLabel + '__' + measureLabel;
          const rowCells = dataRows[rowIndex]?.cells || [];

          for (let colIndex = 0; colIndex < rowCells.length; colIndex += 1) {
            const period = periods[colIndex];
            if (!period) continue;

            const value = parseNumber(rowCells[colIndex]?.value);
            if (value === null) continue;

            const existing = snapshots[period];
            if (!existing.some((item) => item.seriesCode === seriesCode)) {
              existing.push({
                seriesCode,
                propertyLabel,
                measureLabel,
                value,
              });
            }
          }
        }
      };

      return new Promise((resolve) => {
        frame.contentWindow.require(
          ['tm1web/share/service-loader!TM1Service', 'tm1web/share/service-loader!CubeViewService'],
          (tm1Service, cubeViewService) => {
            tm1Service.newCubeViewWidget(
              token,
              'sp1002qs',
              'v_sp1002qs_00_00_00_sk',
              true,
              {
                callback: (widget) => {
                  const loadVisiblePage = () =>
                    new Promise((pageResolve) => {
                      cubeViewService.LoadData(widget.objectId, {
                        callback: (data) => pageResolve({ ok: true, data }),
                        errorHandler: (message, error) =>
                          pageResolve({
                            ok: false,
                            error:
                              message ||
                              error?.message ||
                              'The DATAcube real estate view did not return data.',
                          }),
                      });
                    });

                  const navigateRight = () =>
                    new Promise((pageResolve) => {
                      cubeViewService.Navigate(widget.objectId, 'Right', {
                        callback: (data) => pageResolve({ ok: true, data }),
                        errorHandler: (message, error) =>
                          pageResolve({
                            ok: false,
                            error:
                              message ||
                              error?.message ||
                              'The DATAcube real estate view could not navigate to the next page.',
                          }),
                      });
                    });

                  (async () => {
                    const snapshots = {};
                    const headerState = { propertyLabels: null, measureLabels: null };

                    const firstPage = await loadVisiblePage();
                    if (!firstPage.ok) {
                      resolve({ error: firstPage.error });
                      return;
                    }

                    mergePageIntoSnapshots(firstPage.data, snapshots, headerState);

                    const totalColumnPages = Math.max(
                      1,
                      Number(firstPage.data?.gridData?.pageID?.totalColumnPages || 1),
                    );

                    for (let columnPage = 1; columnPage < totalColumnPages; columnPage += 1) {
                      const nextPage = await navigateRight();
                      if (!nextPage.ok) {
                        resolve({ error: nextPage.error });
                        return;
                      }

                      mergePageIntoSnapshots(nextPage.data, snapshots, headerState);
                    }

                    const nonEmptySnapshots = Object.fromEntries(
                      Object.entries(snapshots).filter(([, items]) => Array.isArray(items) && items.length > 0),
                    );

                    resolve({
                      availablePeriods: Object.keys(nonEmptySnapshots).sort(),
                      snapshots: nonEmptySnapshots,
                    });
                  })().catch((error) => {
                    resolve({
                      error: error?.message || 'The DATAcube real estate view could not be processed.',
                    });
                  });
                },
                errorHandler: (message, error) =>
                  resolve({
                    error:
                      message ||
                      error?.message ||
                      'The DATAcube real estate widget could not be created.',
                  }),
              },
            );
          },
        );
      });
    })()`,
    returnByValue: true,
    awaitPromise: true,
  });

  const value = result.result.value;
  if (!value) {
    throw new Error('The DATAcube real estate fetch returned no result.');
  }
  if (value.error) {
    throw new Error(value.error);
  }
  return value;
}

async function main() {
  const chrome = launchChrome();

  try {
    const { ws, send } = await createSession();
    try {
      await waitForCubeFrame(send);
      const snapshots = await fetchSnapshots(send);
      process.stdout.write(`${JSON.stringify(snapshots)}\n`);
    } finally {
      ws.close();
    }
  } finally {
    chrome.kill('SIGKILL');
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
