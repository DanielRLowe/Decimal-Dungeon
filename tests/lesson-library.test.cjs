const test=require('node:test');
const assert=require('node:assert/strict');
const lessons=require('../web/lessons.js');
const board=require('../web/lesson-board.js');
const math=require('../web/math.js');
function sequence(seed) {
  return ()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
}
const required=[
  'OA.A.1','OA.A.2','OA.B.3','NBT.A.1','NBT.A.2','NBT.A.3','NBT.A.4','NBT.B.5','NBT.B.6','NBT.B.7',
  'NF.A.1','NF.A.2','NF.B.3','NF.B.4','NF.B.5','NF.B.6','NF.B.7','MD.A.1','MD.B.2','MD.C.3','MD.C.4','MD.C.5','G.A.1','G.A.2','G.B.3'
].map(s=>'5.'+s);
test('each Tennessee grade 5 content standard has practice and every style has a worked tutorial',()=>{
  const codes=new Set(lessons.list.flatMap(l=>l.codes));
  for(const code of required)assert.ok(codes.has(code),code);
  assert.equal(new Set(lessons.list.map(x=>x.id)).size,lessons.list.length);
  for(const item of lessons.list){
    assert.ok(item.tutorial.intro && item.tutorial.steps.length>=2,item.id);
    for(let level=1;level<=3;level++)for(let i=0;i<20;i++) {
      const p=lessons.make(item.id,level,i,sequence(i+level)), again=lessons.make(item.id,level,i,sequence(i+level));
      assert.deepEqual(p,again);
      assert.equal(lessons.identify(p).id,item.id);
      if(p.kind==='lesson') {
        assert.ok(p.prompt&&p.steps.length>=2,item.id);
        for(const step of p.steps) {
          assert.ok(step.hint && step.prompt,item.id);
          const correct=[].concat(step.answer);
          for(const answer of correct)assert.ok(board.matches(step,answer),item.id+' '+answer);
          if(step.choices) {
            assert.ok(step.choices.length>=2);
            assert.equal(step.choices.filter(x=>board.matches(step,x)).length,1,item.id+' '+step.prompt);
          }
        }
      } else assert.ok(math.analyze(p).columns.length>=2);
    }
  }
});
test('numeric answers support exact decimal, fraction, mixed number, and coordinate equivalents',()=>{
  const check=(answer,raw,extras)=>board.matches({answer,...extras},raw);
  for(const answer of ['3/2','1 1/2','1.50','1½','1 ½','6/4'])assert.ok(check('1 1/2',answer,{format:'fraction'}),answer);
  assert.ok(check('1024','1,024'));assert.ok(check('2*(8+7)','2 × [8 + 7]'));
  assert.ok(check('5,2','(5, 2)',{plot:true}));
  for(const bad of ['2,5','(5,2','5,2)','text'])assert.equal(check('5,2',bad,{plot:true}),false);
  for(const bad of ['1 5','1,5','1/0','','0.15','1.50001'])assert.equal(check('15',bad),false);
  assert.equal(check('1/3','0.3333',{format:'fraction'}),false);
});
test('sustained independent practice gives optional recommendations across levels and topics',()=>{
  let entries=[];
  const run={history:entries};
  const add=(id,level,independent=true)=>entries.push({problem:lessons.make(id,level,0,sequence(30)),difficulty:level,independent});
  const next=()=>lessons.nextPractice([run],'prism-volume',2);
  add('prism-volume',2,false);add('prism-volume',2);
  assert.deepEqual(next(),{lessonId:'prism-volume',difficulty:2,target:3,independent:1});
  add('prism-volume',2);add('prism-volume',2);assert.equal(next().difficulty,3);
  for(let n=0;n<3;n++)add('prism-volume',3);
  assert.equal(next().lessonId,'composite-volume');
  assert.equal(next().difficulty,2);
});
test('measurement generators encode independently recoverable volumes, conversions, and line-plot answers',()=>{
  for(let level=1;level<=3;level++)for(let i=0;i<24;i++) {
    const make=id=>lessons.make(id,level,i,sequence(903+i*level));
    const cubes=make('unit-cubes'), {l,w,h}=cubes.model;
    assert.equal(cubes.steps[0].answer,String(l*w));assert.equal(cubes.steps[2].answer,String(l*w*h));
    const composite=make('composite-volume'),solid=composite.model;
    assert.ok(solid.b<solid.l);assert.equal(composite.steps.at(-1).answer,String(solid.w*(solid.l*solid.h+solid.b*solid.top)));
    const plot=make('line-plots'), denom=[2,4,8][level-1], toUnits=s=>{
      const [n,d=1]=s.split('/').map(Number);return n*denom/d;
    };
    const samples=plot.prompt.match(/measure (.+) feet\./)[1].split(', ');
    const total=samples.reduce((n,s)=>n+toUnits(s),0);
    for(const step of plot.steps.filter(s=>s.tick!=null))assert.equal(+step.answer,samples.filter(s=>s===plot.model.labels[step.tick]).length);
    assert.ok(board.matches(plot.steps[plot.model.labels.length],total+'/'+denom));
    if(level===3)assert.ok(board.matches(plot.steps.at(-1),total+'/'+(denom*samples.length)));
    const conversion=make('unit-conversions'),amount=conversion.prompt.match(/two amounts, ([\d.]+)/)[1];
    assert.equal(+conversion.steps[1].answer,+amount*+conversion.steps[0].answer);
    const graph=make('coordinate-stories');
    const point=graph.steps.find(s=>s.plot).answer.split(',').map(Number);
    assert.ok(point.every(n=>n>=0 && n<=graph.model.max));
  }
});
test('lesson mastery follows checked original work across battles, sessions and eras',()=>{
  const rows=[], add=(id,level,independent=true,reviews=0)=>{
    const round=rows.length+1;
    rows.push({roundId:round,at:round*100,independent,reviewCount:reviews,problem:lessons.make(id,level,round,sequence(round)),difficulty:level});
  };
  const history=()=>[{history:rows.filter(r=>r.roundId%2===0).reverse()},{history:rows.filter(r=>r.roundId%2)}];
  const recommended=()=>lessons.campaignPractice(history());
  assert.deepEqual(recommended(),{lessonId:'place-value',difficulty:2});
  add('place-value',1,true,2);add('place-value',2,false);add('place-value',2);add('place-value',3);
  assert.equal(lessons.tracker(history()).mastered,0);
  add('place-value',2);add('place-value',1,false);
  const report=lessons.tracker(history());
  assert.equal(report.mastered,1);
  assert.deepEqual(report.lessons.find(item=>item.lessonId==='place-value'),{lessonId:'place-value',completed:6,independent:4,qualifying:3,mastered:true,extraPractice:1,reviews:2,masteredAt:500,masteredRoundId:5});
  assert.equal(recommended().lessonId,'powers-of-ten');
  const seen=new Set(['place-value']);
  for(let i=1;i<report.total;i++) {
    const next=recommended();assert.ok(!seen.has(next.lessonId));seen.add(next.lessonId);
    for(let n=0;n<3;n++)add(next.lessonId,2);
  }
  assert.equal(lessons.tracker(history()).mastered,report.total);
  assert.equal(recommended().difficulty,3);
});
