import test from 'node:test';
import assert from 'node:assert/strict';
import { makeData, mulberry32, KINDS, getKind } from '../js/data.js';

test('mesma semente gera o mesmo array; sementes diferentes geram arrays diferentes', () => {
  for (const k of KINDS) {
    if (k.id === 'ordenado' || k.id === 'inverso') continue; // determinísticos por definição
    assert.deepEqual(makeData(k.id, 200, 42), makeData(k.id, 200, 42), k.id);
    assert.notDeepEqual(makeData(k.id, 200, 42), makeData(k.id, 200, 43), k.id);
  }
});

test('o PRNG gera valores em [0, 1) e é determinístico', () => {
  const a = mulberry32(5), b = mulberry32(5);
  for (let i = 0; i < 1000; i++) {
    const x = a();
    assert.ok(x >= 0 && x < 1);
    assert.equal(x, b());
  }
});

test('aleatório é uma permutação de 1..n', () => {
  const a = makeData('aleatorio', 500, 1);
  assert.deepEqual(a.slice().sort((x, y) => x - y), Array.from({ length: 500 }, (_, i) => i + 1));
});

test('ordenado cresce e inverso decresce', () => {
  const o = makeData('ordenado', 100, 1);
  const r = makeData('inverso', 100, 1);
  for (let i = 1; i < 100; i++) {
    assert.ok(o[i - 1] < o[i]);
    assert.ok(r[i - 1] > r[i]);
  }
});

test('"poucos" tem no máximo 10 valores distintos', () => {
  assert.ok(new Set(makeData('poucos', 1000, 3)).size <= 10);
  assert.ok(new Set(makeData('poucos', 4, 3)).size <= 4);
});

test('"quase ordenado" tem poucas inversões comparado ao aleatório', () => {
  const inversoes = (a) => { let c = 0; for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) if (a[i] > a[j]) c++; return c; };
  const n = 300;
  assert.ok(inversoes(makeData('quase', n, 1)) < inversoes(makeData('aleatorio', n, 1)) / 4);
});

test('"nomes" gera textos "Nome Sobrenome"', () => {
  for (const s of makeData('nomes', 50, 1)) {
    assert.equal(typeof s, 'string');
    assert.match(s, /^\S+ \S+$/);
  }
});

test('tamanho zero e getKind com id inválido', () => {
  for (const k of KINDS) assert.deepEqual(makeData(k.id, 0, 1), []);
  assert.equal(getKind('nao-existe').id, KINDS[0].id);
});
