// Algoritmos de ordenação instrumentados.
//
// Cada algoritmo é escrito UMA vez, como `sort(a, io)`, e ordena `a` no lugar. Toda comparação e toda escrita
// passam pelo objeto `io`, que conta as operações e, opcionalmente, registra cada uma como evento. Assim o
// visualizador (que reproduz os eventos), o benchmark (que só conta) e os testes usam exatamente o mesmo código.
//
// Contagens: "comparações" = chamadas ao comparador; "escritas" = escritas no array principal (uma troca vale 2).
// Cópias para buffers auxiliares (merge sort) não contam como escritas.

export const EV_COMPARE = 0; // [0, i, j]  compara as posições i e j (só para destacar)
export const EV_SWAP = 1;    // [1, i, j]  troca as posições i e j
export const EV_WRITE = 2;   // [2, i, v]  escreve o valor v na posição i

export function defaultCompare(x, y) {
  return x < y ? -1 : x > y ? 1 : 0;
}

export class Io {
  /**
   * @param {object} [opts]
   * @param {(x:any,y:any)=>number} [opts.compare] comparador (negativo, zero ou positivo)
   * @param {boolean} [opts.record] se true, guarda os eventos em `events` (lista plana de trios)
   */
  constructor({ compare = defaultCompare, record = false } = {}) {
    this.compare = compare;
    this.comparisons = 0;
    this.writes = 0;
    this.swaps = 0;
    this.events = record ? [] : null;
  }

  /** x < y ? As posições i e j são só dicas de destaque para o visualizador (-1 se não houver). */
  lt(x, y, i = -1, j = -1) {
    this.comparisons++;
    if (this.events) this.events.push(EV_COMPARE, i, j);
    return this.compare(x, y) < 0;
  }

  swap(a, i, j) {
    if (i === j) return;
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
    this.swaps++;
    this.writes += 2;
    if (this.events) this.events.push(EV_SWAP, i, j);
  }

  set(a, i, v) {
    a[i] = v;
    this.writes++;
    if (this.events) this.events.push(EV_WRITE, i, v);
  }
}

// ---------- algoritmos ----------

function bubble(a, io) {
  for (let end = a.length - 1; end > 0; end--) {
    let trocou = false;
    for (let i = 0; i < end; i++) {
      if (io.lt(a[i + 1], a[i], i + 1, i)) {
        io.swap(a, i, i + 1);
        trocou = true;
      }
    }
    if (!trocou) return; // já ordenado
  }
}

function selection(a, io) {
  for (let i = 0; i < a.length - 1; i++) {
    let min = i;
    for (let j = i + 1; j < a.length; j++) {
      if (io.lt(a[j], a[min], j, min)) min = j;
    }
    io.swap(a, i, min);
  }
}

function insertion(a, io) {
  for (let i = 1; i < a.length; i++) {
    const chave = a[i];
    let j = i - 1;
    while (j >= 0 && io.lt(chave, a[j], i, j)) {
      io.set(a, j + 1, a[j]);
      j--;
    }
    io.set(a, j + 1, chave);
  }
}

// Sequência de Ciura (gaps empiricamente bons para Shell sort).
const CIURA = [701, 301, 132, 57, 23, 10, 4, 1];

function shell(a, io) {
  for (const gap of CIURA) {
    if (gap >= a.length) continue;
    for (let i = gap; i < a.length; i++) {
      const chave = a[i];
      let j = i;
      while (j >= gap && io.lt(chave, a[j - gap], i, j - gap)) {
        io.set(a, j, a[j - gap]);
        j -= gap;
      }
      io.set(a, j, chave);
    }
  }
}

function merge(a, io) {
  const aux = a.slice();
  function sortRange(lo, hi) { // [lo, hi)
    if (hi - lo < 2) return;
    const mid = (lo + hi) >>> 1;
    sortRange(lo, mid);
    sortRange(mid, hi);
    for (let k = lo; k < hi; k++) aux[k] = a[k]; // cópia para o buffer (não conta como escrita)
    let i = lo, j = mid;
    for (let k = lo; k < hi; k++) {
      if (i >= mid) io.set(a, k, aux[j++]);
      else if (j >= hi) io.set(a, k, aux[i++]);
      // só pega da direita se for ESTRITAMENTE menor: mantém a estabilidade
      else if (io.lt(aux[j], aux[i], j, i)) io.set(a, k, aux[j++]);
      else io.set(a, k, aux[i++]);
    }
  }
  sortRange(0, a.length);
}

// Quicksort com partição em três vias (trata bem muitos valores repetidos) e pivô = mediana de três
// posições SORTEADAS. O sorteio usa semente fixa, então a execução continua 100% reproduzível.
//
// Por que sorteio e não "mediana de lo/meio/hi"? Testei a versão clássica: na entrada ordenada, a partição
// de três vias embaralha a metade direita e a mediana fixa passa a escolher pivôs ruins, o que faz o custo
// crescer perto de O(n²) (comparações ÷ n·log2 n subiam de 3,9 para 20,6 entre n=1.000 e n=100.000).
function quick(a, io) {
  let semente = 0x9e3779b9;
  function sorteia(n) { // inteiro em [0, n)
    semente = (Math.imul(semente, 1664525) + 1013904223) >>> 0;
    return Math.floor((semente / 4294967296) * n);
  }
  function medianaDeTres(lo, hi) {
    const tam = hi - lo + 1;
    const i = lo + sorteia(tam), j = lo + sorteia(tam), k = lo + sorteia(tam);
    const x = a[i], y = a[j], z = a[k];
    if (io.lt(x, y, i, j)) {
      if (io.lt(y, z, j, k)) return y;
      return io.lt(x, z, i, k) ? z : x;
    }
    if (io.lt(x, z, i, k)) return x;
    return io.lt(y, z, j, k) ? z : y;
  }
  function sortRange(lo, hi) { // [lo, hi] inclusivo
    while (lo < hi) {
      const pivo = medianaDeTres(lo, hi);
      let menor = lo, i = lo, maior = hi;
      while (i <= maior) {
        if (io.lt(a[i], pivo, i, -1)) io.swap(a, menor++, i++);
        else if (io.lt(pivo, a[i], -1, i)) io.swap(a, i, maior--);
        else i++;
      }
      // recursão no lado menor, laço no maior: a pilha fica limitada a O(log n)
      if (menor - lo < hi - maior) {
        sortRange(lo, menor - 1);
        lo = maior + 1;
      } else {
        sortRange(maior + 1, hi);
        hi = menor - 1;
      }
    }
  }
  sortRange(0, a.length - 1);
}

function heap(a, io) {
  const n = a.length;
  function afundar(i, tam) {
    for (;;) {
      let maior = i;
      const l = 2 * i + 1, r = l + 1;
      if (l < tam && io.lt(a[maior], a[l], maior, l)) maior = l;
      if (r < tam && io.lt(a[maior], a[r], maior, r)) maior = r;
      if (maior === i) return;
      io.swap(a, i, maior);
      i = maior;
    }
  }
  for (let i = (n >>> 1) - 1; i >= 0; i--) afundar(i, n);
  for (let fim = n - 1; fim > 0; fim--) {
    io.swap(a, 0, fim);
    afundar(0, fim);
  }
}

/** Catálogo exibido na interface. `quadratic` marca os O(n²) (lentos em arrays grandes). */
export const ALGORITHMS = [
  { id: 'bubble', name: 'Bubble sort', sort: bubble, stable: true, quadratic: true, best: 'O(n)', average: 'O(n²)', worst: 'O(n²)', space: 'O(1)' },
  { id: 'selection', name: 'Selection sort', sort: selection, stable: false, quadratic: true, best: 'O(n²)', average: 'O(n²)', worst: 'O(n²)', space: 'O(1)' },
  { id: 'insertion', name: 'Insertion sort', sort: insertion, stable: true, quadratic: true, best: 'O(n)', average: 'O(n²)', worst: 'O(n²)', space: 'O(1)' },
  { id: 'shell', name: 'Shell sort (Ciura)', note: 'Usa a sequência de gaps de Ciura (701, 301, 132, 57, 23, 10, 4, 1). O caso médio depende dos gaps escolhidos.', sort: shell, stable: false, quadratic: false, best: 'O(n log n)', average: 'depende dos gaps', worst: 'O(n²)', space: 'O(1)' },
  { id: 'merge', name: 'Merge sort', sort: merge, stable: true, quadratic: false, best: 'O(n log n)', average: 'O(n log n)', worst: 'O(n log n)', space: 'O(n)' },
  { id: 'quick', name: 'Quicksort (3 vias)', note: 'Pivô = mediana de três posições sorteadas (semente fixa, então é reproduzível). A partição em 3 vias trata bem muitos valores repetidos.', sort: quick, stable: false, quadratic: false, best: 'O(n log n)', average: 'O(n log n)', worst: 'O(n²)', space: 'O(log n)' },
  { id: 'heap', name: 'Heap sort', sort: heap, stable: false, quadratic: false, best: 'O(n log n)', average: 'O(n log n)', worst: 'O(n log n)', space: 'O(1)' },
];

export function getAlgorithm(id) {
  const alg = ALGORITHMS.find((x) => x.id === id);
  if (!alg) throw new Error('Algoritmo desconhecido: ' + id);
  return alg;
}

/** Ordena uma cópia dos dados e devolve o resultado, as contagens e (opcional) os eventos gravados. */
export function runSort(id, data, { compare = defaultCompare, record = false } = {}) {
  const alg = getAlgorithm(id);
  const a = data.slice();
  const io = new Io({ compare, record });
  alg.sort(a, io);
  return { result: a, comparisons: io.comparisons, writes: io.writes, swaps: io.swaps, events: io.events };
}

/** Reaplica eventos gravados sobre uma cópia dos dados originais (é o que o visualizador faz, passo a passo). */
export function replay(data, events) {
  const a = data.slice();
  for (let k = 0; k < events.length; k += 3) {
    const t = events[k];
    if (t === EV_SWAP) {
      const x = a[events[k + 1]];
      a[events[k + 1]] = a[events[k + 2]];
      a[events[k + 2]] = x;
    } else if (t === EV_WRITE) {
      a[events[k + 1]] = events[k + 2];
    }
  }
  return a;
}
