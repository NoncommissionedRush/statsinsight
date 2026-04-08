function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'chart';
}

// Inline SVG recreation of the aktuality.sk logo (self-contained, no external deps)
const AKTUALITY_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 230 42" height="18" aria-label="aktuality.sk">
  <polygon points="0,0 14,0 28,21 14,42 0,42 14,21" fill="#cc2828"/>
  <text x="36" y="30" font-family="'Arial Black',Arial,Helvetica,sans-serif" font-weight="900" font-size="28" fill="#1a2744">aktuality.sk</text>
</svg>`;

function buildExportHtml({
  title,
  unit,
  seriesNames,
  svgMarkup,
  source,
}: {
  title: string;
  unit: string;
  seriesNames: string[];
  svgMarkup: string;
  source: string;
}) {
  const exportedAt = new Date().toISOString().slice(0, 10);
  const seriesLine = seriesNames.join(', ');

  return `<!DOCTYPE html>
<html lang="sk">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      :root {
        color-scheme: light;
        --text: #0f172a;
        --muted: #64748b;
        --border: #e2e8f0;
        --background: #ffffff;
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        padding: 0;
        font-family: Inter, "Segoe UI", sans-serif;
        background: transparent;
        color: var(--text);
      }

      .chart-embed {
        width: min(100%, 900px);
        margin: 0 auto;
        border: 1px solid var(--border);
        border-radius: 16px;
        background: var(--background);
        padding: 24px;
      }

      .chart-embed h1 {
        margin: 0 0 8px;
        font-size: 24px;
        line-height: 1.2;
      }

      .chart-embed p {
        margin: 0;
        color: var(--muted);
        font-size: 14px;
        line-height: 1.5;
      }

      .chart-meta {
        display: grid;
        gap: 4px;
        margin-bottom: 18px;
      }

      .chart-svg {
        width: 100%;
      }

      .chart-svg svg {
        display: block;
        width: 100%;
        height: auto;
      }

      .chart-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 16px;
        padding-top: 12px;
        border-top: 1px solid var(--border);
      }

      .chart-source {
        font-size: 12px;
        color: var(--muted);
        font-style: italic;
      }

      .chart-logo {
        display: flex;
        align-items: center;
      }
    </style>
  </head>
  <body>
    <figure class="chart-embed">
      <div class="chart-meta">
        <h1>${title}</h1>
        <p>Jednotka: ${unit || 'hodnota'}</p>
        <p>Série: ${seriesLine}</p>
        <p>Exportované zo StatInsight dňa ${exportedAt}</p>
      </div>
      <div class="chart-svg">
        ${svgMarkup}
      </div>
      <div class="chart-footer">
        <span class="chart-source">Zdroj: ${source}</span>
        <div class="chart-logo">${AKTUALITY_LOGO_SVG}</div>
      </div>
    </figure>
  </body>
</html>`;
}

export function exportSvgChartAsHtml({
  container,
  title,
  unit,
  seriesNames,
  source,
}: {
  container: HTMLElement | null;
  title: string;
  unit: string;
  seriesNames: string[];
  source: string;
}) {
  const svg = container?.querySelector('svg');
  if (!(svg instanceof SVGSVGElement)) {
    throw new Error('Graf sa ešte vykresluje. Skúste to znova o chvíľu.');
  }

  const clonedSvg = svg.cloneNode(true) as SVGSVGElement;
  clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clonedSvg.setAttribute('role', 'img');
  clonedSvg.setAttribute('aria-label', title);
  clonedSvg.style.width = '100%';
  clonedSvg.style.height = 'auto';

  return buildExportHtml({
    title,
    unit,
    seriesNames,
    svgMarkup: clonedSvg.outerHTML,
    source,
  });
}

export async function copyChartHtml(html: string) {
  await navigator.clipboard.writeText(html);
}

export function downloadChartHtml(html: string, title: string) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${slugify(title)}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
