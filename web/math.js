/* All arithmetic is performed on base-ten digits or safely bounded integers. */
(function (root, factory) {
  const math = factory();
  if (typeof module === 'object' && module.exports) module.exports = math;
  root.DungeonMath = math;
})(globalThis, function () {
  'use strict';

  function parts(value, result = false) {
    const text = String(value).trim();
    // A sum of three eight-digit whole parts can have a ninth whole digit.
    const decimal = result ? /^(?:\d{1,9}(?:\.\d{0,6})?|\.\d{1,6})$/ : /^(?:\d{1,8}(?:\.\d{0,6})?|\.\d{1,6})$/;
    if (!decimal.test(text)) return null;
    const [whole = '', fraction = ''] = text.split('.');
    return {whole: whole.replace(/^0+(?=\d)/, '') || '0', fraction};
  }

  function atScale(value, precision) {
    return Number(value.whole + value.fraction.padEnd(precision, '0'));
  }

  function scaledText(value, precision) {
    const digits = String(value).padStart(precision + 1, '0');
    return precision ? digits.slice(0, -precision) + '.' + digits.slice(-precision) : digits;
  }

  // Inspect the first discarded digit once. This also handles a carry into
  // the next whole number, without converting a decimal through a binary float.
  function roundDecimal(value, places=0) {
    const n=parts(value,true);
    if(!n || !Number.isInteger(places) || places<0 || places>6)throw Error('Invalid decimal or rounding place');
    const kept=Number(n.whole+n.fraction.slice(0,places).padEnd(places,'0'));
    const next=n.fraction[places] || '0';
    return scaledText(kept+(next>='5'?1:0),places);
  }

  function operands(problem) {
    return problem.c == null ? [problem.a, problem.b] : [problem.a, problem.b, problem.c];
  }

  function combine(values, operator) {
    return operator === '-' ? values[0] - values[1] : values.reduce((sum, value) => sum + value, 0);
  }

  function analyze(problem, {firstIsSubtotal = false} = {}) {
    // Adding two valid eight-digit inputs can produce a nine-digit operand for the next addition.
    const numbers = operands(problem).map((value, index) => parts(value, firstIsSubtotal && index === 0));
    if (numbers.some(n => !n) || !['+', '-'].includes(problem.op) || (problem.op === '-' && numbers.length !== 2)) {
      throw Error('Invalid decimal problem');
    }
    const precision = Math.max(...numbers.map(n => n.fraction.length));
    const total = combine(numbers.map(n => atScale(n, precision)), problem.op);
    if (total < 0) throw Error('A subtraction problem needs a nonnegative difference');
    const answer = scaledText(total, precision);
    const wholeWidth = Math.max(answer.split('.')[0].length, ...numbers.map(n => n.whole.length));
    const width = wholeWidth + precision;
    function row(n) {
      return Array.from(n.whole.padStart(wholeWidth, ' ') + n.fraction.padEnd(precision, ' '));
    }
    const rows = numbers.map(row);
    const blanks = [];
    for (const [r, digits] of rows.entries()) {
      for (let i = wholeWidth; i < width; i++) {
        if (digits[i] === ' ') blanks.push({row:r, index:i});
      }
    }
    const placeNames = ['ones', 'tens', 'hundreds', 'thousands', 'ten-thousands', 'hundred-thousands', 'millions', 'ten-millions', 'hundred-millions'];
    const fractionNames = ['tenths', 'hundredths', 'thousandths', 'ten-thousandths', 'hundred-thousandths', 'millionths'];
    const columns = [];
    let incoming = 0;
    for (let i = width - 1; i >= 0; i--) {
      const digits = rows.map(row => Number(row[i]));
      const subtract = problem.op === '-';
      const raw = combine(digits, problem.op) + (subtract ? -incoming : incoming);
      const outgoing = subtract ? Number(raw < 0) : Math.floor(raw / 10);
      columns.push({
        index:i, digits, top:digits[0], bottom:digits[1], incoming, outgoing, digit:(raw + 10) % 10,
        place: i < wholeWidth ? placeNames[wholeWidth - 1 - i] : fractionNames[i - wholeWidth]
      });
      incoming = outgoing;
    }
    const roundedOperands = operands(problem).map(value => Number(roundDecimal(value)));
    const estimate = combine(roundedOperands, problem.op);
    const roundedAnswer = Number(roundDecimal(answer));
    return {rows, precision, wholeWidth, width, columns, blanks, total, answer, roundedOperands, estimate, roundedAnswer};
  }

  function sameDecimal(input, expected) {
    const given = parts(input, true);
    const want = parts(expected, true);
    if (!given || !want) return false;
    const precision = Math.max(given.fraction.length, want.fraction.length);
    return atScale(given, precision) === atScale(want, precision);
  }

  function pairPlan(problem, pair) {
    const values = operands(problem);
    if (problem.op !== '+' || values.length !== 3 || !Array.isArray(pair) || pair.length !== 2 ||
        !pair.every(i => Number.isInteger(i) && i >= 0 && i < 3) || pair[0] === pair[1]) {
      throw Error('Choose two different addends');
    }
    const remainingIndex = [0,1,2].find(i => !pair.includes(i));
    const subtotal = analyze({a:values[pair[0]], b:values[pair[1]], op:'+'}).answer;
    return {subtotal, remainingIndex, remaining:values[remainingIndex], answer:analyze(problem).answer};
  }

  function checkColumn(column, digit, outgoing) {
    if (!/^\d$/.test(String(digit))) return {ok:false, error:'columns'};
    if (!/^[012]?$/.test(String(outgoing)) || Number(outgoing) !== column.outgoing) return {ok:false, error:'regroup'};
    if (Number(digit) !== column.digit) return {ok:false, error: 'columns'};
    return {ok:true};
  }

  const examples = [
    ['1.2','3.5'], ['2.35','1.42'], ['1.9','2.31'], ['1.909','2.31'],
    ['3.978','2.56'], ['5.02','1.876']
  ];

  const schoolExample = {a:'1.987', b:'2.7964', c:'0.86', op:'+', world:6};

  function makePairProblem(world, options, random) {
    const tier = Number(options.tier) || (world === 6 ? 4 : world + 1);
    const pick = (lo, hi) => lo + Math.floor(random() * (hi - lo + 1));
    const precision = tier >= 5 ? 4 : tier >= 4 ? (random() < .25 ? 4 : 3) : tier >= 2 ? 2 : 1;
    const scale = 10 ** precision;
    // Advanced pairs sometimes end at tenths or hundredths; the last addition then regroups too.
    const useShortDecimal = tier >= 4 && random() < (tier >= 5 ? .70 : .35);
    let tail = useShortDecimal ? pick(2,7) * (scale / 10) : 0;
    if (useShortDecimal && tier >= 5 && random() < .5) tail += pick(1,9) * (scale / 100);
    let fraction = pick(tail + 1, scale - 1);
    if (fraction % 10 === 0) fraction++;
    const maxWhole = tier >= 6 ? 29 : tier >= 4 ? 14 : 6;
    const firstWhole = pick(1, maxWhole);
    let secondWhole = pick(1, maxWhole);
    if (secondWhole === firstWhole && 2 * fraction === scale + tail) secondWhole++;
    const first = scaledText(firstWhole * scale + fraction, precision);
    const second = scaledText(secondWhole * scale + scale + tail - fraction, precision);
    const otherPrecision = precision === 1 ? 1 : pick(1, precision - 1);
    const otherScale = 10 ** otherPrecision;
    const minOther = useShortDecimal ? Math.ceil((scale-tail) / (scale/otherScale)) : 1;
    let other = scaledText(pick(1, maxWhole) * otherScale + pick(minOther,otherScale - 1), otherPrecision);
    if (sameDecimal(other,first) || sameDecimal(other,second)) {
      other = scaledText(atScale(parts(other),otherPrecision) + (maxWhole+1)*otherScale, otherPrecision);
    }
    const values = [first, second, other];
    for (let i=values.length-1; i>0; i--) {
      const j=pick(0,i);
      [values[i],values[j]]=[values[j],values[i]];
    }
    if (options.avoid?.c != null && operands(options.avoid).every((v,i)=>v===values[i])) {
      const n=parts(values[0]);
      values[0] = (Number(n.whole)+1)+'.'+n.fraction;
    }
    return {a:values[0],b:values[1],c:values[2],op:'+',world,kind:'pair'};
  }

  function makeSchoolProblem(options, random) {
    if (options.first) return {...schoolExample};
    const pick = (min, max) => min + Math.floor(random() * (max - min + 1));
    const doubleCarry = options.focus === 'regroup' || random() < 0.45;
    const acrossDecimal = random() < 0.5;
    const avoid = options.avoid && operands(options.avoid);
    const repeated = p => avoid && operands(p).every((value, i) => value === avoid[i]);
    for (let attempt = 0; attempt < 60; attempt++) {
      const longest = options.tier >= 5 ? 4 : pick(3, 4);
      const places = [longest, pick(1, longest - 1), pick(1, longest)];
      const start = pick(0, 2);
      const values = [0, 1, 2].map((_, i) => {
        const length = places[(i + start) % 3];
        const scale = 10 ** length;
        const maxWhole = options.focus === 'align' && i === 0 ? 19 : 9;
        return scaledText(pick(1, (maxWhole + 1) * scale - 1), length);
      });
      const [a, b, c] = values;
      const p = {a, b, c, op:'+', world:6};
      if (repeated(p)) continue;
      const plan = analyze(p);
      const carriesInFractions = plan.columns.filter(column => column.index >= plan.wholeWidth && column.outgoing);
      if (!carriesInFractions.length) continue;
      if (doubleCarry && !carriesInFractions.some(column => column.outgoing === 2)) continue;
      if (acrossDecimal && !carriesInFractions.some(column => column.place === 'tenths')) continue;
      if (options.focus === 'estimate' && !values.some(v => /^[456]/.test(parts(v).fraction))) continue;
      if (options.focus === 'answer' && !plan.answer.endsWith('0')) continue;
      return {...p, offset: random() < 0.5 ? 1 : -1};
    }
    // Even a constant random source must terminate with a real regrouping exercise.
    const primary = options.focus === 'answer' ? {...schoolExample, b:'2.7960'} : schoolExample;
    const fallback = repeated(primary) ? {a:'3.9970', b:'1.896', c:'0.7', op:'+', world:6} : primary;
    return {...fallback, offset: random() < 0.5 ? 1 : -1};
  }

  function makeProblem(world, options = {}) {
    const index = Math.max(0, Math.min(6, Math.trunc(Number(world)) || 0));
    const op = index === 5 ? '-' : '+';
    const random = options.random || Math.random;
    if (options.pair && index !== 5 && !(index === 6 && options.first)) return makePairProblem(index,options,random);
    if (index === 6) return makeSchoolProblem(options, random);
    const pick = (low, high) => low + Math.floor(random() * (high - low + 1));
    const decimal = (digits) => scaledText(pick(10 ** digits, 7 * 10 ** digits - 1), digits);
    const needsRegroup = index === 4 || options.focus === 'regroup';
    function facing(problem) {
      // Either direction is possible. The first encounter always starts one place to the right.
      return {...problem, offset: random() < 0.5 ? 1 : -1};
    }
    function roll() {
      const reverse = random() < 0.5;
      const unequal = options.focus === 'zeros' || options.focus === 'align';
      let lengths = [[1,1],[2,2],[1,2],[3,2],[3,2],[2,3]][index].slice();
      if (index === 0 && options.focus === 'zeros') lengths = [1,0];
      if (index === 1 && unequal) lengths = [2,1];
      if (index === 3 && !unequal && random() < 0.35) lengths = [3,3];
      if (reverse) lengths.reverse();
      let a = decimal(lengths[0]);
      let b = decimal(lengths[1]);
      if (options.focus === 'align') a = '1' + a;
      if (op === '-') {
        const p = Math.max(...lengths);
        if (atScale(parts(a),p) < atScale(parts(b),p)) [a,b] = [b,a];
      }
      return {a, b, op, world:index};
    }
    if (options.first) return {a:examples[index][0], b:examples[index][1], op, world:index};
    for (let attempt = 0; attempt < 60; attempt++) {
      const problem = roll();
      const plan = analyze(problem);
      const regroup = plan.columns.some(c => c.outgoing);
      if (options.avoid && problem.a === options.avoid.a && problem.b === options.avoid.b) continue;
      if (needsRegroup && !regroup) continue;
      if (index === 0 && !needsRegroup && regroup) continue;
      if (options.focus === 'columns' && index < 4 && regroup) continue;
      if (options.focus === 'estimate' && ![problem.a,problem.b].some(v => /^[456]/.test(parts(v).fraction))) continue;
      if (options.focus === 'answer' && !plan.answer.endsWith('0')) continue;
      if (op === '-' && plan.total === 0) continue;
      return facing(problem);
    }
    const fallbacks = [['2.8','3.7'],['1.96','2.17'],['2.8','3.47'],['2.908','3.27'],examples[4],examples[5]];
    const pair = needsRegroup ? fallbacks[index] : examples[index];
    return facing({a:pair[0], b:pair[1], op, world:index});
  }

  function checkZeros(blanks, values) {
    return blanks.every(({row,index}) => values[row + '-' + index] === '0');
  }

  function spellDamage(steps) {
    if (steps.subtotal) return 20 + (steps.answer ? 10 : 0) + (steps.estimate ? 5 : 0);
    return (steps.align ? 5 : 0) + (steps.zeros ? 5 : 0) + (steps.columns ? 10 : 0)
      + (steps.answer ? 10 : 0) + (steps.estimate ? 5 : 0);
  }

  return {makeProblem, operands, analyze, pairPlan, roundDecimal, sameDecimal, checkColumn, checkZeros, spellDamage};
});
