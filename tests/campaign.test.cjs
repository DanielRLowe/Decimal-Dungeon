const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../web/adventure.js');
const board = require('../web/campaign-data.js');
const math = require('../web/math.js');
const KEY = 'decimal-dungeon.adventure.v1';

function storage() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, text) => data.set(key, text) };
}
function cast(game, damage = 10) {
  const r = game.nextRound(math.makeProblem);
  return game.finishRound(r.id, {
    damage, hints: 0, errors: {}, independent: damage > 10, fullyWorked: damage > 10, answer: math.analyze(r.problem).answer
  });
}
function win(game) {
  let receipt;
  do { receipt = cast(game, 30); } while (!receipt.capture);
  return receipt;
}
const country = code => board.NATIONS.find(n => n.code === code);
function fromHome(store = storage(), code = 'USA') {
  const game = A.open(store);
  assert.ok(game.chooseCapital(country(code).id));
  game.setCampaignMath('classic');
  return game;
}

test('195 real countries have bounded atlas anchors, detailed SVG geography and a connected route graph', () => {
  assert.equal(board.NATIONS.length, 195);
  assert.equal(new Set(board.NATIONS.map(n => n.name)).size, 195);
  assert.equal(new Set(board.NATIONS.map(n => n.code)).size, 195);
  assert.equal(new Set(board.NATIONS.map(n => n.iso2)).size, 195);
  const reached = new Set([board.CAPITAL_ID]);
  const queue = [board.CAPITAL_ID];
  while (queue.length) {
    for (const id of board.NATIONS[queue.shift()].neighbors) {
      if (!reached.has(id)) { reached.add(id); queue.push(id); }
    }
  }
  assert.equal(reached.size, 195);
  for (const [i, n] of board.NATIONS.entries()) {
    assert.equal(n.id, i);
    assert.match(n.path, /^M[\d., MZ-]+Z$/);
    assert.ok(n.x >= 0 && n.x <= board.WIDTH && n.y >= 0 && n.y <= board.HEIGHT);
    assert.ok(n.region && A.WORLDS[n.biome]);
    assert.ok(!n.neighbors.includes(n.id));
    for (const id of n.neighbors) assert.ok(board.NATIONS[id].neighbors.includes(n.id));
    for (const id of n.seaNeighbors) {
      assert.ok(n.neighbors.includes(id));
      assert.ok(board.NATIONS[id].seaNeighbors.includes(n.id));
    }
  }
  assert.ok(country('USA').x < country('GBR').x && country('GBR').x < country('CHN').x);
  assert.ok(country('CAN').y < country('USA').y && country('USA').y < country('MEX').y);
  assert.ok(country('VAT').tiny && country('MCO').tiny && country('TUV').tiny && country('PSE'));
});

test('classifies real land borders, subscale enclaves and game sea crossings separately', () => {
  for (const [a, b] of [['USA','CAN'], ['USA','MEX'], ['GBR','IRL'], ['FRA','BRA'], ['ITA','VAT'],
      ['ESP','MAR'], ['CAN','DNK'], ['BWA','ZMB'], ['CHN','MNG'], ['KEN','TZA']]) {
    assert.ok(country(a).neighbors.includes(country(b).id), a + ' to ' + b);
    assert.ok(!country(a).seaNeighbors.includes(country(b).id));
  }
  for (const [a, b] of [['USA','JPN'], ['USA','CUB'], ['CAN','GBR'], ['BRA','SEN'], ['AUS','NZL'], ['AUS','IDN']]) {
    assert.ok(country(a).seaNeighbors.includes(country(b).id), a + ' to ' + b);
  }
});

test('home country is explicitly chosen once and persists across launch', () => {
  const store = storage();
  const game = A.open(store);
  assert.equal(game.campaignView().needsCapital, true);
  assert.equal(game.campaignView().claimed, 0);
  assert.deepEqual(game.campaignView().frontier, []);
  assert.equal(game.invade(country('CAN').id), false);
  assert.equal(game.chooseCapital(-1), false);
  assert.ok(game.chooseCapital(country('PHL').id));
  assert.equal(game.chooseCapital(country('USA').id), false);
  const current = A.open(store).campaignView();
  assert.equal(current.needsCapital, false);
  assert.equal(current.capitalId, country('PHL').id);
  assert.deepEqual(current.owned, [country('PHL').id]);
  assert.ok(current.frontier.includes(country('PLW').id));
});

test('map selects border-sharing defenders and keeps the math track independent of geography', () => {
  const game = fromHome();
  const map = game.campaignView();
  assert.equal(game.state.screen, 'campaign');
  assert.equal(map.claimed, 1);
  assert.deepEqual(map.owned, [board.CAPITAL_ID]);
  assert.deepEqual(map.frontier, board.NATIONS[board.CAPITAL_ID].neighbors);
  assert.equal(game.invade(0), false);
  assert.equal(game.invade(board.CAPITAL_ID), false);
  assert.equal(game.invade('4'), false);
  const target = map.frontier.find(i => board.NATIONS[i].biome !== game.state.world);
  assert.ok(game.invade(target));
  assert.equal(game.state.screen, 'battle');
  const v = game.view();
  const n = board.NATIONS[target];
  assert.equal(v.nation.id, n.id);
  assert.equal(v.biomeIndex, n.biome);
  assert.equal(v.world, A.WORLDS[0]);
  assert.deepEqual(v.enemy, map.defenders[target]);
  assert.equal(game.startRound(math.makeProblem).world, 0);
  assert.equal(game.state.round.problem.world, 0);
});

test('campaign defenders cover every original monster sprite used by the practice worlds', () => {
  const map = fromHome().campaignView();
  const practiceNames = A.WORLDS.flatMap(w => [...w.monsters, w.special, w.boss]);
  const practiceArt = new Set(practiceNames.map(name => A.MONSTER_ART[name]));
  const campaignArt = new Set(Object.values(map.defenders).map(d => A.MONSTER_ART[d.name]));
  assert.ok(!practiceArt.has(undefined) && !campaignArt.has(undefined));
  assert.deepEqual(campaignArt, practiceArt);
  assert.ok(Object.values(map.defenders).some(d => d.name === 'Moon Moth'));
  assert.ok(Object.values(map.defenders).some(d => d.name === 'The Rune Keeper'));
  for (const sprite of practiceArt) {
    // Whichever country is selected as home, each sprite has a playable opponent.
    assert.ok(Object.values(map.defenders).filter(d => A.MONSTER_ART[d.name] === sprite).length >= 2);
  }
});

test('damaged holdings, training and different targets each keep their own work across relaunch', () => {
  const store = storage();
  let game = fromHome(store);
  const training = game.startRound(math.makeProblem);
  game.saveDraft(training.id, { stage: 'columns', digit: '3' });
  const a = country('CAN').id, b = country('MEX').id;
  game.invade(a);
  const hit = cast(game);
  assert.equal(hit.capture, null);
  const pending = game.nextRound(math.makeProblem);
  game.saveDraft(pending.id, { stage: 'columns', digit: '7' });
  assert.ok(game.invade(b));
  const other = game.startRound(math.makeProblem);
  game.saveDraft(other.id, { stage: 'align', shift: 0 });
  game.leaveCampaign();
  assert.equal(game.state.screen, 'campaign');
  assert.equal(game.state.round.id, training.id);
  assert.equal(game.state.round.draft.digit, '3');
  game = A.open(store);
  assert.equal(game.campaignView().defenders[a].hp, hit.afterHp);
  assert.equal(game.campaignView().defenders[b].hp, game.campaignView().defenders[b].maxHp);
  assert.ok(game.invade(a));
  assert.equal(game.state.round.id, pending.id);
  assert.equal(game.state.round.draft.digit, '7');
  assert.equal(game.view().enemy.hp, hit.afterHp);
  game.setScreen('campaign');
  game = A.open(store);
  assert.equal(game.state.screen, 'campaign');
  assert.equal(game.campaignView().targetId, a);
  game.invade(a);
  assert.equal(game.state.round.id, pending.id);
  game.travel(0);
  assert.equal(game.state.round.id, training.id);
  game.invade(b);
  assert.equal(game.state.round.id, other.id);
  assert.equal(game.state.round.draft.shift, 0);
});

test('practice-world changes preserve partial solutions at each difficulty and never heal a garrison', () => {
  const game = fromHome();
  const target = country('CAN').id; // wounded boss keeps the draft at each selected skill
  game.invade(target);
  const hit = cast(game);
  const tenths = game.nextRound(math.makeProblem);
  game.saveDraft(tenths.id, { stage: 'estimate' });
  game.travel(3, true);
  game.invade(target);
  assert.equal(game.view().enemy.hp, hit.afterHp);
  const thousandths = game.startRound(math.makeProblem);
  assert.equal(thousandths.world, 3);
  assert.equal(thousandths.problem.a, '1.909');
  game.saveDraft(thousandths.id, { stage: 'zeros' });
  game.travel(0);
  game.invade(target);
  assert.equal(game.state.round.id, tenths.id);
  assert.deepEqual(game.state.round.draft, { stage: 'estimate' });
  game.travel(3);
  game.invade(target);
  assert.deepEqual(game.state.round.draft, { stage: 'zeros' });
});

test('claim is atomic and explicit, expanding the frontier without awarding a second victory', () => {
  const store = storage();
  let game = fromHome(store);
  const target = country('MEX').id;
  const beyond = board.NATIONS[target].neighbors.find(id => !game.campaignView().frontier.includes(id) && id !== board.CAPITAL_ID);
  assert.equal(game.invade(beyond), false);
  game.invade(target);
  const won = win(game);
  const { xp, coins, serial } = game.state;
  assert.deepEqual(won.capture, { id: target, eraId:'modern', empireId:'player', name: 'Mexico', victory: false, opened: [country('BLZ').id, country('GTM').id],
    peakHoldings:2, newTier:2, previousOwner:null, rivalMoves:[], winner:null });
  assert.equal(game.campaignView().defenders[target].hp, 0);
  assert.ok(game.campaignView().frontier.includes(beyond));
  assert.equal(game.state.regions[0].clears, 0);
  game = A.open(store);
  assert.deepEqual(game.nextRound(math.makeProblem).receipt, won);
  assert.deepEqual(game.finishRound(serial, { damage: 10 }), won);
  assert.equal(game.invade(target), false);
  assert.equal(game.state.xp, xp);
  assert.equal(game.state.coins, coins);
  assert.equal(game.state.serial, serial);
  game.leaveCampaign();
  assert.equal(game.campaignView().targetId, null);
  assert.equal(game.finishRound(serial, { damage: 10 }), null);
  assert.equal(game.invade(beyond), true);
});

test('all 194 countries can be conquered with increasing campaign skills and a persistent final victory', () => {
  const store = storage();
  const game = fromHome(store);
  const kinds = new Set();
  let final;
  while (!game.campaignView().victory) {
    const { owned, frontier, claimed } = game.campaignView();
    assert.equal(owned.length, claimed);
    assert.ok(game.invade(frontier[0]));
    kinds.add(game.view().enemy.kind);
    final = win(game);
    assert.equal(game.campaignView().claimed, claimed + 1);
    assert.equal(game.state.world, 0);
    assert.equal(final.capture.victory, claimed === 194);
    game.leaveCampaign();
  }
  assert.deepEqual([...kinds].sort(), ['boss','normal','special']);
  assert.ok(final.capture.victory);
  const resumed = A.open(store);
  assert.deepEqual(resumed.campaignView().frontier, []);
  assert.equal(resumed.campaignView().claimed, 195);
  assert.equal(resumed.campaignView().victory, true);
  assert.equal(resumed.campaignView().progression.tier, 6);
  assert.ok(resumed.state.regions[0].stats.count > 0 && resumed.state.regions[A.SCHOOLWORK].stats.count > 0);
  assert.equal(resumed.state.world, 0);
  resumed.reset();
  assert.deepEqual(resumed.campaignView().owned, []);
  assert.equal(resumed.state.screen, 'campaign');
});

test('the original save upgrades in place without touching training work, settings, or rewards', () => {
  const store = storage();
  let game = A.open(store);
  game.startRound(math.makeProblem);
  function asLegacy() {
    const old = JSON.parse(store.getItem(KEY));
    delete old.campaign; delete old.screen; delete old.round.nationId;
    store.setItem(KEY, JSON.stringify(old));
    return old;
  }
  const untouched = asLegacy();
  game = A.open(store);
  assert.equal(game.state.screen, 'campaign');
  assert.deepEqual(game.state.round, untouched.round);
  game.saveDraft(game.state.round.id, { digit: '4' });
  game.setting('mode', 'challenge');
  game.equip('mage');
  const old = asLegacy();
  const migrated = A.open(store);
  assert.equal(migrated.state.screen, 'battle');
  assert.deepEqual(migrated.state.round, old.round);
  assert.deepEqual(migrated.state.settings, old.settings);
  assert.deepEqual(migrated.state.stats, old.stats);
  assert.equal(migrated.state.hero, old.hero);
  assert.deepEqual(migrated.campaignView().owned, []);
});

test('a six-region save keeps conquest progress and drafts when Schoolwork is added', () => {
  const store = storage();
  let game = fromHome(store);
  const canada = country('CAN').id;
  assert.ok(game.invade(canada));
  cast(game, 10);
  const round = game.nextRound(math.makeProblem);
  game.saveDraft(round.id, {digit: '1'});
  const legacy = JSON.parse(store.getItem(KEY));
  legacy.regions.length = 6;
  legacy.settings.sessionMinutes = 5;
  store.setItem(KEY, JSON.stringify(legacy));
  game = A.open(store);
  assert.equal(game.campaignView().targetId, canada);
  const hp = game.campaignView().defender.hp;
  assert.equal(game.state.stats.count, 1);
  assert.equal(game.state.settings.sessionMinutes, undefined);
  assert.ok(game.travel(A.SCHOOLWORK));
  assert.equal(game.state.regions.filter(r => r.unlocked).length, A.WORLDS.length);
  assert.equal(math.operands(game.startRound(math.makeProblem).problem).length, 3);
  assert.ok(game.invade(canada));
  assert.equal(math.operands(game.startRound(math.makeProblem).problem).length, 3);
  assert.equal(game.campaignView().defender.hp, hp);
  assert.ok(game.travel(0));
  assert.ok(game.invade(canada));
  assert.deepEqual(game.startRound(math.makeProblem), round);
  assert.deepEqual(game.state.round.draft, {digit:'1'});
});
