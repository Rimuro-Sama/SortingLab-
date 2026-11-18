// Servidor estático mínimo, sem dependências: `npm run serve` (ou `node scripts/serve.mjs 8080`).
// Necessário porque os módulos ES e o Web Worker não carregam via file://.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = resolve(fileURLToPath(new URL('..', import.meta.url)));
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.md': 'text/plain; charset=utf-8',
};

export function criaServidor() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      let caminho = normalize(decodeURIComponent(url.pathname));
      if (caminho.endsWith(sep) || caminho === '/') caminho = join(caminho, 'index.html');
      const arquivo = resolve(join(RAIZ, caminho));
      if (arquivo !== RAIZ && !arquivo.startsWith(RAIZ + sep)) { res.writeHead(403).end('Proibido'); return; } // sem sair da pasta
      if ((await stat(arquivo)).isDirectory()) { res.writeHead(301, { Location: url.pathname + '/' }).end(); return; }
      const corpo = await readFile(arquivo);
      res.writeHead(200, { 'Content-Type': TIPOS[extname(arquivo)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(corpo);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Não encontrado');
    }
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const porta = Number(process.argv[2]) || 8080;
  criaServidor().listen(porta, '127.0.0.1', () => console.log(`Sorting Lab em http://localhost:${porta}`));
}
