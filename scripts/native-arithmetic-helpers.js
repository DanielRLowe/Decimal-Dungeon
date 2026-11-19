// Shared by the native playtests; these helpers interact only with the learner's controls.
const nativeMath = (() => {
  const query = selector => document.querySelector('#workbench ' + selector);
  const button = name => query('[data-action="' + name + '"]');
  const field = name => query('[data-field="' + name + '"]');
  const demand = (condition, message) => { if (!condition) throw Error(message); };
  const stage = () => query('[data-stage]')?.dataset.stage;

  function noBypass() {
    for (const name of ['quick','skip','back']) demand(!button(name), 'Unexpected work shortcut: ' + name);
  }
  function expectStage(expected) {
    demand(stage() === expected, 'Expected workbench stage ' + expected + ', found ' + stage());
    noBypass();
  }
  function set(name, value) {
    const element = field(name);
    demand(element?.getClientRects().length && !element.disabled, 'Expected a visible input for ' + name);
    element.value = String(value);
    element.dispatchEvent(new Event('input', {bubbles:true}));
    return element;
  }
  function pressReturn(element) {
    demand(element, 'Missing Return target');
    element.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
  }
  function check() {
    demand(!button('check')?.disabled && button('check')?.getClientRects().length, 'Missing check button');
    button('check').click();
  }
  function align() {
    expectStage('align');
    const rows = Array.from(document.querySelectorAll('#workbench [data-slide]'), row => row.dataset.slide);
    demand(rows.length > 0, 'No alignment controls were presented');
    for (const row of rows) {
      const shift = Number(query('[data-slide="' + row + '"]').getAttribute('aria-valuenow'));
      if (shift === 0) continue;
      const move = query('[data-action="' + (shift > 0 ? 'left' : 'right') + '"][data-row="' + row + '"]');
      demand(move && !move.disabled, 'The decimal alignment control is unavailable');
      move.click();
    }
    check();
  }
  function zeros(count) {
    expectStage('zeros');
    const fields = Array.from(document.querySelectorAll('#workbench [data-field^="z"]'));
    demand(fields.length === count, 'Incorrect number of missing decimal places: ' + fields.length);
    for (const item of fields) set(item.dataset.field, 0);
    pressReturn(fields[fields.length-1]);
  }
  function expectColumn(place) {
    expectStage('columns');
    const heading = query('[data-stage-heading]').textContent.toLowerCase();
    demand(heading.endsWith(' ' + place), 'Expected the ' + place + ' column, found ' + heading);
  }
  function writeColumn(digit, carry = 0) {
    const cell = set('digit', digit);
    const entry = field('transfer') ? set('transfer', carry || '') : cell;
    demand(!carry || entry !== cell, 'The next column is missing its carry box');
    pressReturn(entry);
  }
  function estimate(plan) {
    expectStage('estimate');
    const roundedFields = document.querySelectorAll('#workbench [data-field^="rounded"]');
    for (const [i,input] of Array.from(roundedFields).entries()) set(input.dataset.field, plan.roundedOperands[i]);
    const estimateButton = query('[data-guess="' + plan.estimate + '"]');
    demand(estimateButton, 'The correct estimate is unavailable');
    estimateButton.click();
    if (roundedFields.length) pressReturn(field('rounded' + (roundedFields.length - 1)));
    else check();
  }
  function solveOrdinary(problem) {
    demand(problem.kind !== 'pair', 'An ordinary worked exercise was expected');
    const plan = DungeonMath.analyze(problem);
    align();
    if (plan.blanks.length) zeros(plan.blanks.length);
    for (const c of plan.columns) {
      expectColumn(c.place);
      writeColumn(c.digit,c.outgoing);
    }
    expectStage('answer');
    pressReturn(set('final',plan.answer));
    estimate(plan);
  }
  return {noBypass,expectStage,stage,set,field,check,pressReturn,align,zeros,expectColumn,writeColumn,estimate,solveOrdinary};
})();
