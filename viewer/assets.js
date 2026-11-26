// Decompress the immutable scene and motion payloads at their original URLs.
const originalFetch=globalThis.fetch.bind(globalThis);
const root=new URL('../',import.meta.url);
const index=await originalFetch(new URL('packed.json',root)).then(r=>r.json());
globalThis.fetch=async function(input,init) {
  const url=new URL(input instanceof Request ? input.url : input,location.href);
  const entry=url.origin===root.origin && url.pathname.startsWith(root.pathname)
    ? index[decodeURIComponent(url.pathname.slice(root.pathname.length))] : null;
  if(!entry) return originalFetch(input,init);
  const signal=init?.signal ?? (input instanceof Request ? input.signal : undefined);
  const buffers=await Promise.all(entry.parts.map(async part=>{
    const response=await originalFetch(new URL(part,root),{signal});
    if(!response.ok)throw Error('A playback asset could not load: '+part);
    return response.arrayBuffer();
  }));
  const stream=new Blob(buffers).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream,{headers:{'Content-Type':entry.type,'Content-Length':String(entry.bytes)}});
};
