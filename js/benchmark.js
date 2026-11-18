// Interface do benchmark: configura, dispara o Worker e mostra tabela e gráfico.
import { ALGORITHMS } from './algorithms.js';
import { KINDS } from './data.js';

const NOMES = Object.fromEntries(ALGORITHMS.map((a) => [a.id, a.name]));
NOMES.nativo = 'Array.sort (nativo, referência)';
const TAMANHOS = [500, 1000, 2000, 5000, 10000, 20000];
const CORES = { bubble: '#e5534b', selection: '#d29922', insertion: '#a371f7', shell: '#39c5cf', merge: '#3fb950', quick: '#58a6ff', heap: '#f778ba', nativo: '#8b949e' };
const FORMAS = ['circulo', 'quadrado', 'triangulo', 'losango', 'circulo', 'quadrado', 'triangulo', 'losango'];
const ORDEM = ALGORITHMS.map((a) => a.id).concat(['nativo']);

const $ = (id) => document.getElementById(id);
const fmtInt = (v) => v == null ? '—' : v.toLocaleString('pt-BR');
// vírgula decimal (pt-BR), para não confundir com o ponto de milhar usado nas contagens
const fmtMs = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: v < 10 ? 2 : v < 100 ? 1 : 0, maximumFractionDigits: v < 10 ? 2 : v < 100 ? 1 : 0 });

export function initBenchmark() {
  // opções
  $('bench-algs').innerHTML = ALGORITHMS.map((a) =>
    `<label><input type="checkbox" value="${a.id}" ${a.id === 'bubble' ? '' : 'checked'}> ${a.name}</label>`).join('');
  $('bench-sizes').innerHTML = TAMANHOS.map((n) =>
    `<label><input type="checkbox" value="${n}" ${n <= 5000 ? 'checked' : ''}> ${n.toLocaleString('pt-BR')}</label>`).join('');
  $('bench-kind').innerHTML = KINDS.map((k) => `<option value="${k.id}">${k.name}</option>`).join('');

  let worker = null;
  let rows = [];

  const algsSel = () => [...$('bench-algs').querySelectorAll('input:checked')].map((i) => i.value);
  const sizesSel = () => [...$('bench-sizes').querySelectorAll('input:checked')].map((i) => Number(i.value));

  function atualizaAviso() {
    const lentos = ALGORITHMS.filter((a) => a.quadratic && algsSel().includes(a.id));
    const grande = sizesSel().some((n) => n >= 20000);
    const av = $('bench-aviso');
    if (lentos.length && grande) {
      av.hidden = false;
      av.textContent = 'Atenção: ' + lentos.map((a) => a.name).join(', ') + ' com n = 20.000 podem levar vários segundos (são O(n²)). Dá para cancelar.';
    } else av.hidden = true;
  }
  $('bench-algs').addEventListener('change', atualizaAviso);
  $('bench-sizes').addEventListener('change', atualizaAviso);
  atualizaAviso();

  function finalizar() {
    if (worker) { worker.terminate(); worker = null; }
    $('bench-run').disabled = false;
    $('bench-cancel').disabled = true;
    $('bench-progress').hidden = true;
  }

  $('bench-cancel').addEventListener('click', () => {
    finalizar();
    $('bench-status').textContent = 'Cancelado. Os resultados parciais continuam na tabela.';
  });

  $('bench-run').addEventListener('click', () => {
    const algos = algsSel(), sizes = sizesSel().sort((a, b) => a - b);
    if (!algos.length || !sizes.length) {
      $('bench-status').textContent = 'Escolha pelo menos um algoritmo e um tamanho.';
      return;
    }
    const reps = Math.min(9, Math.max(1, Number($('bench-reps').value) || 1));
    rows = [];
    renderiza();
    $('bench-run').disabled = true;
    $('bench-cancel').disabled = false;
    $('bench-progress').hidden = false;
    $('bench-progress').value = 0;
    $('bench-status').textContent = 'Executando...';

    try {
      worker = new Worker(new URL('./benchmark.worker.js', import.meta.url), { type: 'module' });
    } catch (e) {
      finalizar();
      $('bench-status').textContent = 'Seu navegador não conseguiu iniciar o Web Worker: ' + e.message;
      return;
    }
    worker.onmessage = (ev) => {
      const m = ev.data;
      if (m.type === 'row') {
        rows.push(m.row);
        $('bench-progress').value = m.done / m.total;
        $('bench-status').textContent = `Executando... ${m.done} de ${m.total}`;
        renderiza();
      } else if (m.type === 'done') {
        finalizar();
        $('bench-status').textContent = `Concluído: ${rows.length} medições.`;
        $('bench-status').dataset.state = 'done';
      } else if (m.type === 'error') {
        finalizar();
        $('bench-status').textContent = 'Erro: ' + m.message;
      }
    };
    worker.onerror = (e) => {
      finalizar();
      $('bench-status').textContent = 'Erro no Worker: ' + (e.message || 'desconhecido');
    };
    delete $('bench-status').dataset.state;
    worker.postMessage({ algos, sizes, kind: $('bench-kind').value, reps, seed: 1 });
  });

  function renderiza() {
    const tabela = $('bench-tabela');
    tabela.hidden = rows.length === 0;
    const ordenadas = rows.slice().sort((a, b) => a.n - b.n || ORDEM.indexOf(a.id) - ORDEM.indexOf(b.id));
    tabela.querySelector('tbody').innerHTML = ordenadas.map((r) =>
      `<tr data-algo="${r.id}" data-n="${r.n}"><td>${NOMES[r.id]}</td><td>${fmtInt(r.n)}</td><td>${fmtMs(r.ms)}</td><td>${fmtInt(r.comparisons)}</td><td>${fmtInt(r.writes)}</td></tr>`).join('');
    desenhaGrafico();
  }

  function desenhaGrafico() {
    const canvas = $('bench-canvas');
    const porAlgo = new Map();
    for (const r of rows) {
      if (!porAlgo.has(r.id)) porAlgo.set(r.id, []);
      porAlgo.get(r.id).push(r);
    }
    const tamanhos = [...new Set(rows.map((r) => r.n))];
    canvas.hidden = tamanhos.length < 2;
    $('bench-legenda').innerHTML = '';
    if (tamanhos.length < 2) return;

    const dpr = window.devicePixelRatio || 1;
    const W = Math.round(canvas.clientWidth * dpr), H = Math.round(canvas.clientHeight * dpr);
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const css = getComputedStyle(canvas);
    const fg = css.getPropertyValue('--mut').trim() || '#888';
    const grade = css.getPropertyValue('--bd').trim() || '#ccc';
    const ml = 56 * dpr, mr = 30 * dpr, mt = 12 * dpr, mb = 30 * dpr;

    const xs = tamanhos.map((n) => Math.log10(n));
    const ys = rows.map((r) => Math.log10(Math.max(r.ms, 0.001)));
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    let y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
    if (y1 === y0) y1 = y0 + 1;
    const px = (v) => ml + ((Math.log10(v) - x0) / (x1 - x0 || 1)) * (W - ml - mr);
    const py = (v) => H - mb - ((Math.log10(Math.max(v, 0.001)) - y0) / (y1 - y0)) * (H - mt - mb);

    ctx.clearRect(0, 0, W, H);
    ctx.font = `${11 * dpr}px system-ui, sans-serif`;
    ctx.fillStyle = fg; ctx.strokeStyle = grade; ctx.lineWidth = 1;
    for (let e = y0; e <= y1; e++) {
      const y = py(Math.pow(10, e));
      ctx.beginPath(); ctx.moveTo(ml, y); ctx.lineTo(W - mr, y); ctx.stroke();
      ctx.textAlign = 'right'; ctx.fillText((Math.pow(10, e) < 1 ? Math.pow(10, e).toString() : Math.pow(10, e).toLocaleString('pt-BR')) + ' ms', ml - 6 * dpr, y + 4 * dpr);
    }
    ctx.textAlign = 'center';
    for (const n of tamanhos) {
      const x = px(n);
      ctx.beginPath(); ctx.moveTo(x, mt); ctx.lineTo(x, H - mb); ctx.stroke();
      ctx.fillText(n.toLocaleString('pt-BR'), x, H - 10 * dpr);
    }

    let leg = '';
    for (const id of ORDEM) {
      const pts = (porAlgo.get(id) || []).slice().sort((a, b) => a.n - b.n);
      if (!pts.length) continue;
      const cor = CORES[id], forma = FORMAS[ORDEM.indexOf(id)];
      ctx.strokeStyle = cor; ctx.fillStyle = cor; ctx.lineWidth = 2 * dpr;
      if (id === 'nativo') ctx.setLineDash([6 * dpr, 4 * dpr]); else ctx.setLineDash([]);
      ctx.beginPath();
      pts.forEach((p, i) => { const x = px(p.n), y = py(p.ms); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      ctx.stroke();
      ctx.setLineDash([]);
      for (const p of pts) marca(ctx, px(p.n), py(p.ms), 4 * dpr, forma);
      leg += `<span><svg width="16" height="12" aria-hidden="true"><line x1="0" y1="6" x2="16" y2="6" stroke="${cor}" stroke-width="2" ${id === 'nativo' ? 'stroke-dasharray="4 3"' : ''}/></svg>${NOMES[id]}</span>`;
    }
    $('bench-legenda').innerHTML = leg;
  }

  function marca(ctx, x, y, r, forma) {
    ctx.beginPath();
    if (forma === 'circulo') ctx.arc(x, y, r, 0, Math.PI * 2);
    else if (forma === 'quadrado') ctx.rect(x - r, y - r, 2 * r, 2 * r);
    else if (forma === 'triangulo') { ctx.moveTo(x, y - r); ctx.lineTo(x + r, y + r); ctx.lineTo(x - r, y + r); ctx.closePath(); }
    else { ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); }
    ctx.fill();
  }

  window.addEventListener('resize', () => { if (rows.length) desenhaGrafico(); });
}
