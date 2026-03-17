const http = require('http');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..', 'build', 'web-desktop');
const startPort = Number(process.env.PORT || 8080);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
};

function send404(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404 Not Found');
}

if (!fs.existsSync(rootDir)) {
  console.error('[web:play] 未找到 build/web-desktop 目录。');
  console.error('[web:play] 请先在 Cocos Creator 中构建 Web Desktop。');
  process.exit(1);
}

const server = http.createServer((req, res) => {
  const requestPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const safePath = requestPath.replace(/^\/+/, '');

  let targetFile = path.join(rootDir, safePath);
  if (requestPath === '/' || requestPath === '') {
    targetFile = path.join(rootDir, 'index.html');
  }

  if (!targetFile.startsWith(rootDir)) {
    send404(res);
    return;
  }

  fs.stat(targetFile, (statErr, stats) => {
    if (!statErr && stats.isDirectory()) {
      targetFile = path.join(targetFile, 'index.html');
    }

    fs.readFile(targetFile, (readErr, content) => {
      if (readErr) {
        send404(res);
        return;
      }

      const ext = path.extname(targetFile).toLowerCase();
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
      });
      res.end(content);
    });
  });
});

function listenWithFallback(port, attemptsLeft) {
  server.once('error', (err) => {
    if (err && err.code === 'EADDRINUSE' && attemptsLeft > 0) {
      const nextPort = port + 1;
      console.warn(`[web:play] 端口 ${port} 已占用，尝试端口 ${nextPort}...`);
      listenWithFallback(nextPort, attemptsLeft - 1);
      return;
    }

    throw err;
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`[web:play] 游戏已启动: http://localhost:${port}`);
    console.log('[web:play] 局域网手机可访问: http://你的电脑IP:' + port);
  });
}

listenWithFallback(startPort, 10);
