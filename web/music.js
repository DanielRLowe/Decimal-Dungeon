/* One playback element keeps both scores under the same Music switch. */
(function (root) {
  'use strict';
  const sources = {atlas:'assets/empire-overture.m4a', battle:'assets/frontier-battle.m4a'};
  const volume = .58;

  function create({enabled = false, scene = 'atlas'} = {}) {
    if (!Object.hasOwn(sources,scene)) scene = 'atlas';
    const audio = document.createElement('audio');
    audio.dataset.dungeonMusic = '';
    audio.dataset.musicScene = scene;
    audio.setAttribute('aria-hidden','true');
    audio.hidden = true;
    audio.loop = true;
    audio.preload = 'none';
    audio.volume = volume;
    document.body.append(audio);

    const positions = {atlas:0,battle:0};
    let track = null, seekTo = null, pendingPlay = null, fade = null;
    let away = typeof document.hasFocus === 'function' && !document.hasFocus();
    let pageAway = false, disposed = false, fadingIn = false;
    const listeners = [];
    function listen(target,event,callback,capture = false) {
      target.addEventListener(event,callback,capture);
      listeners.push(() => target.removeEventListener(event,callback,capture));
    }
    function mayPlay() {
      return !disposed && enabled && !away && !pageAway && !document.hidden && !document.querySelector('#victory-film[open]');
    }
    function normalLevel() { return document.querySelector('dialog[open]') ? volume * .62 : volume; }
    function stopFade() {
      if (fade) cancelAnimationFrame(fade.frame);
      fade = null;
    }
    function fadeTo(target, duration, onDone = null) {
      if (fade?.target === target && fade.onDone === onDone) return;
      stopFade();
      const from = audio.volume;
      if (Math.abs(from-target) < .001) {
        audio.volume = target;
        onDone?.();
        return;
      }
      const start = performance.now();
      const job = {target,onDone,frame:0};
      fade = job;
      function step(now) {
        if (fade !== job) return;
        const t = Math.max(0,Math.min(1,(now-start)/duration));
        audio.volume = from + (target-from) * t;
        if (t < 1) job.frame = requestAnimationFrame(step);
        else { fade = null; onDone?.(); }
      }
      job.frame = requestAnimationFrame(step);
    }
    function silence() {
      stopFade();
      pendingPlay = null;
      audio.pause();
    }
    function restorePosition() {
      if (seekTo === null || audio.readyState < 1 || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
      if (audio.currentSrc && !audio.currentSrc.endsWith(sources[track])) return;
      try {
        audio.currentTime = seekTo % audio.duration;
        seekTo = null;
      } catch { /* A local file can become seekable after its metadata event. */ }
    }
    function started() {
      if (!mayPlay()) { silence(); return; }
      if (track !== scene) { sync(); return; }
      restorePosition();
      fadingIn = false;
      fadeTo(normalLevel(),360);
    }
    function playCurrent() {
      if (!fadingIn) fadeTo(normalLevel(),260);
      if (!audio.paused || pendingPlay) return;
      const request = {};
      pendingPlay = request;
      let play;
      try { play = audio.play(); }
      catch { pendingPlay = null; return; }
      // WebKit may deny autoplay until the next gesture. A later attempt, pause,
      // or change of source supersedes this promise.
      if (!play) { pendingPlay = null; return; }
      play.then(() => {
        if (!mayPlay()) { silence(); return; }
        if (pendingPlay !== request) return;
        pendingPlay = null;
        started();
      }, () => { if (pendingPlay === request) pendingPlay = null; });
    }
    function switchTrack() {
      if (!mayPlay()) { silence(); return; }
      if (track === scene) { playCurrent(); return; }
      const first = track === null;
      if (track && seekTo === null && Number.isFinite(audio.currentTime)) positions[track] = audio.currentTime;
      silence();
      track = scene;
      seekTo = positions[track] > 0 ? positions[track] : null;
      fadingIn = !first;
      audio.volume = first ? normalLevel() : 0;
      audio.dataset.musicTrack = track;
      audio.src = sources[track];
      audio.load();
      restorePosition();
      playCurrent();
    }
    function sync() {
      if (disposed) return;
      if (!mayPlay()) { silence(); return; }
      if (track === scene) {
        // A return to the outgoing scene can reverse an unfinished fade-out.
        if (fade?.onDone === switchTrack) stopFade();
        playCurrent();
      } else if (track && !audio.paused && audio.volume > .001) {
        fadeTo(0,220,switchTrack);
      } else switchTrack();
    }
    function activate() { away = false; sync(); }
    for (const name of ['pointerdown','keydown','click']) listen(document,name,activate,true);
    listen(audio,'loadedmetadata',restorePosition);
    listen(audio,'canplay',restorePosition);
    listen(audio,'playing',started);
    listen(root,'blur',() => {away = true;sync();});
    listen(root,'focus',activate);
    listen(root,'pagehide',() => {pageAway = true;sync();});
    listen(root,'pageshow',() => {pageAway = false;sync();});
    listen(root,'dungeon-suspend',() => {pageAway = true;sync();});
    listen(root,'dungeon-resume',() => {pageAway = false;sync();});
    listen(document,'visibilitychange',sync);
    listen(document,'close',sync,true);
    const menus = new MutationObserver(changes => {
      if (changes.some(change => change.target.localName === 'dialog' ||
        [...change.addedNodes,...change.removedNodes].some(node => node.localName === 'dialog'))) sync();
    });
    menus.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});
    sync();
    return {
      setScene(value) {
        if (!Object.hasOwn(sources,value)) return;
        scene = value;
        audio.dataset.musicScene = scene;
        sync();
      },
      setEnabled(value) { enabled = !!value; sync(); },
      sync,
      state() { return {enabled,scene,track,playing:!audio.paused,position:audio.currentTime,duration:audio.duration}; },
      destroy() {
        disposed = true;
        menus.disconnect();
        listeners.forEach(remove => remove());
        silence();
        audio.removeAttribute('src'); audio.load(); audio.remove();
      }
    };
  }
  root.DungeonMusic = {create};
})(globalThis);
