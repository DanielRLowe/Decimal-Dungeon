const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../web/adventure.js');
const math = require('../web/math.js');

function memory() {
  const pairs = new Map();
  return { getItem: k => pairs.get(k) ?? null, setItem: (k, v) => pairs.set(k, v) };
}
const perfect = { damage: 30, hints: 0, errors: {}, independent: true, steps: {}, answer: '4.7', fullyWorked: true };
function play(game, change = {}) {
  const round = game.nextRound(math.makeProblem);
  return game.finishRound(round.id, { ...perfect, ...change });
}

test('reopens active work, stores a battle receipt once, rejects old submissions', () => {
  const store = memory();
  let game = A.open(store);
  const r = game.startRound(math.makeProblem);
  assert.equal(r.problem.a, '1.2');
  assert.equal(game.saveDraft(r.id, { step: 2, digit: '9' }), true);
  game = A.open(store);
  assert.deepEqual(game.startRound(math.makeProblem), r);
  const receipt = game.finishRound(r.id, perfect);
  assert.equal(receipt.enemy.name, 'Moss Slime');
  assert.equal(receipt.afterHp, 0);
  assert.equal(receipt.defeated, true);
  assert.equal(game.state.stats.count, 1);
  assert.equal(game.state.xp, receipt.xp);
  game = A.open(store);
  assert.deepEqual(game.startRound(math.makeProblem).receipt, receipt);
  assert.deepEqual(game.finishRound(r.id, perfect), receipt);
  assert.equal(game.state.xp, receipt.xp);
  assert.equal(game.saveDraft(r.id, {}), false);
  const next = game.nextRound(math.makeProblem);
  assert.notEqual(next.id, r.id);
  assert.equal(game.finishRound(r.id, perfect), null);
  assert.equal(game.finishRound(next.id, { damage: Infinity }), null);
});

test('ordinary, special and boss encounters update health and recommend the next world after mastery', () => {
  const game = A.open(memory());
  const encountered = [];
  for (let i = 0; i < 9; i++) {
    const receipt = play(game);
    encountered.push(receipt.enemy.kind);
    assert.equal(game.state.regions[1].recommended, false);
  }
  assert.ok(encountered.includes('special'));
  assert.ok(encountered.includes('boss'));
  assert.ok(game.state.regions[0].bossCleared);
  const unlock = play(game);
  assert.equal(unlock.recommended, 1);
  assert.equal(unlock.unlocked, null);
  assert.ok(game.travel(1));
  const round = game.startRound(math.makeProblem);
  assert.equal(round.problem.world, 1);
  assert.equal(round.problem.a, '2.35');
});

test('legacy partial-work results and repeatedly assisted spells earn XP separately from mastery', () => {
  const game = A.open(memory());
  for (let i = 0; i < 35; i++) play(game, { fullyWorked: false, independent: false, damage: 10 });
  assert.ok(game.state.regions[0].bossCleared);
  assert.equal(game.state.regions[1].recommended, false);
  assert.ok(game.view().level > 1);
  for (let i = 0; i < 8; i++) play(game, { hints: 2 });
  assert.equal(game.view().mastered, 0);
  for (let i = 0; i < 7; i++) play(game, { hints: 1 });
  assert.equal(game.view().mastered, 7);
  assert.equal(game.state.regions[1].recommended, false);
  game.setting('mastery', 7);
  assert.equal(game.state.regions[1].recommended, true);
  assert.equal(game.state.stats.independent, 0);
});

test('errors feed future practice and parental first-try and independence metrics', () => {
  const game = A.open(memory());
  play(game, { errors: { align: 1, regroup: 3, zeros: 0 }, hints: 2 });
  let options;
  game.nextRound((_, o) => { options = o; return math.makeProblem(0, o); });
  assert.equal(options.focus, 'regroup');
  assert.deepEqual(game.state.stats, { count: 1, firstTry: 0, independent: 0, hints: 2, errors: { align: 1, regroup: 3 } });
});

test('world travel preserves drafts and starts selected world at its sample problem', () => {
  const game = A.open(memory());
  const forest = game.startRound(math.makeProblem);
  game.saveDraft(forest.id, { focus: 3 });
  assert.ok(game.travel(3));
  assert.deepEqual(game.startRound(math.makeProblem).problem, { a: '1.909', b: '2.31', op: '+', world: 3 });
  assert.equal(game.state.regions[2].unlocked, true);
  assert.equal(game.state.regions[4].unlocked, true);
  assert.ok(game.travel(0));
  assert.equal(game.startRound(math.makeProblem).id, forest.id);
  assert.deepEqual(game.state.round.draft, { focus: 3 });
});

test('coins buy cosmetic gear once, retain ownership on relaunch, and do not change damage', () => {
  const store = memory();
  const game = A.open(store);
  assert.equal(game.equip('blade'), false);
  for (let i = 0; i < 8; i++) play(game);
  const purse = game.state.coins;
  assert.equal(game.equip('staff'), true);
  assert.equal(game.state.coins, purse - 24);
  assert.equal(game.equip('wand'), true);
  assert.equal(game.equip('staff'), true);
  assert.equal(game.state.coins, purse - 24);
  game.equip('mage');
  const resumed = A.open(store);
  assert.equal(resumed.view().hero.name, 'Nova');
  assert.equal(resumed.view().weapon.id, 'staff');
  assert.equal(play(resumed).damage, 30);
});

test('mode remains stable while playing; preference applies to the next spell', () => {
  const game = A.open(memory());
  const r = game.startRound(math.makeProblem);
  assert.ok(game.setting('mode', 'challenge'));
  assert.equal(game.startRound(math.makeProblem).mode, 'guided');
  game.finishRound(r.id, perfect);
  assert.equal(game.nextRound(math.makeProblem).mode, 'challenge');
});

test('the journal groups practice after inactivity while rounds stay playable', () => {
  let time = 10000;
  const game = A.open(memory(), { now: () => time });
  play(game);
  time += 11 * 60 * 1000;
  play(game);
  assert.equal(game.state.session.count, 2);
  assert.equal(game.state.sessions.length, 0);
  time += 31 * 60 * 1000;
  play(game);
  assert.equal(game.state.sessions[0].count, 2);
  assert.equal(game.state.session.count, 1);
});

test('PIN gate retains salted proof, settings and PIN through a learning reset', async () => {
  const store = memory();
  const game = A.open(store);
  assert.equal(await game.setPin('ab12'), false);
  assert.equal(await game.setPin('2468'), true);
  assert.equal(await game.setPin('9753'), false);
  assert.equal(await game.verifyPin('2468'), true);
  game.setting('mastery', 9);
  play(game);
  const resumed = A.open(store);
  assert.equal(await resumed.verifyPin('9753'), false);
  resumed.reset();
  assert.equal(await resumed.verifyPin('2468'), true);
  assert.equal(resumed.state.stats.count, 0);
  assert.equal(resumed.state.settings.mastery, 9);
});

test('storage failure leaves play possible and exposes persistence status', () => {
  const game = A.open({ getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } });
  assert.equal(game.storageAvailable, false);
  assert.ok(play(game).defeated);
  assert.equal(game.storageAvailable, false);
});
