const test = require('node:test');
const assert = require('node:assert/strict');
const adventure = require('../web/adventure.js');
const board = require('../web/campaign-data.js');
const capitals = require('../web/capitals.js');
const math = require('../web/math.js');

const modern = {id:'modern',board,capitals};
function fixture(id) {
  const neighbors = [[1,2],[0,2],[0,1,3],[2]];
  // Different polity and capital names intentionally occupy the same IDs in every fixture.
  const nations = neighbors.map((links,i) => ({
    id:i, code:id + i, name:id + ' country ' + i, rank:i === 1 ? 'boss' : 'normal',
    biome:i, variant:0, neighbors:links, seaNeighbors:[]
  }));
  return {id,board:{NATIONS:nations,CAPITAL_ID:0},capitals:{
    get:i => ({name:id + ' city ' + i,x:10+i,y:4}), containsPoint:(i,x,y) => x === 10+i && y === 4
  }};
}
const catalog = {modern,ww1:fixture('ww1'),ww2:fixture('ww2'),'1886':fixture('1886')};
const eras = {get:id => catalog[id]};
const lessons = {has:id => id === 'patterns', make:(id,level,index) => ({kind:'lesson',lessonId:id,world:0,level,
  prompt:'Task ' + index,steps:[{prompt:'How many?',answer:'5'}]})};
const earned = {damage:35,fullyWorked:true,independent:true,errors:{},hints:0,answer:'5'};
const makeRound = game => game.startRound(math.makeProblem);
function local() {
  const data = new Map();
  const storage = {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
  return {data,open:()=>adventure.open(storage,{eras,lessons})};
}

test('all four campaigns have independent home, territory, rival, empire and government records across restart', () => {
  const env = local();
  let game = env.open();
  const home = board.NATIONS.find(n => n.code === 'USA').id;
  game.chooseCapital(home); game.renameCountry(home,'My modern home');
  const session = game.startLesson('patterns',2);
  const practice = makeRound(game); game.saveDraft(practice.id,{entry:'modern'});
  assert.equal(game.switchEra('unavailable'),false);
  for (const id of ['ww1','ww2','1886']) {
    assert.ok(game.switchEra(id));
    const view = game.campaignView();
    assert.deepEqual([view.eraId,view.needsCapital,view.total,view.capitalId], [id,true,4,0]);
    assert.equal(view.board,catalog[id].board);
    assert.equal(view.capitals.get(0).name,id + ' city 0');
    assert.deepEqual(view.rivals,[]);
    assert.equal(game.lessonView().active.id,session);
    assert.ok(game.chooseCapital(0)); assert.ok(game.renameCountry(0,id + ' home'));
    assert.ok(game.setEmpireName(id + ' explorers'));
    assert.ok(game.setCountryCapital(0,{name:id + ' seat'}));
    assert.ok(game.addRival(id + ' rivals',3));
    assert.ok(game.invade(2));
    const r = makeRound(game);
    assert.equal(r.lessonId,'patterns');
    assert.equal(r.eraId,id);
    assert.equal(game.finishRound(r.id,earned).capture.id,2);
    assert.ok(game.setEmpireSeat(2));
    game.leaveCampaign();
  }
  game = env.open();
  assert.equal(game.campaignView().eraId,'1886');
  for (const id of ['ww2','ww1','1886']) {
    game.switchEra(id);
    const v = game.campaignView();
    assert.deepEqual(v.owned,[0,2]);
    assert.equal(v.seatId,2); assert.equal(v.empireName,id + ' explorers');
    assert.equal(v.administration[0].countryName,id + ' home');
    assert.equal(v.administration[0].capitalName,id + ' seat');
    assert.equal(v.rivals[0].name,id + ' rivals');
    assert.equal(v.turn,1);
  }
  game.switchEra('modern');
  const v = game.campaignView();
  assert.deepEqual(v.owned,[home]);
  assert.equal(v.administration[home].countryName,'My modern home');
  assert.deepEqual(v.rivals,[]);
  assert.equal(makeRound(game).id,practice.id);
  assert.deepEqual(makeRound(game).draft,{entry:'modern'});
  assert.equal(game.lessonView().active.completed,3);
  assert.deepEqual(game.lessonView().active.history.map(r=>r.eraId), ['ww1','ww2','1886']);
});

test('era changes preserve partially damaged defenders and exact rounds; cross-era session navigation restores the correct frontier', () => {
  const env = local(); let game = env.open();
  game.switchEra('ww1'); game.chooseCapital(0);
  const first = game.startLesson('patterns',2);
  game.invade(1);
  let r = makeRound(game);
  assert.equal(game.finishRound(r.id,{...earned,damage:10}).capture,null);
  assert.equal(game.campaignView().defender.hp,10);
  const ongoing = game.nextRound(math.makeProblem);
  game.saveDraft(ongoing.id,{column:2,carry:1});
  game.switchEra('ww2'); game.chooseCapital(0);
  const second = game.startLesson('patterns',3);
  game.invade(1);
  r = makeRound(game); game.saveDraft(r.id,{unrelated:true});
  assert.equal(game.campaignView().defender.hp,20);
  game = env.open();
  const firstSummary = game.lessonView().sessions.find(s=>s.id===first);
  assert.deepEqual(firstSummary.pending.map(p=>[p.roundId,p.eraId,p.nationId]),[[ongoing.id,'ww1',1]]);
  assert.ok(game.resumeLesson(first,ongoing.id));
  assert.equal(game.campaignView().eraId,'ww1');
  assert.equal(game.campaignView().defender.hp,10);
  assert.equal(makeRound(game).id,ongoing.id);
  assert.deepEqual(makeRound(game).draft,{column:2,carry:1});
  const won = game.finishRound(ongoing.id,earned);
  assert.equal(won.capture.id,1);
  const before = [game.state.xp,game.state.coins,game.state.stats.count];
  assert.ok(game.resumeLesson(second,r.id));
  assert.equal(game.campaignView().eraId,'ww2');
  assert.deepEqual(game.campaignView().owned,[0]);
  assert.equal(game.campaignView().defender.hp,20);
  assert.deepEqual(makeRound(game).draft,{unrelated:true});
  game.switchEra('ww1');
  assert.deepEqual(makeRound(game).receipt,won);
  assert.deepEqual(game.finishRound(ongoing.id,earned),won);
  assert.deepEqual([game.state.xp,game.state.coins,game.state.stats.count],before);
  assert.deepEqual(game.campaignView().owned,[0,1]);
  assert.equal(game.reviewLessonProblem(first,ongoing.id).eraId,'ww1');
});

test('earlier single-map saves migrate to the modern campaign and keep training work', () => {
  const env = local();
  let game = env.open();
  const home = board.NATIONS.find(n => n.code === 'MEX').id;
  game.chooseCapital(home);
  const r = makeRound(game);
  game.saveDraft(r.id,{pos:1});
  const key = 'decimal-dungeon.adventure.v1', old = JSON.parse(env.data.get(key));
  delete old.eraId; delete old.eraCampaigns; delete old.lessonBook;
  delete old.round.eraId; delete old.round.lessonSessionId;
  env.data.set(key,JSON.stringify(old));
  game = env.open();
  assert.equal(game.campaignView().eraId,'modern');
  assert.deepEqual(game.campaignView().owned,[home]);
  game.switchEra('1886');
  assert.equal(game.campaignView().needsCapital,true);
  game.switchEra('modern');
  assert.equal(makeRound(game).id,r.id);
  assert.deepEqual(makeRound(game).draft,{pos:1});
  assert.equal(makeRound(game).eraId,'modern');
});

test('the shipped historical atlases support real capital placement, conquest, and exact captured receipts after relaunch', () => {
  const actual = require('../web/eras.js');
  const data = new Map(), storage = {getItem:k=>data.get(k)??null, setItem:(k,v)=>data.set(k,v)};
  let game = adventure.open(storage);
  const wins = [];
  for (const id of ['1886','ww1','ww2']) {
    assert.ok(game.switchEra(id));
    const era = actual.get(id), view = game.campaignView();
    assert.equal(view.nations,era.board.NATIONS);
    assert.equal(view.needsCapital,true);
    assert.ok(view.total > 40);
    for (const n of view.nations) {
      const city = era.capitals.get(n.id);
      assert.ok(city.name && era.capitals.containsPoint(n.id,city.x,city.y), era.date + ' ' + n.name);
    }
    const target = view.nations.find(n => n.rank === 'boss' && n.neighbors.length);
    const home = target.neighbors[0];
    assert.ok(game.chooseCapital(home));
    assert.ok(game.invade(target.id));
    const r = makeRound(game);
    const p = r.problem;
    assert.equal(r.eraId,id);
    assert.equal(r.lessonId,'place-value');
    const won = game.finishRound(r.id,{...earned,answer:p.steps.at(-1).answer});
    assert.equal(won.capture.name,target.name);
    assert.equal(won.capture.eraId,id);
    wins.push({id, roundId:r.id, home, target:target.id, won});
  }
  game.switchEra('modern');
  assert.equal(game.campaignView().needsCapital,true);
  const stats = [game.state.xp,game.state.coins,game.state.stats.count];
  game = adventure.open(storage);
  for (const {id,roundId,home,target,won} of wins) {
    game.switchEra(id);
    assert.deepEqual(game.campaignView().owned,[home,target]);
    assert.deepEqual(makeRound(game).receipt,won);
    assert.deepEqual(game.finishRound(roundId,earned),won);
    assert.deepEqual([game.state.xp,game.state.coins,game.state.stats.count],stats);
    const session = game.lessonView().sessions.find(run=>run.history.some(row=>row.roundId === roundId));
    assert.equal(game.reviewLessonProblem(session.id,roundId).eraId,id);
  }
});
