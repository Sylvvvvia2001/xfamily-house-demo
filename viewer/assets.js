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
const catalog = await download(new URL('cohort.json',root)).then(b=>b.text()).then(JSON.parse);
const store = new URL(catalog.store,root), activeManifests = new Map();
async function remoteEntry(key,signal) {
  const [,who,date,...tail] = key.split('/');
  const id = who+'/'+date;
  if (!catalog.days.some(d => d.participant===who && d.date===date)) return null;
  if (!activeManifests.has(id)) activeManifests.set(id,download(new URL('days/'+id+'.json',store),signal).then(b=>b.text()).then(JSON.parse).catch(e=>{activeManifests.delete(id);throw e;}));
  const item = (await activeManifests.get(id))[tail.join('/')];
  if (!item) return null;
  return item.site ? index[item.site] : {type:item.type,bytes:item.bytes,parts:[new URL(item.key,store).href]};
}
globalThis.fetch = async function(input, init) {
  const url = new URL(input instanceof Request ? input.url : input, location.href);
  const key = url.origin === root.origin && url.pathname.startsWith(root.pathname)
    ? decodeURIComponent(url.pathname.slice(root.pathname.length)) : null;
  const cohortDay = key?.startsWith("cohort/");
  const entry = cohortDay ? await remoteEntry(key,init?.signal) : key && ((fast && index['compact/' + key]) || index[key]);
  if (!entry) return originalFetch(input, init);
  const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
  const parts = await Promise.all(entry.parts.map(p => download(new URL(p, root), signal, true)));
  const stream = new Blob(parts).stream().pipeThrough(new DecompressionStream('gzip'));
  if (key === 'viewer/day-catalog.json') {
    const original = await new Response(stream).json();
    return Response.json({...original,additionalDates:[...original.additionalDates,...catalog.days]});
  }
  return new Response(stream, {headers:{'Content-Type':entry.type, 'Content-Length':String(entry.bytes)}});
};
