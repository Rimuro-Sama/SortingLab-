// Visualizador: roda o algoritmo uma vez (gravando eventos) e depois reproduz os eventos no canvas.
import { runSort, getAlgorithm, EV_COMPARE, EV_SWAP, EV_WRITE } from './algorithms.js';
import { makeData } from './data.js';

const reduzMovimento = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export class Visualizer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {(s:object)=>void} onUpdate chamado a cada mudança de estado (para atualizar textos)
   */
  constructor(canvas, onUpdate) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onUpdate = onUpdate;
    this.speed = 30;
    this.playing = false;
    this.raf = 0;
    this.sweep = -1; // posição da "varredura verde" ao terminar; -1 = não começou
    this.original = [];
    this.arr = [];
    this.events = [];
    this.pos = 0;
    this.cmp = 0; this.wr = 0; this.sw = 0;
    this.hotCmp = [-1, -1];
    this.hotWrite = [-1, -1];
    this.totals = { comparisons: 0, writes: 0, swaps: 0 };
    this.max = 1;
    this.done = false;
    this.seed = 1;

    if (typeof ResizeObserver === 'function') new ResizeObserver(() => this.draw()).observe(canvas);
  }

  /** Gera os dados, roda o algoritmo (gravando) e volta ao início. */
  load({ algoId, kind, n, seed }) {
    this.pause();
    this.algoId = algoId;
    this.seed = seed;
    this.original = makeData(kind, n, seed);
    this.max = Math.max(...this.original, 1);
    const r = runSort(algoId, this.original, { record: true });
    this.events = r.events;
    this.totals = { comparisons: r.comparisons, writes: r.writes, swaps: r.swaps };
    this.rewind();
  }

  /** Volta ao início com os mesmos dados. */
  rewind() {
    this.pause();
    this.arr = this.original.slice();
    this.pos = 0;
    this.cmp = this.wr = this.sw = 0;
    this.hotCmp = [-1, -1];
    this.hotWrite = [-1, -1];
    this.sweep = -1;
    this.done = false;
    this.draw();
    this.emit();
  }

  get totalSteps() { return this.events.length / 3; }

  setSpeed(v) { this.speed = v; }

  play() {
    if (this.done) this.rewind();
    if (this.playing) return;
    this.playing = true;
    this.emit();
    const tick = () => {
      if (!this.playing) return;
      if (this.pos < this.events.length) {
        // velocidade exponencial: 1 passo por quadro até ~900 passos por quadro
        const porQuadro = Math.max(1, Math.round(Math.pow(1.12, this.speed)));
        for (let k = 0; k < porQuadro && this.pos < this.events.length; k++) this.applyNext();
      } else {
        this.advanceSweep();
      }
      this.draw();
      this.emit();
      if (this.playing) this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  pause() {
    this.playing = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.emit();
  }

  /** Avança um único evento. */
  step() {
    this.pause();
    if (this.pos < this.events.length) this.applyNext();
    else this.finishNow();
    this.draw();
    this.emit();
  }

  /** Aplica todos os eventos restantes de uma vez. */
  finish() {
    this.pause();
    this.finishNow();
    this.draw();
    this.emit();
  }

  finishNow() {
    while (this.pos < this.events.length) this.applyNext();
    this.sweep = this.arr.length;
    this.done = true;
    this.hotCmp = [-1, -1];
    this.hotWrite = [-1, -1];
  }

  applyNext() {
    const e = this.events, a = this.arr, k = this.pos;
    const t = e[k], x = e[k + 1], y = e[k + 2];
    this.hotCmp = [-1, -1];
    this.hotWrite = [-1, -1];
    if (t === EV_COMPARE) {
      this.cmp++;
      this.hotCmp = [x, y];
    } else if (t === EV_SWAP) {
      const tmp = a[x]; a[x] = a[y]; a[y] = tmp;
      this.sw++; this.wr += 2;
      this.hotWrite = [x, y];
    } else if (t === EV_WRITE) {
      a[x] = y;
      this.wr++;
      this.hotWrite = [x, -1];
    }
    this.pos += 3;
  }

  advanceSweep() {
    if (reduzMovimento()) {
      this.sweep = this.arr.length;
    } else {
      if (this.sweep < 0) this.sweep = 0;
      this.sweep = Math.min(this.arr.length, this.sweep + Math.max(1, Math.ceil(this.arr.length / 40)));
    }
    this.hotCmp = [-1, -1];
    this.hotWrite = [-1, -1];
    if (this.sweep >= this.arr.length) {
      this.done = true;
      this.playing = false;
      this.raf = 0;
    }
  }

  emit() {
    this.onUpdate({
      playing: this.playing,
      done: this.done,
      step: this.pos / 3,
      totalSteps: this.totalSteps,
      comparisons: this.cmp,
      writes: this.wr,
      swaps: this.sw,
      totals: this.totals,
    });
  }

  draw() {
    const c = this.canvas;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(c.clientWidth * dpr));
    const h = Math.max(1, Math.round(c.clientHeight * dpr));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const ctx = this.ctx;
    const css = getComputedStyle(c);
    const cor = (n) => css.getPropertyValue(n).trim() || '#888';
    ctx.clearRect(0, 0, w, h);
    const n = this.arr.length;
    if (!n) return;
    const bw = w / n;
    const gap = bw > 4 * dpr ? Math.max(1, Math.floor(dpr)) : 0;
    const bar = cor('--bar'), cmp = cor('--cmp'), wr = cor('--write'), done = cor('--done');
    for (let i = 0; i < n; i++) {
      const bh = Math.max(1, (this.arr[i] / this.max) * (h - 4));
      let fill = bar;
      if (this.sweep >= 0 && i < this.sweep) fill = done;
      else if (i === this.hotWrite[0] || i === this.hotWrite[1]) fill = wr;
      else if (i === this.hotCmp[0] || i === this.hotCmp[1]) fill = cmp;
      ctx.fillStyle = fill;
      ctx.fillRect(Math.floor(i * bw), h - bh, Math.max(1, Math.ceil(bw) - gap), bh);
    }
  }
}

export { getAlgorithm };
