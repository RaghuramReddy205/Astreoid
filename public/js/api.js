export async function api(method, url, body) {
  const r = await fetch('/api' + url, { method, credentials: 'same-origin', headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  let data = {}; try { data = await r.json(); } catch (e) {}
  if (!r.ok) {
    const err = new Error(data.error || 'Request failed'); err.status = r.status;
    if (r.status === 401 && !url.startsWith('/login') && !url.startsWith('/register') && !url.startsWith('/me')) window.dispatchEvent(new Event('auth:expired'));
    throw err;
  }
  return data;
}
