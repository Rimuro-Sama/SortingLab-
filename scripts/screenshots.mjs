// Gera os prints do README a partir da aplicação real: `node scripts/screenshots.mjs`
// (precisa de `npm install` e `npx playwright install chromium`).
import { chromium } from 'playwright';
import { criaServidor } from './serve.mjs';
import { mkdir } from 'node:fs/promises';

const saida = new URL('../docs/img/', import.meta.url).pathname;
await mkdir(saida, { recursive: true });
const servidor = criaServidor();
await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${servidor.address().port}`;
const browser = await chromium.launch();

for (const tema of ['dark', 'light']) {
  const ctx = await browser.newContext({ colorScheme: tema, viewport: { width: 1000, height: 820 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(base + '/?seed=3');

  // visualizador: quicksort pausado no meio da execução
  await page.selectOption('#vis-alg', 'quick');
  await page.fill('#vis-n', '90');
  await page.dispatchEvent('#vis-n', 'input');
  await page.fill('#vis-speed', '22');
  await page.dispatchEvent('#vis-speed', 'input');
  await page.click('#vis-play');
  await page.waitForFunction(() => Number(document.getElementById('m-cmp').textContent.replace(/\./g, '')) > 150);
  await page.click('#vis-play'); // pausa
  await page.screenshot({ path: `${saida}visualizador-${tema}.png` });

  if (tema === 'dark') {
    // benchmark: todos menos bubble, n = 500..10.000, dados aleatórios, 3 repetições
    await page.click('#aba-bench');
    for (const cb of await page.$$('#bench-sizes input')) {
      await cb.setChecked(['500', '1000', '2000', '5000', '10000'].includes(await cb.getAttribute('value')));
    }
    await page.fill('#bench-reps', '3');
    await page.click('#bench-run');
    await page.waitForFunction(() => document.getElementById('bench-status').dataset.state === 'done', null, { timeout: 120000 });
    await page.screenshot({ path: `${saida}benchmark-${tema}.png`, fullPage: true });
    const linhas = await page.$$eval('#bench-tabela tbody tr', (trs) => trs.map((tr) => [...tr.cells].map((c) => c.textContent).join(' | ')));
    console.log(linhas.filter((l) => / (5\.000|10\.000) \|/.test(l)).join('\n'));
  }
  await ctx.close();
}
await browser.close();
servidor.close();
