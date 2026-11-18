// Geração de dados de entrada, reproduzível por semente (mesma semente = mesmo array).

/** PRNG mulberry32: pequeno, rápido e determinístico. */
export function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const KINDS = [
  { id: 'aleatorio', name: 'Aleatório', numeric: true },
  { id: 'ordenado', name: 'Já ordenado', numeric: true },
  { id: 'inverso', name: 'Ordem inversa', numeric: true },
  { id: 'quase', name: 'Quase ordenado (5% fora do lugar)', numeric: true },
  { id: 'poucos', name: 'Poucos valores distintos (10)', numeric: true },
  { id: 'nomes', name: 'Nomes fictícios (texto)', numeric: false },
];

const PRIMEIROS = ['Ana', 'Bruno', 'Carla', 'Daniel', 'Elisa', 'Fábio', 'Gabriela', 'Hugo', 'Inês', 'João',
  'Karen', 'Lucas', 'Marina', 'Nelson', 'Olívia', 'Paulo', 'Quésia', 'Rafael', 'Sofia', 'Tiago',
  'Úrsula', 'Vítor', 'Wanda', 'Xavier', 'Yara', 'Zélia', 'Álvaro', 'Érica', 'Ítalo', 'Ângela'];
const SOBRENOMES = ['Almeida', 'Barros', 'Cardoso', 'Dias', 'Esteves', 'Fonseca', 'Gomes', 'Honório', 'Ibrahim', 'Jesus',
  'Klein', 'Lopes', 'Moraes', 'Nogueira', 'Oliveira', 'Pereira', 'Queiroz', 'Ramos', 'Santos', 'Teixeira',
  'Ulisses', 'Vieira', 'Werneck', 'Ximenes', 'Yamada', 'Zanetti', 'Álvares', 'Ávila', 'Ôto', 'Ürsula'];

/** Comparador de texto para português do Brasil (acentos e maiúsculas tratados corretamente). */
export function textCompare() {
  const col = new Intl.Collator('pt-BR');
  return (x, y) => col.compare(x, y);
}

/**
 * Gera `n` elementos do tipo `kind`. Para os tipos numéricos devolve números; para 'nomes', textos.
 * Os nomes são combinações aleatórias de listas curtas: não representam pessoas reais.
 */
export function makeData(kind, n, seed = 1) {
  const rnd = mulberry32(seed);
  const a = [];
  switch (kind) {
    case 'ordenado':
      for (let i = 1; i <= n; i++) a.push(i);
      return a;
    case 'inverso':
      for (let i = n; i >= 1; i--) a.push(i);
      return a;
    case 'quase': {
      for (let i = 1; i <= n; i++) a.push(i);
      const trocas = Math.floor(n * 0.05);
      for (let k = 0; k < trocas; k++) {
        const i = Math.floor(rnd() * n), j = Math.floor(rnd() * n);
        const t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    }
    case 'poucos': {
      const distintos = Math.min(10, Math.max(1, n));
      for (let i = 0; i < n; i++) a.push(1 + Math.floor(rnd() * distintos));
      return a;
    }
    case 'nomes':
      for (let i = 0; i < n; i++) {
        a.push(PRIMEIROS[Math.floor(rnd() * PRIMEIROS.length)] + ' ' + SOBRENOMES[Math.floor(rnd() * SOBRENOMES.length)]);
      }
      return a;
    case 'aleatorio':
    default:
      for (let i = 1; i <= n; i++) a.push(i);
      for (let i = n - 1; i > 0; i--) { // Fisher-Yates
        const j = Math.floor(rnd() * (i + 1));
        const t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
  }
}

export function getKind(id) {
  return KINDS.find((k) => k.id === id) || KINDS[0];
}
