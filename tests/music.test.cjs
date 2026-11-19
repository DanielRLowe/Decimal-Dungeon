const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(require.resolve('../web/music.js'), 'utf8');

// A decoder can resolve play() after the player has switched songs or muted
// the game. Hold each promise independently to exercise that ordering.
class DeferredAudio extends EventTarget {
  dataset = {};
  paused = true;
  volume = 1;
  currentTime = 0;
  duration = 130;
  readyState = 0;
  requests = [];
  source = '';
  set src(value) {
    this.source = value;
    this.currentTime = 0;
    this.paused = true;
    this.readyState = 1;
    queueMicrotask(() => this.dispatchEvent(new Event('loadedmetadata')));
  }
  get src() { return this.source; }
  get currentSrc() { return this.source; }
  getAttribute(name) { return name === 'src' && this.source ? this.source : null; }
  setAttribute(name, value) { if (name === 'src') this.src = value; }
  hasAttribute(name) { return this.getAttribute(name) !== null; }
  removeAttribute(name) { if (name === 'src') this.source = ''; }
  play() {
    this.paused = false;
    return new Promise((resolve, reject) => this.requests.push({src:this.src, resolve, reject}));
  }
  pause() { this.paused = true; }
  load() {}
  remove() { this.removed = true; }
}

function player(options) {
  const audio = new DeferredAudio();
  const document = Object.assign(new EventTarget(), {
    hidden:false, body:{append() {}}, createElement:() => audio, querySelector:() => null
  });
  const window = new EventTarget();
  let now = 0, next = 0;
  const frames = new Map();
  const browser = {
    document, performance:{now:() => now},
    addEventListener:window.addEventListener.bind(window),
    removeEventListener:window.removeEventListener.bind(window),
    MutationObserver:class { observe() {} disconnect() {} },
    requestAnimationFrame(fn) { frames.set(++next, fn); return next; },
    cancelAnimationFrame(id) { frames.delete(id); }
  };
  vm.runInNewContext(source, browser);
  async function advance() {
    for (let i = 0; i < 60; i++) {
      now += 20;
      const batch = [...frames.values()];
      frames.clear();
      for (const fn of batch) fn(now);
      await Promise.resolve();
    }
  }
  return {music:browser.DungeonMusic.create(options), audio, document, advance};
}

test('a previous song settling late cannot silence the new one or restart music after mute', async () => {
  const {music, audio, advance} = player({enabled:true, scene:'atlas'});
  await advance();
  const atlas = audio.requests.at(-1);
  assert.match(atlas.src, /empire-overture\.m4a$/);
  music.setScene('battle');
  await advance();
  const battle = audio.requests.at(-1);
  assert.match(battle.src, /frontier-battle\.m4a$/);
  atlas.reject(new Error('Previous source interrupted'));
  await advance();
  assert.equal(audio.paused, false);
  music.setEnabled(false);
  battle.resolve();
  await advance();
  assert.equal(audio.paused, true);
  music.destroy();
});

test('rapid map and battle switches settle on the last choice, even when hidden', async () => {
  const {music, audio, document, advance} = player({enabled:false, scene:'atlas'});
  music.setScene('battle');
  music.setEnabled(true);
  await advance();
  audio.requests.at(-1).resolve();
  await advance();
  audio.currentTime = 17;
  music.setScene('atlas');
  music.setScene('battle');
  await advance();
  assert.match(audio.src, /frontier-battle\.m4a$/);
  assert.equal(audio.currentTime, 17);
  document.hidden = true;
  document.dispatchEvent(new Event('visibilitychange'));
  music.setScene('atlas');
  await advance();
  assert.equal(audio.paused, true);
  document.hidden = false;
  document.dispatchEvent(new Event('visibilitychange'));
  await advance();
  const last = audio.requests.at(-1);
  assert.match(last.src, /empire-overture\.m4a$/);
  assert.equal(audio.paused, false);
  music.destroy();
  last.resolve();
  await advance();
  assert.equal(audio.paused, true);
  assert.equal(audio.removed, true);
});
