'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const adventure=require('../web/adventure.js');
const math=require('../web/math.js');
const board=require('../web/campaign-data.js');
const id=code=>board.NATIONS.find(n=>n.code===code).id;
const key='decimal-dungeon.adventure.v1';
function store() {
  const data=new Map();
  return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
}
function units() {
  const storage=store(),game=adventure.open(storage);
  game.chooseCapital(id('USA'));
  game.setCampaignMath('classic');
  return {game,storage};
}
function add(game,name,code,control='manual') {
  assert.ok(game.addRival(name,id(code),control));
  return game.campaignView().empires.find(r=>r.name===name).id;
}
function round(game) { return game.nextRound(math.makeProblem); }
function solve(game,damage=30) {
  const r=round(game);
  return game.finishRound(r.id,{damage,fullyWorked:true,independent:true,errors:{},hints:0,answer:'verified'});
}
function capture(game,code) {
  assert.ok(game.invade(id(code)));
  let win=solve(game).capture;
  if(!win)win=solve(game).capture;
  assert.ok(win,code+' was not acquired');
  return win;
}

test('human empires have independent homes, border access, holdings, administration and victory credit',()=>{
  const {game,storage}=units(),red=add(game,'Red River','MEX'),blue=add(game,'Blue River','FRA');
  assert.equal(game.campaignView().activeEmpireId,'player');
  assert.equal(game.invade(id('GTM')),false);
  assert.ok(game.switchEmpire(red));
  let v=game.campaignView();
  assert.equal(v.activeEmpire.id,red);
  assert.equal(v.capitalId,id('MEX'));
  assert.equal(v.seatId,id('MEX'));
  assert.deepEqual(v.frontier,board.NATIONS[id('MEX')].neighbors);
  assert.equal(game.invade(id('CAN')),false);
  assert.ok(game.setEmpireName('Rio Verde'));
  assert.equal(game.setEmpireName('Blue River'),false);
  const cap=capture(game,'GTM');
  assert.equal(cap.empireId,red);
  assert.deepEqual(cap.rivalMoves,[]);
  assert.ok(game.updateCountry(id('GTM'),{countryName:'Highlands',seat:true}));
  assert.ok(game.switchEmpire('player'));
  v=game.campaignView();
  assert.deepEqual(v.owned,[id('USA')]);
  assert.equal(v.owners[id('GTM')],red);
  assert.deepEqual(v.empires.find(r=>r.id===blue).owned,[id('FRA')]);
  assert.equal(game.renameCountry(id('GTM'),'Elsewhere'),false);
  const loaded=adventure.open(storage);
  assert.ok(loaded.switchEmpire(red));
  assert.equal(loaded.campaignView().empireName,'Rio Verde');
  assert.equal(loaded.campaignView().seatId,id('GTM'));
  assert.equal(loaded.campaignView().administration[id('GTM')].countryName,'Highlands');
  const won=capture(loaded,'USA');
  assert.equal(won.previousOwner,'player');
  assert.equal(won.winner,null,'Another manual empire still holds France');
  assert.equal(loaded.campaignView().empires.find(r=>r.id==='player').seatId,null);
  assert.equal(loaded.switchEmpire('player'),false);
  assert.deepEqual(adventure.open(storage).campaignView().empires.find(r=>r.id==='player').owned,[]);
  assert.equal(adventure.open(storage).campaignView().empires.find(r=>r.id==='player').seatId,null);
});

test('two humans attacking the same boss retain different written answers, remaining health and exact receipt across restart',()=>{
  const env=units();let game=env.game;
  const blue=add(game,'Blue Coast','DNK');
  assert.ok(game.invade(id('CAN')));
  assert.equal(solve(game,10).capture,null);
  const mine=round(game);
  game.saveDraft(mine.id,{owner:'first',carry:1});
  assert.equal(game.campaignView().defender.hp,10);
  assert.ok(game.switchEmpire(blue));
  assert.ok(game.invade(id('CAN')));
  assert.equal(game.campaignView().defender.hp,20);
  const theirs=round(game);
  assert.notEqual(theirs.id,mine.id);
  game.saveDraft(theirs.id,{owner:'second',place:3});
  game=adventure.open(env.storage);
  assert.equal(game.campaignView().activeEmpireId,blue);
  assert.deepEqual(game.state.round.draft,{owner:'second',place:3});
  assert.ok(game.resumeLesson(mine.lessonSessionId,mine.id));
  assert.equal(game.campaignView().activeEmpireId,'player');
  assert.equal(game.campaignView().defender.hp,10);
  assert.equal(game.state.round.id,mine.id);
  assert.deepEqual(game.state.round.draft,{owner:'first',carry:1});
  const win=solve(game,10).capture;
  assert.equal(win.empireId,'player');
  assert.ok(game.switchEmpire(blue));
  assert.equal(game.startRound(math.makeProblem).id,theirs.id);
  assert.deepEqual(game.state.round.draft,{owner:'second',place:3});
  assert.equal(game.campaignView().defender.hp,20,'A new flag replaces the defeated garrison');
  const secondWin=solve(game).capture;
  assert.equal(secondWin.empireId,blue);
  assert.equal(secondWin.previousOwner,'player');
  const stats=game.state.stats.count,xp=game.state.xp;
  game=adventure.open(env.storage);
  assert.deepEqual(game.finishRound(theirs.id,{}).capture,secondWin);
  assert.deepEqual([game.state.stats.count,game.state.xp],[stats,xp]);
  assert.equal(game.campaignView().turn,2);
  assert.equal(game.lessonView().sessions.flatMap(r=>r.history).find(r=>r.roundId===theirs.id).empireId,blue);
});

test('manual and automatic empires coexist; the original automatic mode can be converted and saved',()=>{
  const {game,storage}=units();
  const manual=add(game,'Blue','DNK'),cpu=add(game,'Green','FRA','ai');
  assert.equal(game.switchEmpire(cpu),false);
  assert.equal(game.setEmpireControl('player','ai'),false);
  const first=capture(game,'MEX');
  assert.deepEqual(first.rivalMoves.map(m=>m.rivalId),[cpu]);
  assert.deepEqual(game.campaignView().empires.find(r=>r.id===manual).owned,[id('DNK')]);
  assert.ok(game.setEmpireControl(cpu,'manual'));
  assert.ok(game.switchEmpire(cpu));
  assert.equal(game.setEmpireControl(cpu,'ai'),false);
  assert.equal(game.removeRival(cpu),false);
  const v=game.campaignView(),target=v.frontier.find(i=>!v.owners[i]);
  assert.ok(game.invade(target));
  assert.deepEqual(solve(game).capture.rivalMoves,[]);
  assert.equal(adventure.open(storage).campaignView().activeEmpireId,cpu);
  assert.ok(game.switchEmpire(manual));
  assert.ok(game.setEmpireControl(cpu,'ai'));
  assert.equal(game.switchEmpire(cpu),false);
});

test('a manual empire wins the race by taking the last other holding, independently of the device owner',()=>{
  const {game}=units(),manual=add(game,'Red','MEX');
  game.switchEmpire(manual);
  const cap=capture(game,'USA');
  assert.equal(cap.empireId,manual);
  assert.equal(cap.winner,manual);
  assert.equal(cap.previousOwner,'player');
  assert.equal(game.campaignView().winner,manual);
  assert.equal(game.campaignView().victory,false);
  assert.equal(capture(game,'GTM').winner,null);
});

test('existing AI saves are imported as AI and the active manual side and unfinished country survive era switches',()=>{
  const env=units();let game=env.game;
  assert.ok(game.addRival('Legacy rival',id('MEX')));
  let saved=JSON.parse(env.storage.getItem(key));
  delete saved.campaign.activeEmpireId;
  delete saved.campaign.empireTurns;
  for(const r of saved.campaign.rivals) for(const field of ['control','seatId','administration','peakHoldings','lastProblem','spells']) delete r[field];
  env.storage.setItem(key,JSON.stringify(saved));
  game=adventure.open(env.storage);
  const old=game.campaignView().rivals[0];
  assert.equal(old.control,'ai');
  assert.equal(game.campaignView().activeEmpireId,'player');
  assert.ok(game.setEmpireControl(old.id,'manual'));game.switchEmpire(old.id);
  game.invade(id('GTM'));
  const original=round(game);game.saveDraft(original.id,{written:'modern manual'});
  game.switchEra('ww1');
  assert.equal(game.campaignView().activeEmpireId,'player');
  assert.deepEqual(game.campaignView().rivals,[]);
  game.chooseCapital(0);
  assert.ok(game.addRival('1914 side',1,'manual'));
  const historical=game.campaignView().rivals[0];
  assert.ok(game.switchEmpire(historical.id));
  const destination=game.campaignView().frontier.find(i=>i!==0);
  assert.ok(game.invade(destination));
  const past=round(game);game.saveDraft(past.id,{written:'historical manual'});
  game=adventure.open(env.storage);
  assert.equal(game.campaignView().activeEmpire.name,'1914 side');
  assert.ok(game.resumeLesson(original.lessonSessionId,original.id));
  assert.equal(game.campaignView().activeEmpire.name,'Legacy rival');
  assert.equal(game.campaignView().eraId,'modern');
  assert.deepEqual(game.state.round.draft,{written:'modern manual'});
  assert.ok(game.resumeLesson(past.lessonSessionId,past.id));
  assert.equal(game.campaignView().eraId,'ww1');
  assert.deepEqual(game.state.round.draft,{written:'historical manual'});
});

test('a learner can finish stranded schoolwork after another human takes the connecting border or an empire is removed',()=>{
  const {game}=units();
  const red=add(game,'Belize','BLZ');
  capture(game,'MEX');
  game.leaveCampaign();
  game.invade(id('GTM'));
  const work=round(game);
  game.saveDraft(work.id,{estimate:'six'});
  game.switchEmpire(red);
  assert.equal(capture(game,'MEX').previousOwner,'player');
  game.leaveCampaign();
  game.invade(id('HND'));
  const redTask=round(game);
  game.saveDraft(redTask.id,{estimate:'three'});
  game.switchEmpire('player');
  assert.equal(game.campaignView().inBattle,false);
  assert.ok(!game.campaignView().frontier.includes(id('GTM')));
  assert.ok(game.resumeLesson(work.lessonSessionId,work.id));
  assert.deepEqual(game.state.round.draft,{estimate:'six'});
  assert.equal(game.state.round.nationId,null);
  assert.equal(solve(game).capture,null);
  assert.equal(game.campaignView().turn,2);
  assert.ok(game.removeRival(red));
  assert.ok(game.resumeLesson(redTask.lessonSessionId,redTask.id));
  assert.deepEqual(game.state.round.draft,{estimate:'three'});
  assert.equal(game.state.round.nationId,null);
  assert.equal(solve(game).capture,null);
  assert.equal(game.campaignView().turn,2);
});
