/* Only the foreground workbench owns a running timer. Review boards never mount it. */
(function (root) {
  'use strict';
  function clockText(ms) {
    const seconds = Math.max(0, Math.floor(ms / 1000));
    return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
  }

  function mount(host, game, roundId) {
    const doc = host.ownerDocument;
    const win = doc.defaultView;
    const bar = doc.createElement('div');
    bar.className = 'bt-clock';
    bar.innerHTML = '<span class="bt-dial" aria-hidden="true"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2h6m-3 0v3m6 1 1.5-1.5"/><circle cx="12" cy="14" r="7.5"/><path d="M12 9v5l3 2"/></svg></span>' +
      '<span class="bt-title">Problem timer</span><span class="bt-reading" role="timer" aria-live="off" aria-label="Active solving time" data-battle-elapsed></span>' +
      '<span class="bt-goal" data-battle-goal></span>';
    host.replaceChildren(bar);
    const reading = bar.querySelector('[data-battle-elapsed]');
    const goal = bar.querySelector('[data-battle-goal]');
    let closed = false;
    let pageAway = false;
    let focused = doc.hasFocus();
    let lastCheckpoint = null;

    function sync() {
      if (closed) return;
      const current = game.state.round;
      const visible = game.state.screen === 'battle' && current?.id === roundId && !current.receipt && game.state.settings.timer;
      const active = visible && !pageAway && !doc.hidden && focused && doc.hasFocus() && !doc.querySelector('dialog[open]');
      game.setBattleActive(roundId, active);
      host.hidden = !visible;
      if (!visible) return;
      const timing = game.battleTiming(roundId);
      if (!timing) return;
      const time = clockText(timing.elapsedMs);
      if (reading.textContent !== time) reading.textContent = time;
      const over = timing.elapsedMs > timing.targetMs;
      const state = !active ? 'paused' : !timing.eligible || over ? 'untimed' : 'ready';
      const label = state === 'paused' ? 'Paused' : state === 'untimed' ? 'Take your time'
        : '2× critical by ' + clockText(timing.targetMs);
      if (bar.dataset.pace !== state) bar.dataset.pace = state;
      if (goal.textContent !== label) goal.textContent = label;
      if (timing.running) {
        if (lastCheckpoint === null) lastCheckpoint = timing.elapsedMs;
        if (timing.elapsedMs - lastCheckpoint >= 8000) {
          game.checkpointBattle(roundId);
          lastCheckpoint = timing.elapsedMs;
        }
      }
    }
    const onFocus = () => { focused = true; sync(); };
    const onBlur = () => { focused = false; sync(); };
    const onPageHide = () => { pageAway = true; sync(); };
    const onPageShow = () => { pageAway = false; focused = doc.hasFocus(); sync(); };
    const listeners = [[win,'focus',onFocus],[win,'blur',onBlur],[win,'pagehide',onPageHide],
      [win,'pageshow',onPageShow],[win,'beforeunload',onPageHide],
      [win,'dungeon-suspend',onPageHide],[win,'dungeon-resume',onPageShow],[doc,'visibilitychange',sync]];
    for (const [target,event,fn] of listeners) target.addEventListener(event,fn);
    function includesDialog(nodes) {
      return Array.from(nodes).some(node => node.matches?.('dialog') || node.querySelector?.('dialog[open]'));
    }
    const observer = new win.MutationObserver(records => {
      if (records.some(r => r.attributeName === 'open' || (r.type === 'childList' && (includesDialog(r.addedNodes) || includesDialog(r.removedNodes))))) sync();
    });
    observer.observe(doc.body, {subtree:true,childList:true,attributes:true,attributeFilter:['open']});
    const interval = win.setInterval(sync,250);
    sync();
    return {
      sync,
      destroy() {
        if (closed) return;
        closed = true;
        observer.disconnect();
        win.clearInterval(interval);
        for (const [target,event,fn] of listeners) target.removeEventListener(event,fn);
        game.setBattleActive(roundId,false);
        host.hidden = true;
      }
    };
  }
  const api = {mount,clockText};
  root.DungeonBattleClock = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
