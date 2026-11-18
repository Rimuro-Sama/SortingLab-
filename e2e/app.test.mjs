// Testes de ponta a ponta: abrem a página de verdade num navegador (Chromium) e usam a interface.
// Pré-requisito: `npx playwright install chromium` (uma vez). Rodar: `npm run e2e`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { criaServidor } from '../scripts/serve.mjs';
import { ALGORITHMS, runSort } from '../js/algorithms.js';
import { makeData } from '../js/data.js';

let servidor, base, browser;

test.before(async () => {
  servidor = criaServidor();
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  base = `http://127.0.0.1:${servidor.address().port}`;
  browser = await chromium.launch();
});

test.after(async () => {
  await browser?.close();
  servidor?.close();
});

/** Abre uma página nova e junta qualquer erro de JavaScript ou de console. */
async function abre(url = '/?seed=1') {
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  page.erros = [];
  page.on('pageerror', (e) => page.erros.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') page.erros.push('console: ' + m.text()); });
  page.on('requestfailed', (r) => page.erros.push('requisição falhou: ' + r.url()));
  await page.goto(base + url);
  return page;
}

const ordenado = (a) => a.every((v, i) => i === 0 || a[i - 1] <= v);

test('cada algoritmo termina ordenado, e os contadores da tela são exatamente os do núcleo', async () => {
  const page = await abre('/?seed=1');
  await page.fill('#vis-n', '40');
  await page.dispatchEvent('#vis-n', 'input');
  for (const alg of ALGORITHMS) {
    await page.selectOption('#vis-alg', alg.id);
    await page.click('#vis-finish');
    assert.equal(await page.getAttribute('#vis-status', 'data-state'), 'done', alg.name);

    const arr = await page.evaluate(() => window.__sortingLab.getArray());
    assert.ok(ordenado(arr), `${alg.name}: array final não está ordenado`);
    assert.equal(arr.length, 40);

    // a interface precisa mostrar exatamente o que o núcleo conta para os mesmos dados (mesma semente)
    const esperado = runSort(alg.id, makeData('aleatorio', 40, 1));
    const estado = await page.evaluate(() => window.__sortingLab.getState());
    assert.equal(estado.comparisons, esperado.comparisons, `${alg.name}: comparações`);
    assert.equal(estado.writes, esperado.writes, `${alg.name}: escritas`);
    assert.equal(await page.textContent('#m-cmp'), esperado.comparisons.toLocaleString('pt-BR'), `${alg.name}: texto das comparações`);
  }
  assert.deepEqual(page.erros, []);
  await page.close();
});

test('o botão Passo avança exatamente um evento por clique', async () => {
  const page = await abre('/?seed=1');
  await page.selectOption('#vis-alg', 'insertion');
  assert.equal((await page.textContent('#m-step')).split(' / ')[0], '0');
  await page.click('#vis-step');
  await page.click('#vis-step');
  await page.click('#vis-step');
  assert.equal((await page.textContent('#m-step')).split(' / ')[0], '3');
  assert.equal(await page.getAttribute('#vis-status', 'data-state'), 'idle');
  assert.deepEqual(page.erros, []);
  await page.close();
});

test('Executar anima até o fim sozinho e o status muda para concluído', async () => {
  const page = await abre('/?seed=1');
  await page.fill('#vis-n', '20');
  await page.dispatchEvent('#vis-n', 'input');
  await page.fill('#vis-speed', '60');
  await page.dispatchEvent('#vis-speed', 'input');
  await page.click('#vis-play');
  await page.waitForFunction(() => document.getElementById('vis-status').dataset.state === 'done', null, { timeout: 15000 });
  assert.ok(ordenado(await page.evaluate(() => window.__sortingLab.getArray())));
  assert.deepEqual(page.erros, []);
  await page.close();
});

test('"Novos dados" muda a semente e gera outro array', async () => {
  const page = await abre('/?seed=1');
  const antes = await page.evaluate(() => window.__sortingLab.getArray());
  await page.click('#vis-reset');
  const depois = await page.evaluate(() => window.__sortingLab.getArray());
  assert.equal((await page.evaluate(() => window.__sortingLab.getState())).seed, 2);
  assert.notDeepEqual(antes, depois);
  await page.close();
});

test('benchmark: roda no Worker e a tabela traz contagens exatas', async () => {
  const page = await abre('/?seed=1');
  await page.click('#aba-bench');
  // seleção mínima: só selection e merge, só n=500 e n=1000, 1 repetição
  for (const cb of await page.$$('#bench-algs input')) await cb.setChecked(['selection', 'merge'].includes(await cb.getAttribute('value')));
  for (const cb of await page.$$('#bench-sizes input')) await cb.setChecked(['500', '1000'].includes(await cb.getAttribute('value')));
  await page.fill('#bench-reps', '1');
  await page.click('#bench-run');
  await page.waitForFunction(() => document.getElementById('bench-status').dataset.state === 'done', null, { timeout: 60000 });

  // 2 algoritmos + a referência nativa, em 2 tamanhos = 6 linhas
  const linhas = await page.$$eval('#bench-tabela tbody tr', (trs) => trs.map((tr) => ({ algo: tr.dataset.algo, n: Number(tr.dataset.n), cols: [...tr.cells].map((c) => c.textContent) })));
  assert.equal(linhas.length, 6);
  assert.deepEqual([...new Set(linhas.map((l) => l.algo))].sort(), ['merge', 'nativo', 'selection']);

  // selection sort faz exatamente n(n-1)/2 comparações, e a tela precisa mostrar esse número
  for (const n of [500, 1000]) {
    const l = linhas.find((x) => x.algo === 'selection' && x.n === n);
    assert.equal(l.cols[3], (n * (n - 1) / 2).toLocaleString('pt-BR'), `comparações do selection n=${n}`);
    const ms = Number(l.cols[2].replace(',', '.'));
    assert.ok(ms > 0, `tempo positivo (${l.cols[2]})`);
  }
  // o merge sort faz bem menos comparações que o selection no mesmo tamanho
  const parse = (s) => Number(s.replace(/\./g, ''));
  const sel = linhas.find((x) => x.algo === 'selection' && x.n === 1000), mer = linhas.find((x) => x.algo === 'merge' && x.n === 1000);
  assert.ok(parse(mer.cols[3]) < parse(sel.cols[3]) / 10);
  assert.equal(await page.isVisible('#bench-canvas'), true); // com 2 tamanhos o gráfico aparece
  assert.deepEqual(page.erros, []);
  await page.close();
});

test('benchmark com textos funciona com os nomes fictícios', async () => {
  const page = await abre('/?seed=1');
  await page.click('#aba-bench');
  for (const cb of await page.$$('#bench-algs input')) await cb.setChecked((await cb.getAttribute('value')) === 'merge');
  for (const cb of await page.$$('#bench-sizes input')) await cb.setChecked((await cb.getAttribute('value')) === '1000');
  await page.selectOption('#bench-kind', 'nomes');
  await page.fill('#bench-reps', '1');
  await page.click('#bench-run');
  await page.waitForFunction(() => document.getElementById('bench-status').dataset.state === 'done', null, { timeout: 60000 });
  assert.equal(await page.$$eval('#bench-tabela tbody tr', (t) => t.length), 2); // merge + nativo
  assert.deepEqual(page.erros, []);
  await page.close();
});

test('abas: clique e teclado (setas, Home, End) trocam o painel e atualizam aria-selected', async () => {
  const page = await abre();
  assert.equal(await page.getAttribute('#aba-vis', 'aria-selected'), 'true');
  assert.equal(await page.isVisible('#painel-vis'), true);

  await page.focus('#aba-vis');
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.getAttribute('#aba-bench', 'aria-selected'), 'true');
  assert.equal(await page.isVisible('#painel-bench'), true);
  assert.equal(await page.isVisible('#painel-vis'), false);

  await page.keyboard.press('End');
  assert.equal(await page.getAttribute('#aba-sobre', 'aria-selected'), 'true');
  assert.equal(await page.isVisible('#painel-sobre'), true);

  await page.keyboard.press('Home');
  assert.equal(await page.getAttribute('#aba-vis', 'aria-selected'), 'true');
  assert.deepEqual(page.erros, []);
  await page.close();
});

test('o servidor de desenvolvimento não serve arquivos fora da pasta do projeto', async () => {
  const tentativas = ['/..%2f..%2fetc%2fpasswd', '/%2e%2e/%2e%2e/etc/passwd'];
  for (const t of tentativas) {
    const r = await fetch(base + t);
    assert.ok([403, 404].includes(r.status), `${t}: status ${r.status}`);
  }
  const ok = await fetch(base + '/js/algorithms.js');
  assert.equal(ok.status, 200);
  assert.match(ok.headers.get('content-type'), /javascript/);
});
