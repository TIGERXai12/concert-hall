// "Live" playlist player: everyone hears the same point, derived from wall clock.
// Streams via HTMLAudioElement (range requests), no UI.
const EPOCH = Date.UTC(2026, 0, 1);

export function createPlayer(tracks, { onStatus } = {}) {
  const el = new Audio();
  el.preload = 'auto';
  el.setAttribute('playsinline', '');
  el.setAttribute('webkit-playsinline', '');
  const total = tracks.reduce((a, t) => a + t.duration, 0);
  let idx = -1, wantPlay = false;
  const status = (s) => onStatus && onStatus(s, tracks[idx]);

  function livePos() {
    let pos = (((Date.now() - EPOCH) / 1000) % total + total) % total;
    for (let i = 0; i < tracks.length; i++) {
      if (pos < tracks[i].duration) return { i, off: pos };
      pos -= tracks[i].duration;
    }
    return { i: 0, off: 0 };
  }
  function seekWhenReady() {
    const go = () => { const { i, off } = livePos(); if (i === idx) { try { el.currentTime = off; } catch (e) {} } };
    if (el.readyState >= 1) go(); else el.addEventListener('loadedmetadata', go, { once: true });
  }
  function syncTrack() {
    const { i, off } = livePos();
    if (i !== idx) { idx = i; el.src = tracks[i].url + '#t=' + off.toFixed(1); el.load(); }
    seekWhenReady();
  }
  syncTrack();

  const fixDrift = () => { const { i, off } = livePos(); if (i === idx && Math.abs(el.currentTime - off) > 2) { try { el.currentTime = off; } catch (e) {} } };
  el.addEventListener('canplay', fixDrift);
  el.addEventListener('playing', () => { fixDrift(); status('playing'); });
  el.addEventListener('ended', () => { syncTrack(); if (wantPlay) tryPlay(); });
  el.addEventListener('error', () => console.warn('audio error', el.error));

  function tryPlay() {
    wantPlay = true;
    const p = el.play(); // synchronous inside the tap handler
    if (p && p.catch) p.catch((e) => { console.warn('play blocked', e); status('blocked'); });
    seekWhenReady();
  }
  // Drift correction every 30s
  setInterval(() => {
    if (!wantPlay || el.paused) return;
    const { i, off } = livePos();
    if (i !== idx) { syncTrack(); tryPlay(); }
    else if (Math.abs(el.currentTime - off) > 2) el.currentTime = off;
  }, 30000);

  return {
    play: tryPlay,
    pause() { wantPlay = false; el.pause(); },
    isPlaying: () => wantPlay && !el.paused,
    setVolume: (v) => { el.volume = Math.max(0, Math.min(1, v)); },
    livePos,
    el,
  };
}
