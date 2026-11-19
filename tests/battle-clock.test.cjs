const test = require('node:test');
const assert = require('node:assert/strict');
const adventure = require('../web/adventure.js');
const math = require('../web/math.js');
const lessons = require('../web/lessons.js');
const controller = require('../web/battle-clock.js');

const key = 'decimal-dungeon.adventure.v1';
const checked = {damage:35,fullyWorked:true,independent:true,answer:'4.7',errors:{},hints:0};
function environment() {
  let ms = 0;
  const data = new Map(), writes = [];
  const storage = {getItem:k=>data.get(k)??null, setItem:(k,v)=>{data.set(k,v);writes.push(k);}};
  return {
    data,writes,advance:delta=>{ms += delta;},
    open:()=>adventure.open(storage,{now:()=>1700000000000+ms, monotonicNow:()=>ms})
  };
}
function practice(game) {
  game.travel(game.state.world);
  return game.startRound(math.makeProblem);
}
function finishAfter(game,env,round,ms,result=checked) {
  game.setBattleActive(round.id,true);
  env.advance(ms);
  return game.finishRound(round.id,result);
}

test('time allowances account for columns, carries, two written sums and fraction/plot steps', () => {
  const target = adventure.battleTargetMs;
  const easy = target(math.makeProblem(0,{first:true}));
  assert.ok(easy >= 90_000);
  assert.ok(target(math.makeProblem(5,{first:true})) > easy);
  assert.ok(target(math.makeProblem(6,{first:true})) > target(math.makeProblem(5,{first:true})));
  const worksheet = {a:'9.86',b:'9.9429',c:'13.3571',world:6,op:'+',kind:'pair'};
  assert.ok(target(worksheet) >= 300_000);
  assert.ok(target(worksheet) > target({...worksheet,kind:undefined}));
  const fraction = lessons.make('fraction-add',3,2,()=>.4);
  assert.ok(target(fraction) >= 240_000);
  const basic = {kind:'lesson',steps:[{choices:['2','3']}]};
  assert.ok(target({...basic,steps:[{format:'fraction'}]}) > target(basic));
  assert.ok(target({...basic,steps:[{plot:true}]}) > target(basic));
  assert.ok(target({...basic,steps:[{},{}]}) > target({...basic,steps:[{}]}));
  assert.deepEqual([controller.clockText(0),controller.clockText(85999),controller.clockText(600000)],['0:00','1:25','10:00']);
});

test('foreground time survives pauses, map visits, checkpoints and a full relaunch without counting time away', () => {
  const env = environment();
  let game = env.open();
  const round = practice(game);
  assert.equal(game.battleTiming(round.id).elapsedMs,0);
  assert.ok(game.setBattleActive(round.id,true));
  env.advance(12345); assert.ok(game.setBattleActive(round.id,false));
  env.advance(3600000); assert.equal(game.battleTiming(round.id).elapsedMs,12345);
  game.setBattleActive(round.id,true);
  env.advance(2701); game.setScreen('campaign');
  assert.equal(game.battleTiming(round.id).running,false);
  assert.equal(game.battleTiming(round.id).elapsedMs,15046);
  assert.equal(game.setBattleActive(round.id,true),false);
  env.advance(2200);
  game.setScreen('battle'); game.setBattleActive(round.id,true);
  env.advance(8765);
  assert.ok(game.checkpointBattle(round.id));
  const full = JSON.parse(env.data.get(key)).round.timing;
  assert.equal(full.elapsedMs,15046);
  assert.equal(env.writes.at(-1),key+'.clock');
  env.advance(24*60*60*1000);
  game = env.open();
  const reopened = game.startRound(math.makeProblem);
  assert.equal(reopened.id,round.id);
  assert.equal(game.battleTiming(round.id).elapsedMs,23811);
  assert.equal(game.battleTiming(round.id).running,false);
  game.setBattleActive(round.id,true);
  env.advance(262);
  game.saveDraft(round.id,{digit:'3'});
  assert.equal(JSON.parse(env.data.get(key)).round.timing.elapsedMs,24073);
  game.setBattleActive(round.id,false);
  assert.equal(env.open().battleTiming(round.id).elapsedMs,24073);
});

test('a critical really defeats a practice boss in one spell and pays its bonus once across reloads', () => {
  const env = environment(); let game = env.open();
  practice(game);
  for (let i=0;i<4;i++) {
    const r = game.nextRound(math.makeProblem);
    const won = game.finishRound(r.id,checked);
    assert.equal(won.critical,false);
    assert.equal(won.baseDamage,won.damage);
  }
  const boss = game.nextRound(math.makeProblem), before = game.state.xp;
  assert.deepEqual([game.view().enemy.kind,game.view().enemy.hp],['boss',60]);
  const paper = {notes:'3 groups of ten',strokes:[[0,0,3,4]]};
  const result = finishAfter(game,env,boss,28000,{...checked,paper});
  assert.deepEqual([result.critical,result.baseDamage,result.bonusDamage,result.damage], [true,35,35,70]);
  assert.deepEqual([result.beforeHp,result.afterHp,result.defeated], [60,0,true]);
  assert.equal(result.xp,100);
  assert.equal(result.bonusXp,35);
  assert.equal(result.elapsedMs,28000);
  assert.equal(game.state.xp,before+100);
  const run = game.lessonView().activeAutomatic;
  assert.equal(run.history.at(-1).elapsedMs,28000);
  assert.equal(run.history.at(-1).critical,true);
  assert.deepEqual(result.paper,paper);
  paper.notes = 'changed after casting';
  assert.equal(result.paper.notes,'3 groups of ten');
  assert.deepEqual(game.reviewLessonProblem(run.id,boss.id).paper,result.paper);
  const coins = game.state.coins;
  game = env.open();
  assert.deepEqual(game.finishRound(boss.id,checked),result);
  assert.equal(game.state.xp,before+100);
  assert.equal(game.state.coins,coins);
  assert.equal(game.state.stats.count,5);
  assert.equal(game.lessonView().activeAutomatic.history.length,5);
});

test('missing the critical target has no penalty, and solving fast never turns assistance into independent mastery', () => {
  for (const [extra,critical] of [[0,true],[1,false]]) {
    const env=environment(),game=env.open();const r=practice(game);
    const result=finishAfter(game,env,r,game.battleTiming(r.id).targetMs+extra,{...checked,hints:1,errors:{align:1},independent:false});
    assert.equal(result.critical,critical);
    assert.equal(result.damage,critical?70:35);
    assert.equal(result.bonusXp,critical?35:0);
    assert.equal(result.xp,critical?80:45);
    assert.equal(result.coins,8);
    assert.ok(result.fullyWorked);
    assert.equal(game.state.stats.independent,0);
    assert.equal(game.state.regions[0].recent.at(-1).mastered,false);
  }
  const env=environment(),game=env.open(),r=practice(game);
  const partial=finishAfter(game,env,r,1000,{...checked,damage:10,fullyWorked:false,independent:false});
  assert.equal(partial.critical,false);
  assert.equal(partial.damage,10);
});

test('pre-update work and an opted-out round keep normal spell power; new rounds honor the saved timer preference', () => {
  const env=environment();let game=env.open();const r=practice(game);
  const legacy=JSON.parse(env.data.get(key));
  delete legacy.round.timing; delete legacy.settings.timer; delete legacy.settings.music;
  legacy.round.draft={stage:'columns',pos:2};
  env.data.set(key,JSON.stringify(legacy));
  game=env.open();
  assert.deepEqual([game.state.settings.timer,game.state.settings.music,game.state.settings.sound],[true,false,true]);
  const stored=game.startRound(math.makeProblem);
  assert.deepEqual(stored.draft,legacy.round.draft);
  assert.equal(game.battleTiming(r.id).eligible,false);
  assert.equal(finishAfter(game,env,stored,250).critical,false);
  game.setting('music',true);
  let next=game.nextRound(math.makeProblem);
  game.setBattleActive(next.id,true);
  env.advance(2500);game.setting('timer',false);
  assert.equal(game.battleTiming(next.id).elapsedMs,2500);
  assert.equal(game.battleTiming(next.id).running,false);
  game=env.open();
  assert.equal(game.state.settings.music,true); assert.equal(game.state.settings.sound,true);
  assert.equal(game.state.settings.timer,false);
  game.setting('timer',true);
  assert.equal(game.battleTiming(next.id).eligible,false);
  assert.equal(finishAfter(game,env,next,4000).critical,false);
  next=game.nextRound(math.makeProblem);
  assert.equal(game.battleTiming(next.id).eligible,true);
  assert.equal(finishAfter(game,env,next,2000).critical,true);
});

test('a stale clock token and an invalid heartbeat cannot change the new round or erase a saved adventure', () => {
  const env=environment();let game=env.open();
  let r=practice(game); game.setBattleActive(r.id,true);
  env.advance(10000);game.checkpointBattle(r.id);
  game.finishRound(r.id,checked);
  r=game.nextRound(math.makeProblem);
  game=env.open();
  assert.equal(game.battleTiming(r.id).elapsedMs,0);
  env.data.set(key+'.clock','broken');
  game=env.open();
  assert.equal(game.state.round.id,r.id);
  assert.equal(game.state.stats.count,1);
  assert.equal(game.storageAvailable,true);
});

function clockSurface() {
  function eventTarget() {
    const listeners = new Map();
    return {
      addEventListener(evt,fn) { listeners.set(evt,fn); },
      removeEventListener(evt,fn) { if (listeners.get(evt) === fn) listeners.delete(evt); },
      fire(evt) { listeners.get(evt)?.(); }
    };
  }
  const win=eventTarget(), doc=eventTarget();
  let pulser=null, mutations=null;
  win.setInterval=fn=>{pulser=fn; return 1;};
  win.clearInterval=()=>{pulser=null;};
  win.MutationObserver=class {
    constructor(fn){mutations=fn;}
    observe(){}
    disconnect(){mutations=null;}
  };
  const fields={'[data-battle-elapsed]':{textContent:''},'[data-battle-goal]':{textContent:''}};
  const bar={dataset:{},querySelector:key=>fields[key]};
  Object.assign(doc,{defaultView:win,body:{},hidden:false,focused:true,modal:false,
    hasFocus(){return this.focused;}, querySelector(){return this.modal?{}:null;}, createElement(){return bar;}});
  const host={ownerDocument:doc,replaceChildren(){},hidden:false};
  return {win,doc,host,fields,pulse(){pulser?.();},
    toggleDialog(open){doc.modal=open; mutations?.([{type:'attributes',attributeName:'open'}]);}};
}

test('the clock pauses for tutorials, reviews, hidden pages, lost window focus, the map and native suspension', () => {
  const env=environment(),game=env.open(),round=practice(game);
  const surface=clockSurface(), {doc,win}=surface;
  const clock=controller.mount(surface.host,game,round.id);
  const elapsed=()=>game.battleTiming(round.id).elapsedMs;
  assert.equal(game.battleTiming(round.id).running,true);
  assert.equal(surface.fields['[data-battle-goal]'].textContent,'2× critical by 1:46');
  const initialWrites=env.writes.length;
  env.advance(7500);surface.pulse();
  assert.equal(env.writes.length,initialWrites);
  assert.equal(surface.fields['[data-battle-elapsed]'].textContent,'0:07');
  env.advance(500);surface.pulse();assert.equal(env.writes.at(-1),key+'.clock');
  surface.toggleDialog(true);
  env.advance(500000);surface.pulse();
  assert.equal(elapsed(),8000);
  assert.equal(surface.fields['[data-battle-goal]'].textContent,'Paused');
  surface.toggleDialog(false);env.advance(900);
  win.fire('blur');env.advance(400000);surface.pulse();assert.equal(elapsed(),8900);
  win.fire('focus');env.advance(1200);
  doc.hidden=true;doc.fire('visibilitychange');env.advance(5000000);assert.equal(elapsed(),10100);
  doc.hidden=false;doc.fire('visibilitychange');env.advance(3500);
  win.fire('pagehide');env.advance(4000000);surface.pulse();assert.equal(elapsed(),13600);
  win.fire('pageshow');env.advance(400);
  game.setScreen('campaign');clock.sync();env.advance(35000);
  assert.equal(surface.host.hidden,true);assert.equal(elapsed(),14000);
  game.setScreen('battle');clock.sync();env.advance(1000);
  win.fire('dungeon-suspend');env.advance(100000);surface.pulse();
  assert.equal(elapsed(),15000);
  assert.equal(JSON.parse(env.data.get(key)).round.timing.elapsedMs,15000);
  win.fire('dungeon-resume');env.advance(151);
  clock.destroy();clock.destroy();env.advance(54000);
  assert.equal(elapsed(),15151);
  assert.equal(game.battleTiming(round.id).running,false);
  assert.equal(surface.host.hidden,true);
});

test('country criticals capture once, and resuming a parked schoolwork spell retains only active time', () => {
  const env=environment();let game=env.open();
  game.chooseCapital(game.campaignView().capitalId);
  const pinned=game.startLesson('decimal-pairs',2);
  const training=game.startRound(math.makeProblem);
  game.setBattleActive(training.id,true);
  env.advance(13500); game.saveDraft(training.id,{pair:[0,2]});
  game.invade(game.campaignView().frontier[0]);
  const battle=game.startRound(math.makeProblem);
  assert.equal(game.battleTiming(battle.id).elapsedMs,0);
  const award=finishAfter(game,env,battle,20000,checked);
  assert.equal(award.critical,true);
  assert.equal(award.damage,70);
  const holding=award.capture.id;
  const xp=game.state.xp;
  game=env.open();env.advance(1800000);
  assert.deepEqual(game.finishRound(battle.id,checked),award);
  assert.equal(game.state.xp,xp);
  assert.equal(game.campaignView().owned.filter(id=>id===holding).length,1);
  game.leaveCampaign();
  assert.equal(game.startRound(math.makeProblem).id,training.id);
  assert.deepEqual(game.state.round.draft,{pair:[0,2]});
  assert.equal(game.battleTiming(training.id).elapsedMs,13500);
  assert.equal(game.reviewLessonProblem(pinned,battle.id).critical,true);
  assert.equal(game.battleTiming(training.id).running,false);
});
