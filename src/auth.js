/**
 * Dongguk R13.4 admission gate.
 * Both CAMPUS_PASSWORD and CAMPUS_SESSION_SECRET are Cloudflare Worker Secrets;
 * do not store values in code, wrangler.toml, the GitHub repository or public/.
 * This is a 4-digit numeric shared PIN gate, NOT an individual account system.
 * A 4-digit PIN has only 10,000 combinations. Keep rate-limiting enabled.
 */
const enc = new TextEncoder();
const SESSION_SECONDS = 12 * 60 * 60;
const COOKIE_PROD = '__Host-dgu_campus';
const COOKIE_LOCAL = 'dgu_campus_dev';
const MAX_FORM_BYTES = 2048;
const LOGIN_PATH = '/__auth/login';
const LOGOUT_PATH = '/__auth/logout';

function localDev(url) { return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname); }
function secureTransport(url) { return url.protocol === 'https:'; }
function cookieName(url) { return localDev(url) ? COOKIE_LOCAL : COOKIE_PROD; }
function securityHeaders(extra = {}) {
  return { 'Cache-Control': 'private, no-store, max-age=0', 'Pragma': 'no-cache',
    'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY', ...extra };
}
function encodeB64url(data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}
function decodeB64url(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length > 256) return null;
  try {
    const s = atob(value.replaceAll('-', '+').replaceAll('_', '/'));
    return Uint8Array.from(s, c => c.charCodeAt(0));
  } catch { return null; }
}
function hex(buf) { return [...new Uint8Array(buf)].map(v => v.toString(16).padStart(2, '0')).join(''); }
async function signingKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
async function sign(key, message) { return encodeB64url(await crypto.subtle.sign('HMAC', key, enc.encode(message))); }
/** Only reveal binding presence/format, never the actual secret or its length. */
function configIssues(env) {
  const problems = [];
  if (typeof env?.CAMPUS_PASSWORD !== 'string')
    problems.push('CAMPUS_PASSWORD가 현재 배포에 연결되지 않았습니다.');
  else if (!/^[0-9]{4}$/.test(env.CAMPUS_PASSWORD))
    problems.push('CAMPUS_PASSWORD는 공백 없이 숫자 네 자리여야 합니다.');
  if (typeof env?.CAMPUS_SESSION_SECRET !== 'string')
    problems.push('CAMPUS_SESSION_SECRET이 현재 배포에 연결되지 않았습니다.');
  else if (env.CAMPUS_SESSION_SECRET.length < 10)
    problems.push('CAMPUS_SESSION_SECRET은 무작위 문자열 10자 이상이어야 합니다.');
  if (typeof env?.CAMPUS_PASSWORD === 'string' && typeof env?.CAMPUS_SESSION_SECRET === 'string' &&
      env.CAMPUS_PASSWORD === env.CAMPUS_SESSION_SECRET)
    problems.push('두 Secret은 서로 다른 값으로 설정해야 합니다.');
  return problems;
}
function configReady(env) { return configIssues(env).length === 0; }
async function tagForPassword(env, key) { return (await sign(key, 'r13.4-password-revision:' + env.CAMPUS_PASSWORD)).slice(0, 22); }
function readCookie(request, name) {
  const all = request.headers.get('Cookie') || '';
  if (all.length > 8192) return '';
  for (const item of all.split(';')) {
    const part = item.trim(); if (part.startsWith(name + '=')) return part.slice(name.length + 1);
  }
  return '';
}
async function verifiedSession(request, env, url) {
  const token = readCookie(request, cookieName(url));
  const parts = token.split('.');
  if (parts.length !== 5 || parts[0] !== 'v1') return null;
  const [version, seconds, nonce, rev, mac] = parts;
  if (!/^\d{10,11}$/.test(seconds) || !/^[a-f0-9-]{36}$/.test(nonce) || !/^[A-Za-z0-9_-]{22}$/.test(rev)) return null;
  const exp = Number(seconds), now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(exp) || exp <= now || exp > now + SESSION_SECONDS) return null;
  const bytes = decodeB64url(mac);
  if (!bytes || bytes.length !== 32) return null;
  const key = await signingKey(env.CAMPUS_SESSION_SECRET);
  if (rev !== await tagForPassword(env, key)) return null;
  const body = `${version}.${seconds}.${nonce}.${rev}`;
  return await crypto.subtle.verify('HMAC', key, bytes, enc.encode(body)) ? { exp } : null;
}
async function makeCookie(env, url) {
  const key = await signingKey(env.CAMPUS_SESSION_SECRET);
  const seconds = String(Math.floor(Date.now() / 1000) + SESSION_SECONDS);
  const body = `v1.${seconds}.${crypto.randomUUID()}.${await tagForPassword(env, key)}`;
  const token = `${body}.${await sign(key, body)}`;
  return `${cookieName(url)}=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secureTransport(url) ? '; Secure' : ''}`;
}
function emptyCookie(url) {
  return `${cookieName(url)}=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0${secureTransport(url) ? '; Secure' : ''}`;
}
async function safePasswordMatch(typed, expected) {
  // Compare fixed-length SHA-256 digests (not variable-length UTF-8 strings).
  const [left, right] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(typed)),
    crypto.subtle.digest('SHA-256', enc.encode(expected))
  ]);
  const a = new Uint8Array(left), b = new Uint8Array(right);
  let diff = 0; for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
async function boundedForm(request) {
  if (!(request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/x-www-form-urlencoded')) return null;
  const length = Number(request.headers.get('Content-Length') || '0');
  if (length > MAX_FORM_BYTES) return null;
  if (!request.body) return null;
  const reader = request.body.getReader(); const chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength; if (size > MAX_FORM_BYTES) { await reader.cancel(); return null; }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const buffer = new Uint8Array(size); let off = 0;
  for (const chunk of chunks) { buffer.set(chunk, off); off += chunk.byteLength; }
  const params = new URLSearchParams(new TextDecoder('utf-8', { fatal: false }).decode(buffer));
  const pass = params.get('password');
  return typeof pass === 'string' && pass.length <= 256 ? pass : null;
}
function htmlPage({ error = '', limited = false, missing = false, issues = [] } = {}) {
  // Every string in issues comes from our fixed configIssues() messages, never from the secrets.
  const configStatus = '<div class="alert" role="alert"><strong>Cloudflare 서버 설정을 확인해 주세요.</strong>' +
    '<p style="margin:7px 0">입력창은 사용 가능하지만, 아래 설정을 수정하기 전에는 실제 입장할 수 없습니다.</p>' +
    (issues.length ? '<ul style="margin:6px 0;padding-left:20px">' + issues.map(item => '<li>' + item + '</li>').join('') + '</ul>' : '') +
    '<p style="margin:7px 0 0">Cloudflare → Workers 및 Pages → <b>dongguk-campus-game</b> → 설정 → 변수 및 암호에서 수정한 후 배포를 확인하세요. 비밀값 자체는 공개하거나 전송하지 마세요.</p></div>';
  const status = missing
    ? configStatus
    : limited
      ? '<div class="alert">비밀번호 입력 횟수가 초과되었습니다. 15분 후 다시 시도해 주세요.</div>'
      : error ? '<div class="alert">비밀번호가 올바르지 않습니다.</div>' : '';
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>비공개 입장 · 동국대학교 마음의 쉼표</title><meta name="robots" content="noindex,nofollow,noarchive">
<style>*,*::before,*::after{box-sizing:border-box}html{background:#162c28}body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:20px;font-family:system-ui,-apple-system,"Noto Sans KR",sans-serif;color:#254239;background:radial-gradient(ellipse at 15% 25%,rgba(193,161,101,.19),transparent 42%),radial-gradient(ellipse at 90% 80%,rgba(197,141,86,.14),transparent 35%),linear-gradient(150deg,#142d27,#284739)}.frame{width:min(440px,100%);padding:36px clamp(22px,6vw,42px);background:#fff9ec;border:1px solid rgba(220,182,113,.9);border-radius:28px;box-shadow:0 28px 85px rgba(0,0,0,.38);text-align:center;position:relative}.frame:after{content:"";position:absolute;inset:7px;border:1px solid rgba(177,135,70,.28);border-radius:22px;pointer-events:none}.seal{width:70px;height:70px;margin:0 auto 16px;border:1px solid #b58a4a;border-radius:50%;display:grid;place-items:center;font-size:32px;color:#8b5c2c;background:linear-gradient(135deg,#fffefa,#f3dfb9)}.kicker{font-size:10px;letter-spacing:.18em;font-weight:800;color:#96794a}.frame h1{font-size:26px;line-height:1.36;margin:10px 0 8px}.description{font-size:14px;color:#657769;line-height:1.8;margin-bottom:25px}label{display:block;text-align:left;font-size:13px;font-weight:800;margin:0 0 8px}input{display:block;width:100%;height:50px;border:1px solid #c9bd9f;background:#fff;border-radius:12px;font-size:16px;padding:0 15px;color:#173e31;outline:none}input:focus{border-color:#897038;box-shadow:0 0 0 3px rgba(181,138,74,.18)}button{display:block;width:100%;height:51px;margin-top:12px;border:0;border-radius:12px;background:#315344;color:#fff;font-size:15px;font-weight:800;cursor:pointer}button:hover{background:#274736}button:focus-visible{outline:3px solid #bd9d67;outline-offset:3px}.alert{text-align:left;padding:12px 13px;margin:0 0 17px;background:#fff0e7;border:1px solid #e7c1a9;border-radius:10px;color:#a3452f;font-size:13px;font-weight:700;line-height:1.6}.foot{font-size:11px;color:#7f816f;margin:24px 0 0;line-height:1.6}.lotus{font-size:22px;color:#a8844a;letter-spacing:4px;margin-top:15px}</style></head>
<body><main class="frame"><div class="seal" aria-hidden="true">❁</div><div class="kicker">DONGGUK UNIVERSITY · PRIVATE CAMPUS</div><h1>동국을 산책하다.<br>마음을 밝혀요.</h1><div class="description">초대받은 방문자만 입장할 수 있는<br>3D 힐링 캠퍼스입니다.</div>${status}
<form action="${LOGIN_PATH}" method="post"><label for="password">캠퍼스 입장 비밀번호</label><input id="password" name="password" type="password" autocomplete="current-password" placeholder="숫자 4자리를 입력해 주세요" inputmode="numeric" pattern="[0-9]{4}" minlength="4" maxlength="4" required autofocus><button type="submit">🔐 비공개 캠퍼스 입장하기</button></form>
<p class="foot">비밀번호는 서버에서 확인하며 게임 화면에는 저장되지 않습니다.<br>공식 수계 행사가 아닌 비공식 체험 공간입니다.<br><small>R13.5 · 비밀번호 입력창 오류 수정</small></p><div class="lotus" aria-hidden="true">❀ ❁ ❀</div></main></body></html>`;
}
function pageResponse(props, status = 200) {
  return new Response(htmlPage(props), { status, headers: securityHeaders({
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  })});
}
function failClosed(env) { return pageResponse({ missing: true, issues: configIssues(env) }, 503); }
function redirect(to, cookie) {
  const headers = securityHeaders({ Location: to });
  if (cookie) headers['Set-Cookie'] = cookie;
  return new Response(null, { status: 303, headers });
}
function sameOriginForm(request, url) {
  const origin = request.headers.get('Origin');
  return !origin || origin === url.origin;
}
async function attemptLogin(request, env, url) {
  if (!sameOriginForm(request, url)) return new Response('Forbidden', { status: 403, headers: securityHeaders() });
  const submitted = await boundedForm(request);
  if (submitted === null) return pageResponse({ error: true }, 400);
  const passwordValid = /^[0-9]{4}$/.test(submitted) && await safePasswordMatch(submitted, env.CAMPUS_PASSWORD);
  const ip = request.headers.get('CF-Connecting-IP') || 'local-development';
  const id = hex(await crypto.subtle.digest('SHA-256', enc.encode(env.CAMPUS_SESSION_SECRET + ':rate-limit:' + ip)));
  const roomId = env.CAMPUS_ROOM.idFromName('public-campus-v1');
  let limited;
  try {
    const result = await env.CAMPUS_ROOM.get(roomId).fetch(new Request('https://room.internal/__auth/rate-limit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, valid: passwordValid })
    }));
    if (!result.ok) return new Response('Authentication service unavailable', { status: 503, headers: securityHeaders() });
    limited = await result.json();
  } catch (err) {
    console.error('Authentication rate-limit service unavailable', err);
    return new Response('Authentication service unavailable', { status: 503, headers: securityHeaders() });
  }
  if (limited.blocked) return pageResponse({ limited: true }, 429);
  if (!limited.ok || !passwordValid) return pageResponse({ error: true }, 401);
  return redirect('/', await makeCookie(env, url));
}

/** Executed on every request before static assets and WebSocket forwarding. */
export async function serveWithAuth(request, env, gameFetch) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  if (!configReady(env)) return failClosed(env); // NEVER serve unprotected content without configured secrets.
  if (!secureTransport(url) && !localDev(url)) return new Response('HTTPS required', { status: 403, headers: securityHeaders() });

  if (pathname === LOGIN_PATH && request.method === 'POST') return attemptLogin(request, env, url);
  const session = await verifiedSession(request, env, url);
  if (pathname === LOGOUT_PATH) {
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: securityHeaders({ Allow: 'POST' }) });
    if (!sameOriginForm(request, url)) return new Response('Forbidden', { status: 403, headers: securityHeaders() });
    return redirect(LOGIN_PATH, emptyCookie(url));
  }
  if (pathname === LOGIN_PATH) {
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method Not Allowed', { status: 405, headers: securityHeaders({ Allow: 'GET, HEAD, POST' }) });
    return session ? redirect('/') : pageResponse();
  }
  if (pathname === '/__auth/status') {
    return Response.json({ authenticated: !!session }, { headers: securityHeaders() });
  }
  if (pathname.startsWith('/__auth/')) return new Response('Not Found', { status: 404, headers: securityHeaders() });
  if (pathname === '/ws') {
    if (!session) return new Response('Unauthorized', { status: 401, headers: securityHeaders() });
    const origin = request.headers.get('Origin');
    if (!origin || origin !== url.origin) return new Response('Forbidden', { status: 403, headers: securityHeaders() });
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return new Response('WebSocket required', { status: 426, headers: securityHeaders() });
    // Forward the *validated* expiration so an already-open connection expires, too.
    const h = new Headers(request.headers);
    h.set('X-DGU-Auth-Expires', String(session.exp * 1000));
    h.delete('Cookie'); // The Durable Object never needs the credential cookie.
    return gameFetch(new Request(request, { headers: h }), env);
  }
  if (!session) {
    if (request.method === 'GET' || request.method === 'HEAD') return pageResponse();
    return new Response('Unauthorized', { status: 401, headers: securityHeaders() });
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method Not Allowed', { status: 405, headers: securityHeaders({ Allow: 'GET, HEAD' }) });
  const response = await gameFetch(request, env);
  const h = new Headers(response.headers);
  h.set('Cache-Control', 'private, no-store, max-age=0');
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('Referrer-Policy', 'no-referrer');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: h });
}

/** Internal durable-object endpoint: per-IP-hash login attempt throttling. */
export async function rateLimitAttempt(request, ctx) {
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  let input;
  try { input = await request.json(); } catch { return new Response('Bad Request', { status: 400 }); }
  if (!/^[a-f0-9]{64}$/.test(input?.id) || typeof input?.valid !== 'boolean') return new Response('Bad Request', { status: 400 });
  const key = 'login-limit:v1:' + input.id;
  const now = Date.now(), windowMs = 15 * 60_000, maxFails = 8;
  let entry = await ctx.storage.get(key) || { start: now, failed: 0, blockedUntil: 0 };
  if (entry.blockedUntil > now) return Response.json({ ok: false, blocked: true });
  if (now - entry.start >= windowMs) entry = { start: now, failed: 0, blockedUntil: 0 };
  if (input.valid) { await ctx.storage.delete(key); return Response.json({ ok: true, blocked: false }); }
  entry.failed++;
  if (entry.failed >= maxFails) entry.blockedUntil = now + windowMs;
  await ctx.storage.put(key, entry);
  return Response.json({ ok: false, blocked: entry.blockedUntil > now });
}
