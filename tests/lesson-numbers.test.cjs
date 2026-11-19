'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const library=require('../web/lesson-numbers.js');
const byId=id=>library.find(l=>l.id===id);
function random(seed){let state=seed;return ()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);}
function asNumber(s){
  const parts=String(s).split(' '), last=parts.pop().split('/').map(Number);
  return (parts.length?Number(parts[0]):0)+last[0]/(last[1]||1);
}
function close(actual,expected,context){assert.ok(Math.abs(asNumber(actual)-expected)<1e-9,context+' '+actual+' ≠ '+expected);}
function each(id,fn){for(let level=1;level<=3;level++)for(let i=0;i<50;i++)fn(byId(id).make(level,i,random(98*i+level)),level,i);}
test('21 number topics cover all grade-five OA, NBT and NF standards',()=>{
  assert.equal(library.length,21);
  const codes=new Set(library.flatMap(l=>l.codes));
  const standards={'OA.A':[1,2],'OA.B':[3],'NBT.A':[1,2,3,4],'NBT.B':[5,6,7],'NF.A':[1,2],'NF.B':[3,4,5,6,7]};
  for(const [domain,items] of Object.entries(standards))for(const n of items)assert.ok(codes.has('5.'+domain+'.'+n));
  for(const code of ['OA.B.3.a','OA.B.3.b','NF.B.4.a','NF.B.4.b','NF.B.5.a','NF.B.5.b','NF.B.7.a','NF.B.7.b','NF.B.7.c'])assert.ok(codes.has('5.'+code));
});
test('every lesson has worked teaching, serializable guided steps, and varied seeded practice at all levels',()=>{
  for(const l of library){
    assert.ok(l.tutorial.intro && l.tutorial.steps.length>=2 && /\d/.test(l.tutorial.steps.join(' ')),l.id);
    for(let level=1;level<=3;level++){
      const variants=new Set();
      for(let i=0;i<35;i++){
        const p=l.make(level,i,random(i*99+level));
        assert.deepEqual(JSON.parse(JSON.stringify(p)),p); assert.equal(JSON.stringify(p).includes('undefined'),false,l.id);
        assert.deepEqual(p,l.make(level,i,random(i*99+level)));
        assert.ok(p.steps.length>=2&&p.prompt.length>10,l.id); variants.add(p.prompt);
        for(const s of p.steps){
          assert.ok(s.prompt&&s.hint&&s.answer!==undefined,l.id);
          assert.ok(Array.isArray(s.answer)?s.answer.every(Boolean):s.answer.length>0,l.id);
          if(s.choices){assert.ok(s.choices.length>=2 && s.choices.includes(s.answer),l.id);assert.equal(s.choices.length,new Set(s.choices).size);}
        }
        if(p.model?.type==='coordinates'){
          for(const s of p.steps.filter(x=>x.plot))assert.ok(s.answer.split(',').map(Number).every(value=>value>=0&&value<=p.model.max));
        }
        if(p.model?.type==='bars')assert.ok(p.model.bars.every(b=>b.numerator>=0&&b.denominator>=b.numerator));
      }
      assert.ok(variants.size>=2,l.id+' level '+level);
    }
  }
});
test('multiplication, division and decimal answers match the quantities in the stories',()=>{
  each('whole-multiply',(p,l)=>{const [a,b]=p.prompt.match(/\d+/g).map(Number);close(p.steps.at(-1).answer,a*b,p.prompt);
    if(l===3)assert.ok(a>=1000&&a<=9999&&b>=100&&b<=999);});
  each('whole-divide',(p,l)=>{const [n,d]=p.prompt.match(/\d+/g).map(Number);assert.equal(+p.steps.at(-2).answer,Math.floor(n/d));assert.equal(+p.steps.at(-1).answer,n%d);
    assert.ok(n<10000&&d<100);if(l===3)assert.ok(n>=1000&&d>=10);});
  each('decimal-multiply',p=>{const [a,b]=p.prompt.match(/[\d.]+(?= meters)/g).map(Number);
    close(p.steps.at(-1).answer,a*b,p.prompt);close(p.steps[1].answer,Number(p.steps[0].answer)*b,p.prompt);});
  each('decimal-divide',p=>{const [a,b]=p.prompt.match(/\d+(?:\.\d+)?/g).map(Number);
    close(p.steps.at(-1).answer,a/b,p.prompt);assert.ok(Number.isInteger(a)||Number.isInteger(b));});
});
test('fraction contexts agree with arithmetical results, square tiles and inverse relations',()=>{
  const qty='(\\d+(?: \\d+/\\d+|/\\d+)?)';
  for(const id of ['fraction-add','fraction-subtract','mixed-products'])each(id,p=>{
    const nums=[...p.prompt.matchAll(new RegExp(qty,'g'))].map(m=>asNumber(m[0]));
    assert.equal(nums.length,2);close(p.steps.at(-1).answer,id==='fraction-add'?nums[0]+nums[1]:id==='fraction-subtract'?nums[0]-nums[1]:nums[0]*nums[1],p.prompt);
    if(id!=='mixed-products'){
      const h=nums.map(x=>Math.round(2*x)/2);close(p.steps[0].answer,id==='fraction-add'?h[0]+h[1]:h[0]-h[1],p.prompt);
    }
  });
  each('fraction-area',p=>{const m=p.model;assert.equal(m.rows,m.cols);assert.equal(+p.steps[0].answer,m.shadedCols);
    assert.equal(+p.steps[1].answer,m.shadedRows);close(p.steps.at(-1).answer,m.shadedCols*m.shadedRows/(m.cols*m.rows),p.prompt);});
  each('whole-divide-fraction',p=>{const [w,q]=[...p.prompt.matchAll(new RegExp(qty,'g'))].map(m=>asNumber(m[0]));close(p.steps[2].answer,w/q,p.prompt);});
  each('fraction-divide-whole',p=>{const [q,k]=[...p.prompt.matchAll(new RegExp(qty,'g'))].map(m=>asNumber(m[0]));close(p.steps[2].answer,q/k,p.prompt);close(p.steps[3].answer,q,p.prompt);});
  each('fraction-of-quantity',p=>{const [q,a]=[...p.prompt.matchAll(new RegExp(qty,'g'))].map(m=>asNumber(m[0]));close(p.steps[1].answer,q*a,p.prompt);});
});
test('place forms and estimates stay consistent through thousandths',()=>{
  each('decimal-round',(p,l)=>{const {min,max,value}=p.model;assert.ok(min<value&&value<max);
    close(p.steps[1].answer,(min+max)/2,p.prompt);const places=10**(l-1);close(p.steps.at(-1).answer,Math.round((value+1e-10)*places)/places,p.prompt);});
  each('decimal-forms',p=>{const last=p.steps.at(-1), evaluate=s=>s.split(' + ').reduce((sum,term)=>{const match=term.match(/^\((\d+) × (\d+(?:\/\d+)?)\)$/);return sum+(match?Number(match[1])*asNumber(match[2]):Number(term));},0);
    close(last.answer?evaluate(last.answer):0,Number(p.steps[1].answer),p.prompt);
    for(const x of last.choices.filter(s=>s!==last.answer))assert.notEqual(evaluate(x),evaluate(last.answer),p.prompt);});
  each('powers-of-ten',p=>{const m=p.prompt.match(/in ([\d.]+) (÷|×) 10([¹²³])/),scale=10**('¹²³'.indexOf(m[3])+1);
    close(p.steps.at(-1).answer,m[2]==='×'?+m[1]*scale:+m[1]/scale,p.prompt);});
});
