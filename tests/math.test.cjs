const test = require('node:test');
const assert = require('node:assert/strict');
const math = require('../web/math.js');
require('../web/workbench.js');

function problem(a, b, op = '+') { return {a, b, op, world:3}; }
function seeded(seed) {
  let s = seed;
  return () => { s = (Math.imul(s,1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

test('1.909 + 2.31 aligns, pads only the missing thousandths and regroups the tenths', () => {
  const p = math.analyze(problem('1.909','2.31'));
  assert.equal(p.answer, '4.219');
  assert.equal(p.estimate,4);
  assert.deepEqual(p.blanks,[{row:1,index:3}]);
  assert.deepEqual(p.columns.map(c=>[c.place,c.digit,c.incoming,c.outgoing]),[
    ['thousandths',9,0,0],['hundredths',1,0,0],['tenths',2,0,1],['ones',4,1,0]
  ]);
  assert.equal(math.checkZeros(p.blanks,{'1-3':'0'}),true);
  assert.equal(math.checkZeros(p.blanks,{'1-3':'1'}),false);
  assert.equal(math.checkZeros(p.blanks,{}),false);
});

test('carries span a whole-number boundary; borrowing works across consecutive zero places', () => {
  const sum = math.analyze(problem('9.999','.001'));
  assert.equal(sum.answer,'10.000');
  assert.deepEqual(sum.columns.map(c=>c.outgoing),[1,1,1,1,0]);
  const diff = math.analyze(problem('5.02','1.876','-'));
  assert.equal(diff.answer,'3.144');
  assert.deepEqual(diff.columns.map(c=>c.outgoing),[1,1,1,0]);
  assert.equal(math.analyze(problem('10.000','.001','-')).answer,'9.999');
  assert.equal(math.analyze(problem('2.10','2.1','-')).answer,'0.00');
  assert.throws(()=>math.analyze(problem('1.11','2.22','-')));
});

test('answers accept equivalent decimal notation and reject malformed entries', () => {
  for (const correct of ['.5','0.5','000.5000',' 0.50 ']) assert.equal(math.sameDecimal(correct,'0.500'),true);
  for (const incorrect of ['','.','-','1.2.3','0.5x','1/2','5e-1','0.05','']) assert.equal(math.sameDecimal(incorrect,'.5'),false);
  assert.equal(math.analyze(problem('.1','.2')).answer,'0.3');
  assert.equal(math.analyze(problem('3.50','1.51')).estimate,6);
  assert.equal(math.analyze(problem('3.49','1.51','-')).estimate,1);
});

test('column digit and regrouping are checked independently', () => {
  const c = math.analyze(problem('1.7','2.8')).columns[0];
  assert.deepEqual(math.checkColumn(c,'5','1'),{ok:true});
  assert.deepEqual(math.checkColumn(c,'4','1'),{ok:false,error:'columns'});
  assert.deepEqual(math.checkColumn(c,'5',''),{ok:false,error:'regroup'});
  assert.deepEqual(math.checkColumn(c,'','1'),{ok:false,error:'columns'});
  assert.deepEqual(math.checkColumn(c,'5','9'),{ok:false,error:'regroup'});
});

test('each world generates exercises of the right skill and the columns reproduce an exact reference', () => {
  const rng = seeded(2026);
  for (let w=0;w<6;w++) {
    const seen = new Set();
    for (let j=0;j<150;j++) {
      const p = math.makeProblem(w,{random:rng});
      const plan = math.analyze(p);
      const precision = Math.max(...[p.a,p.b].map(s=>s.split('.')[1].length));
      const exact = s=> { const [whole,frac] = s.split('.'); return BigInt(whole + frac.padEnd(precision,'0')); };
      const expected = p.op === '+' ? exact(p.a)+exact(p.b) : exact(p.a)-exact(p.b);
      assert.equal(exact(plan.answer),expected);
      assert.equal(BigInt(plan.columns.map(c=>c.digit).reverse().join('')),expected);
      assert.equal(p.op,w===5?'-':'+');
      if (w===0) assert.equal(plan.columns.some(c=>c.outgoing),false);
      if (w===2) assert.ok(plan.blanks.length);
      if (w===4) assert.ok(plan.columns.some(c=>c.outgoing));
      seen.add([p.a,p.b].join('/'));
    }
    assert.ok(seen.size>80);
    assert.deepEqual(math.makeProblem(w,{first:true}),math.makeProblem(w,{first:true}));
  }
  for (let w=0;w<6;w++) {
    assert.ok(math.analyze(math.makeProblem(w,{focus:'regroup', random:rng})).columns.some(c=>c.outgoing));
  }
  assert.ok(math.analyze(math.makeProblem(1,{focus:'zeros',random:rng})).blanks.length);
  assert.ok(math.analyze(math.makeProblem(0,{focus:'zeros',random:rng})).blanks.length);
  assert.equal(session(math.makeProblem(0,{first:true})).api.getDraft().shift,1);
  const offsets = new Set(Array.from({length:40}, () => math.makeProblem(2,{random:rng}).offset));
  assert.deepEqual([...offsets].sort(),[-1,1]);
});

/* Drives the workbench through its public events without external DOM dependencies. */
function session(p, mode='guided', draft, hooks = {}) {
  const listeners = new Map();
  const node = {tagName:'DIV',focus(){},select(){},remove(){}};
  const container = {
    innerHTML:'',addEventListener:(k,fn)=>listeners.set(k,fn),removeEventListener:k=>listeners.delete(k),
    querySelector:()=>node,contains:()=>true
  };
  let saved, result, completed = 0;
  const api = MathWorkbench.mount(container,{
    problem:p, mode, draft,
    onDraft:d => { saved = d; hooks.onDraft?.(d); },
    onComplete:r => { result = r; completed++; hooks.onComplete?.(r); }
  });
  function button(action,guess,row,index) {
    const element={dataset:{action,row,index,guess:guess===undefined?'':String(guess)},hasAttribute:k=>k==='data-guess' && guess!==undefined};
    listeners.get('click')?.({target:{closest:()=>element}});
  }
  function input(name,value) { listeners.get('input')?.({target:{dataset:{field:name},value:String(value)}}); }
  return {button,input,pick:index=>button('pick-addend',undefined,undefined,index),get html(){return container.innerHTML;},get saved(){return saved;},get result(){return result;},get completed(){return completed;},api};
}

test('all three modes check every intermediate step, resume a draft, and award 35 for the example', () => {
  for (const mode of ['guided','standard','challenge']) {
    const p = problem('1.909','2.31');
    let ui = session(p,mode);
    ui.button('left'); ui.button('check');
    assert.equal(ui.saved.stage,'zeros');
    ui.input('z1-3','0'); ui.button('check');
    assert.equal(ui.saved.stage,'columns');
    const previous = ui.saved;
    ui.api.destroy();
    ui = session(p,mode,previous);
    const plan = math.analyze(p);
    for (const column of plan.columns) {
      ui.input('digit',column.digit);
      if (column.outgoing) ui.input('transfer',1);
      ui.button('check');
    }
    assert.equal(ui.saved.stage,'answer');
    ui.input('final','4.2190'); ui.button('check');
    assert.equal(ui.saved.stage,'estimate');
    ui.button(null,4); ui.button('check'); ui.button('check');
    assert.equal(ui.completed,1);
    assert.equal(ui.result.damage,35);
    assert.equal(ui.result.fullyWorked,true);
    assert.equal(ui.result.independent,true);
  }
});

test('hints are limited and a corrected mistake still requires all the work', () => {
  const p = problem('1.9','2.31');
  const ui = session(p);
  for (let i = 0; i < 5; i++) ui.button('hint');
  ui.button('check');
  assert.equal(ui.saved.errors.align, 1);
  assert.equal(ui.saved.hints, 3);
  ui.button('left');
  ui.button('check');
  ui.input('z0-2', '9');
  ui.button('check');
  assert.equal(ui.saved.errors.zeros, 1);
  ui.input('z0-2', '0');
  ui.button('check');
  writeColumns(ui, math.analyze(p).columns);
  ui.input('final', '4.31');
  ui.button('check');
  assert.equal(ui.saved.errors.answer, 1);
  ui.input('final', '4.21');
  ui.button('check');
  assert.equal(ui.completed, 0);
  ui.button(null, 4);
  ui.button('check');
  assert.equal(ui.result.damage, 35);
  assert.equal(ui.result.fullyWorked, true);
  assert.equal(ui.result.hints, 3);
  assert.equal(ui.result.independent, false);
});

test('a subtraction draft survives an incorrect borrow; estimates are checked after an exact answer', () => {
  const p = problem('5.02','1.876','-');
  const ui = session(p,'standard');
  ui.button('left'); ui.button('check'); ui.input('z0-3','0'); ui.button('check');
  ui.input('digit',4); ui.button('check');
  assert.equal(ui.saved.errors.regroup,1);
  for (const c of math.analyze(p).columns) {
    ui.input('digit',c.digit);
    ui.input('transfer',c.outgoing);
    ui.button('check');
  }
  ui.input('final','3.144'); ui.button('check');
  ui.button(null,4); ui.button('check');
  assert.equal(ui.saved.errors.estimate,1);
  ui.button(null,3); ui.button('check');
  assert.equal(ui.result.damage,35);
  assert.equal(ui.result.independent,false);
});

test('an unshifted equation, current mode, place guide, and a reversed starting position remain usable', () => {
  const p = {...problem('1.909','2.31'), offset:-1};
  const ui = session(p,'standard');
  assert.match(ui.html,/1\.909 <span>\+<\/span> 2\.31/);
  assert.match(ui.html,/>Standard<\/span>/);
  ui.button('guide'); assert.match(ui.html,/thousandths, place value 0\.001/);
  ui.button('check'); assert.equal(ui.saved.errors.align,1);
  ui.button('right'); ui.button('check'); assert.equal(ui.saved.stage,'zeros');
  ui.button('guide'); assert.doesNotMatch(ui.html,/thousandths, place value/);
  const guided = session({...problem('10.000','0.001','-'),offset:1});
  guided.button('left'); guided.button('check');
  assert.match(guided.html,/thousandths, place value 0\.001/);
  guided.button('hint');
  assert.match(guided.saved.clue,/from the tens through the empty hundredths place/);
});

test('three-addend work keeps both row positions, exact carries and each rounded number', () => {
  const p = math.makeProblem(6, {first:true});
  const plan = math.analyze(p);
  let ui = session(p);
  function align(row) {
    ui.button(ui.api.getDraft().shifts[row] > 0 ? 'left' : 'right', undefined, row);
  }
  align(1);
  ui.button('check');
  assert.equal(ui.saved.errors.align, 1);
  const draft = ui.saved;
  ui.api.destroy();
  ui = session(p, 'guided', draft);
  assert.equal(ui.api.getDraft().shifts[1], 0);
  align(2);
  ui.button('check');
  assert.equal(ui.saved.stage, 'zeros');
  for (const cell of plan.blanks) ui.input('z' + cell.row + '-' + cell.index, '0');
  ui.button('check');
  assert.equal(ui.saved.stage, 'columns');
  for (const column of plan.columns) {
    ui.input('digit', column.digit);
    if (column.outgoing === 2) {
      const pos = ui.saved.pos;
      ui.input('transfer', 1);
      ui.button('check');
      assert.equal(ui.saved.pos, pos);
      assert.ok(ui.saved.errors.regroup);
    }
    ui.input('transfer', column.outgoing);
    ui.button('check');
  }
  assert.equal(ui.saved.stage, 'answer');
  ui.input('final', '5.6434');
  ui.button('check');
  ui.button(null, 6);
  ui.button('check');
  assert.equal(ui.completed, 0);
  for (const [i, rounded] of [2,3,1].entries()) ui.input('rounded' + i, rounded);
  ui.button('check');
  assert.equal(ui.completed, 1);
  assert.equal(ui.result.answer, '5.6434');
});

const worksheet = {a:'9.86', b:'9.9429', c:'13.3571', world:6, op:'+', kind:'pair'};
const modes = ['guided', 'standard', 'challenge'];
const places = ['ten-thousandths', 'thousandths', 'hundredths', 'tenths', 'ones', 'tens'];

// These are worked by hand. Reading each string from left to right follows the
// child's writing order, starting at ten-thousandths and ending at tens.
const pairCases = [
  {pair:[0,1], subtotal:'19.8029', remaining:'13.3571', firstDigits:'920891', firstCarries:'001110', lastCarries:'110110'},
  {pair:[0,2], subtotal:'23.2171', remaining:'9.9429', firstDigits:'171232', firstCarries:'001110', lastCarries:'110110'},
  {pair:[1,2], subtotal:'23.3000', remaining:'9.86',   firstDigits:'000332', firstCarries:'111110', lastCarries:'000110'}
];

function expectedColumns(digits, carries) {
  return places.map((place, i) => ({place, digit:Number(digits[i]), outgoing:Number(carries[i])}));
}

function stage(ui, name, leg) {
  assert.equal(ui.api.getDraft().stage, name);
  assert.match(ui.html, new RegExp('data-stage="' + name + '"'));
  if (leg != null) {
    assert.equal(ui.api.getDraft().pairLeg, leg);
    assert.match(ui.html, new RegExp('data-pair-leg="' + leg + '"'));
  }
  assert.doesNotMatch(ui.html, /data-action="(?:quick|back|skip)"/);
  if (!['subtotal', 'answer'].includes(name)) {
    assert.doesNotMatch(ui.html, /data-field="(?:subtotal|final)"/);
  }
}

function selectPair(ui, pair) {
  stage(ui, 'pair');
  for (const index of pair) ui.pick(index);
  ui.button('check');
  stage(ui, 'align', 1);
}

function operandRows(ui) {
  return [...ui.html.matchAll(/data-operand-row="\d+"[^>]*>([\s\S]*?)<\/div><\/div>/g)]
    .map(match => match[1].replace(/<[^>]*>/g, '').replace(/[+−\s]/g, ''));
}

function alignRows(ui) {
  const shifts = ui.api.getDraft().shifts;
  assert.equal(shifts[0], 0);
  for (let row = 1; row < shifts.length; row++) {
    const shift = shifts[row];
    assert.ok(Math.abs(shift) === 1, 'each new lower row starts displaced');
    assert.match(ui.html, new RegExp('data-slide="' + row + '"'));
    ui.button(shift > 0 ? 'left' : 'right', undefined, row);
  }
  ui.button('check');
}

function fillZeros(ui, fields) {
  if (!fields.length) return;
  stage(ui, 'zeros');
  assert.deepEqual([...ui.html.matchAll(/data-field="(z\d+-\d+)"/g)].map(m => m[1]), fields);
  for (const name of fields) ui.input(name, '0');
  ui.button('check');
}

function writeColumns(ui, columns, start = 0) {
  for (let i = start; i < columns.length; i++) {
    const column = columns[i];
    stage(ui, 'columns');
    assert.equal(ui.api.getDraft().pos, i);
    assert.match(ui.html, new RegExp('Result digit in the ' + column.place + ' column'));
    assert.equal((ui.html.match(/data-field="digit"/g) || []).length, 1);
    if (i + 1 < columns.length) {
      assert.match(ui.html, new RegExp('(?:Carry into|Borrow from) ' + columns[i + 1].place));
      ui.input('transfer', column.outgoing);
    } else {
      assert.doesNotMatch(ui.html, /data-field="transfer"/);
      assert.equal(column.outgoing, 0);
    }
    ui.input('digit', column.digit);
    ui.button('check');
    if (i + 1 < columns.length) assert.equal(ui.api.getDraft().pos, i + 1);
  }
}

function writeLeg(ui, leg, operands, columns) {
  stage(ui, 'align', leg);
  assert.deepEqual(operandRows(ui), operands);
  alignRows(ui);
  const row = operands.indexOf('9.86');
  fillZeros(ui, row < 0 ? [] : ['z' + row + '-4', 'z' + row + '-5']);
  writeColumns(ui, columns);
  stage(ui, leg === 1 ? 'subtotal' : 'answer', leg);
}

function estimateWorksheet(ui) {
  stage(ui, 'estimate');
  for (const [i, rounded] of [10, 10, 13].entries()) {
    assert.match(ui.html, new RegExp('data-field="rounded' + i + '"'));
    ui.input('rounded' + i, rounded);
  }
  ui.button(null, 33);
  ui.button('check');
}

function reopen(ui, p, mode = 'guided') {
  const saved = JSON.parse(JSON.stringify(ui.api.getDraft()));
  ui.api.destroy();
  return session(p, mode, saved);
}

for (const mode of modes) {
  test(mode + ' requires both written sums for all six orders of the three addends', () => {
    for (const sample of pairCases) {
      for (const order of [sample.pair, [...sample.pair].reverse()]) {
        const ui = session(worksheet, mode);
        selectPair(ui, order);
        writeLeg(ui, 1, order.map(i => [worksheet.a, worksheet.b, worksheet.c][i]),
          expectedColumns(sample.firstDigits, sample.firstCarries));
        ui.input('subtotal', sample.subtotal);
        ui.button('check');
        assert.equal(ui.completed, 0);
        writeLeg(ui, 2, [sample.subtotal, sample.remaining], expectedColumns('006133', sample.lastCarries));
        ui.input('final', '33.1600');
        ui.button('check');
        assert.equal(ui.completed, 0);
        estimateWorksheet(ui);
        ui.button('check');
        assert.equal(ui.completed, 1);
        assert.equal(ui.result.answer, '33.1600');
        assert.equal(ui.result.damage, 35);
        assert.equal(ui.result.fullyWorked, true);
        assert.equal(ui.result.independent, true);
        assert.deepEqual(ui.result.pair, order);
      }
    }
  });
}

test('the screenshot spell preserves incomplete work and allows correcting each kind of mistake after relaunch', () => {
  const sample = pairCases[0];
  let ui = session(worksheet);
  ui.pick(0);
  ui = reopen(ui, worksheet);
  assert.deepEqual(ui.api.getDraft().pair, [0]);
  ui.pick(1);
  ui.button('check');
  ui.button('check');
  assert.equal(ui.saved.errors.align, 1);
  alignRows(ui);
  ui.input('z0-4', '0');
  ui.input('z0-5', '7');
  ui.button('check');
  assert.equal(ui.saved.errors.zeros, 1);
  ui = reopen(ui, worksheet);
  stage(ui, 'zeros', 1);
  assert.deepEqual(ui.api.getDraft().zeros, {'0-4':'0', '0-5':'7'});
  ui.input('z0-5', '0');
  ui.button('check');
  ui.input('digit', '8');
  ui.button('check');
  assert.equal(ui.saved.errors.columns, 1);
  assert.equal(ui.saved.pos, 0);
  ui.input('digit','9'); ui.button('check');
  ui.input('digit','2'); ui.button('check');
  ui.input('digit','0'); ui.input('transfer','0'); ui.button('check');
  assert.equal(ui.saved.errors.regroup, 1);
  ui = reopen(ui, worksheet);
  assert.equal(ui.api.getDraft().pos, 2);
  assert.equal(ui.api.getDraft().digit, '0');
  assert.equal(ui.api.getDraft().transfer, '0');
  assert.deepEqual([ui.api.getDraft().errors.columns, ui.api.getDraft().errors.regroup], [1,1]);
  writeColumns(ui, expectedColumns(sample.firstDigits, sample.firstCarries), 2);
  stage(ui, 'subtotal', 1);
  ui.input('subtotal', '33.1600');
  ui.button('check');
  stage(ui, 'subtotal', 1);
  assert.equal(ui.saved.errors.columns, 1);
  assert.equal(ui.saved.errors.answer, 1);
  ui.input('subtotal', '19.80');
  ui = reopen(ui, worksheet);
  assert.equal(ui.api.getDraft().subtotal, '19.80');
  ui.input('subtotal', sample.subtotal);
  ui.button('check');
  ui = reopen(ui, worksheet);
  stage(ui, 'align', 2);
  assert.equal(ui.api.getDraft().steps.subtotal, true);
  alignRows(ui);
  stage(ui, 'columns', 2);
  ui.input('digit', '0'); ui.input('transfer', '1'); ui.button('check');
  ui.input('digit', '0'); ui.input('transfer', '1');
  ui = reopen(ui, worksheet);
  assert.deepEqual([ui.api.getDraft().pos, ui.api.getDraft().digit, ui.api.getDraft().transfer], [1,'0','1']);
  writeColumns(ui, expectedColumns('006133', sample.lastCarries), 1);
  ui.input('final', sample.subtotal);
  ui.button('check');
  stage(ui, 'answer', 2);
  assert.equal(ui.saved.errors.answer, 2);
  ui.input('final', '33.1');
  ui = reopen(ui, worksheet);
  assert.equal(ui.api.getDraft().final, '33.1');
  ui.input('final', '33.16');
  ui.button('check');
  ui.button(null, 33);
  ui.button('check');
  assert.equal(ui.completed, 0);
  ui.input('rounded0', 9);
  ui.input('rounded1', 10);
  ui.input('rounded2', 13);
  ui.button('check');
  assert.equal(ui.saved.errors.estimate, 1);
  ui = reopen(ui, worksheet);
  stage(ui, 'estimate');
  assert.deepEqual(ui.api.getDraft().rounded, ['9','10','13']);
  ui.input('rounded0', 10);
  ui.button(null, 32);
  ui.button('check');
  assert.equal(ui.saved.errors.estimate, 2);
  ui.button('hint');
  estimateWorksheet(ui);
  assert.equal(ui.result.independent, false);
  assert.equal(ui.result.fullyWorked, true);
  assert.equal(ui.result.hints, 1);
});

test('reselecting the same pair in reverse keeps its row work; changing the pair clears both legs', () => {
  let ui = session(worksheet);
  const sample = pairCases[0];
  selectPair(ui, [0,1]);
  writeLeg(ui, 1, [worksheet.a,worksheet.b], expectedColumns(sample.firstDigits, sample.firstCarries));
  ui.input('subtotal', sample.subtotal);
  ui.button('check');
  alignRows(ui);
  ui.input('digit', '0'); ui.input('transfer','1'); ui.button('check');
  ui.input('digit','0');
  ui.button('change-pair');
  stage(ui, 'pair');
  ui.pick(0); ui.pick(1);
  ui.pick(1); ui.pick(0);
  ui = reopen(ui, worksheet);
  ui.button('check');
  stage(ui, 'columns', 2);
  assert.equal(ui.saved.pos, 1);
  assert.equal(ui.saved.digit, '0');
  assert.equal(ui.saved.subtotal, sample.subtotal);
  assert.deepEqual(ui.saved.pair, [0,1]);
  ui.button('change-pair'); ui.pick(1); ui.pick(2); ui.button('check');
  stage(ui, 'align', 1);
  assert.deepEqual(operandRows(ui), [worksheet.a,worksheet.c]);
  assert.equal(ui.saved.pos, 0);
  assert.equal(ui.saved.digit, '');
  assert.equal(ui.saved.subtotal, '');
  assert.equal(ui.saved.final, '');
  assert.ok(!ui.saved.steps.subtotal && !ui.saved.steps.answer && !ui.saved.steps.columns);
  assert.deepEqual(ui.saved.zeros, {});
  ui.button('check');
  stage(ui, 'align', 1);
  assert.equal(ui.completed, 0);
});

test('old subtotal and already-accepted subtotal drafts must show both calculations after updating', () => {
  for (const oldStage of ['subtotal','pair-total']) {
    const old = {
      signature:'6/9.86/+/9.9429/13.3571/pair', stage:oldStage, pair:[0,1], confirmedPair:'0,1',
      subtotal:oldStage === 'pair-total' ? '19.8029' : '19.', final:'33.1600', hints:2,
      errors:{columns:1}, steps:{align:false, zeros:false, columns:false, answer:false, estimate:false, subtotal:oldStage === 'pair-total'}
    };
    let ui = session(worksheet, 'standard', old);
    stage(ui, 'align', 1);
    assert.deepEqual(ui.api.getDraft().pair, [0,1]);
    assert.equal(ui.api.getDraft().hints, 2);
    assert.equal(ui.api.getDraft().errors.columns, 1);
    assert.ok(!ui.api.getDraft().steps.subtotal);
    assert.equal(ui.api.getDraft().pos, 0);
    ui.button('quick'); ui.button('skip'); ui.button('check');
    stage(ui, 'align', 1);
    ui = reopen(ui, worksheet, 'standard');
    const s = pairCases[0];
    writeLeg(ui, 1, [worksheet.a, worksheet.b], expectedColumns(s.firstDigits, s.firstCarries));
    ui.input('subtotal', s.subtotal); ui.button('check');
    writeLeg(ui, 2, [s.subtotal, s.remaining], expectedColumns('006133', s.lastCarries));
    ui.input('final', '33.1600'); ui.button('check');
    estimateWorksheet(ui);
    assert.equal(ui.result.fullyWorked, true);
  }
});

test('ordinary old quick drafts return to the first unverified step, preserving completed columns', () => {
  const p = problem('1.909','2.31');
  const plan = math.analyze(p);
  const oldQuick = {
    signature:'3/1.909/+/2.31', stage:'quick', beforeQuick:'columns', final:'4.219', shift:0, pos:2,
    zeros:{'1-3':'0'}, digit:'2', transfer:'1', hints:1, errors:{align:1},
    steps:{align:true, zeros:true, columns:false, answer:false, estimate:false}
  };
  for (const mode of modes) {
    let ui = session(p, mode, oldQuick);
    stage(ui, 'columns');
    assert.equal(ui.api.getDraft().pos, 2);
    assert.equal(ui.api.getDraft().digit, '2');
    assert.equal(ui.api.getDraft().transfer, '1');
    assert.equal(ui.api.getDraft().final, '');
    assert.equal(ui.api.getDraft().hints, 1);
    assert.equal(ui.api.getDraft().errors.align, 1);
    ui = reopen(ui, p, mode);
    writeColumns(ui, plan.columns, 2);
    stage(ui, 'answer');
    ui.input('final', plan.answer); ui.button('check');
    stage(ui, 'estimate');
    ui.button('skip');
    assert.equal(ui.completed, 0);
    ui.button(null, plan.estimate); ui.button('check');
    assert.equal(ui.result.fullyWorked, true);
    assert.equal(ui.result.independent, false);
  }
  const earlier = {...oldQuick, beforeQuick:'align', pos:0, shift:1, steps:{}};
  const ui = session(p, 'challenge', earlier);
  stage(ui, 'align');
  assert.equal(ui.api.getDraft().final, '');
});

test('retired quick, back, and skip actions cannot bypass regular or grouped work in any mode', () => {
  function tryRetired(ui) {
    const before = ui.api.getDraft();
    for (const action of ['quick','skip','back']) ui.button(action);
    assert.deepEqual(ui.api.getDraft(), before);
    assert.equal(ui.completed, 0);
  }
  for (const mode of modes) {
    for (const p of [problem('1.909','2.31'), worksheet]) {
      const ui = session(p, mode);
      const grouped = p.kind === 'pair';
      if (grouped) { tryRetired(ui); selectPair(ui, [0,1]); }
      stage(ui, 'align'); tryRetired(ui);
      ui.button('check');
      stage(ui, 'align');
      alignRows(ui);
      stage(ui, 'zeros'); tryRetired(ui);
      fillZeros(ui, grouped ? ['z0-4','z0-5'] : ['z1-3']);
      stage(ui, 'columns'); tryRetired(ui);
      ui.button('check');
      assert.equal(ui.saved.pos, 0);
      if (grouped) {
        const s = pairCases[0];
        writeColumns(ui, expectedColumns(s.firstDigits, s.firstCarries));
        stage(ui, 'subtotal'); tryRetired(ui);
        ui.input('subtotal', s.subtotal); ui.button('check');
        stage(ui, 'align', 2); tryRetired(ui);
        alignRows(ui);
        stage(ui, 'columns', 2); tryRetired(ui);
        writeColumns(ui, expectedColumns('006133', s.lastCarries));
      } else {
        writeColumns(ui, math.analyze(p).columns);
      }
      stage(ui, 'answer'); tryRetired(ui);
      ui.input('final', grouped ? '33.1600' : '4.219'); ui.button('check');
      stage(ui, 'estimate'); tryRetired(ui);
      ui.button('check');
      assert.equal(ui.completed, 0);
    }
  }
});

test('a nine-digit intermediate subtotal can be aligned and added through its new leading place', () => {
  const value = '99999999.999999';
  const p = {...worksheet, a:value, b:value, c:value};
  const bigPlaces = ['millionths','hundred-thousandths','ten-thousandths','thousandths','hundredths','tenths',
    'ones','tens','hundreds','thousands','ten-thousands','hundred-thousands','millions','ten-millions','hundred-millions'];
  let ui = session(p, 'challenge');
  selectPair(ui, [0,1]);
  for (const leg of [1,2]) {
    stage(ui, 'align', leg);
    assert.deepEqual(operandRows(ui), [leg === 1 ? value : '199999999.999998', value]);
    alignRows(ui);
    const columns = bigPlaces.map((place, i) => ({
      place, digit:i === 0 ? 9 - leg : i === 14 ? leg : 9, outgoing:Number(i < 14)
    }));
    writeColumns(ui, columns);
    const first = leg === 1;
    stage(ui, first ? 'subtotal' : 'answer', leg);
    ui.input(first ? 'subtotal' : 'final', first ? '199999999.999998' : '299999999.999997');
    ui.button('check');
    ui = reopen(ui, p, 'challenge');
  }
  stage(ui, 'estimate');
  for (let i = 0; i < 3; i++) ui.input('rounded' + i, '100000000');
  ui.button(null, 300000000); ui.button('check');
  assert.equal(ui.result.answer, '299999999.999997');
  assert.equal(ui.result.fullyWorked, true);
});

test('reopening the game after a worked pair preserves one award and one mastery record', () => {
  const adventure = require('../web/adventure.js');
  const data = new Map();
  const store = {getItem:key => data.get(key) ?? null, setItem:(key,val) => data.set(key,val)};
  let game = adventure.open(store);
  const round = game.startRound(() => worksheet);
  function mountRound() {
    return session(worksheet, 'guided', game.state.round.draft, {
      onDraft:draft => game.saveDraft(round.id, draft),
      onComplete:result => game.finishRound(round.id, result)
    });
  }
  let ui = mountRound();
  const s = pairCases[0];
  selectPair(ui, [0,1]);
  writeLeg(ui, 1, [worksheet.a,worksheet.b], expectedColumns(s.firstDigits, s.firstCarries));
  ui.input('subtotal', s.subtotal); ui.button('check');
  assert.equal(game.state.stats.count, 0);
  ui.api.destroy();
  game = adventure.open(store);
  ui = mountRound();
  writeLeg(ui, 2, [s.subtotal,s.remaining], expectedColumns('006133', s.lastCarries));
  ui.input('final','33.1600'); ui.button('check');
  assert.equal(game.state.stats.count, 0);
  estimateWorksheet(ui);
  ui.button('check');
  const receipt = game.state.round.receipt;
  assert.equal(receipt.answer, '33.1600');
  assert.equal(receipt.damage, 35);
  assert.equal(game.state.stats.count, 1);
  assert.equal(game.state.stats.independent, 1);
  const xp = game.state.xp;
  const coins = game.state.coins;
  game = adventure.open(store);
  assert.deepEqual(game.startRound(math.makeProblem).receipt, receipt);
  assert.deepEqual(game.finishRound(round.id, ui.result), receipt);
  assert.equal(game.state.xp, xp);
  assert.equal(game.state.coins, coins);
  assert.equal(game.state.stats.count, 1);
});

test('rounding keeps the named place, uses the first discarded digit, and rounds exact ties up', () => {
  for (const [source,places,result] of [
    ['1.77',0,'2'],['1.00',0,'1'],['1.499999',0,'1'],['1.500000',0,'2'],
    ['.500000',0,'1'],['.499999',0,'0'],['1.049999',1,'1.0'],['1.050000',1,'1.1'],
    ['1.005',2,'1.01'],['1.004999',2,'1.00'],['9.995',2,'10.00'],['.007',3,'0.007'],
    ['00001.245',1,'1.2'],['100000000.555555',4,'100000000.5556']
  ]) assert.equal(math.roundDecimal(source,places),result,source+' to '+places+' places');
});

test('a child can correctly round 1.77 to 2 while estimating its three addends as 1', () => {
  const p={world:6,op:'+',a:'0.48',b:'0.49',c:'0.80'},plan=math.analyze(p);
  const ui=session(p);
  alignRows(ui);
  writeColumns(ui,plan.columns);
  ui.input('final','1.77');ui.button('check');
  stage(ui,'estimate');
  assert.match(ui.html,/Round each addend, then add/);
  ui.input('rounded0','0');ui.input('rounded1','0');ui.input('rounded2','0.80');
  ui.button(null,2);ui.button('check');
  assert.equal(ui.saved.rounded[2],'0.80'); // Preserve what was typed, including its point.
  assert.match(ui.saved.message,/tenths digit of 0.80/);
  ui.input('rounded2','1.0');
  ui.button('check');
  assert.match(ui.saved.message,/1.77 does round to 2/);
  assert.match(ui.saved.message,/0 \+ 0 \+ 1/);
  assert.equal(ui.completed,0);
  assert.match(ui.html,/data-guess="1"/);
  assert.match(ui.html,/data-guess="2"/);
  const resumed=reopen(ui,p);
  resumed.button(null,1);resumed.button('check');
  assert.equal(resumed.result.answer,'1.77');
  assert.equal(resumed.completed,1);
  assert.deepEqual([plan.estimate,plan.roundedAnswer],[1,2]);
  const opposite=math.analyze({a:'0.51',b:'0.51',c:'0.51',op:'+'});
  assert.deepEqual([opposite.estimate,opposite.roundedAnswer],[3,2]);
});

test('a saved three-number receipt and its old history snapshot reproduce both rounding methods', () => {
  const A=require('../web/adventure'), store=new Map();
  const storage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
  let game=A.open(storage);
  game.travel(A.SCHOOLWORK);
  const r=game.startRound(()=>({a:'0.48',b:'0.49',c:'0.80',op:'+',world:6}));
  const result={answer:'1.77',damage:35,fullyWorked:true,hints:0,errors:{},independent:true};
  game.finishRound(r.id,result);
  game=A.open(storage);
  const saved=game.state.round;
  assert.equal(saved.id,r.id);assert.equal(saved.receipt.answer,'1.77');
  const entry=game.reviewLessonProblem(saved.lessonSessionId,saved.id);
  const oldDocument=global.document;
  global.document={createElement:()=>({children:[],dataset:{},setAttribute(){},append(...nodes){this.children.push(...nodes);}})};
  try {
    for(const p of [saved.problem,entry.problem]){
      const summary=MathWorkbench.estimateSummary(p);
      const rows=summary.children[0].children;
      assert.deepEqual(rows.map(r=>r.children[1].textContent),['0 + 0 + 1 = 1','1.77 rounds to 2']);
      assert.match(summary.children[1].textContent,/estimate of 1 is 0\.77 away from the exact sum of 1\.77/);
    }
  } finally {
    if(oldDocument===undefined) delete global.document;
    else global.document=oldDocument;
  }
});
