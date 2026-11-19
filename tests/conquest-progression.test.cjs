const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../web/adventure.js');
const B = require('../web/campaign-data.js');
const math = require('../web/math.js');
const key = 'decimal-dungeon.adventure.v1';
const id = code => B.NATIONS.find(n => n.code === code).id;
function storage() {
  const pairs = new Map();
  return {getItem:key => pairs.get(key) ?? null, setItem:(key,v) => pairs.set(key,v)};
}
function setup(store = storage(), home = 'USA') {
  const game = A.open(store);
  assert.ok(game.chooseCapital(id(home)));
  game.setCampaignMath('classic');
  return game;
}
function solve(game, damage = 30) {
  const r = game.nextRound(math.makeProblem);
  return game.finishRound(r.id, {damage,hints:0,errors:{},fullyWorked:damage>=30,independent:damage>=30,
    answer:math.analyze(r.problem).answer});
}
function capture(game, target, damage = 30) {
  assert.ok(game.invade(target));
  let receipt;
  for (let i=0; i<2; i++) {
    receipt = solve(game,damage);
    if (receipt.capture) break;
  }
  assert.ok(receipt.capture);
  game.leaveCampaign();
  return receipt.capture;
}
function legacySeven(store) {
  const c = setup(store);
  c.startRound(math.makeProblem);
  const s = JSON.parse(store.getItem(key));
  delete s.combatVersion;
  for (const k of ['empireName','peakHoldings','turn','spells','lastProblem','rivals','nextRival','rivalMoves','raceGoal','winner']) {
    delete s.campaign[k];
  }
  s.campaign.owned = ['USA','CAN','MEX','CUB','BLZ','GTM','BHS'].map(id);
  s.campaign.targetId = id('JPN');
  s.campaign.inBattle = true;
  s.campaign.garrisons[id('JPN')] = {hp:90,rounds:{}}; // old 100 HP boss hit for 10
  s.round.nationId = id('JPN');
  delete s.round.campaignTier;
  s.regions[0].clears = 4;
  s.regions[0].health = 80; // old 90 HP training boss
  return s;
}

test('normal and elite defenders take one spell and bosses take at most two even at legacy minimum damage', () => {
  for (const kind of ['normal','special','boss']) {
    const target = B.NATIONS.find(n=>n.rank===kind), home = B.NATIONS[target.neighbors[0]];
    const game = setup(storage(),home.code);
    assert.ok(game.invade(target.id));
    const initial = game.campaignView().defender;
    assert.equal(initial.maxSpells,kind==='boss'?2:1);
    assert.equal(initial.spellsLeft,initial.maxSpells);
    const first = solve(game,10);
    if (kind==='boss') {
      assert.equal(first.capture,null);
      assert.equal(game.campaignView().defender.spellsLeft,1);
      assert.ok(solve(game,10).capture);
    } else assert.ok(first.capture);
    const second = setup(storage(),home.code);
    assert.ok(capture(second,target.id,30));
    assert.equal(second.state.stats.count,1);
  }
});

test('campaign ramps from tenths through genuine mixed-place regrouping and up to four-place pair spells', () => {
  const game = setup();
  const worlds = new Set(), inBands = new Map(), newTiers = [];
  while (game.campaignView().peakHoldings <= 19) {
    const c = game.campaignView();
    const neutral = c.frontier[0];
    assert.ok(game.invade(neutral));
    const round = game.startRound(math.makeProblem);
    const p = round.problem, plan = math.analyze(p);
    assert.equal(round.campaignTier,c.progression.tier);
    worlds.add(round.world);
    const seen = inBands.get(round.campaignTier) || [];
    seen.push(p);
    inBands.set(round.campaignTier,seen);
    if (round.campaignTier===1) assert.equal(plan.precision,1);
    if (round.campaignTier===2) assert.equal(plan.precision,2);
    if (round.campaignTier===3) {
      assert.equal(plan.precision,2);
      assert.ok(plan.blanks.length && plan.columns.some(col=>col.outgoing));
    }
    if (round.campaignTier>=4) assert.ok(plan.precision>=3);
    const reward = solve(game).capture;
    if (reward.newTier) newTiers.push(reward.newTier);
    assert.equal(game.state.history.at(-1).world,round.world);
    game.leaveCampaign();
    assert.equal(game.state.world,0);
  }
  assert.deepEqual([...worlds].sort(),[0,1,2,3,4,6]);
  assert.deepEqual(newTiers,[2,3,4,5,6]);
  assert.ok(inBands.get(4).some(p=>p.kind==='pair') && inBands.get(4).some(p=>p.kind!=='pair'));
  for (const tier of [5,6]) assert.ok(inBands.get(tier).some(p=>p.kind==='pair' && math.analyze(p).precision===4));
  assert.equal(game.campaignView().progression.nextAt,null);
});

test('old seven-holding saves immediately get the new schoolwork sequence, preserve real drafts and scale wounds only once', () => {
  const store=storage(), old=legacySeven(store);
  const oldDraft={stage:'columns',digit:'7'};
  old.round.draft=oldDraft;
  store.setItem(key,JSON.stringify(old));
  let game=A.open(store);
  assert.equal(game.campaignView().peakHoldings,7);
  assert.equal(game.campaignView().turn,6);
  assert.equal(game.campaignView().progression.tier,4);
  assert.equal(game.campaignView().defender.spellsLeft,1);
  assert.equal(game.state.regions[0].health,30);
  assert.deepEqual(game.startRound(math.makeProblem).draft,oldDraft);
  assert.equal(solve(game,10).capture.id,id('JPN'));
  game.leaveCampaign();
  game.invade(game.campaignView().frontier[0]);
  let r=game.startRound(math.makeProblem);
  assert.equal(r.problem.kind,'pair');
  assert.ok(math.analyze(r.problem).precision>=3);
  const hp=game.campaignView().defender.hp;
  game=A.open(store);
  assert.equal(game.campaignView().defender.hp,hp);
  assert.deepEqual(game.startRound(math.makeProblem),r);

  old.round.draft=null;
  store.setItem(key,JSON.stringify(old));
  game=A.open(store);
  r=game.startRound(math.makeProblem);
  assert.equal(r.problem.kind,'pair');
  assert.equal(game.state.stats.count,0);
});

test('higher chosen skills persist as floors, subtraction remains subtraction, and second direct school spell uses a pair', () => {
  const game = setup();
  const target = id('CAN');
  assert.ok(game.travel(5,true));
  assert.ok(game.invade(target));
  assert.equal(game.startRound(math.makeProblem).problem.op,'-');
  game.leaveCampaign();
  assert.ok(game.travel(A.SCHOOLWORK));
  const p = game.startRound(math.makeProblem).problem;
  assert.equal(p.a,'1.987');
  assert.equal(p.kind,undefined);
  solve(game);
  assert.equal(game.nextRound(math.makeProblem).problem.kind,'pair');
  game.invade(target);
  assert.equal(game.startRound(math.makeProblem).world,A.SCHOOLWORK);
});

test('rivals occupy distinct homes, follow legal edges once per capture and retain their last moves on relaunch', () => {
  const store=storage(), game=setup(store);
  assert.ok(game.setEmpireName('North Star'));
  assert.equal(game.setEmpireName('\nHidden'),false);
  assert.equal(game.addRival('north star',id('FRA')),false);
  assert.equal(game.addRival('Ruby',id('USA')),false);
  assert.ok(game.addRival('Ruby',id('MEX')));
  assert.ok(game.addRival('Sapphire',id('GBR')));
  assert.ok(game.addRival('Amber',id('JPN')));
  assert.equal(game.addRival('Fourth',id('FRA')),false);
  const before=game.campaignView();
  assert.equal(before.raceGoal,12);
  assert.equal(new Set(before.rivals.map(r=>r.color)).size,3);
  assert.equal(game.invade(id('CAN')),true);
  const partial=solve(game,10);
  assert.equal(partial.capture,null);
  assert.equal(game.campaignView().rivalMoves.length,0);
  const win=solve(game,10).capture;
  const after=game.campaignView();
  assert.equal(after.turn,1);
  assert.equal(after.rivalMoves.length,3);
  assert.equal(after.owners[id('USA')],'player');
  assert.equal(after.owners[id('CAN')],'player');
  for(const m of after.rivalMoves) {
    const founder=before.rivals.find(r=>r.id===m.rivalId);
    assert.ok(B.NATIONS[founder.homeId].neighbors.includes(m.countryId));
    assert.equal(after.owners[m.countryId],m.rivalId);
  }
  const receiptId=game.state.round.id;
  const resumed=A.open(store);
  assert.deepEqual(resumed.finishRound(receiptId,{}).capture,win);
  assert.deepEqual(resumed.campaignView().rivalMoves,after.rivalMoves);
  assert.equal(resumed.campaignView().turn,1);
});

test('a rival can take a player holding and win; the founding home is safe, the race announces once and conquest continues', () => {
  const game=setup();
  game.addRival('Ruby',id('MEX'));
  const rivalId=game.campaignView().rivals[0].id;
  let lost, victory;
  for(let turn=0;turn<15 && !victory;turn++) {
    const v=game.campaignView();
    assert.ok(v.peakHoldings>=v.claimed);
    const next=v.frontier.find(t=>!v.owners[t]);
    const cap=capture(game,next);
    const attack=cap.rivalMoves.find(m=>m.from==='player');
    if(attack) lost=attack.countryId;
    if(cap.winner) victory=cap.winner;
    assert.equal(game.campaignView().owners[id('USA')],'player');
  }
  assert.ok(Number.isInteger(lost));
  assert.equal(victory,rivalId);
  const old=game.campaignView();
  const more=capture(game,old.frontier[0]);
  assert.equal(more.winner,null);
  assert.deepEqual(more.rivalMoves,[]);
  assert.equal(game.campaignView().winner,rivalId);
  assert.ok(game.removeRival(rivalId));
  const solo=game.campaignView();
  assert.equal(solo.raceGoal,null);
  assert.equal(solo.winner,null);
  assert.equal(solo.rivals.length,0);
  assert.ok(solo.peakHoldings>=old.peakHoldings);
});

test('taking the last rival holding wins the race; remaining world stays available for solo conquest', () => {
  const game=setup();
  game.addRival('North Wind',id('CAN'));
  const rival=game.campaignView().rivals[0].id;
  const c=capture(game,id('CAN'));
  assert.equal(c.previousOwner,rival);
  assert.equal(c.winner,'player');
  assert.equal(game.campaignView().victory,false);
  const done=capture(game,id('MEX'));
  assert.equal(done.winner,null);
  assert.ok(game.campaignView().frontier.includes(id('GTM')));
});

test('losing a customized seat moves government home; recapture restores its name and preserves the difficulty peak', () => {
  const store=storage(), game=setup(store), bahamas=id('BHS'), usa=id('USA');
  assert.ok(game.addRival('Ruby',id('MEX')));
  capture(game,bahamas);
  assert.ok(game.updateCountry(bahamas,{countryName:'Lantern Isles',capitalName:'Firefly',seat:true}));
  capture(game,id('CAN'));
  const loss=capture(game,id('DNK')); // rival in Cuba can reach The Bahamas on its third turn
  assert.ok(loss.rivalMoves.some(m=>m.countryId===bahamas && m.from==='player'));
  const v=game.campaignView();
  assert.equal(v.seatId,usa);
  assert.equal(v.capitalId,usa);
  assert.equal(v.peakHoldings,4);
  assert.equal(v.claimed,3);
  assert.equal(v.progression.tier,3);
  assert.equal(game.renameCountry(bahamas,'Locked'),false);
  const restored=A.open(store);
  const receipt=capture(restored,bahamas);
  assert.equal(receipt.previousOwner,v.rivals[0].id);
  assert.equal(receipt.name,'Lantern Isles');
  assert.equal(receipt.newTier,null);
  assert.equal(restored.campaignView().administration[bahamas].capitalName,'Firefly');
  assert.equal(restored.campaignView().seatId,usa);
});
