// Drive each grade-level lesson through the native game and compare credited work to the submitted steps.
const $=selector=>document.querySelector(selector);
const assert=(value,message)=>{if(!value)throw Error(message);};
const key='decimal-dungeon.adventure.v1';
const save=()=>JSON.parse(DungeonNativeStorage.getItem(key));
const catalogue=DungeonLessons.list.filter(lesson=>!Number.isInteger(lesson.world));
const host='#workbench';
const levels=['','Foundation','Core','Challenge'];
function click(selector) {
  const button=$(selector);
  assert(button?.getClientRects().length && !button.disabled,'Unavailable control '+selector);
  button.click();
}
function start(id,level) {
  click('[data-panel=map]');
  click('dialog[open] [data-difficulty="'+level+'"]');
  click('dialog[open] [data-lesson-practice="'+id+'"]');
  const round=save().round;
  assert(round?.problem.kind==='lesson' && round.problem.lessonId===id && round.problem.level===level,'Wrong selected learning activity for '+id);
  assert($(host+' [data-lesson-board] h2')?.textContent===round.problem.prompt,'The original learning question was not displayed');
  return round;
}
function formatted(step) {
  const value=String(Array.isArray(step.answer)?step.answer[0]:step.answer);
  if(step.choices) return value;
  if(step.plot) return '('+value.replace(/\s*,\s*/,', ')+')';
  if(step.format==='fraction') {
    const frac=/^(\d+)\/(\d+)$/.exec(value);
    if(frac) return (Number(frac[1])*2)+'/'+(Number(frac[2])*2);
  }
  if(/^-?\d+\.\d+$/.test(value)) return value+'0';
  if(/^\d{4,}$/.test(value)) return value.replace(/\B(?=(\d{3})+(?!\d))/g,',');
  return value;
}
function checkReceipt(round,work) {
  const state=save();
  const record=state.lessonBook.runs.find(r=>r.id===round.lessonSessionId).history.find(h=>h.roundId===round.id);
  assert(state.round.id===round.id && state.round.receipt?.fullyWorked && record?.independent &&
    JSON.stringify(record.problem)===JSON.stringify(round.problem),'A correctly finished problem was not saved independently');
  assert(record.work.length===work.length && record.work.every((s,i)=>s.prompt===round.problem.steps[i].prompt && s.answer===work[i]),'Checked work differs from the submitted responses');
  assert(record.answer===String(round.problem.solution ?? work[work.length-1]) && record.xp>0 && record.coins>0,'Missing exact answer or earned rewards');
}
function gridClick(x,y) {
  const svg=$(host+' [data-plot]');
  const lines=[...svg.querySelectorAll('line')];
  const vertical=lines.filter(l=>l.x1.baseVal.value===l.x2.baseVal.value).map(l=>l.x1.baseVal.value).sort((a,b)=>a-b);
  const horizontal=lines.filter(l=>l.y1.baseVal.value===l.y2.baseVal.value).map(l=>l.y1.baseVal.value).sort((a,b)=>b-a);
  const p=new DOMPoint(vertical[x],horizontal[y]).matrixTransform(svg.getScreenCTM());
  svg.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:p.x,clientY:p.y}));
}
if(pass<3) {
  const level=pass+1;
  assert(catalogue.length>=29,'The curriculum is missing grade-level lessons');
  let steps=0,choices=0,models=0;
  for(const lesson of catalogue) {
    try {
      const round=start(lesson.id,level);
      if(round.problem.model){
        if (lesson.id==='fraction-add' || lesson.id==='fraction-subtract') {
          const mat=$(host+' [data-fraction-workmat][data-fm-stage="0"]');
          assert(mat?.getClientRects().length && mat.querySelectorAll('.fm-line').length===2 &&
            mat.querySelectorAll('[data-fm-benchmark="0"]').length===3 &&
            mat.querySelectorAll('[data-fm-benchmark="1"]').length===3 && mat.querySelector('[data-fm-check]'),
            'Missing interactive two-operand fraction model');
        } else {
          const fig=$(host+' figure.lc-model');
          assert(fig?.getClientRects().length && fig.children.length>0,'Missing visual model '+round.problem.model.type);
        }
        models++;
      }
      const work=round.problem.steps.map((s,i)=>{
        assert($(host+' .lc-task h3')?.textContent===s.prompt,'The intermediate work question changed');
        if(s.choices)choices++;
        steps++;return nativeLesson.answer(host,s,i,true,formatted(s));
      });
      checkReceipt(round,work);
      await new Promise(done=>setTimeout(done,0));
    } catch(error) {throw Error(lesson.id+' at '+levels[level]+' — '+error.message);}
  }
  assert(save().stats.count===catalogue.length*level,'A completed lesson gave missing or duplicate credit');
  const summary=catalogue.length+' '+levels[level]+' lessons, '+steps+' checked steps, '+choices+' multiple-choice questions and '+models+' visual models verified with saved work';
  if(pass!==2) return summary;
  const round=start('coordinate-grid',3),p=round.problem;
  const plotIndex=p.steps.findIndex(s=>s.plot);
  const work=p.steps.slice(0,plotIndex).map((s,i)=>nativeLesson.answer(host,s,i));
  const [x,y]=String(p.steps[plotIndex].answer).split(',').map(Number);
  assert(x>0 && y>=0,'Invalid initial point for pointer-plus-keyboard test');
  gridClick(x-1,y);
  const entryValue=()=>$(host+' [data-field=lesson-answer]').value;
  assert(entryValue()===(x-1)+', '+y,'Pointer selection did not choose the visible intersection');
  $(host+' [data-plot]').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));
  assert(entryValue()===x+', '+y && document.activeElement===$(host+' [data-plot]'),'Keyboard plot selection failed to move or recover focus');
  assert($(host+' [data-plot] circle') && save().round.draft.value===entryValue(),'Plot position was not drawn and saved');
  DungeonNativeStorage.setItem('matrix-plot',JSON.stringify({id:round.id,plotIndex,work,x,y}));
  return summary+'; map click and arrow key selected an unsubmitted point for relaunch';
}
const info=JSON.parse(DungeonNativeStorage.getItem('matrix-plot')),round=save().round;
const svg=$(host+' [data-plot]');
assert(round.id===info.id && Number($(host+' [data-lesson-step]').dataset.lessonStep)===info.plotIndex,'Coordinate problem did not restore');
const entry=$(host+' [data-field=lesson-answer]');
assert(entry.value===info.x+', '+info.y && svg.querySelector('circle') && round.draft.verified.length===info.work.length,'The typed point, marker or checked work did not survive a new WebKit instance');
info.work.push(entry.value);click(host+' [data-action=check]');
for(let i=info.plotIndex+1;i<round.problem.steps.length;i++) info.work.push(nativeLesson.answer(host,round.problem.steps[i],i,true,formatted(round.problem.steps[i])));
checkReceipt(round,info.work);
assert(save().stats.count===3*catalogue.length+1,'Coordinate relaunch credited the wrong number of problems');
return 'Native coordinate chart restored the selected intersection and earlier work, accepted the reversed second point, and credited the complete problem once';
