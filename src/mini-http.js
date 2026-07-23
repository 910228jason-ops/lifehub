// mini-http.js — 極簡的 Express 風格路由/伺服器框架，只用 Node.js 內建 http/crypto/fs 模組。
//
// 為什麼不用 Express？
// 這個沙盒環境目前無法連線到 npm 套件源 (registry.npmjs.org / pypi.org 皆回傳
// host_not_allowed)，所以原型完全改用 Node.js 內建模組實作，零外部依賴。
// 這裡刻意模仿 Express 慣用的 API 形狀 (Router().get/post/put/delete、
// req.params/req.query/req.body、res.json/res.status)，
// 如果未來正式環境要換回 Express，路由檔案(src/routes/*.js)幾乎不用改，
// 只要把 `require('../mini-http')` 換回 `require('express')` 並调整少量差異即可。

const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('./services/logger');

// 支援 Express 慣用的 router.get(path, middleware1, middleware2, ..., handler) 寫法：
// 除了最後一個函式以外，其餘視為中介層 (簽章為 (req,res,next))，
// 需呼叫 next() 才會繼續往下一個執行；最後一個函式視為最終處理常式 (簽章為 (req,res))。
function compose(handlers) {
  return async function (req, res) {
    let i = 0;
    async function next(err) {
      if (err) throw err;
      if (i >= handlers.length) return;
      const fn = handlers[i++];
      if (fn.length >= 3) return fn(req, res, next);
      return fn(req, res);
    }
    await next();
  };
}

function Router() {
  const routes = [];
  const add = (method) => (pattern, ...handlers) => routes.push({ method, pattern, handler: compose(handlers) });
  return { routes, get: add('GET'), post: add('POST'), put: add('PUT'), delete: add('DELETE') };
}

function matchPath(pattern, pathname) {
  const pp = pattern.split('/').filter(Boolean);
  const ap = pathname.split('/').filter(Boolean);
  if (pp.length !== ap.length) return null;
  const params = {};
  for (let i = 0; i < pp.length; i++) {
    if (pp[i].startsWith(':')) params[pp[i].slice(1)] = decodeURIComponent(ap[i]);
    else if (pp[i] !== ap[i]) return null;
  }
  return params;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach((p) => {
    const idx = p.indexOf('=');
    if (idx === -1) return;
    out[p.slice(0, idx).trim()] = decodeURIComponent(p.slice(idx + 1).trim());
  });
  return out;
}
function sign(payload, secret) {
  const json = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(json).digest('base64url');
  return `${json}.${sig}`;
}
function unsign(token, secret) {
  if (!token) return null;
  const dot = token.lastIndexOf('.');
  if (dot === -1) return null;
  const json = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac('sha256', secret).update(json).digest('base64url');
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    return JSON.parse(Buffer.from(json, 'base64url').toString());
  } catch {
    return null;
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 5_000_000) req.destroy(new Error('Request body too large'));
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function createApp() {
  const mounts = [];
  let staticDir = null;
  let sessionOpts = null;

  const app = {
    mount(prefix, router) {
      mounts.push({ prefix, router });
    },
    setStatic(dir) {
      staticDir = dir;
    },
    setSession(opts) {
      sessionOpts = opts;
    },
    listen(port, cb) {
      const server = http.createServer((req, res) => handleReq(req, res));
      server.listen(port, cb);
      return server;
    },
  };

  async function handleReq(req, res) {
    const startedAt = Date.now();
    res.on('finish', () => {
      if (process.env.DEBUG === 'true') {
        logger.debug(`${req.method} ${req.path || req.url} -> ${res.statusCode} (${Date.now() - startedAt}ms)`);
      }
      if (res.statusCode >= 500) {
        logger.error(`${req.method} ${req.path || req.url} -> ${res.statusCode}`);
      }
    });

    try {
      const u = new URL(req.url, 'http://localhost');
      req.path = decodeURIComponent(u.pathname);
      req.query = Object.fromEntries(u.searchParams.entries());

      res.json = (obj) => {
        if (!res.headersSent) res.setHeader('content-type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(obj));
      };
      res.status = (code) => {
        res.statusCode = code;
        return res;
      };

      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
        const raw = await readBody(req);
        try {
          req.body = raw ? JSON.parse(raw) : {};
        } catch {
          req.body = {};
        }
      } else {
        req.body = {};
      }

      if (sessionOpts) {
        const cookies = parseCookies(req.headers.cookie);
        const initial = unsign(cookies[sessionOpts.name], sessionOpts.secret) || {};
        req.session = { ...initial };
        req._sessionSnapshot = JSON.stringify(initial);
      }

      // 注意：req.session 是在 route handler 執行「期間」被修改的 (例如登入時設定
      // req.session.userId)，所以不能在呼叫 handler 之前就把 cookie 寫進 header —
      // 那樣寫入的還是修改前的舊值。正確做法是在「第一次真的要送出回應資料」的當下
      // (也就是 res.write / res.end 第一次被呼叫時) 才回頭檢查 req.session 目前的最終內容，
      // 並把 Set-Cookie 加上去，這樣不管 handler 什麼時候修改 session 都能正確反映。
      const finalizeSession = () => {
        if (!sessionOpts || res.headersSent) return;
        if (req.session === null || req.session === undefined) {
          res.setHeader('Set-Cookie', `${sessionOpts.name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
          return;
        }
        const serialized = JSON.stringify(req.session);
        if (serialized !== req._sessionSnapshot) {
          const token = sign(req.session, sessionOpts.secret);
          const maxAgeSec = Math.floor((sessionOpts.maxAge || 2592000000) / 1000);
          res.setHeader('Set-Cookie', `${sessionOpts.name}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}`);
        }
      };
      let sessionFinalized = false;
      const ensureSessionFinalized = () => {
        if (sessionFinalized) return;
        sessionFinalized = true;
        finalizeSession();
      };
      const originalWrite = res.write.bind(res);
      const originalEnd = res.end.bind(res);
      res.write = (...args) => {
        ensureSessionFinalized();
        return originalWrite(...args);
      };
      res.end = (...args) => {
        ensureSessionFinalized();
        return originalEnd(...args);
      };

      for (const m of mounts) {
        if (req.path === m.prefix || req.path.startsWith(m.prefix + '/')) {
          const subPath = req.path.slice(m.prefix.length) || '/';
          for (const route of m.router.routes) {
            if (route.method !== req.method) continue;
            const params = matchPath(route.pattern, subPath);
            if (params) {
              req.params = params;
              try {
                await route.handler(req, res);
              } catch (err) {
                logger.error('路由處理發生例外', { path: req.path, message: err.message, stack: err.stack });
                if (!res.headersSent) res.status(500).json({ error: '伺服器發生錯誤，請稍後再試' });
              }
              return;
            }
          }
        }
      }

      if (staticDir) {
        const rel = req.path === '/' ? '/index.html' : req.path;
        const filePath = path.normalize(path.join(staticDir, rel));
        if (filePath.startsWith(staticDir) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          res.setHeader('content-type', MIME[path.extname(filePath)] || 'application/octet-stream');
          fs.createReadStream(filePath).pipe(res);
          return;
        }
      }

      res.status(404).json({ error: 'Not Found' });
    } catch (err) {
      logger.error('伺服器層級例外', { message: err.message, stack: err.stack });
      if (!res.headersSent) res.status(500).json({ error: '伺服器發生錯誤' });
      else res.end();
    }
  }

  return app;
}

module.exports = { createApp, Router };
