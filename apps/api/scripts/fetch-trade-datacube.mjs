import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

const REMOTE_PORT = 9227;
const TARGET_URL =
  'https://datacube.statistics.sk/#!/view/sk/VBD_INTERN/zo0020ms/v_zo0020ms_00_00_00_sk';
const USER_DATA_DIR = '/tmp/codex-datacube-trade';

function resolveChromeBin() {
  const candidates = [
    process.env.CHROME_BIN,
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);

  const match = candidates.find((candidate) => existsSync(candidate));
  if (!match) {
    throw new Error(
      'No supported Chrome or Chromium binary was found. Set CHROME_BIN or install Chromium in the deployment environment.',
    );
  }

  return match;
}

function launchChrome() {
  const chromeBin = resolveChromeBin();
  return spawn(
    chromeBin,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      `--remote-debugging-port=${REMOTE_PORT}`,
      `--user-data-dir=${USER_DATA_DIR}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
}

async function getJson(path) {
  const res = await fetch(`http://127.0.0.1:${REMOTE_PORT}${path}`);
  if (!res.ok) throw new Error(`DevTools ${path} failed: ${res.status}`);
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
      if (attempt === 39) throw new Error('Chrome DevTools did not start in time.');
    }
  }

  const targets = await getJson('/json/list');
  const target = targets.find((entry) => entry.type === 'page') ?? targets[0];
  if (!target) throw new Error('No Chrome page target was available.');

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
          document.querySelector('iframe[title*="zo0020ms"]') ||
          document.querySelector('iframe[src*="Cube=zo0020ms"]');
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
    if (frame?.src && frame?.hasRequire) return frame;
    await delay(1000);
  }

  throw new Error('The DATAcube trade iframe did not become ready in time.');
}

async function fetchSnapshots(send) {
  const result = await send('Runtime.evaluate', {
    expression: `(() => {
      const frame =
        document.querySelector('iframe[title*="zo0020ms"]') ||
        document.querySelector('iframe[src*="Cube=zo0020ms"]');
      if (!frame) {
        throw new Error('The trade DATAcube iframe was not found.');
      }

      const src = frame.getAttribute('src') || '';
      const token = new URL(src, location.origin).hash.match(/SessionToken=([^&]+)/)?.[1];
      if (!token) {
        throw new Error('The trade DATAcube session token was not available.');
      }

      const MONTHS = {
        'január': '01',
        'február': '02',
        'marec': '03',
        'apríl': '04',
        'máj': '05',
        'jún': '06',
        'júl': '07',
        'august': '08',
        'september': '09',
        'október': '10',
        'november': '11',
        'december': '12',
      };

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

      const normalizePeriod = (yearValue, periodValue) => {
        const year = String(yearValue || '').match(/(\\d{4})/)?.[1];
        const month = MONTHS[String(periodValue || '').trim().toLowerCase()];
        if (!year || !month) return null;
        return year + '-' + month;
      };

      return new Promise((resolve) => {
        frame.contentWindow.require(
          ['tm1web/share/service-loader!TM1Service', 'tm1web/share/service-loader!CubeViewService'],
          (tm1Service, cubeViewService) => {
            tm1Service.newCubeViewWidget(
              token,
              'zo0020ms',
              'v_zo0020ms_00_00_00_sk',
              true,
              {
                callback: (widget) => {
                  cubeViewService.LoadData(widget.objectId, {
                    callback: (data) => {
                      const columnHeaderRows = data?.gridData?.columnHeaderRows || [];
                      const rowHeaderColumns = data?.gridData?.rowHeaderColumns || [];
                      const dataRows = data?.gridData?.dataRows || [];

                      const years = expandCells(columnHeaderRows[0]?.cells || []);
                      const periods = expandCells(columnHeaderRows[1]?.cells || [])
                        .map((periodValue, index) => normalizePeriod(years[index], periodValue));

                      const regionLabels = expandCells(rowHeaderColumns[0]?.cells || []);
                      const categoryLabels = expandCells(rowHeaderColumns[1]?.cells || []);
                      const flowLabels = expandCells(rowHeaderColumns[2]?.cells || []);

                      const snapshots = {};
                      for (const period of periods) {
                        if (period && !snapshots[period]) snapshots[period] = [];
                      }

                      for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex += 1) {
                        const regionLabel = regionLabels[rowIndex] || '';
                        const categoryLabel = categoryLabels[rowIndex] || '';
                        const flowLabel = flowLabels[rowIndex] || '';
                        if (regionLabel !== 'SPOLU' || !categoryLabel || !flowLabel) continue;

                        const seriesCode = regionLabel + '__' + categoryLabel + '__' + flowLabel;
                        const rowCells = dataRows[rowIndex]?.cells || [];

                        for (let colIndex = 0; colIndex < rowCells.length; colIndex += 1) {
                          const period = periods[colIndex];
                          if (!period) continue;

                          const value = parseNumber(rowCells[colIndex]?.value);
                          if (value === null) continue;

                          snapshots[period].push({
                            seriesCode,
                            regionLabel,
                            categoryLabel,
                            flowLabel,
                            value,
                          });
                        }
                      }

                      const nonEmpty = Object.fromEntries(
                        Object.entries(snapshots).filter(([, items]) => Array.isArray(items) && items.length > 0),
                      );

                      resolve({
                        availablePeriods: Object.keys(nonEmpty).sort(),
                        snapshots: nonEmpty,
                      });
                    },
                    errorHandler: (message, error) =>
                      resolve({
                        error:
                          message ||
                          error?.message ||
                          'The DATAcube trade view did not return data.',
                      }),
                  });
                },
                errorHandler: (message, error) =>
                  resolve({
                    error:
                      message ||
                      error?.message ||
                      'The DATAcube trade widget could not be created.',
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
  if (!value) throw new Error('The DATAcube trade fetch returned no result.');
  if (value.error) throw new Error(value.error);
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
