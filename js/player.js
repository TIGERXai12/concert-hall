// Simple, robust streaming playlist player (HTMLAudioElement). Plays TRACKS in order, loops.
export function createPlayer(tracks, { onStatus } = {}) {
  const el = new Audio();
  el.preload = 'auto';
  el.setAttribute('playsinline', '');
  el.setAttribute('webkit-playsinline', '');
  let idx = 0, wantPlay = false;
  const status = (s) => onStatus && onStatus(s, tracks[idx]);
  const setTrack = (i) => { idx = (i + tracks.length) % tracks.length; el.src = tracks[idx].url; };
  setTrack(0);
  el.addEventListener('waiting', () => wantPlay && status('loading'));
  el.addEventListener('playing', () => status('playing'));
  el.addEventListener('pause', () => !wantPlay && status('paused'));
  el.addEventListener('ended', () => { setTrack(idx + 1); if (wantPlay) tryPlay(); });
  el.addEventListener('error', () => { if (wantPlay) { setTrack(idx + 1); tryPlay(); } });
  function tryPlay() {
    wantPlay = true;
    status('loading');
    const p = el.play(); // must be called synchronously inside the tap handler
    if (p && p.catch) p.catch((e) => { console.warn('play blocked', e); wantPlay = false; status('blocked'); });
  }
  return {
    play: tryPlay,
    pause() { wantPlay = false; el.pause(); },
    toggle() { if (wantPlay && !el.paused) { this.pause(); return false; } tryPlay(); return true; },
    isPlaying: () => wantPlay && !el.paused,
    setVolume: (v) => { el.volume = Math.max(0, Math.min(1, v)); },
    el,
  };
}
