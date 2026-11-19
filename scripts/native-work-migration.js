// The screenshot's second sum already has equal decimal lengths. This second
// example makes the player supply a new placeholder on both additions.
const key='decimal-dungeon.adventure.v1';
const save=()=>JSON.parse(DungeonNativeStorage.getItem(key));
const $=s=>document.querySelector(s);
const assert=(ok,message)=>{ if(!ok) throw Error(message); };

if(pass===0) {
  $('#battle-nav').click();
  const legacy=save(),p=legacy.round.problem;
  legacy.round.draft={
    signature:[p.world,p.a,p.op,p.b].join('/'),stage:'quick',beforeQuick:'align',
    final:'4.7',pos:0,shift:1,shifts:[0,1],steps:{},zeros:{},hints:0,errors:{}
  };
  DungeonNativeStorage.setItem(key,JSON.stringify(legacy));
  return 'Prepared an old answer-only draft with the correct unearned answer';
}
if(pass===1) {
  nativeMath.expectStage('align');
  assert(!nativeMath.field('final')&&!save().round.receipt,'Legacy answer-only entry skipped the arithmetic');
  nativeMath.solveOrdinary(save().round.problem);
  assert(save().stats.count===1 && save().round.receipt.fullyWorked,'Legacy exercise must earn credit by showing the work');
  $('[data-panel="map"]').click();
  $('dialog[open] [data-world="6"]').click();
  const pending=save();
  pending.round.problem={a:'1.9',b:'2.31',c:'0.006',op:'+',kind:'pair',world:6,offset:1};
  pending.round.draft=null;
  DungeonNativeStorage.setItem(key,JSON.stringify(pending));
  return 'Old direct answer remapped to the first required step; full ordinary practice credited once';
}
nativeMath.expectStage('pair');
for(const index of [1,0]) $('[data-action="pick-addend"][data-index="'+index+'"]').click();
nativeMath.check();
for(const [leg,digits,answer] of [
  [1,[['hundredths',1,0],['tenths',2,1],['ones',4,0]],'4.21'],
  [2,[['thousandths',6,0],['hundredths',1,0],['tenths',2,0],['ones',4,0]],'4.216']
]) {
  assert($('[data-pair-leg="'+leg+'"]'),'Unexpected addition leg');
  nativeMath.align();
  nativeMath.expectStage('zeros');
  const input=$('#workbench [data-field^="z"]');
  assert(input,'This pair needs a placeholder in each leg');
  nativeMath.set(input.dataset.field,1);
  nativeMath.check();
  nativeMath.expectStage('zeros');
  nativeMath.zeros(1);
  for(const [place,digit,carry] of digits) {
    nativeMath.expectColumn(place);
    nativeMath.writeColumn(digit,carry);
  }
  nativeMath.expectStage(leg===1?'subtotal':'answer');
  nativeMath.pressReturn(nativeMath.set(leg===1?'subtotal':'final',answer));
}
nativeMath.estimate(DungeonMath.analyze(save().round.problem));
assert(save().round.receipt?.answer==='4.216' && save().round.receipt.fullyWorked && save().stats.count===2,
  'Grouped sum with two incorrectly attempted placeholder stages was not credited exactly once');
return 'Two independently required zero-padding steps rejected incorrect digits and accepted both completed stacks';
