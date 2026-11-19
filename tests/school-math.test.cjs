const test = require('node:test');
const assert = require('node:assert/strict');
const math = require('../web/math.js');

function seeded(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function scaled(s, precision) {
  const [whole, fraction = ''] = s.split('.');
  return BigInt((whole || '0') + fraction.padEnd(precision, '0'));
}

function verify(p) {
  const values = math.operands(p);
  const plan = math.analyze(p);
  const precision = Math.max(...values.map(x => (x.split('.')[1] || '').length));
  const sum = values.reduce((total, value) => total + scaled(value, precision), 0n);
  assert.equal(scaled(plan.answer, precision), sum);
  assert.equal(BigInt(plan.total), sum);
  assert.equal(BigInt(plan.columns.toReversed().map(c => c.digit).join('')), sum);
  const roundingUnit = 10n ** BigInt(precision);
  const rounded = values.map(v => Number((scaled(v, precision) + roundingUnit / 2n) / roundingUnit));
  assert.deepEqual(plan.roundedOperands, rounded);
  assert.equal(plan.estimate, rounded.reduce((n, x) => n + x, 0));
  let carry = 0;
  for (const c of plan.columns) {
    assert.equal(c.incoming, carry);
    const total = c.digits.reduce((amount, digit) => amount + digit, carry);
    assert.equal(c.digit, total % 10);
    carry = Math.floor(total / 10);
    assert.equal(c.outgoing, carry);
    assert.deepEqual(math.checkColumn(c, String(c.digit), String(carry)), {ok:true});
  }
  assert.equal(carry, 0);
  return plan;
}

test('schoolwork demonstrates 7 + 6 = 13, then carries two tens from a three-addend column', () => {
  const p = math.makeProblem(6, {first:true});
  assert.deepEqual(math.operands(p), ['1.987', '2.7964', '0.86']);
  const plan = verify(p);
  assert.equal(plan.answer, '5.6434');
  assert.deepEqual(plan.roundedOperands, [2, 3, 1]);
  assert.equal(plan.estimate, 6);
  assert.deepEqual(plan.blanks, [{row:0,index:4}, {row:2,index:3}, {row:2,index:4}]);
  const zeros = {'0-4':'0', '2-3':'0', '2-4':'0'};
  assert.ok(math.checkZeros(plan.blanks, zeros));
  assert.equal(math.checkZeros(plan.blanks, {...zeros, '2-4':'1'}), false);
  assert.deepEqual(plan.columns.map(c => [c.digit,c.incoming,c.outgoing]),
    [[4,0,0], [3,0,1], [4,1,2], [6,2,2], [5,2,0]]);
  assert.deepEqual(plan.columns[1].digits, [7,6,0]);
  assert.deepEqual(plan.columns[2].digits, [8,9,6]);
  const c = plan.columns[2];
  for (const wrong of ['', 0, 1, 3, '02', '2x']) {
    assert.deepEqual(math.checkColumn(c, '4', wrong), {ok:false,error:'regroup'});
  }
});

test('school practice varies precision and order while guaranteeing real fractional regrouping', () => {
  const random = seeded(842298);
  const lengthsAcross = new Set();
  const longRows = new Set();
  const answers = new Set();
  const transferValues = new Set();
  const maximumPlaces = new Set();
  let before = null;
  for (const focus of [null,'zeros','align','columns','answer','regroup','estimate']) {
    for (let i = 0; i < 190; i++) {
      const p = math.makeProblem(6, {random, focus, avoid:before});
      assert.equal(p.world, 6);
      assert.equal(p.op, '+');
      assert.equal(math.operands(p).length, 3);
      if (before) assert.notDeepEqual(math.operands(p), math.operands(before));
      before = p;
      const lengths = math.operands(p).map(v => v.split('.')[1].length);
      assert.ok(lengths.every(n => 1 <= n && n <= 4));
      assert.ok(new Set(lengths).size >= 2);
      lengths.forEach(n => lengthsAcross.add(n));
      maximumPlaces.add(Math.max(...lengths));
      longRows.add(lengths.indexOf(Math.max(...lengths)));
      const plan = verify(p);
      assert.ok(plan.blanks.length > 0);
      const fraction = plan.columns.filter(c => c.index >= plan.wholeWidth);
      assert.ok(fraction.some(c => c.outgoing > 0));
      fraction.forEach(c => transferValues.add(c.outgoing));
      if (focus === 'regroup') assert.ok(fraction.some(c => c.outgoing === 2));
      if (focus === 'answer') assert.ok(plan.answer.endsWith('0'));
      answers.add(plan.answer);
    }
  }
  assert.deepEqual([...lengthsAcross].sort(), [1,2,3,4]);
  assert.deepEqual([...maximumPlaces].sort(), [3,4]);
  assert.deepEqual([...longRows].sort(), [0,1,2]);
  assert.deepEqual([...transferValues].sort(), [0,1,2]);
  assert.ok(answers.size >= 1100);
});

test('constant randomness still generates a different, valid regrouping exercise', () => {
  for (const random of [() => 0, () => 0.99999999]) {
    let avoid = math.makeProblem(6, {first:true});
    for (let i = 0; i < 3; i++) {
      const p = math.makeProblem(6, {random, avoid, focus:'regroup'});
      assert.notDeepEqual(math.operands(p), math.operands(avoid));
      assert.ok(verify(p).columns.some(c => c.outgoing === 2));
      avoid = p;
    }
  }
});

test('legacy pairs retain their generated shapes; three-term sums stay exact at the input limits', () => {
  for (let i = 0; i < 6; i++) {
    const p = math.makeProblem(i, {first:true});
    assert.equal(Object.hasOwn(p, 'c'), false);
    assert.deepEqual(math.operands(p), [p.a, p.b]);
    for (const c of math.analyze(p).columns) assert.deepEqual(c.digits, [c.top,c.bottom]);
  }
  const p = {a:'99999999.999999', b:'99999999.999999', c:'99999999.999999', op:'+'};
  const plan = verify(p);
  assert.equal(plan.answer, '299999999.999997');
  assert.equal(math.sameDecimal(plan.answer, plan.answer), true);
  assert.equal(math.sameDecimal('299999999.999996', plan.answer), false);
  assert.equal(math.sameDecimal('5.64340', '5.6434'), true);
  assert.throws(() => math.analyze({...p, c:'one'}), /Invalid decimal/);
  assert.throws(() => math.analyze({...p, op:'-'}), /Invalid decimal/);
  assert.equal(math.analyze({a:'5.02', b:'1.876', op:'-'}).answer,'3.144');
});

test('grouping puzzles include a helpful pair and grow in precision and regrouping with the tier',()=>{
  const random=seeded(1107);
  const twins=[[0,1],[0,2],[1,2]];
  const positions=new Set();
  for(let tier=1;tier<=6;tier++){
    let previous;
    const precisions=new Set(), outcomes=new Set();
    for(let i=0;i<60;i++){
      const p=math.makeProblem(tier<4?0:6,{tier,pair:true,random,avoid:previous});
      assert.equal(p.kind,'pair');assert.equal(p.op,'+');
      const vals=math.operands(p);
      if(previous)assert.notDeepEqual(vals,math.operands(previous));
      previous=p;
      const digits=Math.max(...vals.map(s=>s.split('.')[1].length));
      precisions.add(digits);
      const total=vals.reduce((sum,val)=>sum+scaled(val,digits),0n);
      let friendly=false,whole=false;
      for (const pair of twins){
        const work=math.pairPlan(p,pair);
        const partial=scaled(vals[pair[0]],digits)+scaled(vals[pair[1]],digits);
        assert.equal(scaled(work.subtotal,digits),partial);
        assert.equal(scaled(work.remaining,digits)+partial,total);
        assert.equal(scaled(work.answer,digits),total);
        assert.deepEqual(work,math.pairPlan(p,[pair[1],pair[0]]));
        if(partial % (10n**BigInt(digits))===0n) whole=true;
        if(partial % 10n===0n) {friendly=true;positions.add(pair.join(','));}
      }
      assert.ok(friendly);
      outcomes.add(whole?'whole':'short decimal');
      if(tier<4)assert.ok(whole);
    }
    assert.deepEqual([...precisions].sort(),tier===1?[1]:tier<4?[2]:tier===4?[3,4]:[4]);
    if(tier>=4)assert.equal(outcomes.size,2);
  }
  assert.equal(positions.size,3);
  assert.equal(math.makeProblem(5,{pair:true}).op,'-');
  assert.deepEqual(math.makeProblem(6,{first:true,pair:true}),math.makeProblem(6,{first:true}));
  assert.equal(math.makeProblem(6,{tier:6}).kind,undefined);
  assert.equal(math.analyze(math.makeProblem(6,{tier:6})).precision,4);
});

test('pair plans validate the selected cards and stay exact through nine-digit intermediate sums',()=>{
  const p={a:'99999999.999999', b:'99999999.999999', c:'99999999.999999', op:'+'};
  assert.deepEqual(math.pairPlan(p,[0,2]),{subtotal:'199999999.999998', remainingIndex:1, remaining:p.b, answer:'299999999.999997'});
  for(const choice of [null, [0], [2,2],[-1,0],[0,3],['1',2],[0,1,2]])assert.throws(()=>math.pairPlan(p,choice));
  assert.throws(()=>math.pairPlan({...p,op:'-'},[0,1]));
  const recurring=()=>0;
  const first=math.makeProblem(6,{pair:true,tier:6,random:recurring});
  const next=math.makeProblem(6,{pair:true,tier:6,random:recurring,avoid:first});
  assert.notDeepEqual(math.operands(first),math.operands(next));
});
