import { ALGORITHMS, getAlgorithm } from './algorithms.js';
import { KINDS } from './data.js';
import { Visualizer } from './visualizer.js';
import { initBenchmark } from './benchmark.js';

const $ = (id) => document.getElementById(id);
const fmt = (v) => v.toLocaleString('pt-BR');

// ---------- abas (padrão WAI-ARIA: setas, Home e End) ----------
const abas = [...document.querySelectorAll('[role="tab"]')];
function ativa(aba, foco) {
  for (const t of abas) {
    const sel = t === aba;
    t.setAttribute('aria-selected', String(sel));
    t.tabIndex = sel ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')).hidden = !sel;
  }
  if (foco) aba.focus();
  if (aba.id === 'aba-vis') viz.draw();
}
abas.forEach((t, i) => {
  t.addEventListener('click', () => ativa(t, false));
  t.addEventListener('keydown', (e) => {
    const k = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: abas.length - 1 }[e.key];
    if (k === undefined) return;
    e.preventDefault();
    ativa(abas[(k + abas.length) % abas.length], true);
  });
});

// ---------- visualizador ----------
const params = new URLSearchParams(location.search);
let seed = Number(params.get('seed')) || 1;
const numericKinds = KINDS.filter((k) => k.numeric);

$('vis-alg').innerHTML = ALGORITHMS.map((a) => `<option value="${a.id}">${a.name}</option>`).join('');
$('vis-kind').innerHTML = numericKinds.map((k) => `<option value="${k.id}">${k.name}</option>`).join('');

const viz = new Visualizer($('vis-canvas'), (s) => {
  $('m-cmp').textContent = fmt(s.comparisons);
  $('m-wr').textContent = fmt(s.writes);
  $('m-sw').textContent = fmt(s.swaps);
  $('m-step').textContent = `${fmt(s.step)} / ${fmt(s.totalSteps)}`;
  $('vis-play').textContent = s.playing ? 'Pausar' : (s.done ? 'Repetir' : 'Executar');
  const status = $('vis-status');
  status.dataset.state = s.done ? 'done' : (s.playing ? 'running' : 'idle');
  if (s.done) {
    status.textContent = `Ordenado: ${fmt(s.comparisons)} comparações, ${fmt(s.writes)} escritas.`;
  } else if (s.playing) {
    status.textContent = 'Ordenando...';
  } else if (s.step === 0) {
    status.textContent = 'Pronto. Clique em Executar, Passo ou Terminar.';
  } else {
    status.textContent = 'Pausado.';
  }
  $('vis-canvas').setAttribute('aria-label',
    `Barras representando o array. ${s.done ? 'Array ordenado.' : 'Ordenação em andamento ou pausada.'}`);
});

function mostraInfo() {
  const a = getAlgorithm($('vis-alg').value);
  $('vis-info').innerHTML = `<h2>${a.name}</h2>
    <table><tbody>
      <tr><th scope="row">Melhor caso</th><td>${a.best}</td><th scope="row">Estável</th><td>${a.stable ? 'sim' : 'não'}</td></tr>
      <tr><th scope="row">Caso médio</th><td>${a.average}</td><th scope="row">Espaço extra</th><td>${a.space}</td></tr>
      <tr><th scope="row">Pior caso</th><td>${a.worst}</td><th scope="row"></th><td></td></tr>
    </tbody></table>${a.note ? `<p class="nota-alg">${a.note}</p>` : ''}`;
}

function carrega() {
  $('vis-n-out').textContent = $('vis-n').value;
  mostraInfo();
  viz.setSpeed(Number($('vis-speed').value));
  viz.load({ algoId: $('vis-alg').value, kind: $('vis-kind').value, n: Number($('vis-n').value), seed });
}

$('vis-alg').addEventListener('change', () => { carrega(); });
$('vis-kind').addEventListener('change', carrega);
$('vis-n').addEventListener('input', carrega);
$('vis-speed').addEventListener('input', () => viz.setSpeed(Number($('vis-speed').value)));
$('vis-play').addEventListener('click', () => (viz.playing ? viz.pause() : viz.play()));
$('vis-step').addEventListener('click', () => viz.step());
$('vis-finish').addEventListener('click', () => viz.finish());
$('vis-reset').addEventListener('click', () => { seed++; carrega(); });

carrega();
initBenchmark();

// Gancho somente para leitura, usado pelos testes de ponta a ponta.
window.__sortingLab = {
  getArray: () => viz.arr.slice(),
  getState: () => ({ done: viz.done, seed: viz.seed, comparisons: viz.cmp, writes: viz.wr, swaps: viz.sw, totals: viz.totals }),
};
