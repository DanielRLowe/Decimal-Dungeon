/* Lesson definitions describe teaching content. The registry keeps curriculum IDs
   stable across releases; the problem snapshot is saved with the session. */
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const math = node ? require('./math.js') : root.DungeonMath;
  const numberLessons = node ? require('./lesson-numbers.js') : root.DungeonNumberLessons;
  const spaceLessons = node ? require('./lesson-space.js') : root.DungeonSpaceLessons;
  const columnLessons = [
    ['decimal-tenths','Add tenths',0,'Line up the tenths digit directly below the other tenths digit.',
      ['For 3.2 + 1.5 put the decimal points in one column.','Start on the right. 2 tenths + 5 tenths = 7 tenths.','Add the ones, 3 + 1 = 4. Your sum is 4.7.']],
    ['decimal-hundredths','Add hundredths',1,'Work from the smallest place toward the ones.',
      ['For 4.26 + 1.43 align the decimal points.','Add hundredths, 6 + 3 = 9. Add tenths, 2 + 4 = 6.','Add 4 + 1 ones. Your sum is 5.69. Rounding the addends gives 4 + 1 = 5, a reasonable estimate.']],
    ['decimal-align','Match decimal places',2,'A trailing zero keeps a decimal’s value and fills an empty place.',
      ['Write 2.4 + 1.35 with the dots aligned. Add a placeholder so 2.4 reads 2.40.','Add the hundredths, 0 + 5 = 5. Add the tenths, 4 + 3 = 7.','Two ones plus one gives 3. The sum is 3.75.']],
    ['decimal-thousandths','Add thousandths',3,'Keep thousandths, hundredths and tenths in separate columns.',
      ['For 1.907 + 2.31 write 2.310 below 1.907.','From the right, 7 + 0 = 7 and 0 + 1 = 1. In the tenths, 9 + 3 = 12. Write 2 and carry 1.','Add the ones and the carry, 1 + 2 + 1 = 4. The sum is 4.217.']],
    ['decimal-carry','Carry across decimal columns',4,'Ten units of any place make one unit of the place to its left.',
      ['For 2.78 + 3.46 start with 8 + 6 = 14. Write 4 hundredths and carry 1 tenth.','Add 7 + 4 + 1 = 12. Write 2 tenths and carry 1 one.','The ones are 2 + 3 + 1 = 6, so the sum is 6.24.']],
    ['decimal-subtract','Subtract decimals',5,'Align both decimals, then trade one unit for ten smaller units when needed.',
      ['For 5.2 − 1.47 write 5.20 above 1.47.','Trade one tenth for 10 hundredths. 10 − 7 = 3. In the tenths, trade one whole to get 11 − 4 = 7.','Now 4 − 1 = 3 ones. The difference is 3.73.']],
    ['decimal-three','Add three decimals in columns',6,'Add all three digits in a place and include the previous carry.',
      ['Align 1.78, 2.86 and 0.59. Start at the hundredths.','8 + 6 + 9 = 23, so write 3 and carry 2. Add 7 + 8 + 5 + 2 = 22 in the tenths. Write 2 and carry 2.','Add 1 + 2 + 0 + 2 = 5 ones. The sum is 5.23.',
       'For an estimate, round each addend first. That gives 2 + 3 + 1 = 6. If you round the exact sum of 5.23, you get 5. Rounding happens at a different step.']],
    ['decimal-pairs','Choose a pair and add in two stages',6,'Pick any two decimals and work both additions column by column.',
      ['For 1.75 + 0.625 + 2.25, try 1.75 + 2.25 first. Add hundredths, 5 + 5 = 10. Write 0 and carry 1.','In the tenths, 7 + 2 + 1 = 10. Write 0 and carry 1. The ones give 1 + 2 + 1 = 4. Your subtotal is 4.00.','Align your subtotal with 0.625, writing 4.000. Add right to left to get 4.625. The three original addends round to 2, 1 and 2. Their sum estimates the answer as 5.']]
  ];
  function legacyProblem(id, world, level, index, random) {
    const options = {random, first:false, tier:[2,4,6][level-1]};
    if (id==='decimal-pairs') return math.makeProblem(6,{...options,pair:true});
    if (id==='decimal-three') {
      if (level===2 && !index) return math.makeProblem(6,{first:true});
      if (level===1) {
        const a = math.makeProblem(1,options);
        return {...a,c:(1+Math.floor(random()*29)/10).toFixed(1),world:6};
      }
      return math.makeProblem(6,options);
    }
    if (level===2 && !index) return math.makeProblem(world,{first:true});
    if (world===5 && (level===1 || (level===2 && index%2))) {
      const a = 40+Math.floor(random()*30), b = 10+Math.floor(random()*29);
      const precision=level===1?1:2;
      return {a:(a/10).toFixed(precision),b:((b*10+(precision===2?1+Math.floor(random()*9):0))/100).toFixed(precision),op:'-',world};
    }
    const p=math.makeProblem(world,{...options,focus:level===3?'regroup':null});
    if (level===3) {
      const tens = 10*(1+Math.floor(random()*8));
      const [integer,fraction] = p.a.split('.');
      p.a = String(Number(integer)+tens)+(fraction ? '.'+fraction : '');
    } else if (level===1 && world!==0 && world!==5) {
      if (world===4) return {...math.makeProblem(0,{...options,focus:'regroup'}),world};
      if (world===1) { p.a=p.a.replace(/^\d+/, '1'); p.b=p.b.replace(/^\d+/, '2'); }
      else { p.a=p.a.replace(/^\d+/, '0'); p.b=p.b.replace(/^\d+/, '1'); }
    } else if (world===0 && level===1) {
      p.a='1.'+Math.floor(random()*5);p.b='2.'+Math.floor(random()*5);
    }
    return p;
  }
  const legacy = columnLessons.map(([id,title,world,intro,steps])=>({
    id,title,domain:world<3 || world===5?'Decimal column practice':'Decimal extensions',
    codes:world<3 || world===4 || world===5?['5.NBT.B.7']:[], tutorial:{intro,steps},world,
    make:(level,index,rng)=>legacyProblem(id,world,level,index,rng)
  }));
  const list = [...legacy,...numberLessons,...spaceLessons];
  const byId = new Map(list.map(item=>[item.id,item]));
  if (byId.size !== list.length) throw Error('Duplicate lesson ID');
  function get(id) { return byId.get(id); }
  function forWorld(world) { return Number.isInteger(world) && world>=0 && world<=6 ? legacy[world] : undefined; }
  function identify(problem, fallbackWorld) {
    if (!problem) return undefined;
    const selected = get(problem.lessonId);
    if (selected || problem.kind==='lesson') return selected;
    if (problem.kind==='pair') return get('decimal-pairs');
    if (problem.op==='-') return get('decimal-subtract');
    if (problem.c!=null) return get('decimal-three');
    return forWorld(problem.world ?? fallbackWorld);
  }
  function topicOf(record) {
    return record && (get(record.lessonId) || identify(record.problem,record.world));
  }
  function make(id,level,index=0,rng=Math.random) {
    const item=get(id);
    if (!item || ![1,2,3].includes(level)) throw Error('Unknown lesson or difficulty');
    const problem=item.make(level,index,rng);
    if (item.world!==undefined) return {...problem,lessonId:id,level};
    // Keep the choices in a stable random order in this saved copy of the puzzle.
    const steps=problem.steps.map(step=>{
      if (!step.choices) return step;
      const choices=[...new Set(step.choices.map(String))];
      for (let i=choices.length-1;i>0;i--) { const j=Math.floor(rng()*(i+1)); [choices[i],choices[j]]=[choices[j],choices[i]]; }
      return {...step,choices};
    });
    return {...problem,steps,kind:'lesson',lessonId:id,level,world:0};
  }
  const masteryTarget=3;
  function tracker(sessions) {
    const records=new Map(list.map(item=>[item.id,{
      lessonId:item.id,completed:0,independent:0,qualifying:0,mastered:false,
      extraPractice:0,reviews:0,masteredAt:null,masteredRoundId:null
    }]));
    const entries=sessions.flatMap(run=>run.history).sort((a,b)=>a.at-b.at || a.roundId-b.roundId);
    for(const entry of entries) {
      const id=topicOf(entry)?.id, record=records.get(id);
      if(!record)continue;
      const level=entry.difficulty || entry.problem.level || 1;
      record.completed++;
      record.reviews+=entry.reviewCount||0;
      if(record.mastered)record.extraPractice++;
      if(entry.independent) {
        record.independent++;
        if(level>=2)record.qualifying++;
        if(!record.mastered && record.qualifying>=masteryTarget) {
          record.mastered=true;record.masteredAt=entry.at;record.masteredRoundId=entry.roundId;
        }
      }
    }
    const lessons=[...records.values()];
    return {lessons,mastered:lessons.filter(x=>x.mastered).length,total:lessons.length,target:masteryTarget};
  }
  const journey=[
    'place-value','powers-of-ten','decimal-forms','decimal-compare','decimal-round',
    'decimal-tenths','decimal-hundredths','decimal-align','decimal-carry','decimal-subtract',
    'whole-multiply','whole-divide','expressions-order','expressions-write','decimal-multiply','decimal-divide',
    'fraction-sharing','fraction-add','fraction-subtract','fraction-of-quantity','fraction-area',
    'fraction-scaling','mixed-products','fraction-divide-whole','whole-divide-fraction',
    'unit-conversions','line-plots','unit-cubes','prism-volume','composite-volume',
    'coordinate-grid','pattern-pairs','coordinate-stories','shape-families',
    'decimal-thousandths','decimal-three','decimal-pairs'
  ];
  function campaignPractice(sessions) {
    const progress=new Map(tracker(sessions).lessons.map(r=>[r.lessonId,r]));
    const next=journey.find(id=>!progress.get(id).mastered);
    if(next)return {lessonId:next,difficulty:2};
    const review=journey.reduce((best,id)=>progress.get(id).extraPractice<progress.get(best).extraPractice?id:best);
    return {lessonId:review,difficulty:3};
  }
  // Independent completions recommends new work. Each level remains directly selectable.
  function nextPractice(sessions,lessonId,difficulty) {
    const counts=new Map();
    for(const run of sessions) for(const entry of run.history) {
      if(!entry.independent) continue;
      const id=topicOf(entry)?.id, level=entry.difficulty||entry.problem.level||1;
      const key=id+'/'+level;
      counts.set(key,(counts.get(key)||0)+1);
    }
    const target=3;
    const report=(id,level)=>({lessonId:id,difficulty:level,independent:counts.get(id+'/'+level)||0,target});
    if(get(lessonId) && [1,2,3].includes(difficulty)) {
      for(let level=difficulty;level<=3;level++) {
        const same=report(lessonId,level);
        if(same.independent<target)return same;
      }
    }
    const path=[...numberLessons,...spaceLessons,...legacy];
    const index=path.findIndex(item=>item.id===lessonId);
    for(const level of [2,3,1]) {
      for(let offset=1;offset<=path.length;offset++) {
        const entry=report(path[(index+offset)%path.length].id,level);
        if(entry.independent<target)return entry;
      }
    }
    return null;
  }
  const api={list,get,has:id=>byId.has(id),forWorld,identify,topicOf,make,tracker,campaignPractice,nextPractice,levels:['Foundation','Core','Challenge']};
  root.DungeonLessons=api;
  if(node) module.exports=api;
})(globalThis);
