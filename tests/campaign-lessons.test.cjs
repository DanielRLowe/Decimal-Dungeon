const test = require('node:test');
const assert = require('node:assert/strict');
const adventure = require('../web/adventure.js');
const curriculum = require('../web/lessons.js');
const math = require('../web/math.js');
const key = 'decimal-dungeon.adventure.v1';

function local() {
  const data = new Map(), storage = {setItem:(k,v)=>data.set(k,v),getItem:k=>data.get(k)??null};
  return {data,open:()=>adventure.open(storage)};
}
function grade(round, changes) {
  const p = round.problem;
  const answer = p.kind === 'lesson' ? [p.steps.at(-1).answer].flat()[0] : math.analyze(p).answer;
  return {damage:35, fullyWorked:true, independent:true, errors:{}, hints:0, answer, ...changes};
}
function openFrontier(game) {
  const v = game.campaignView();
  assert.ok(game.invade(v.frontier[0]));
  return game.startRound(math.makeProblem);
}

test('the default country path teaches the full curriculum and continues with Challenge after mastery', () => {
  const game = local().open();
  game.chooseCapital(game.campaignView().capitalId);
  const seen = new Set(), first = game.campaignView().plannedLesson;
  assert.equal(game.campaignView().mathMode,'curriculum');
  assert.deepEqual(first,{lessonId:'place-value',difficulty:2});
  const assisted = openFrontier(game);
  game.finishRound(assisted.id,grade(assisted,{independent:false,hints:1}));
  game.leaveCampaign();
  for (let i = 0; i < curriculum.list.length * 3; i++) {
    const v = game.campaignView(), expected = v.plannedLesson;
    const r = openFrontier(game);
    assert.equal(r.campaignMath,'curriculum');
    assert.equal(r.difficulty,2);
    assert.equal(r.lessonId,expected.lessonId);
    assert.equal(r.problem.lessonId,r.lessonId);
    assert.equal(r.problem.level,2);
    if (i < 3) assert.equal(r.lessonId,'place-value');
    if (i === 3) assert.equal(r.lessonId,'powers-of-ten');
    seen.add(r.lessonId);
    const receipt = game.finishRound(r.id,grade(r));
    assert.ok(receipt.capture);
    assert.equal(game.lessonView().activeAutomatic.history.at(-1).lessonId,r.lessonId);
    assert.equal(game.lessonView().activeAutomatic.history.at(-1).campaignMath,'curriculum');
    game.leaveCampaign();
  }
  assert.deepEqual(seen,new Set(curriculum.list.map(l=>l.id)));
  const summary = curriculum.tracker(game.lessonView().sessions);
  assert.equal(summary.mastered,summary.total);
  assert.equal(game.campaignView().plannedLesson.difficulty,3);
  const extra = openFrontier(game);
  assert.equal(extra.difficulty,3);
  game.finishRound(extra.id,grade(extra));
  const learned = curriculum.tracker(game.lessonView().sessions).lessons.find(r=>r.lessonId===extra.lessonId);
  assert.equal(learned.extraPractice,1);
  game.leaveCampaign();
  game.travel(1);
  const practice = game.startRound(math.makeProblem);
  assert.equal(practice.problem.kind,undefined);
  assert.equal(practice.problem.world,1);
  assert.equal(practice.problem.lessonId,undefined);
});

test('the campaign selector preserves current automatic work, restores unpinned drafts on the map and persists independently by era', () => {
  const env = local(); let game = env.open();
  game.chooseCapital(game.campaignView().capitalId);
  const current = openFrontier(game);
  game.saveDraft(current.id,{reasoning:'half done'});
  game.setScreen('campaign');
  assert.ok(game.setCampaignMath('classic'));
  assert.equal(game.state.screen,'campaign');
  assert.equal(game.campaignView().mathMode,'classic');
  assert.equal(game.campaignView().plannedLesson,null);
  assert.equal(game.startRound(math.makeProblem).id,current.id);
  assert.deepEqual(game.state.round.draft,{reasoning:'half done'});
  const pinned = game.startLesson('line-plots',3);
  const fixed = game.startRound(math.makeProblem);
  assert.equal(fixed.campaignMath,'fixed');
  assert.deepEqual(game.campaignView().plannedLesson,{lessonId:'line-plots',difficulty:3});
  game.saveDraft(fixed.id,{mark:'1/4'});
  game.setScreen('campaign');
  assert.ok(game.setCampaignMath('classic'));
  assert.equal(game.state.screen,'campaign');
  assert.equal(game.lessonView().active,null);
  assert.equal(game.startRound(math.makeProblem).id,current.id);
  assert.deepEqual(game.state.round.draft,{reasoning:'half done'});
  assert.equal(game.setCampaignMath('unknown'),false);
  game = env.open();
  assert.equal(game.campaignView().campaignMath,'classic');
  game.finishRound(current.id,grade(current));
  game.leaveCampaign();
  const next = openFrontier(game);
  assert.equal(next.campaignMath,'classic');
  assert.equal(next.problem.kind,undefined);
  assert.equal(next.problem.lessonId,undefined);
  game.switchEra('ww1');
  assert.equal(game.campaignView().campaignMath,'curriculum');
  game.switchEra('modern');
  assert.equal(game.campaignView().campaignMath,'classic');
  game.resumeLesson(pinned,fixed.id);
  assert.equal(game.startRound(math.makeProblem).id,fixed.id);
  assert.deepEqual(game.state.round.draft,{mark:'1/4'});
});

test('an existing seven-country family save switches to Grade 5 immediately after its exact old puzzle', () => {
  const env = local();
  const source = env.open();
  source.chooseCapital(source.campaignView().capitalId);
  source.setCampaignMath('classic');
  for (let i=0;i<6;i++) {
    const r = openFrontier(source); source.finishRound(r.id,grade(r)); source.leaveCampaign();
  }
  const old = openFrontier(source);
  source.saveDraft(old.id,{stage:'columns',place:2});
  const prev = JSON.parse(env.data.get(key));
  delete prev.campaign.mathMode;
  delete prev.lessonBook;
  delete prev.round.lessonSessionId;
  delete prev.round.campaignMath;
  env.data.set(key,JSON.stringify(prev));
  const game = env.open();
  assert.equal(game.campaignView().owned.length,7);
  assert.equal(game.campaignView().mathMode,'curriculum');
  const pending = game.startRound(math.makeProblem);
  assert.equal(pending.id,old.id);
  assert.deepEqual(pending.problem,old.problem);
  assert.deepEqual(pending.draft,{stage:'columns',place:2});
  game.finishRound(pending.id,grade(pending));
  game.leaveCampaign();
  const next = openFrontier(game);
  assert.equal(next.campaignMath,'curriculum');
  assert.deepEqual([next.lessonId,next.difficulty],['place-value',2]);
});
