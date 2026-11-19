// A child returning to a seven-country campaign can add rivals, group decimals, and
// carry the same puzzle across a launch. All state in this scenario is isolated.
const $ = selector => document.querySelector(selector);
const saveKey = 'decimal-dungeon.adventure.v1';
const save = () => JSON.parse(DungeonNativeStorage.getItem(saveKey));
const campaign = () => DungeonAdventure.open().campaignView();
const country = code => DungeonCampaign.NATIONS.find(n => n.code === code);
const pressReturn = target => target.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true, cancelable:true}));
function assert(value, message) { if (!value) throw Error(message); }
function click(selector) {
  const button = $(selector);
  assert(button?.getClientRects().length && !button.disabled, 'Unavailable control ' + selector);
  button.click();
}
function set(selector, value) {
  const control = $(selector);
  assert(control && !control.disabled, 'Unavailable field ' + selector);
  control.value = value;
  control.dispatchEvent(new Event('input', {bubbles:true}));
  control.dispatchEvent(new Event('change', {bubbles:true}));
}

if (pass === 0) {
  set('[data-pick]', country('USA').id);
  click('[data-home]');
  const legacy = save();
  legacy.campaign.owned = ['USA','MEX','GTM','BLZ','CAN','CUB','BHS'].map(code => country(code).id);
  delete legacy.combatVersion;
  for (const key of ['peakHoldings','turn','rivals','winner','raceGoal','rivalMoves','empireName','spells','lastProblem','nextRival']) delete legacy.campaign[key];
  DungeonNativeStorage.setItem(saveKey, JSON.stringify(legacy));
  return 'Prepared an isolated seven-country empire from an earlier save format';
}

if (pass === 1) {
  set('[data-campaign-math-mode]','classic');
  let v = campaign();
  assert(v.claimed === 7 && v.peakHoldings >= 7 && v.progression.tier >= 4, 'Seven existing countries should already unlock harder math');
  click('[data-empires]');
  set('[data-player-empire-name]', 'Copper Empire');
  click('[data-save-player-empire]');
  for (const [name, code] of [['Jade Empire','CHN'], ['Indigo Empire','FRA']]) {
    if (!$('[data-rival-name]')?.getClientRects().length) click('[data-empires]');
    set('[data-rival-name]', name);
    set('[data-rival-home]', country(code).id);
    click('[data-new-control][value="ai"]');
    click('[data-add-rival]');
  }
  if ($('[data-empires-close]')?.getClientRects().length) click('[data-empires-close]');
  v = campaign();
  assert(v.empireName === 'Copper Empire' && v.rivals.length === 2, 'Named empires did not join the existing map');
  assert(v.owned.length === 7 && new Set(v.rivals.map(r => r.color)).size === 2, 'Each rival needs its own color and country');
  for (const r of v.rivals) {
    const shape = $('[data-territory-id="' + r.homeId + '"]');
    assert(shape?.dataset.owner === r.id, 'Actual map ownership should identify the rival');
  }
  const start = v.frontier.find(id => v.nations[id].rank === 'normal');
  set('[data-pick]', start);
  const promised = nativeAtlas.dossierTitle();
  click('[data-invade]');
  nativeAtlas.checkDossier(promised);
  nativeAtlas.openPreview(campaign());
  set('[data-pick]', start);
  click('[data-resume]');
  for (let i = 0; i < 8; i++) {
    const round = save().round;
    if (round.problem.kind === 'pair') {
      nativeMath.expectStage('pair');
      click('[data-action="pick-addend"][data-index="0"]');
      click('[data-action="pick-addend"][data-index="1"]');
      click('[data-action="check"]');
      nativeMath.expectStage('align');

      // Model the exact earlier desktop screen. The old draft offered an immediate
      // subtotal box and had no verified columns; preserve the learner's chosen pair.
      const legacy = save();
      const p = legacy.round.problem = {...round.problem, a:'9.86',b:'9.9429',c:'13.3571',op:'+',kind:'pair'};
      legacy.round.draft = {
        signature:[p.world,p.a,p.op,p.b,p.c,'pair'].join('/'), stage:'subtotal',
        confirmedPair:'0,1', pair:[0,1], subtotal:'19.8029', final:'', pos:0,
        hints:0, errors:{}, stepHints:{}, zeros:{}, steps:{},
        shift:1, shifts:[0,1,-1], digit:'', transfer:'', rounded:['','',''], guess:null
      };
      DungeonNativeStorage.setItem('race-test-group', JSON.stringify({round:round.id,target:round.nationId,
        turn:campaign().turn,solved:legacy.stats.count,xp:legacy.xp,coins:legacy.coins}));
      DungeonNativeStorage.setItem(saveKey, JSON.stringify(legacy));
      return 'A returning seven-country empire added two rivals and resumed its legacy screenshot problem';
    }
    assert(round.problem.world >= 2, 'Campaign dropped back to introductory tenths');
    nativeMath.solveOrdinary(round.problem);
    assert(document.activeElement === $('#workbench .next'), 'Return cannot continue from the result');
    pressReturn(document.activeElement);
  }
  throw Error('Three-addend grouping did not appear in a returning seven-country campaign');
}

const previous = JSON.parse(DungeonNativeStorage.getItem('race-test-group'));
const demandNoReward = () => {
  const state = save();
  assert(state.round.id === previous.round && !state.round.receipt && state.stats.count === previous.solved &&
    state.xp === previous.xp && state.coins === previous.coins && campaign().turn === previous.turn,
    'Partial grouped work must not finish a battle, grant rewards, or advance rivals');
};
const leg = n => assert($('[data-pair-leg="' + n + '"]'), 'Expected grouped addition leg ' + n);
function col(place,digit,carry=0) {
  nativeMath.expectColumn(place);
  nativeMath.writeColumn(digit,carry);
}

if (pass === 2) {
  nativeAtlas.panels('decimal-pairs');
  await nativeAtlas.openReport('decimal-pairs');
  demandNoReward();
  leg(1);
  nativeMath.expectStage('align');
  assert(!$('[data-field="subtotal"]') && !$('[data-field="final"]'), 'Legacy draft bypassed the first written addition');
  nativeMath.check();
  nativeMath.expectStage('align');
  nativeMath.align();
  assert(save().round.draft.pair.join(',') === '0,1', 'Migration changed the two chosen addends');
  nativeMath.expectStage('zeros');
  nativeMath.check();
  nativeMath.expectStage('zeros');
  nativeMath.zeros(2); // 9.86 becomes 9.8600.
  col('ten-thousandths','9');
  col('thousandths','2');
  nativeMath.expectColumn('hundredths');
  nativeMath.writeColumn('0');
  nativeMath.expectColumn('hundredths');
  assert(nativeMath.field('digit').value === '0', 'A missing carry discarded the learner’s entry');
  nativeMath.set('transfer','1');
  demandNoReward();
  return 'Legacy screenshot selection preserved; first pair aligned and padded, with its hundredths carry saved';
}

if (pass === 3) {
  demandNoReward();
  leg(1);
  nativeMath.expectColumn('hundredths');
  assert(nativeMath.field('digit').value === '0' && nativeMath.field('transfer').value === '1',
    'First-leg digit or carry was lost during relaunch');
  nativeMath.pressReturn(nativeMath.field('transfer'));
  col('tenths','8',1);
  col('ones','9',1);
  col('tens','1');
  nativeMath.expectStage('subtotal');
  nativeMath.pressReturn(nativeMath.set('subtotal','19.803'));
  nativeMath.expectStage('subtotal');
  nativeMath.pressReturn(nativeMath.set('subtotal','19.8029'));
  leg(2);
  nativeMath.expectStage('align');
  assert(!$('[data-field="final"]'), 'A correct subtotal bypassed the second written addition');
  nativeMath.check();
  nativeMath.expectStage('align');
  nativeMath.align(); // Both the subtotal and the remaining number already have four decimal places.
  nativeMath.expectColumn('ten-thousandths');
  nativeMath.writeColumn('0');
  nativeMath.expectColumn('ten-thousandths');
  nativeMath.set('transfer','1');
  demandNoReward();
  return 'First sum 19.8029 verified in all six places; second addition aligned and its first carry saved';
}

if (pass === 4) {
  demandNoReward();
  leg(2);
  nativeMath.expectColumn('ten-thousandths');
  assert(nativeMath.field('digit').value === '0' && nativeMath.field('transfer').value === '1',
    'The last addend or pending second-leg carry was lost across relaunch');
  nativeMath.pressReturn(nativeMath.field('transfer'));
  col('thousandths','0',1);
  col('hundredths','6');
  col('tenths','1',1);
  col('ones','3',1);
  col('tens','3');
  nativeMath.expectStage('answer');
  nativeMath.pressReturn(nativeMath.set('final','33.15'));
  nativeMath.expectStage('answer');
  nativeMath.pressReturn(nativeMath.set('final','33.1600'));
  demandNoReward();
  nativeMath.expectStage('estimate');
  assert(document.querySelectorAll('#workbench [data-field^="rounded"]').length === 3, 'Estimate must include all three original addends');
  for (const [i,value] of [10,10,13].entries()) nativeMath.set('rounded'+i,value);
  click('[data-guess="33"]');
  nativeMath.pressReturn(nativeMath.field('rounded2'));
  const result = save().round.receipt;
  assert(result?.capture?.id === previous.target && result.fullyWorked && result.baseDamage === 35,
    'Checking both written additions and the estimate should earn one full-power conquest');
  assert(save().stats.count === previous.solved + 1 && campaign().turn === previous.turn + 1, 'A grouped problem counted more than once');
  const next = $('#workbench .next');
  assert(document.activeElement === next && next.innerText.includes('Battle for'), 'Result must focus and name the next campaign battle');
  if ($('#victory-film')?.open) click('#skip-victory');
  const details = $('#workbench details.worked-sums');
  assert(details, 'Missing written-work receipt');
  details.querySelector('summary').click();
  assert(details.open, 'The Show my work receipt could not be opened');
  const sections = Array.from(details.querySelectorAll('section'));
  const expected = ['9.86 + 9.9429 = 19.8029','19.8029 + 13.3571 = 33.1600'];
  const places = ['ten-thousandths','thousandths','hundredths','tenths','ones','tens'];
  assert(sections.length === 2, 'The receipt should display both additions');
  for (const [index,section] of sections.entries()) {
    assert(section.querySelector('.equation').textContent === expected[index], 'Incorrect worked equation in receipt');
    const rows = Array.from(section.querySelectorAll('ol li'));
    assert(rows.length === 6 && rows.every((row,i) => row.textContent.toLowerCase().includes(places[i])),
      'The receipt must show six right-to-left places for each addition');
  }
  return 'All twelve columns, both exact sums, three-addend estimate, and expanded written-work receipt verified';
}

assert(pass === 5 && save().round.id === previous.round && save().round.receipt?.fullyWorked, 'The completed result was not restored');
assert(save().stats.count === previous.solved + 1, 'Reload replayed the grouped reward');
const updated = campaign();
assert(updated.turn === previous.turn+1 && updated.rivals.every(r => r.owned.length > 1), 'Both rivals should take their own turn after the conquest');
const next = $('#workbench .next');
assert(next === document.activeElement && next.innerText.includes('Battle for'), 'Relaunched receipt did not restore Return navigation');
pressReturn(next);
assert(save().round.id !== previous.round && !save().round.receipt && save().round.nationId !== previous.target,
  'Return after conquest should begin a different frontier problem without visiting the map');
nativeAtlas.openPreview(campaign());
assert($('[data-empire-standings]')?.innerText.includes('Jade Empire'), 'Rival standings disappeared');
assert($('[data-rival-activity]')?.textContent.includes('Indigo Empire'), 'Map should show what happened on the rival turns');
return 'Relaunched grouped result preserved one conquest, one rival turn and Return to a new frontier problem';
