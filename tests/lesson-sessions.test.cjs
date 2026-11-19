const test = require('node:test');
const assert = require('node:assert/strict');
const adventure = require('../web/adventure.js');
const atlas = require('../web/campaign-data.js');
const math = require('../web/math.js');
const key = 'decimal-dungeon.adventure.v1';
const country = code => atlas.NATIONS.find(n => n.code === code).id;

const lessons = {
  has:id => ['percent','decimal-subtract'].includes(id),
  make(id, difficulty, index) {
    if (id === 'decimal-subtract') return {...math.makeProblem(5,{first:true}), lessonId:id};
    return {kind:'lesson', lessonId:id, world:0, level:difficulty, prompt:'Problem ' + (index + 1),
      steps:[{prompt:'How many?',answer:String(4 + index + difficulty)}]};
  }
};
const correct = {damage:35, hints:0, errors:{}, independent:true, fullyWorked:true, answer:'5',
  work:[{prompt:'How many?', answer:'5'}]};
function setup() {
  let time = 1000;
  const store = new Map();
  const storage = {getItem:k => store.get(k) ?? null, setItem:(k,v) => store.set(k,v)};
  return {store, open:() => adventure.open(storage,{lessons, now:() => time}), advance:ms => {time += ms;}};
}
function round(game) { return game.startRound(math.makeProblem); }

test('all worlds are available before mastery, and genuine older saves preserve progress, rewards, recommendations and drafts', () => {
  const env = setup();
  const fresh = env.open();
  assert.ok(fresh.state.regions.every(r => r.unlocked));
  for (let i = 0; i < adventure.WORLDS.length; i++) assert.equal(fresh.travel(i), true);
  const oldRound = round(fresh);
  fresh.saveDraft(oldRound.id,{stage:'columns',pos:2});
  const old = JSON.parse(env.store.get(key));
  delete old.lessonBook;
  delete old.round.lessonSessionId;
  old.regions.forEach((r,i) => { delete r.recommended; r.unlocked = i < 2 || i === adventure.SCHOOLWORK; });
  old.stats.count = 12;
  old.stats.independent = 10;
  old.xp = 475;
  old.coins = 18;
  env.store.set(key,JSON.stringify(old));
  const game = env.open();
  assert.deepEqual(game.state.round, old.round);
  assert.deepEqual(game.state.stats, old.stats);
  assert.deepEqual([game.state.xp,game.state.coins], [475,18]);
  assert.ok(game.state.regions.every(r => r.unlocked));
  assert.equal(game.state.regions[1].recommended, true);
  assert.equal(game.state.regions[4].recommended, false);
  assert.deepEqual(game.lessonView().sessions,[]);
  assert.equal(game.lessonView().legacyCount,12);
  const resumed = round(game);
  assert.equal(resumed.id,old.round.id);
  assert.deepEqual(resumed.draft, old.round.draft);
  game.finishRound(resumed.id,correct);
  assert.equal(game.lessonView().activeAutomatic.completed,1);
  assert.equal(game.lessonView().activeAutomatic.history[0].roundId,resumed.id);
  assert.equal(env.open().lessonView().legacyCount,12);
});

test('fixed sessions retain separate problems, work, difficulty and dates when switching or reopening', () => {
  const env = setup();
  let game = env.open();
  const auto = round(game);
  game.saveDraft(auto.id,{step:'auto'});
  const autoId = game.lessonView().activeAutomatic.id;
  const first = game.startLesson('percent',1);
  const r1 = round(game);
  assert.deepEqual([r1.lessonSessionId,r1.lessonId,r1.difficulty,r1.problem.prompt], [first,'percent',1,'Problem 1']);
  game.saveDraft(r1.id,{step:'a'});
  env.advance(1000);
  const second = game.startLesson('percent',3);
  const r2 = round(game);
  assert.notEqual(first,second);
  assert.equal(r2.problem.level,3);
  game.saveDraft(r2.id,{step:'b'});
  game = env.open();
  assert.equal(round(game).id,r2.id);
  assert.equal(game.lessonView().active.id,second);
  assert.ok(game.resumeLesson(first));
  assert.deepEqual([round(game).id,round(game).draft], [r1.id,{step:'a'}]);
  const hit = game.finishRound(r1.id,correct);
  assert.equal(game.finishRound(r1.id,correct),hit);
  const stats = game.lessonView().active;
  assert.deepEqual([stats.completed,stats.xp,stats.coins], [1,hit.xp,hit.coins]);
  assert.deepEqual(stats.history[0].work,correct.work);
  assert.equal(game.nextRound(math.makeProblem).problem.prompt,'Problem 2');
  assert.ok(game.automaticMath());
  assert.equal(game.lessonView().active,null);
  assert.equal(game.lessonView().activeAutomatic.id,autoId);
  assert.deepEqual([round(game).id,round(game).draft], [auto.id,{step:'auto'}]);
  assert.ok(game.resumeLesson(second));
  assert.deepEqual([round(game).id,round(game).draft], [r2.id,{step:'b'}]);
  assert.equal(game.lessonView().sessions.length,3);
  const before = env.store.get(key);
  assert.equal(game.startLesson('missing',2),false);
  assert.equal(game.startLesson('percent',4),false);
  assert.equal(game.resumeLesson(8888),false);
  assert.equal(env.store.get(key),before);
});

test('a fixed lesson follows a campaign, saves two contexts and recovers a captured target’s unfinished math in practice', () => {
  const env = setup();
  let game = env.open();
  const usa = country('USA'), canada = country('CAN');
  game.chooseCapital(usa);
  const run = game.startLesson('percent',2);
  const training = round(game);
  game.saveDraft(training.id,{step:'training'});
  game.invade(canada);
  const battle = round(game);
  assert.deepEqual([battle.nationId,battle.lessonId,battle.problem.level], [canada,'percent',2]);
  game.saveDraft(battle.id,{step:'campaign'});
  const other = game.startLesson('percent',3);
  const otherRound = round(game);
  assert.equal(otherRound.nationId,canada);
  const won = game.finishRound(otherRound.id,correct);
  assert.equal(won.capture.id,canada);
  const owned = game.campaignView().owned.slice();
  const turn = game.campaignView().turn;
  game = env.open();
  assert.equal(game.lessonView().active.id,other);
  assert.ok(game.resumeLesson(run));
  assert.equal(game.campaignView().inBattle,false);
  assert.deepEqual([round(game).id,round(game).nationId,round(game).draft], [battle.id,null,{step:'campaign'}]);
  assert.deepEqual(game.lessonView().active.pending.map(p => p.roundId).sort(), [training.id,battle.id].sort());
  const saved = game.startLesson('percent',1);
  assert.ok(game.resumeLesson(run));
  assert.equal(round(game).id,battle.id);
  const recovered = game.finishRound(battle.id,correct);
  assert.equal(recovered.capture,null);
  assert.deepEqual(game.campaignView().owned,owned);
  assert.equal(game.campaignView().turn,turn);
  assert.deepEqual([game.nextRound(math.makeProblem).id,round(game).draft], [training.id,{step:'training'}]);
  assert.ok(game.resumeLesson(saved));
});

test('automatic and fixed arithmetic retain their own math choices, enemy art, decimal mastery and generic reasoning metrics', () => {
  const game = setup().open();
  game.travel(3);
  game.startLesson('percent',2);
  const p = round(game);
  const art = game.view().biomeIndex;
  game.finishRound(p.id,{...correct,hints:1,errors:{reasoning:2}});
  assert.equal(game.state.stats.errors.reasoning,2);
  assert.equal(game.state.regions.reduce((n,r) => n + r.stats.count,0),0);
  game.startLesson('decimal-subtract',3);
  const sub = round(game);
  assert.equal(sub.world,5);
  assert.equal(game.state.world,3);
  assert.equal(game.view().worldIndex,5);
  assert.equal(game.view().biomeIndex,art);
  game.finishRound(sub.id,correct);
  assert.equal(game.state.regions[5].stats.count,1);
  assert.equal(game.state.regions[3].stats.count,0);
  game.automaticMath();
  assert.equal(round(game).world,3);
  game.chooseCapital(country('USA')); game.invade(country('CAN'));
  const originalBattle = round(game);
  const enemy = game.campaignView().defender;
  game.saveDraft(originalBattle.id,{auto:'campaign'});
  game.startLesson('percent',1);
  const fixed = round(game);
  assert.equal(fixed.nationId,country('CAN'));
  assert.equal(game.view().biomeIndex,atlas.NATIONS[country('CAN')].biome);
  game.automaticMath();
  assert.equal(round(game).id,originalBattle.id);
  assert.deepEqual(round(game).draft,{auto:'campaign'});
  assert.equal(game.campaignView().defender.hp,enemy.hp);
});

test('review uses a copy of the recorded problem and can resume without extra awards, claims or mastered problems', () => {
  const env = setup();
  let game = env.open();
  game.chooseCapital(country('USA')); game.invade(country('CAN'));
  const id = game.startLesson('percent',1);
  const r = round(game);
  const won = game.finishRound(r.id,correct);
  assert.equal(won.capture.id,country('CAN'));
  const old = {xp:game.state.xp,coins:game.state.coins,stats:game.state.stats.count,turn:game.campaignView().turn};
  const review = game.reviewLessonProblem(id,r.id);
  assert.deepEqual(review.problem,r.problem);
  assert.deepEqual(review.work,correct.work);
  review.problem.prompt = 'changed';
  assert.notEqual(game.reviewLessonProblem(id,r.id).problem.prompt,'changed');
  assert.ok(game.saveReviewDraft(id,r.id,{pos:2}));
  game = env.open();
  assert.deepEqual(game.reviewLessonProblem(id,r.id).draft,{pos:2});
  assert.ok(game.finishReview(id,r.id));
  assert.equal(game.finishReview(id,r.id),false);
  assert.equal(game.reviewLessonProblem(id,r.id).reviewCount,1);
  assert.equal(game.reviewLessonProblem(id,r.id).draft,null);
  assert.equal(game.lessonView().active.completed,1);
  assert.deepEqual({xp:game.state.xp,coins:game.state.coins,stats:game.state.stats.count,turn:game.campaignView().turn},old);
  assert.equal(game.reviewLessonProblem(id,8888),null);
});

test('new automatic sessions have reviewable problems and a mid-problem break preserves the same run', () => {
  const env = setup();
  const game = env.open();
  const r1 = round(game), run1 = game.lessonView().activeAutomatic.id;
  game.saveDraft(r1.id,{pos:1});
  env.advance(45 * 60 * 1000);
  assert.equal(round(game).id,r1.id);
  assert.equal(game.lessonView().activeAutomatic.id,run1);
  game.finishRound(r1.id,correct);
  env.advance(60 * 60 * 1000);
  const r2 = game.nextRound(math.makeProblem), run2 = game.lessonView().activeAutomatic.id;
  assert.notEqual(run1,run2);
  assert.equal(game.lessonView().sessions.length,2);
  assert.deepEqual(game.reviewLessonProblem(run1,r1.id).problem,r1.problem);
  game.saveDraft(r2.id,{pos:2});
  game.resumeLesson(run1);
  assert.equal(game.lessonView().activeAutomatic.id,run1);
  game.resumeLesson(run2);
  assert.deepEqual(round(game).draft,{pos:2});
});

test('every published topic opens at all three difficulties on a fresh profile, with no earned progress required', () => {
  const registry = require('../web/lessons.js');
  const rows = new Map();
  const storage = {getItem:k=>rows.get(k)??null,setItem:(k,v)=>rows.set(k,v)};
  let game = adventure.open(storage);
  const probes = [];
  for (const topic of registry.list) {
    for (const difficulty of [1,2,3]) {
      const id = game.startLesson(topic.id,difficulty);
      assert.ok(id,topic.id);
      const r = round(game);
      assert.equal(r.problem.lessonId,topic.id);
      assert.equal(r.problem.level,difficulty);
      assert.equal(r.lessonSessionId,id);
      if (topic.id === 'decimal-three' && difficulty === 2) assert.deepEqual(math.operands(r.problem),['1.987','2.7964','0.86']);
      if (topic.id === 'decimal-subtract') assert.equal(r.problem.op,'-');
      if (topic.world == null) {
        assert.ok(r.problem.steps.length,topic.id);
        assert.equal(r.problem.kind,'lesson');
      }
      game.saveDraft(r.id,{entry:topic.id + difficulty});
      if (difficulty === 2) probes.push([id,r.id,topic.id + difficulty]);
    }
  }
  game = adventure.open(storage);
  assert.equal(game.lessonView().sessions.length,registry.list.length * 3);
  for (const [id,roundId,entry] of probes) {
    assert.ok(game.resumeLesson(id));
    assert.equal(round(game).id,roundId);
    assert.deepEqual(round(game).draft,{entry});
  }
  assert.equal(game.state.xp,0);
  assert.equal(game.state.stats.count,0);
});

test('a hidden old-format garrison draft survives a different session capturing that country first', () => {
  const env = setup(), first = env.open();
  const usa = country('USA'), canada = country('CAN');
  first.chooseCapital(usa);
  first.startRound(math.makeProblem);
  const old = JSON.parse(env.store.get(key));
  delete old.lessonBook;
  delete old.round.lessonSessionId;
  const garrisonRound = {id:++old.serial,world:3,mode:'standard',problem:math.makeProblem(3,{first:true}),
    nationId:canada,campaignTier:3,draft:{pos:2},receipt:null};
  old.campaign.garrisons[canada] = {hp:10,rounds:{3:garrisonRound}};
  env.store.set(key, JSON.stringify(old));
  const game = env.open();
  const original = game.lessonView().activeAutomatic.id;
  assert.ok(game.lessonView().activeAutomatic.pending.some(p => p.roundId === garrisonRound.id));
  game.startLesson('percent',2); game.invade(canada);
  const won = game.finishRound(round(game).id,correct);
  assert.equal(won.capture.id,canada);
  assert.ok(game.resumeLesson(original,garrisonRound.id));
  assert.equal(round(game).id,garrisonRound.id);
  assert.deepEqual(round(game).draft,{pos:2});
  assert.equal(game.campaignView().inBattle,false);
  assert.deepEqual(game.campaignView().owned,[usa,canada]);
});
