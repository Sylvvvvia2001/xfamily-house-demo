// Unpack the immutable scene and motion payloads at their original URLs.
const originalFetch = globalThis.fetch.bind(globalThis);
const root = new URL('../', import.meta.url);
export const fast = new URLSearchParams(location.search).get('detail') !== 'full';

async function download(url, signal, reportBytes) {
  for (let attempt = 0; ; attempt++) {
    if (signal?.aborted) throw signal.reason;
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, {once:true});
    let timer;
    function resetTimer() {
      clearTimeout(timer);
      timer = setTimeout(abort, 40000);
    }
    try {
      resetTimer();
      const response = await originalFetch(url, {signal:controller.signal, cache:attempt ? 'reload' : 'default'});
      if (!response.ok) throw Error('HTTP ' + response.status);
      const reader = response.body.getReader(), chunks = [];
      while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        resetTimer();
        chunks.push(value);
        if (reportBytes) window.houseStartup?.received(value.byteLength);
      }
      return new Blob(chunks);
    } catch (e) {
      if (signal?.aborted || attempt === 2) throw Error('Could not download ' + url.pathname.split('/').pop() + ' (' + e.message + ').');
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }
}
const index = JSON.parse(await (await download(new URL('packed.json?v=quick-2', root))).text());
globalThis.fetch = async function(input, init) {
  const url = new URL(input instanceof Request ? input.url : input, location.href);
  const key = url.origin === root.origin && url.pathname.startsWith(root.pathname)
    ? decodeURIComponent(url.pathname.slice(root.pathname.length)) : null;
  const entry = key && ((fast && index['compact/' + key]) || index[key]);
  if (!entry) return originalFetch(input, init);
  const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
  const parts = await Promise.all(entry.parts.map(p => download(new URL(p, root), signal, true)));
  const stream = new Blob(parts).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream, {headers:{'Content-Type':entry.type, 'Content-Length':String(entry.bytes)}});
};
