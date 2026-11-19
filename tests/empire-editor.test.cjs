const test = require('node:test');
const assert = require('node:assert/strict');
const adventure = require('../web/adventure.js');
const capitals = require('../web/capitals.js');
const board = require('../web/campaign-data.js');
const math = require('../web/math.js');

const key = 'decimal-dungeon.adventure.v1';
const id = code => board.NATIONS.find(n => n.code === code).id;
const point = (lon, lat) => ({x:(lon+180)*1000/360, y:(85-lat)*540/152});
function stored() {
  const pairs = new Map();
  return { getItem:k => pairs.get(k) ?? null, setItem:(k,v) => pairs.set(k,v) };
}
function setup(store = stored()) {
  const game = adventure.open(store);
  assert.ok(game.chooseCapital(id('USA')));
  return game;
}
function conquer(game, code) {
  assert.ok(game.invade(id(code)));
  while (true) {
    const round = game.nextRound(math.makeProblem);
    const r = game.finishRound(round.id, {damage:30, hints:0, errors:{}, fullyWorked:true, independent:true, answer:'4.7'});
    if (r.capture) break;
  }
  game.leaveCampaign();
}

test('all 195 city markers have a named default capital and fall on land in exactly their own holding', () => {
  for (const n of board.NATIONS) {
    const city = capitals.get(n.id);
    assert.ok(city.name && Number.isFinite(city.x) && Number.isFinite(city.y));
    assert.deepEqual(board.NATIONS.filter(other => capitals.containsPoint(other.id,city.x,city.y)).map(p=>p.code), [n.code]);
  }
  assert.equal(capitals.get(id('GNQ')).name,'Ciudad de la Paz');
  assert.equal(capitals.get(id('KAZ')).name,'Astana');
  assert.equal(capitals.get(id('CAN')).name,'Ottawa');
  assert.equal(capitals.get(id('BDI')).name,'Gitega');
  assert.equal(capitals.get(id('USA')).name,'Washington, D.C.');
  assert.match(capitals.get(id('NRU')).note,/seat of government/);
  assert.match(capitals.get(id('PSE')).note,/administrative seat/);
});

test('land placement handles offshore islands, enclaves, both sides of the dateline, and lake water', () => {
  function land(code, lon, lat) {
    const {x,y} = point(lon,lat);
    return capitals.containsPoint(id(code),x,y);
  }
  assert.equal(land('USA', -149.9, 61.22),true); // Alaska
  assert.equal(land('USA', -157.86, 21.32),true); // Oahu
  assert.equal(land('USA', -87, 44),false); // Lake Michigan
  assert.equal(land('USA', -125, 35),false); // Pacific
  const vatican = capitals.get(id('VAT'));
  assert.equal(capitals.containsPoint(id('ITA'),vatican.x,vatican.y),false);
  assert.equal(land('ZAF',27.5,-29.5),false); // Lesotho
  assert.equal(land('FJI',-179.9,-16.8),true);
  assert.equal(land('FJI',178.4,-18.1),true);
  assert.equal(land('FJI',0,-16.8),false);
  for (const invalid of [-1,1.5,400,'0']) assert.equal(capitals.containsPoint(invalid,10,10),false);
  for (const invalid of [NaN,Infinity,null,'15']) assert.equal(capitals.containsPoint(id('USA'),invalid,3),false);
});

test('local country and capital edits persist without changing identity or altering math, borders or XP', () => {
  const store=stored(), game=setup(store), usa=id('USA'), mex=id('MEX');
  conquer(game,'MEX');
  const old=game.campaignView(), xp=game.state.xp, stats=JSON.stringify(game.state.stats);
  const loc=point(-103.34,20.67); // Guadalajara
  assert.ok(game.updateCountry(mex,{countryName:"  The  Firefly  Isles ",capitalName:"Beacon Hill",...loc,seat:true}));
  const next=adventure.open(store).campaignView();
  assert.equal(next.seatId,mex);
  assert.equal(next.capitalId,usa);
  assert.deepEqual(next.frontier,old.frontier);
  assert.deepEqual(next.owned,old.owned);
  assert.equal(next.administration[mex].countryName,'The Firefly Isles');
  assert.equal(next.administration[mex].originalCountryName,'Mexico');
  assert.equal(next.administration[mex].originalCapitalName,'Mexico City');
  assert.equal(next.administration[mex].capitalName,'Beacon Hill');
  assert.equal(next.administration[mex].x,loc.x);
  assert.ok(next.administration[mex].customLocation);
  assert.equal(game.state.xp,xp);
  assert.equal(JSON.stringify(game.state.stats),stats);
  assert.equal(board.NATIONS[mex].name,'Mexico');
  assert.equal(capitals.get(mex).name,'Mexico City');
  assert.ok(game.renameCountry(mex,''));
  assert.ok(game.setCountryCapital(mex,{name:'',resetLocation:true}));
  assert.ok(game.setEmpireSeat(usa));
  const reset=game.campaignView().administration[mex];
  assert.equal(reset.countryName,'Mexico');
  assert.deepEqual([reset.x,reset.y],[reset.originalX,reset.originalY]);
  assert.equal(reset.customCapitalName,false);
  assert.equal(reset.customLocation,false);
  assert.equal(game.state.campaign.administration[mex],undefined);
});

test('partial or invalid edits fail atomically and unowned countries remain read-only', () => {
  const store=stored(), game=setup(store), usa=id('USA'), canada=id('CAN');
  const before=store.getItem(key);
  for (const fields of [{countryName:'Test',x:0,y:0,seat:true}, {capitalName:'a'.repeat(41)}, {x:NaN,y:-50},
    {x:70}, {x:Infinity,y:20}, {countryName:'A\nB'}, {capitalName:null}, {capitalName:'Hi\u202Ethere'},
    {x:220,y:105,resetLocation:true}, {seat:1}, {missing:true}]) {
    assert.equal(game.updateCountry(usa,fields),false);
    assert.equal(store.getItem(key),before);
  }
  assert.equal(game.renameCountry(canada,'Moontown'),false);
  assert.equal(game.setEmpireSeat(canada),false);
  assert.equal(game.setCountryCapital(canada,{resetLocation:true}),false);
  assert.equal(store.getItem(key),before);
  assert.equal(game.renameCountry(usa,'Étoile 🌟'),true);
  assert.equal(game.renameCountry(usa,'🌟'.repeat(40)),true);
  assert.equal(game.renameCountry(usa,'🌟'.repeat(41)),false);
});

test('older Earth saves keep ownership, home and pending battles while gaining a default seat', () => {
  const store=stored(), game=setup(store);
  conquer(game,'MEX');
  game.invade(id('CAN'));
  const active=game.startRound(math.makeProblem);
  game.saveDraft(active.id,{step:'columns',digit:'7'});
  const old=JSON.parse(store.getItem(key));
  delete old.campaign.seatId; delete old.campaign.administration;
  store.setItem(key,JSON.stringify(old));
  const restored=adventure.open(store);
  assert.equal(restored.campaignView().seatId,id('USA'));
  assert.equal(restored.campaignView().administration[id('MEX')].capitalName,'Mexico City');
  assert.deepEqual(restored.campaignView().owned,old.campaign.owned);
  assert.deepEqual(restored.state.round,old.round);
  assert.equal(restored.state.xp,old.xp);
  assert.ok(restored.setEmpireSeat(id('MEX')));
  assert.deepEqual(restored.state.round,old.round);
});
