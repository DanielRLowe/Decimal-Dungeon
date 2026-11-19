'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const mat=require('../web/fraction-workmat.js'),lessons=require('../web/lessons.js'),board=require('../web/lesson-board.js');
const legacy={lessonId:'fraction-add',prompt:'A recipe uses 2 1/6 cups of oats and 1/8 cups of seeds. How many cups is that together?',
  model:{type:'bars',bars:[{label:'Fractional part of 2 1/6 cups',numerator:1,denominator:6},{label:'Fractional part of 1/8 cups',numerator:1,denominator:8}]}};
function fresh(problem){const p=mat.readProblem(problem);assert.ok(p);return [p,mat.safeState(p,null)];}
function move(p,s,id){assert.ok(mat.tryMove(p,mat.pileState(p,s),id),'Unavailable move '+id);s.moves.push(id);}
function pack(p,s){
  const b=p.operands[1];
  while(mat.pileState(p,s).movedWhole<b.w) move(p,s,'whole');
  while(mat.pileState(p,s).movedLoose<b.part){
    const q=mat.pileState(p,s);
    if(mat.tryMove(p,q,'five'))move(p,s,'five');
    else if(mat.tryMove(p,q,'piece'))move(p,s,'piece');
    else move(p,s,'trade');
  }
  if(mat.tryMove(p,mat.pileState(p,s),'trade'))move(p,s,'trade');
}
function random(seed){let x=seed;return ()=>((x=(Math.imul(x,1664525)+1013904223)>>>0)/4294967296);}
test('screenshot exercise keeps its two whole cups when loading either legacy representation',()=>{
  const [p,s]=fresh(legacy);
  assert.deepEqual(p,mat.readProblem({...legacy,model:null}));assert.equal(p.den,24);
  assert.deepEqual(s.marks,[null,null]);assert.deepEqual(s.multiples,[null,null]);assert.deepEqual(s.counts,[{whole:'',part:''},{whole:'',part:''}]);
  assert.equal(mat.evaluate(p,s,0).ok,false);
  s.marks=[5,0];assert.equal(mat.evaluate(p,s,0).ok,false);s.marks=[4,0];assert.equal(mat.evaluate(p,s,0).ok,true);
  assert.equal((s.marks[0]+s.marks[1])/2,2);
  s.multiples=[48,48];assert.match(mat.evaluate(p,s,1).text,/earlier/);s.multiples=[24,24];assert.equal(mat.evaluate(p,s,1).ok,true);
  s.splits=[4,3];s.counts[0]={whole:'',part:'4'};assert.equal(mat.evaluate(p,s,2).ok,false);
  s.counts[0].whole='48';assert.equal(mat.evaluate(p,s,2).ok,true);assert.equal(p.operands[0].count,52);
  s.counts[1].part='3';assert.equal(mat.evaluate(p,s,3).ok,true);assert.equal(p.operands[1].count,3);
  move(p,s,'piece');move(p,s,'piece');assert.equal(mat.evaluate(p,s,4).ok,false);
  const stored=JSON.stringify(s);const resumed=mat.safeState(p,JSON.parse(stored));assert.deepEqual(resumed,s);
  move(p,resumed,'piece');assert.equal(mat.evaluate(p,resumed,4).ok,true);
  const pile=mat.pileState(p,resumed);assert.equal(pile.whole,2);assert.equal(pile.loose,7);assert.equal(pile.whole*p.den+pile.loose,55);
  assert.equal(mat.tryMove(p,pile,'piece'),null);
  assert.ok(board.matches({answer:'55/24',format:'fraction'},'2 7/24'));
});
test('at one and three quarters a tie goes to the higher benchmark; a wrong selection stays editable',()=>{
  const [p,s]=fresh({lessonId:'fraction-subtract',prompt:'A spool holds 2 1/4 meters. You cut off 3/4 meters.'});
  s.marks=[4,2];assert.match(mat.evaluate(p,s,0).text,/exactly halfway/);
  s.marks=[5,1];assert.match(mat.evaluate(p,s,0).text,/higher/);
  s.marks=[5,2];assert.equal(mat.evaluate(p,s,0).ok,true);
});
test('mixed subtraction physically trades a whole before removing otherwise unavailable pieces and undo reverses that exchange',()=>{
  const [p,s]=fresh({lessonId:'fraction-subtract',prompt:'A spool holds 3 1/6 meters. You cut off 1 7/8 meters. How many meters remain?'});
  move(p,s,'whole');assert.equal(mat.tryMove(p,mat.pileState(p,s),'five'),null);
  assert.match(mat.evaluate(p,s,4).text,/Trade one whole/);
  move(p,s,'trade');const afterTrade=mat.pileState(p,s);assert.equal(afterTrade.whole,1);assert.equal(afterTrade.loose,28);
  s.moves.pop();assert.equal(mat.pileState(p,s).loose,4);move(p,s,'trade');move(p,s,'five');
  const resumed=mat.safeState(p,JSON.parse(JSON.stringify(s)));pack(p,resumed);
  assert.deepEqual(mat.pileState(p,resumed),{whole:1,loose:7,movedWhole:1,movedLoose:21});
  assert.equal(mat.evaluate(p,resumed,4).ok,true);
});
test('addition needs an explicit trade to collect a full row of loose pieces',()=>{
  const [p,s]=fresh({lessonId:'fraction-add',prompt:'Add 1 5/6 cups and 7/8 cups.'});
  for(let j=0;j<4;j++)move(p,s,'five');move(p,s,'piece');
  assert.equal(mat.evaluate(p,s,4).ok,false);assert.match(mat.evaluate(p,s,4).text,/trade/i);
  move(p,s,'trade');assert.deepEqual(mat.pileState(p,s),{whole:2,loose:17,movedWhole:0,movedLoose:21});
  assert.equal(mat.evaluate(p,s,4).ok,true);
});
test('fraction work agrees with every graded step across generated levels and survives serialization',()=>{
  for(const id of ['fraction-add','fraction-subtract'])for(let l=1;l<=3;l++)for(let i=0;i<70;i++){
    const pr=lessons.make(id,l,i,random(99*i+l)),[p,s]=fresh(pr),[a,b]=p.operands,sign=p.op==='+'?1:-1;
    assert.deepEqual(mat.readProblem({...pr,fractionWork:null}),p);
    s.marks=[a.nearest,b.nearest];s.multiples=[p.den,p.den];
    const answers=[(a.nearest+sign*b.nearest)+'/2',p.den,a.count,b.count,(a.count+sign*b.count)+'/'+p.den];
    for(const [j,o] of p.operands.entries()){
      s.splits[j]=p.den/o.d;s.counts[j]={whole:String(o.w*p.den),part:String(o.part)};
    }
    pack(p,s);const pile=mat.pileState(p,s);
    assert.equal(pile.whole*p.den+pile.loose,a.count+sign*b.count);
    for(let j=0;j<5;j++){
      assert.equal(mat.evaluate(p,s,j).ok,true,id+' '+pr.prompt+' step '+j);
      assert.ok(board.matches(pr.steps[j],String(answers[j])));
    }
    assert.deepEqual(mat.safeState(p,JSON.parse(JSON.stringify(s))),s);
  }
});
test('scratch choices belong to one problem; unrelated and unrecognizable old lessons keep their original board',()=>{
  const [p,s]=fresh(legacy);s.marks=[4,0];
  const other=mat.readProblem({lessonId:'fraction-add',prompt:'Add 2 1/6 cups and 3/8 cups.'});
  assert.deepEqual(mat.safeState(other,s).marks,[null,null]);
  assert.equal(mat.readProblem({...legacy,lessonId:'whole-multiply'}),null);
  assert.equal(mat.readProblem({lessonId:'fraction-add',prompt:'Older format'}),null);
  assert.equal(mat.render({lessonId:'unrelated'},0,{},()=>{}),null);
});

const quarterRecipe = {
  kind:'lesson', lessonId:'fraction-add', world:0, level:2,
  prompt:'A recipe uses 4 3/4 cups of oats and 1/6 cups of seeds. How many cups is that together?',
  model:{type:'bars',bars:[
    {label:'Fractional part of 4 3/4 cups',numerator:3,denominator:4},
    {label:'Fractional part of 1/6 cups',numerator:1,denominator:6}
  ]},
  steps:[
    {prompt:'Estimate the total to the nearest half.',answer:'5',format:'fraction'},
    {prompt:'What is the least common denominator?',answer:'12'},
    {prompt:'Write 4 3/4 with denominator 12. What is its numerator?',answer:'57'},
    {prompt:'Write 1/6 with denominator 12. What is its numerator?',answer:'2'},
    {prompt:'What is the exact amount in cups?',answer:'59/12',format:'fraction'}
  ]
};
const roundTrip = value => JSON.parse(JSON.stringify(value));

test('counting whole bars and shaded quarters builds 57 twelfths in any order, independently for each operand', () => {
  const [p,s] = fresh(quarterRecipe);
  assert.equal(p.den,12);
  assert.deepEqual(p.operands.map(o => [o.w,o.r,o.count]),[[4,3,57],[0,1,2]]);
  assert.ok(mat.setSplit(p,s,0,4));
  assert.equal(mat.toggleTally(p,s,0,'whole',0),false);
  assert.equal(mat.evaluate(p,s,2).ok,false);
  assert.ok(mat.setSplit(p,s,0,3));
  for (const [category,index] of [['whole',4],['part',3],['part',-1],['part',.5]]) {
    assert.equal(mat.toggleTally(p,s,0,category,index),false);
  }
  for (const idx of [2,0,3]) assert.ok(mat.toggleTally(p,s,0,'whole',idx));
  assert.deepEqual(s.tallies[0].whole,[0,2,3]);
  assert.equal(s.counts[0].whole,'36');
  assert.ok(mat.toggleTally(p,s,0,'whole',2));
  assert.equal(s.counts[0].whole,'24');
  assert.ok(mat.toggleTally(p,s,0,'part',1));
  assert.equal(s.counts[0].part,'3');
  assert.equal(mat.evaluate(p,s,2).ok,false);
  const resumed = mat.safeState(p,roundTrip(s));
  assert.deepEqual(resumed,s);
  for (const idx of [1,2]) assert.ok(mat.toggleTally(p,resumed,0,'whole',idx));
  for (const idx of [0,2]) assert.ok(mat.toggleTally(p,resumed,0,'part',idx));
  assert.deepEqual(resumed.counts[0],{whole:'48',part:'9'});
  assert.ok(mat.evaluate(p,resumed,2).ok);
  assert.ok(board.matches(quarterRecipe.steps[2],String(48+9)));
  assert.equal(board.matches(quarterRecipe.steps[2],'57/12'),false);
  assert.ok(mat.setSplit(p,resumed,1,2));
  assert.equal(mat.toggleTally(p,resumed,1,'whole',0),false);
  assert.ok(mat.toggleTally(p,resumed,1,'part',0));
  assert.deepEqual(resumed.counts[1],{whole:'',part:'2'});
  assert.ok(mat.evaluate(p,resumed,3).ok);
  assert.deepEqual(resumed.tallies[0],{whole:[0,1,2,3],part:[0,1,2]});
  assert.equal(board.matches(quarterRecipe.steps[4],'4 10/12'),false);
  assert.ok(board.matches(quarterRecipe.steps[4],'4 11/12'));
});

test('a new cut clears counts sourced from taps and preserves the other typed subtotal', () => {
  const [p,s] = fresh(quarterRecipe);
  mat.setSplit(p,s,0,3);
  s.counts[0].whole='48';
  for (let idx=0;idx<3;idx++) mat.toggleTally(p,s,0,'part',idx);
  assert.ok(mat.evaluate(p,s,2).ok);
  assert.ok(mat.setSplit(p,s,0,4));
  assert.deepEqual(s.tallies[0],{whole:[],part:[]});
  assert.deepEqual(s.counts[0],{whole:'48',part:''});
  assert.equal(mat.evaluate(p,s,2).ok,false);
  mat.setSplit(p,s,0,3);
  assert.equal(mat.evaluate(p,s,2).ok,false);
  mat.toggleTally(p,s,0,'whole',0);
  assert.equal(s.counts[0].whole,'12');
});

test('a pre-tally draft retains typed counts and check results without fabricating tapped pieces', () => {
  const [p] = fresh(quarterRecipe);
  const old = {
    version:1,key:p.key,marks:[10,0],multiples:[12,12],splits:[3,2],
    counts:[{whole:'48',part:'9'},{whole:'',part:'2'}],moves:[],checked:[true,true,true,true,false]
  };
  const restored=mat.safeState(p,roundTrip(old));
  assert.deepEqual(restored.counts,old.counts);
  assert.deepEqual(restored.checked,old.checked);
  assert.deepEqual(restored.tallies,[{whole:[],part:[]},{whole:[],part:[]}]);
  assert.deepEqual(mat.safeState(p,roundTrip(restored)),restored);
  for(let index=0;index<4;index++) assert.ok(mat.evaluate(p,restored,index).ok);
  assert.equal(mat.evaluate(p,restored,4).ok,false);
  assert.equal(mat.safeState(p,{...old,counts:[{whole:'47',part:'9'}]}).counts[0].whole,'47');
  assert.equal(mat.evaluate(p,mat.safeState(p,{...old,counts:[{whole:'47',part:'9'}]}),2).ok,false);
});

test('older fraction problems and their original five checked answers stay intact when resumed or replayed', () => {
  const gameModel=require('../web/adventure.js');
  const data=new Map();
  const storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};
  let issued=0;
  const open=()=>gameModel.open(storage,{lessons:{
    has:id=>id==='fraction-add',
    make() {assert.equal(issued++,0,'A held or historical fraction must retain the issued problem');return roundTrip(quarterRecipe);}
  }});
  let game=open();
  const session=game.startLesson('fraction-add',2);
  const original=game.startRound();
  const [p]=fresh(original.problem);
  const originalDraft={
    identity:JSON.stringify([original.lessonId,quarterRecipe.prompt,quarterRecipe.steps.map(s=>s.answer)]),
    verified:['5','12'],value:'56',errors:1,hints:1,
    fractionWork:{version:1,key:p.key,marks:[10,0],multiples:[12,12],splits:[3,1],
      counts:[{whole:'48',part:'9'},{whole:'',part:''}],moves:[],checked:[true,true,true,false,false]}
  };
  game.saveDraft(original.id,originalDraft);
  game=open();
  const pending=game.startRound();
  assert.deepEqual(pending.problem,quarterRecipe);
  assert.deepEqual(pending.draft,originalDraft);
  assert.deepEqual(mat.readProblem(pending.problem),p);
  assert.ok(mat.evaluate(p,mat.safeState(p,pending.draft.fractionWork),2).ok);
  const answers=['5','12','57','2','4 11/12'];
  const work=quarterRecipe.steps.map((s,i)=>({prompt:s.prompt,answer:answers[i]}));
  const result={answer:answers.at(-1),damage:35,fullyWorked:true,independent:false,errors:{reasoning:1},hints:1,work};
  const receipt=game.finishRound(pending.id,result);
  game=open();
  assert.deepEqual(game.startRound().receipt,receipt);
  const rewards=[game.state.stats.count,game.state.xp,game.state.coins];
  assert.deepEqual(game.finishRound(pending.id,result),receipt);
  const review=game.reviewLessonProblem(session,pending.id);
  assert.deepEqual(review.problem,quarterRecipe);
  assert.deepEqual(review.work,work);
  assert.ok(game.saveReviewDraft(session,pending.id,originalDraft));
  game=open();
  assert.deepEqual(game.reviewLessonProblem(session,pending.id).draft,originalDraft);
  assert.ok(game.finishReview(session,pending.id));
  assert.equal(game.finishReview(session,pending.id),false);
  assert.deepEqual([game.state.stats.count,game.state.xp,game.state.coins],rewards);
  assert.equal(game.reviewLessonProblem(session,pending.id).reviewCount,1);
});

test('every countable bar and shaded slice has the right piece value at every generated level', () => {
  for (const id of ['fraction-add','fraction-subtract']) {
    for (let level=1;level<=3;level++) {
      for (let index=0;index<50;index++) {
        const problem=lessons.make(id,level,index,random(4451+index+100*level));
        const [p,s]=fresh(problem);
        for (const [j,o] of p.operands.entries()) {
          const split=p.den/o.d;
          if (split!==s.splits[j]) assert.ok(mat.setSplit(p,s,j,split));
          for (let k=o.w-1;k>=0;k--) assert.ok(mat.toggleTally(p,s,j,'whole',k));
          for (let k=o.r-1;k>=0;k--) assert.ok(mat.toggleTally(p,s,j,'part',k));
          // A possible exact whole has a zero loose-piece subtotal.
          if (o.r===0) s.counts[j].part='0';
          assert.equal(Number(s.counts[j].whole),o.w*p.den);
          assert.equal(Number(s.counts[j].part),o.r*split);
          assert.ok(mat.evaluate(p,s,j+2).ok,problem.prompt);
          const numerator=Number(s.counts[j].whole)+Number(s.counts[j].part);
          assert.ok(board.matches(problem.steps[j+2],String(numerator)),problem.prompt);
          assert.equal(mat.checkSum(p,s,j).ok,false,'Numbers alone must not count as checked work');
          s.checked[j+2]=true;
          if (o.w) {
            assert.equal(mat.checkSum(p,s,j).ok,false);
            assert.ok(mat.setSum(p,s,j,String(numerator)));
          }
          const checked=mat.checkSum(p,s,j);
          assert.ok(checked.ok,problem.prompt);
          assert.equal(checked.value,String(numerator));
        }
        assert.deepEqual(mat.safeState(p,roundTrip(s)),s);
      }
    }
  }
});

test('restored tally marks must describe the saved counts, fit the bar, and match the current cut', () => {
  const [p,s]=fresh(quarterRecipe);
  mat.setSplit(p,s,0,3);
  s.counts[0]={whole:'24',part:'9'};
  s.tallies[0]={whole:[3,0,0,4,-1,null],part:[1]};
  const restored=mat.safeState(p,roundTrip(s));
  assert.deepEqual(restored.tallies[0],{whole:[0,3],part:[]});
  assert.deepEqual(restored.counts[0],{whole:'24',part:'9'});
  s.splits[0]=4;
  assert.deepEqual(mat.safeState(p,roundTrip(s)).tallies[0],{whole:[],part:[]});
});

function countedMixed(problem) {
  const [spec,state]=fresh(problem);
  const first=spec.operands[0];
  state.splits[0]=spec.den/first.d;
  state.counts[0]={whole:String(first.w*spec.den),part:String(first.part)};
  assert.ok(mat.evaluate(spec,state,2).ok);
  state.checked[2]=true;
  return [spec,state];
}

test('valid piece counts keep a mixed numerator unanswered until the learner supplies the total', () => {
  for (const [problem,wrong,total] of [[quarterRecipe,'56','57'],[legacy,'51','52']]) {
    const [p,s]=countedMixed(problem);
    assert.deepEqual(s.sums,[{value:'',status:'draft'},{value:'',status:'draft'}]);
    assert.equal(mat.checkSum(p,s,0).ok,false);
    assert.notEqual(s.sums[0].status,'verified');
    mat.setSum(p,s,0,wrong);
    assert.deepEqual(s.sums[0],{value:wrong,status:'draft'});
    const retry=mat.checkSum(p,s,0);
    assert.equal(retry.ok,false);
    assert.ok(!new RegExp('\\b'+total+'\\b').test(retry.text),'The retry message revealed the mixed numerator');
    assert.deepEqual(s.sums[0],{value:wrong,status:'retry'});
    const restored=mat.safeState(p,roundTrip(s));
    assert.deepEqual(restored.sums,s.sums);
    mat.setSum(p,restored,0,total);
    assert.deepEqual(restored.sums[0],{value:total,status:'draft'});
    const accepted=mat.checkSum(p,restored,0);
    assert.equal(accepted.ok,true);
    assert.equal(String(accepted.value),total);
    assert.deepEqual(restored.sums[0],{value:total,status:'verified'});
    assert.deepEqual(restored.sums[1],{value:'',status:'draft'});
    assert.deepEqual(mat.safeState(p,roundTrip(restored)),restored);
  }
});

test('old checked mats keep all original scratch counts while leaving their mixed addition unearned', () => {
  const [p,s]=countedMixed(quarterRecipe);
  const old=roundTrip(s);
  delete old.sums;
  const restored=mat.safeState(p,old);
  assert.deepEqual(restored.checked,old.checked);
  assert.deepEqual(restored.counts,old.counts);
  assert.deepEqual(restored.sums[0],{value:'',status:'draft'});
  assert.ok(mat.evaluate(p,restored,2).ok);
  assert.equal(mat.checkSum(p,restored,0).ok,false);
  const alreadyTyped={...old,sums:[{value:'57',status:'draft'}]};
  assert.deepEqual(mat.safeState(p,alreadyTyped).sums[0],{value:'57',status:'draft'});
  for (const changed of [
    {...old,sums:[{value:'56',status:'verified'}]},
    {...old,counts:[{whole:'47',part:'9'},old.counts[1]],sums:[{value:'57',status:'verified'}]},
    {...old,splits:[4,1],sums:[{value:'57',status:'verified'}]},
    {...old,key:'a different problem',sums:[{value:'57',status:'verified'}]}
  ]) {
    assert.notEqual(mat.safeState(p,changed).sums[0].status,'verified');
  }
});

test('a checked total belongs to the operand and cuts the learner actually counted', () => {
  const [p,s]=countedMixed(quarterRecipe);
  mat.setSum(p,s,0,'57');
  assert.ok(mat.checkSum(p,s,0).ok);
  assert.ok(mat.setSplit(p,s,1,2));
  assert.ok(mat.toggleTally(p,s,1,'part',0));
  assert.ok(mat.evaluate(p,s,3).ok);
  assert.deepEqual(s.sums[0],{value:'57',status:'verified'});
  assert.deepEqual(s.sums[1],{value:'',status:'draft'});
  assert.ok(mat.toggleTally(p,s,0,'whole',0));
  assert.deepEqual(s.sums[0],{value:'',status:'draft'});
  assert.equal(mat.checkSum(p,s,0).ok,false);
  const [same,checked]=countedMixed(quarterRecipe);
  mat.setSum(same,checked,0,'57');
  assert.ok(mat.checkSum(same,checked,0).ok);
  assert.ok(mat.setSplit(same,checked,0,4));
  assert.deepEqual(checked.sums[0],{value:'',status:'draft'});
  assert.equal(mat.checkSum(same,checked,0).ok,false);
});

test('proper fractions transfer the counted numerator directly, including when the other operand uses a mixed sum', () => {
  for (const [problem,factor,pieces] of [[legacy,3,'3'],[quarterRecipe,2,'2']]) {
    const [p,s]=countedMixed(problem);
    s.splits[1]=factor;
    s.counts[1].part=pieces;
    assert.equal(mat.checkSum(p,s,1).ok,false);
    s.checked[3]=true;
    assert.equal(mat.setSum(p,s,1,'56'),false);
    assert.equal(mat.checkSum(p,s,1).value,pieces);
    assert.deepEqual(s.sums[1],{value:pieces,status:'verified'});
    assert.deepEqual(s.sums[0],{value:'',status:'draft'});
    assert.deepEqual(mat.safeState(p,roundTrip(s)),s);
  }
});
