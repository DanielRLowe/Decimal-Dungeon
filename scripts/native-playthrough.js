// Test body executed in the real bundled game by verify-native.swift.
const state = () => JSON.parse(DungeonNativeStorage.getItem('decimal-dungeon.adventure.v1'));
const query = selector => document.querySelector(selector);

function click(name) {
  nativeMath.noBypass();
  const button = query('[data-action="' + name + '"]');
  if (!button || button.disabled) throw Error('Control unavailable: ' + name);
  button.click();
}

function enter(field, value) {
  const input = query('[data-field="' + field + '"]');
  if (!input) throw Error('Missing input: ' + field);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function waitFor(check, message) {
  const deadline = performance.now() + 5000;
  while (!check() && performance.now() < deadline) {
    await new Promise(done => setTimeout(done, 25));
  }
  if (!check()) throw Error(message);
}

function openPractice(skill) {
  query('[data-panel="map"]').click();
  const route = Array.from(document.querySelectorAll('dialog[open] [data-lesson-practice]'))
    .find(button => button.textContent.trim() === 'Practice ' + skill);
  if (!route || route.disabled) throw Error('Practice atlas skill unavailable: ' + skill);
  route.click();
}

function alignRow(row) {
  const slider = query('[data-slide="' + row + '"]');
  if (!slider) throw Error('Missing alignment slider for operand ' + (row + 1));
  const shift = Number(slider.getAttribute('aria-valuenow'));
  if (Math.abs(shift) !== 1) throw Error('Expected an independently misaligned operand');
  const direction = shift > 0 ? 'left' : 'right';
  const arrow = query('[data-action="' + direction + '"][data-row="' + row + '"]');
  if (!arrow || arrow.disabled) throw Error('Missing alignment control for operand ' + (row + 1));
  arrow.click();
}

function column(digit, carry = '') {
  enter('digit', digit);
  if (carry !== '') enter('transfer', carry);
  click('check');
}

async function verifySchoolCampaign() {
  query('#campaign-nav').click();
  const home = query('#campaign-host [data-home]');
  if (home) home.click();
  const mexico = query('#campaign-host [data-iso3="MEX"]');
  if (!mexico || mexico.dataset.status !== 'frontier') throw Error('The campaign practice frontier is unavailable');
  const chooseMexico = () => {
    const picker = query('#campaign-host select[data-pick]');
    picker.value = mexico.dataset.territoryId;
    picker.dispatchEvent(new Event('change', {bubbles:true}));
  };
  chooseMexico();
  const go = query('#campaign-host [data-invade]');
  if (!go) throw Error('A campaign battle should be accessible with the chosen math skill');
  const promised = nativeAtlas.dossierTitle();
  go.click();
  nativeAtlas.checkDossier(promised);
  await waitFor(() => state().campaign.inBattle && state().round?.world === 6, 'Campaign did not use the schoolwork challenge');
  if (!state().round.problem.c || !(query('[data-slide="2"]') || query('[data-action="pick-addend"]'))) throw Error('Campaign did not render the third addend');
  const target = state().campaign.targetId;
  openPractice('Add tenths');
  await waitFor(() => state().round?.lessonId === 'decimal-tenths', 'Could not choose introductory math for the active frontier');
  if (!state().campaign.inBattle || state().campaign.targetId !== target || state().round.world !== 0) {
    throw Error('Changing math lessons moved the player away from the current frontier');
  }
  if (state().round.problem.c || query('[data-slide="2"]')) throw Error('Introductory practice should use its ordinary two-addend problems');
}

if (scenario === 'schoolwork') {
  if (pass === 0) {
    if (state().pin) throw Error('Schoolwork must be tested with a fresh save');
    openPractice('Add three decimals in columns');
    await waitFor(() => state().round?.world === 6, 'Could not enter the schoolwork challenge from the opening atlas');
    const p = state().round.problem;
    if (p.a !== '1.987' || p.b !== '2.7964' || p.c !== '0.86' || p.op !== '+') throw Error('Unexpected first schoolwork example');
    nativeAtlas.panels('decimal-three');
    alignRow(1);
    click('check');
    if (!query('[data-slide="2"]')) throw Error('Alignment accepted while the third addend was still misplaced');
    alignRow(2);
    click('check');
    const fields = Array.from(document.querySelectorAll('[data-field^="z"]'));
    if (fields.length !== 3) throw Error('The three missing placeholder zeros were not requested');
    for (const field of fields) enter(field.dataset.field, '0');
    click('check');
    column('4');
    column('3'); // Seven and six make thirteen. The carry must be recorded.
    if (query('[data-field="digit"]')?.value !== '3' || !state().round.draft?.errors?.regroup) {
      throw Error('The thousandths column accepted 13 without its carry');
    }
    return 'Three-addend alignment, placeholder zeros, and the missing-carry check verified';
  }

  if (query('[data-field="digit"]')?.value !== '3') throw Error('Schoolwork column was lost across relaunch');
  column('3', '1');
  column('4', '1'); // Eight, nine, six and the carried one make 24.
  if (query('[data-field="digit"]')?.value !== '4') throw Error('The hundredths column accepted a carry of one in 24');
  column('4', '2');
  column('6', '2');
  column('5');
  enter('final', '5.6434');
  click('check');
  for (const [i, rounded] of ['2','3','1'].entries()) enter('rounded' + i, rounded);
  const estimate = query('[data-guess="6"]');
  if (!estimate) throw Error('Three-addend estimate is unavailable');
  estimate.click();
  click('check');
  await waitFor(() => state().round?.receipt?.baseDamage === 35, 'Correct three-addend work did not earn 35 power');
  if (state().round.receipt.answer !== '5.6434' || !state().round.receipt.fullyWorked) {
    throw Error('Schoolwork did not credit the verified four-decimal sum');
  }
  await verifySchoolCampaign();
  return 'Four-place schoolwork, carries of one and two, three-operand estimation and campaign skill switching verified';
}

if (pass === 0) {
  const practice = query('#battle-nav');
  if (!practice || !practice.getClientRects().length) throw Error('Practice control unavailable from the opening map');
  practice.click();
  await waitFor(() => query('[data-action="check"]')?.getClientRects().length, 'Practice workbench did not open');
  const initial = DungeonAdventure.open().campaignView();
  if (!initial.needsCapital || initial.owned.length) throw Error('The first practice must show an unfounded empire');
  const originalRound = state().round.id;
  nativeAtlas.openPreview(initial);
  practice.click();
  if (state().round.id !== originalRound) throw Error('Visiting the atlas lost the first practice round');
  nativeAtlas.panels('decimal-tenths');
  const problem = state().round.problem;
  if (problem.a !== '1.2' || problem.b !== '3.5') throw Error('Unexpected introductory problem');
  click('check');
  click('hint');
  click('left');
  click('check');
  enter('digit', '7');

  // Relaunch with an active save from a version that had five-minute break reminders.
  const legacy = state();
  const now = Date.now();
  legacy.settings.sessionMinutes = 5;
  legacy.session.start = now - 11 * 60 * 1000;
  legacy.session.last = now;
  DungeonNativeStorage.setItem('decimal-dungeon.adventure.v1', JSON.stringify(legacy));
  return true;
}

// Continue from the saved first column in a newly created WebKit instance.
if (query('[data-field="digit"]')?.value !== '7') throw Error('Draft was lost on relaunch');
click('check');
enter('digit', '4');
click('check');
enter('final', '4.7');
click('check');
query('[data-guess="5"]').click();
click('check');
await waitFor(() => state().round?.receipt, 'First battle did not finish');
const first = state();
if (!first.round.receipt.fullyWorked || query('#victory-film')?.open || query('[data-replay-victory]')) {
  throw Error('A worked practice encounter should grant ordinary practice credit');
}
if (first.stats.count !== 1 || first.stats.hints !== 1 || first.stats.errors.align !== 1 ||
    first.stats.independent !== 0 || first.xp < 1 || first.coins < 1 || first.regions[0].clears !== 1) {
  throw Error('Unexpected rewards or learning record after the introductory battle');
}

// Crossing the old session limit must let the child go straight to the next problem.
const nextSpell = query('#workbench .next');
if (!nextSpell || nextSpell.disabled) throw Error('The next problem is unavailable after the first result');
if (document.activeElement !== nextSpell) throw Error('Return was not ready to continue from the receipt');
const pressReturn = repeat => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', repeat, bubbles:true, cancelable:true}));
pressReturn(true);
if (state().round.id !== first.round.id) throw Error('A held Return key skipped the receipt');
pressReturn(false);
if (query('dialog[open]')) throw Error('An expired legacy break reminder interrupted the next problem');
const next = state().round;
if (!next || next.id === first.round.id || next.receipt || !query('#workbench [data-action="check"]')?.getClientRects().length) {
  throw Error('The next problem did not open immediately after the first result');
}

// A parent can jump directly to the family's original mixed-precision example.
const openJournal = () => query('[data-panel="parent"]').click();
openJournal();
const pins = document.querySelectorAll('dialog[open] input[type="password"]');
if (pins.length !== 2) throw Error('Fresh journal did not request a new PIN');
for (const field of pins) field.value = '3141';
query('dialog[open] form').requestSubmit();
await waitFor(() => query('dialog[open] select'), 'Parent PIN or journal failed');
nativeAtlas.report('decimal-tenths');
const worldField = Array.from(document.querySelectorAll('dialog[open] label'))
  .find(label => label.textContent.includes('Choose a decimal practice topic'));
const picker = worldField?.querySelector('select');
if (!picker || picker.options[3]?.textContent !== DungeonLessons.get('decimal-thousandths').title) throw Error('Parent topic picker omitted the academic name for thousandths');
picker.value = '3';
Array.from(document.querySelectorAll('dialog[open] button'))
  .find(button => button.textContent === 'Start selected practice').click();
await waitFor(() => state().round?.world === 3, 'Practice world failed to open');
nativeAtlas.headings('decimal-thousandths');
const target = state().round.problem;
if (target.a !== '1.909' || target.b !== '2.31') throw Error('Target example is missing');
click('left');
click('check');
const zero = query('input[data-field^="z"]');
enter(zero.dataset.field, '0');
click('check');
for (const [digit, carry] of [['9', ''], ['1', ''], ['2', '1'], ['4', '']]) {
  enter('digit', digit);
  if (carry) enter('transfer', carry);
  click('check');
}
enter('final', '4.219');
click('check');
query('[data-guess="4"]').click();
click('check');
await waitFor(() => state().round.receipt?.baseDamage === 35, 'Verified mixed-precision work did not earn full power');
const result = state().stats;
if (result.count !== 2 || result.independent !== 1) throw Error('Independent practice was not recorded');

openJournal();
if (document.querySelectorAll('dialog[open] input[type="password"]').length !== 1) {
  throw Error('Reopened parent journal should ask for its local PIN');
}
return true;
