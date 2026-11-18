import test from 'node:test';
import assert from 'node:assert/strict';
import { ALGORITHMS, runSort, replay, EV_COMPARE, EV_SWAP, EV_WRITE, defaultCompare } from '../js/algorithms.js';
import { makeData, KINDS, textCompare } from '../js/data.js';

const referencia = (arr, cmp = defaultCompare) => arr.slice().sort(cmp);
const tamanhos = [0, 1, 2, 3, 4, 5, 10, 31, 100, 257, 1000];

for (const alg of ALGORITHMS) {
  test(`${alg.name}: ordena igual à referência em todos os tipos de entrada e tamanhos`, () => {
    for (const kind of KINDS) {
      const cmp = kind.numeric ? defaultCompare : textCompare();
      for (const n of tamanhos) {
        for (const seed of [1, 2, 3]) {
          const dados = makeData(kind.id, n, seed);
          const { result } = runSort(alg.id, dados, { compare: cmp });
          assert.deepEqual(result, referencia(dados, cmp), `${kind.id} n=${n} seed=${seed}`);
        }
      }
    }
  });

  test(`${alg.name}: não altera o array de entrada`, () => {
    const dados = makeData('aleatorio', 50, 7);
    const copia = dados.slice();
    runSort(alg.id, dados);
    assert.deepEqual(dados, copia);
  });

  test(`${alg.name}: reproduzir os eventos gravados leva ao mesmo resultado`, () => {
    for (const kind of ['aleatorio', 'inverso', 'poucos', 'quase']) {
      const dados = makeData(kind, 120, 5);
      const r = runSort(alg.id, dados, { record: true });
      assert.deepEqual(replay(dados, r.events), r.result, kind);
    }
  });

  test(`${alg.name}: contadores batem com os eventos gravados`, () => {
    const dados = makeData('aleatorio', 150, 9);
    const r = runSort(alg.id, dados, { record: true });
    let comparacoes = 0, trocas = 0, escritas = 0;
    for (let k = 0; k < r.events.length; k += 3) {
      if (r.events[k] === EV_COMPARE) comparacoes++;
      else if (r.events[k] === EV_SWAP) trocas++;
      else if (r.events[k] === EV_WRITE) escritas++;
    }
    assert.equal(r.comparisons, comparacoes);
    assert.equal(r.swaps, trocas);
    assert.equal(r.writes, 2 * trocas + escritas); // uma troca = 2 escritas
  });

  test(`${alg.name}: respeita a estabilidade declarada (${alg.stable ? 'estável' : 'pode ser instável'})`, () => {
    if (!alg.stable) return; // só afirmamos para os que prometem ser estáveis
    // muitos empates: chave em 0..9, com o índice original como "etiqueta"
    const itens = makeData('poucos', 400, 11).map((k, id) => ({ k, id }));
    const { result } = runSort(alg.id, itens, { compare: (x, y) => x.k - y.k });
    for (let i = 1; i < result.length; i++) {
      if (result[i - 1].k === result[i].k) {
        assert.ok(result[i - 1].id < result[i].id, `empate fora da ordem original em ${i}`);
      }
    }
  });
}

test('casos extremos: vazio, um elemento e todos iguais', () => {
  for (const alg of ALGORITHMS) {
    assert.deepEqual(runSort(alg.id, []).result, []);
    assert.deepEqual(runSort(alg.id, [42]).result, [42]);
    assert.deepEqual(runSort(alg.id, [7, 7, 7, 7, 7]).result, [7, 7, 7, 7, 7]);
  }
});

// ---- propriedades de custo: pegam implementações que "funcionam" mas degradaram ----

test('selection sort faz exatamente n(n-1)/2 comparações, independente da entrada', () => {
  const n = 200;
  for (const kind of ['aleatorio', 'ordenado', 'inverso']) {
    assert.equal(runSort('selection', makeData(kind, n, 3)).comparisons, n * (n - 1) / 2, kind);
  }
});

test('bubble e insertion fazem n-1 comparações em entrada já ordenada', () => {
  const n = 300;
  const dados = makeData('ordenado', n, 1);
  assert.equal(runSort('bubble', dados).comparisons, n - 1);
  assert.equal(runSort('insertion', dados).comparisons, n - 1);
  assert.equal(runSort('bubble', dados).swaps, 0);
});

test('insertion sort em ordem inversa faz n(n-1)/2 comparações (pior caso)', () => {
  const n = 120;
  assert.equal(runSort('insertion', makeData('inverso', n, 1)).comparisons, n * (n - 1) / 2);
});

test('merge sort não passa de n·⌈log2 n⌉ comparações', () => {
  const n = 4096;
  const limite = n * Math.ceil(Math.log2(n));
  for (const kind of ['aleatorio', 'ordenado', 'inverso', 'poucos']) {
    assert.ok(runSort('merge', makeData(kind, n, 4)).comparisons <= limite, kind);
  }
});

test('heap sort não passa de 2·n·log2 n comparações', () => {
  const n = 4096;
  const limite = 2 * n * Math.log2(n);
  for (const kind of ['aleatorio', 'inverso', 'poucos']) {
    assert.ok(runSort('heap', makeData(kind, n, 4)).comparisons <= limite, kind);
  }
});

test('quicksort de 3 vias continua O(n log n) com muitos valores repetidos', () => {
  // uma partição de 2 vias ingênua degrada para O(n²) aqui: seriam ~n²/20 = 500.000 comparações
  const n = 10000;
  const { comparisons } = runSort('quick', makeData('poucos', n, 2));
  assert.ok(comparisons < 20 * n, `comparações: ${comparisons}`);
});

test('quicksort não degrada em entradas ordenadas ou inversas: o custo cresce como n·log n, não como n²', () => {
  // A 1ª versão (mediana de lo/meio/hi) falhava aqui: comparações ÷ (n·log2 n) subiam de 3,9 para 20,6 de n=1.000 a n=100.000.
  // Num algoritmo O(n log n) essa razão fica quase constante; num O(n²) ela cresce com n.
  const razao = (kind, n) => runSort('quick', makeData(kind, n, 1)).comparisons / (n * Math.log2(n));
  for (const kind of ['ordenado', 'inverso', 'aleatorio']) {
    const pequeno = razao(kind, 2000), grande = razao(kind, 100000);
    assert.ok(grande < 4, `${kind}: razão ${grande.toFixed(2)} em n=100.000`);
    assert.ok(grande < pequeno * 1.5, `${kind}: razão cresceu de ${pequeno.toFixed(2)} para ${grande.toFixed(2)}`);
  }
});

test('a ordenação de texto usa as regras do português (acentos) quando recebe o comparador certo', () => {
  const nomes = ['Bruno', 'Ana', 'Álvaro'];
  assert.deepEqual(runSort('merge', nomes, { compare: textCompare() }).result, ['Álvaro', 'Ana', 'Bruno']);
  // com o comparador padrão, "Á" (código maior) vai para o fim: é exatamente o erro que o comparador de pt-BR evita
  assert.deepEqual(runSort('merge', nomes).result, ['Ana', 'Bruno', 'Álvaro']);
});
