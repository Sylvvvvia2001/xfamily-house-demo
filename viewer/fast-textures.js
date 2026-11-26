// The first visit fetches the compact material images together, avoiding thousands of round trips.
export async function installFastTextures(THREE, fast) {
  if (!fast) return;
  const [table, buffer] = await Promise.all([
    fetch('fast-images.json').then(r => r.json()),
    fetch('fast-images.bin').then(r => r.blob())
  ]);
  const urls = new Map();
  for (const [name, [start, length, mime]] of Object.entries(table)) {
    urls.set(name, URL.createObjectURL(buffer.slice(start, start + length, mime)));
  }
  const imageRoot = new URL('../images/', location.href);
  THREE.DefaultLoadingManager.setURLModifier(url => {
    const src = new URL(url, location.href);
    if (src.origin === imageRoot.origin && src.pathname.startsWith(imageRoot.pathname))
      return urls.get(src.pathname.slice(imageRoot.pathname.length)) || url;
    return url;
  });
}
