// Roda no Worker: executa os algoritmos sem travar a página e devolve uma linha por (algoritmo, tamanho).
import { getAlgorithm, Io, defaultCompare } from './algorithms.js';
import { makeData, getKind, textCompare } from './data.js';

function mediana(v) {
  const s = v.slice().sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function estaOrdenado(a, cmp) {
  for (let i = 1; i < a.length; i++) if (cmp(a[i - 1], a[i]) > 0) return false;
  return true;
}

self.onmessage = (ev) => {
  const { algos, sizes, kind, reps, seed } = ev.data;
  const cmp = getKind(kind).numeric ? defaultCompare : textCompare();
  const ids = algos.concat(['nativo']);
  const total = sizes.length * ids.length;
  let feitos = 0;
  try {
    for (const n of sizes) {
      const dados = makeData(kind, n, seed); // os mesmos dados para todos os algoritmos deste tamanho
      for (const id of ids) {
        const tempos = [];
        let comparacoes = 0, escritas = null;
        for (let r = 0; r < reps; r++) {
          const a = dados.slice();
          if (id === 'nativo') {
            let c = 0;
            const t0 = performance.now();
            a.sort((x, y) => { c++; return cmp(x, y); });
            tempos.push(performance.now() - t0);
            comparacoes = c;
          } else {
            const io = new Io({ compare: cmp });
            const t0 = performance.now();
            getAlgorithm(id).sort(a, io);
            tempos.push(performance.now() - t0);
            comparacoes = io.comparisons;
            escritas = io.writes;
          }
          if (!estaOrdenado(a, cmp)) throw new Error('Resultado não ordenado: ' + id + ' n=' + n);
        }
        feitos++;
        self.postMessage({ type: 'row', done: feitos, total, row: { id, n, ms: mediana(tempos), comparisons: comparacoes, writes: escritas } });
      }
    }
    self.postMessage({ type: 'done' });
  } catch (e) {
    self.postMessage({ type: 'error', message: String(e && e.message || e) });
  }
};
