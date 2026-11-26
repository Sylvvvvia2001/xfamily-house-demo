// A small pool overlaps network latency and keeps repeated segments on the same pose buffer.
export async function loadMotions(segments, base) {
  const groups = new Map();
  for (const segment of segments.flatMap(s => s.cleaningSource ? [s, s.cleaningSource] : [s])) {
    if (!segment.file) continue;
    if (!groups.has(segment.file)) groups.set(segment.file, []);
    groups.get(segment.file).push(segment);
  }
  const queue = groups.entries();
  let done = 0;
  async function worker() {
    for (const [file, uses] of queue) {
      const response = await fetch(new URL(file, base));
      if (!response.ok) throw Error('Could not load a registered motion (' + response.status + ').');
      const pose = new Float32Array(await response.arrayBuffer());
      for (const s of uses) s.pose = pose;
      window.houseStartup.stage('Preparing motion clips · ' + (++done) + ' / ' + groups.size);
    }
  }
  await Promise.all(Array.from({length: Math.min(6, groups.size)}, worker));
}
