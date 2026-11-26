// Install the status UI before the renderer or its module dependencies are fetched.
(() => {
  const panel = document.getElementById('loading');
  const label = document.getElementById('load-stage');
  const detail = document.getElementById('load-detail');
  const retry = document.getElementById('load-retry');
  const sequence = document.getElementById('load-sequence');
  const select = document.getElementById('detail-mode');
  const url = new URL(location.href);
  select.value = url.searchParams.get('detail') === 'full' ? 'full' : 'quick';
  select.onchange = () => {
    const next = new URL(location.href);
    next.searchParams.set('detail',select.value);
    if (window.review?.stats?.ready) next.searchParams.set('t',document.getElementById('timeline').value);
    location.assign(next);
  };
  sequence.href = 'sequence.html' + location.search;
  let bytes = 0, lastChange = Date.now(), failed = false;
  retry.onclick = () => location.reload();
  function update() {
    if (panel.hidden || failed) return;
    const mb = (bytes / 1e6).toFixed(1);
    const waiting = Date.now() - lastChange > 30000;
    detail.textContent = (bytes ? mb + ' MB of packed scene data received' : 'Connecting to playback assets') +
      (waiting ? ' · Still waiting for the next resource' : '');
    retry.hidden = !waiting;
  }
  const api = window.houseStartup = {
    get packedBytes() { return bytes; },
    stage(message) { if (!failed) { label.textContent = message; lastChange = Date.now(); update(); } },
    received(n) { bytes += n; lastChange = Date.now(); },
    fail(err) {
      if (failed || panel.hidden) return;
      failed = true;
      label.textContent = 'Playback could not start';
      detail.textContent = err instanceof Error ? err.message : String(err);
      retry.hidden = false;
    }
  };
  window.addEventListener('error', e => { if(e.target === window && e.message) api.fail(e.message); });
  window.addEventListener('unhandledrejection', e => api.fail(e.reason));
  const timer = setInterval(() => { if (panel.hidden || failed) clearInterval(timer); else update(); }, 400);
  import('./app.js?v=stream-02').catch(api.fail);
})();
