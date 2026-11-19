// Run in a real foreground WebKit window with an isolated save.
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const expect=(ok,msg)=>{if(!ok)throw Error(msg);};
const delay=ms=>new Promise(done=>setTimeout(done,ms));
const key='decimal-dungeon.adventure.v1',save=()=>JSON.parse(DungeonNativeStorage.getItem(key));
const get=()=>JSON.parse(DungeonNativeStorage.getItem('play-tools-test'));
const put=obj=>DungeonNativeStorage.setItem('play-tools-test',JSON.stringify(obj));
const dialog='dialog.dp-dialog[open] ';
const host='#workbench ',mat=host+'[data-fraction-workmat] ';
function click(selector) {
  const b=$(selector); expect(b?.getClientRects().length&&!b.disabled,'Missing enabled control: '+selector); b.click();
}
function write(selector,value) {const f=$(selector);expect(f,'Missing input '+selector);f.value=String(value);f.dispatchEvent(new Event('input',{bubbles:true}));}
async function wait(test,message) {
  const deadline=performance.now()+4500;
  while(!test()&&performance.now()<deadline)await delay(30);
  expect(test(),message+' (focus '+document.hasFocus()+', visibility '+document.visibilityState+', audio state '+[audio.paused,audio.readyState,audio.currentTime,audio.error?.code].join('/')+')');
}
function workcheck(correct) {
  click(mat+'[data-fm-check]');
  const message=$(mat+'[data-fm-feedback]');
  expect(message.dataset.correct===String(correct)&&message.textContent.trim(),'Unexpected fraction workmat feedback');
  return message.textContent;
}
const lessonAnswer=host+'[data-field=lesson-answer]';
const sumInput=mat+'[data-fm-sum]',checkSum=mat+'[data-fm-check-sum]';
const scratch=()=>save().round.draft.fractionWork;
const errors=()=>save().round.draft.errors;
function stage() {return Number($(host+'[data-lesson-step]').dataset.lessonStep);}
function pressReturn(selector,extra={}) {
  const input=$(selector);
  expect(input?.getClientRects().length,'Keyboard field not visible: '+selector);
  input.focus();
  input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true,...extra}));
}
function viewMat(index) {
  const chooser=$(mat+'[data-fm-view]');
  chooser.value=String(index);
  chooser.dispatchEvent(new Event('change',{bubbles:true}));
  expect($(host+'[data-fm-stage="'+index+'"]'),'Could not revisit fraction mat '+index);
}
function checkUnrevealed(total,isMixed) {
  const shell=$(host+'[data-fraction-workmat]');
  expect(!shell.querySelector('[data-fm-equivalence], [data-fm-numerator]'),
    'The workmat displayed a completed numerator before the learner supplied it');
  if(isMixed) {
    const visibleText=shell.innerText+' '+[...shell.querySelectorAll('[aria-label]')]
      .map(node=>node.getAttribute('aria-label')).join(' ');
    expect(!new RegExp('\\b'+total+'\\b').test(visibleText),
      'The mixed-number sum appeared in visible text or an accessible label before entry');
  }
}
function checkOldCountDraft(problem,sourceDraft,index) {
  // Reopen a v1 workmat inside the same WebKit lesson renderer used by saved reviews.
  const draft=JSON.parse(JSON.stringify(sourceDraft));
  delete draft.fractionWork.sums;
  delete draft.numeratorFromMat;
  draft.value=index===2?'41':'';
  const container=document.createElement('section');
  container.hidden=true;
  document.body.append(container);
  let saved=0;
  const oldBoard=DungeonLessonBoard.mount(container,{problem,draft,onDraft:()=>{saved++;},
    onComplete:()=>{throw Error('Opening old scratch work graded a lesson');}});
  try {
    expect(Number(container.querySelector('[data-lesson-step]').dataset.lessonStep)===index,
      'A legacy checked-count draft returned to the wrong official step');
    expect(container.querySelector('[data-field=lesson-answer]').value===draft.value && !saved,
      'Restoring an old checked-count flag must preserve the actual saved lesson answer');
    expect(!container.querySelector('[data-fm-equivalence], [data-fm-numerator]'),
      'An old checked-count flag was incorrectly treated as a solved numerator');
    if(index===2) expect(container.querySelector('[data-fm-sum]')?.value==='',
      'A previously checked mixed count must reopen with an empty sum');
  } finally {
    oldBoard.destroy();
    container.remove();
  }
}
function startFraction(values) {
  click('[data-panel=map]');
  click(dialog+'[data-difficulty="2"]');
  const original=Math.random;
  try {
    Math.random=()=>values.shift()??.2;
    click(dialog+'[data-lesson-practice=fraction-add]');
  } finally { Math.random=original; }
  return save().round;
}
const eq='2 1/6 + 1/8',note=eq+'\n24ths: 48 + 4 + 3';
function stroke(svg) {
  const matrix=svg.getScreenCTM();
  const points=[[22,42],[34,26],[47,27],[49,38],[25,61],[50,61]];
  points.forEach(([x,y],index)=>{
    const px=new DOMPoint(x,y).matrixTransform(matrix);
    const type=index===0?'pointerdown':index===points.length-1?'pointerup':'pointermove';
    svg.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,clientX:px.x,clientY:px.y,pointerId:9,
      pointerType:'pen',isPrimary:true,button:0,buttons:type==='pointerup'?0:1}));
  });
}
if (scenario==='fraction-clarity') {
  const liveStage=()=>Number($(host+'[data-lesson-step]')?.dataset.lessonStep);
  const stageIs=index=>expect(liveStage()===index&&$(host+'[data-fm-stage="'+index+'"]'),
    'Unexpected verified lesson or workmat stage '+index);
  if (pass===0) {
    const round=startFraction([.50,.98,.01,.98]);
    const p=round.problem;
    expect(p.prompt.includes('4 3/4')&&p.prompt.includes('1/6')&&p.steps[2].answer==='57',
      'Could not generate the four-and-three-quarters screenshot example');
    nativeLesson.answer('#workbench',p.steps[0],0,true,'5');
    nativeLesson.answer('#workbench',p.steps[1],1,true,'12');
    stageIs(2);
    for (let n=1;n<4;n++)click(mat+'[data-fm-split=up]');
    workcheck(false);
    expect($(mat+'[data-fm-current]').textContent.trim()==='16' && $(mat+'[data-fm-goal]').textContent.trim()==='12' &&
      /[−-]|fewer|decrease/i.test($(mat+'[data-fm-direction]').textContent),
      'The four-piece split should show 16 pieces per whole, a goal of 12 and a direction to reduce the split');
    expect(save().round.draft.fractionWork.splits[0]===4,'Four pieces per quarter did not stay visible for correction');
    click(mat+'[data-fm-split=down]');
    expect($(mat+'[data-fm-current]').textContent.trim()==='12','Three pieces per quarter should visibly match the twelfths goal');
    write(mat+'[data-fm-count=whole]','16');
    write(mat+'[data-fm-count=part]','6');
    expect(/whole/i.test(workcheck(false)),'The first correction should identify the whole-bar subtotal');
    write(mat+'[data-fm-count=whole]','48');
    expect(/shad|fraction|quarter|part/i.test(workcheck(false)),'The second correction should identify the fractional subtotal');
    for (const kind of ['whole','part']) write(mat+'[data-fm-count='+kind+']','');
    for (const [kind,number,per] of [['whole',4,12],['part',3,3]]) {
      const buttons=$$(mat+'[data-fm-tally="'+kind+'"]');
      expect(buttons.length===number,'Wrong number of countable '+kind+' groups');
      for (let i=0;i<number;i++) {
        const selector=mat+'[data-fm-tally="'+kind+'"][data-index="'+i+'"]';
        click(selector);
        expect($(selector).getAttribute('aria-pressed')==='true' && Number($(mat+'[data-fm-count="'+kind+'"]').value)===(i+1)*per,
          'Tapping the '+kind+' group did not add its visible pieces');
      }
    }
    workcheck(true);
    stageIs(2);
    checkUnrevealed('57',true);
    expect($(sumInput)?.inputMode==='numeric' && $(sumInput).value==='' && $(lessonAnswer).value==='',
      'Checking the two counts must leave a blank numeric sum');
    const before=errors();
    pressReturn(sumInput);
    expect(errors()===before && $(lessonAnswer).value==='','An empty sum check counted as a wrong answer or filled the lesson field');
    write(sumInput,'56');
    expect(errors()===before && $(lessonAnswer).value==='','Typing an unsubmitted sum changed the lesson answer or error count');
    pressReturn(sumInput);
    expect($(mat+'[data-fm-sum-feedback]').dataset.correct==='false' && errors()===before+1,
      'Checking an incorrect sum must record exactly one arithmetic error');
    checkUnrevealed('57',true);
    expect(scratch().sums[0].value==='56' && scratch().sums[0].status==='retry' && $(lessonAnswer).value==='',
      'An incorrect sum must stay editable without filling the numerator');
    expect(save().round.draft.verified.length===2 && !save().round.receipt,
      'Checking the workmat must leave the numerator step pending');
    $(host+'[data-fraction-workmat]').scrollIntoView({block:'center'});
    return 'The workmat showed 48 + 9 with a blank sum, rejected 56 without giving away 57, and saved the retry.';
  }
  const saved=save(),p=saved.round.problem;
  stageIs(2);
  expect(scratch().splits[0]===3 && scratch().counts[0].whole==='48' && scratch().counts[0].part==='9',
    'The corrected cuts and both piece counts did not survive relaunch');
  if(pass===1) {
    expect($(sumInput).value==='56' && $(lessonAnswer).value==='' && errors()===1,
      'The restored retry did not preserve the sum, official field, and one error');
    checkUnrevealed('57',true);
    write(sumInput,'57');
    expect($(lessonAnswer).value==='' && errors()===1,'Typing the correct sum filled the lesson field before a check');
    pressReturn(sumInput);
    stageIs(2);
    expect($(lessonAnswer).value==='57' && document.activeElement===$(lessonAnswer) && save().round.draft.value==='57',
      'Return on a correct total must transfer and focus the numerator without submitting it');
    expect(scratch().sums[0].status==='verified' && $(mat+'[data-fm-numerator]').textContent.trim()==='57' &&
      /4\s+3\/4\s*=\s*57\/12/.test($(mat+'[data-fm-equivalence]').textContent),
      'The independently produced sum should show the completed equivalence');
    expect(save().round.draft.verified.length===2 && !save().round.receipt && errors()===1,
      'A correct sum alone must not grade or advance the official lesson');
    return 'WebKit restored the incorrect sum. Return on the corrected sum filled the official numerator and kept the lesson on the same step.';
  }
  checkOldCountDraft(p,save().round.draft,2);
  expect($(lessonAnswer).value==='57' && scratch().sums[0].status==='verified' && errors()===1,
    'The learner’s verified total and official answer did not survive relaunch');
  write(mat+'[data-fm-count=part]','8');
  expect($(lessonAnswer).value==='' && !$(mat+'[data-fm-equivalence]') && scratch().sums[0].status==='draft',
    'Changing a source count left the previously transferred official total in place');
  write(mat+'[data-fm-count=part]','9');
  workcheck(true);
  checkUnrevealed('57',true);
  write(lessonAnswer,'41');
  write(mat+'[data-fm-count=part]','8');
  expect($(lessonAnswer).value==='41','Scratch edits erased the learner’s independently typed lesson answer');
  write(mat+'[data-fm-count=part]','9');
  workcheck(true);
  write(sumInput,'57');click(checkSum);
  expect($(lessonAnswer).value==='57' && stage()===2,'Checking 48 + 9 must fill the sum without advancing');
  pressReturn(lessonAnswer);
  stageIs(3);
  expect(save().round.draft.verified[2]==='57','Submitting the transferred numerator did not record the checked 57');
  write(lessonAnswer,'8');
  viewMat(2);
  write(mat+'[data-fm-count=part]','8');
  write(mat+'[data-fm-count=part]','9');
  workcheck(true);write(sumInput,'55');click(checkSum);
  const beforeReview=errors();
  expect(beforeReview===1 && $(lessonAnswer).value==='8' && stage()===3,
    'Reviewing an earlier sum altered the current answer, error count or lesson step');
  write(sumInput,'57');click(checkSum);
  expect($(lessonAnswer).value==='8' && errors()===beforeReview,'A correct previous-stage sum overwrote the current numerator');
  viewMat(3);
  click(mat+'[data-fm-split=up]');
  write(mat+'[data-fm-count=part]','2');
  workcheck(true);
  expect(!$(sumInput) && $(lessonAnswer).value==='2' && stage()===3,
    'A proper fraction should transfer its counted pieces directly and await submission');
  checkOldCountDraft(p,save().round.draft,3);
  pressReturn(lessonAnswer);
  stageIs(4);
  nativeLesson.answer('#workbench',p.steps[4],4,true,'4 10/12');
  stageIs(4);
  nativeLesson.answer('#workbench',p.steps[4],4,true,'4 11/12');
  const finished=save(),record=finished.lessonBook.runs.find(r=>r.id===finished.round.lessonSessionId).history.find(r=>r.roundId===finished.round.id);
  expect(finished.round.receipt?.fullyWorked && record.work.map(w=>w.answer).join('|')==='5|12|57|2|4 11/12' && record.errors.reasoning===2 && !record.independent &&
    finished.stats.count===saved.stats.count+1,'The arithmetic or final reward for 57/12 + 2/12 was not recorded exactly once');
  return 'WebKit restored 57, invalidated a changed workmat, preserved a manual answer during edits and an earlier-step review, transferred the proper fraction, and credited 4 11/12 once.';
}
const audio=$('audio[data-dungeon-music]');
expect(audio?.loop,'The background score player must support looping');
if(pass===0) {
  expect($('#music').getAttribute('aria-pressed')==='false' && audio.paused,'Music must begin off with a clean save');
  click('#music');
  await wait(()=>!audio.paused&&audio.currentTime>.10 && audio.duration>180,'The enabled original music did not audibly advance in WebKit');
  expect(audio.src.endsWith('/assets/empire-overture.m4a')&&audio.volume>0&&!audio.muted,'Music asset was missing or muted');
  const fullVolume=audio.volume;
  click('#sound');
  expect(!save().settings.sound&&save().settings.music&&!audio.paused,'Effects and background music cannot share a switch');
  click('[data-panel=settings]');
  await wait(()=>audio.volume<fullVolume*.8,'Menus should gently lower the score');
  expect($(dialog+'[data-setting=music]').checked&&!$(dialog+'[data-setting=sound]').checked,'Settings do not reflect the independent audio switches');
  click(dialog+'.dp-close');
  await wait(()=>audio.volume>fullVolume*.96,'Music did not return to its ordinary level after the menu closed');
  const first=startFraction([.98,.01,.01,.01]);
  expect(first.problem.prompt.includes('2 1/6')&&first.problem.prompt.includes('1/8'),'The screenshot exercise was not generated');
  await wait(()=>$('#battle-timer [data-pace="ready"]'),'The foreground spell clock is not running');
  await delay(1200);
  click('[data-panel=tutorial]');
  await wait(()=>$('#battle-timer [data-pace="paused"]'),'The clock did not pause for the tutorial');
  const paused=$('[data-battle-elapsed]').textContent;
  await delay(1300);
  expect($('[data-battle-elapsed]').textContent===paused,'Reading the tutorial consumed solving time');
  click(dialog+'[data-tutorial-return]');
  await wait(()=>$('#battle-timer [data-pace="ready"]'),'The timer did not resume after the tutorial');
  click(mat+'[data-fm-benchmark="0"][data-halves="5"]');
  click(mat+'[data-fm-benchmark="1"][data-halves="0"]');
  workcheck(false);
  click(mat+'[data-fm-benchmark="0"][data-halves="4"]');
  workcheck(true);
  click(host+'[data-paper-toggle]');click(host+'[data-paper-mode=type]');
  write(host+'[data-paper-notes]',note);
  $(host+'[data-paper-notes]').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
  expect(Number($(host+'[data-lesson-step]').dataset.lessonStep)===0,'Return in the scratchpad submitted a lesson answer');
  click(host+'[data-paper-mode=draw]');
  stroke($(host+'[data-paper-surface]'));
  expect(save().round.draft.paper.strokes.length===1,'Pencil stroke was not saved');
  click(host+'[data-paper-undo]');expect(save().round.draft.paper.strokes.length===0,'Undo did not erase the pencil stroke');
  click(host+'[data-paper-redo]');expect(save().round.draft.paper.strokes.length===1,'Redo did not restore the pencil stroke');
  const film=$('#victory-film');film.show();
  await wait(()=>audio.paused,'The score did not pause for the conquest film');film.close();
  await wait(()=>!audio.paused,'Music did not resume after the film closed');
  $(host+'[data-fraction-workmat]').scrollIntoView({block:'start'});
  put({round:first.id,run:first.lessonSessionId,xp:save().xp,count:save().stats.count});
  return 'Native audio played offline, ducked for menus and paused for films. Mixed-fraction benchmarks, typed paper, drawn stroke and real tutorial clock pause verified.';
}
const info=get();
if(pass===1) {
  expect(save().settings.music&&!save().settings.sound&&$('#music').getAttribute('aria-pressed')==='true','Music/effects settings were lost after relaunch');
  const p=save().round.problem;
  expect(save().round.id===info.round&&save().round.draft.paper.notes===note&&save().round.draft.paper.strokes.length===1,'Graph-paper notes or pencil stroke were lost');
  expect($(mat+'[data-fm-benchmark="0"][data-halves="4"]').getAttribute('aria-pressed')==='true'&&$(mat+'[data-fm-feedback]').dataset.correct==='true','Fraction benchmark choices did not reopen');
  click(host+'[data-paper-toggle]');
  await wait(()=>!audio.paused&&audio.readyState>=2,'Music did not resume after a launch gesture');
  audio.currentTime=audio.duration-.25;
  await wait(()=>audio.currentTime>.02 && audio.currentTime<2.5&&!audio.paused,'The native soundtrack did not loop');
  nativeLesson.answer('#workbench',p.steps[0],0);
  click(mat+'[data-fm-multiple="0"][data-value="12"]');
  click(mat+'[data-fm-multiple="1"][data-value="24"]');workcheck(false);
  click(mat+'[data-fm-multiple="0"][data-value="24"]');workcheck(true);
  nativeLesson.answer('#workbench',p.steps[1],1);
  for(let i=0;i<3;i++)click(mat+'[data-fm-split=up]');
  write(mat+'[data-fm-count=whole]',48);write(mat+'[data-fm-count=part]',4);workcheck(true);
  checkUnrevealed('52',true);
  expect($(sumInput)?.inputMode==='numeric' && $(sumInput).value==='' && $(lessonAnswer).value==='',
    'Counting 48 whole-bar pieces and 4 loose pieces must open an empty total for the learner');
  write(sumInput,'52');click(checkSum);
  expect($(lessonAnswer).value==='52' && stage()===2,'The checked 48 + 4 should transfer the typed 52 without advancing');
  pressReturn(lessonAnswer);
  for(let i=0;i<2;i++)click(mat+'[data-fm-split=up]');
  write(mat+'[data-fm-count=part]',3);workcheck(true);
  expect(!$(sumInput) && $(lessonAnswer).value==='3' && stage()===3,
    'The three shaded twenty-fourths in 1/8 should transfer directly');
  pressReturn(lessonAnswer);
  click(mat+'[data-fm-move=piece]');click(mat+'[data-fm-move=undo]');
  for(let i=0;i<3;i++)click(mat+'[data-fm-move=piece]');workcheck(true);
  await wait(()=>$('#battle-timer [data-pace="ready"]'),'The resumed native clock did not restart');
  nativeLesson.answer('#workbench',p.steps[4],4,true,'2 7/24');
  const finished=save(),receipt=finished.round.receipt;
  expect(receipt.critical&&receipt.baseDamage===35&&receipt.damage===70&&receipt.bonusDamage===35&&receipt.bonusXp===35&&receipt.elapsedMs>0&&receipt.elapsedMs<=receipt.targetMs,'The verified quick solve did not earn exactly double spell power');
  expect(finished.xp===info.xp+receipt.xp && finished.stats.count===info.count+1,'Critical XP or problem credit was counted incorrectly');
  expect($(host+'[data-critical-hit]')&&$(host+'.mp-saved-notes')?.textContent===note,'The critical result or saved handwritten work is missing');
  put({...info,coins:finished.coins,earnedXp:finished.xp,credit:finished.stats.count});
  $(host+'[data-critical-hit]').scrollIntoView({block:'center'});
  return 'Restored fraction mat and paper, verified all five worked steps and 55/24, looped the soundtrack, earned exactly 70 power and saved the critical-hit receipt.';
}
expect(save().xp===info.earnedXp&&save().coins===info.coins&&save().stats.count===info.credit && $(host+'[data-critical-hit]'),'A restored critical result credited the spell twice or disappeared');
click('[data-panel=sessions]');click(dialog+'[data-view-session="'+info.run+'"]');
expect($(dialog+'[data-round-id="'+info.round+'"] .mp-saved-notes')?.textContent===note,'Session history did not preserve the original paper');
click(dialog+'[data-revisit="'+info.round+'"]');
const review=dialog+'[data-review-board] ';
click(review+'[data-paper-toggle]');click(review+'[data-paper-mode=type]');write(review+'[data-paper-notes]','Review: the common denominator is 24.');
click(dialog+'.dp-close');
click('[data-panel=sessions]');click(dialog+'[data-view-session="'+info.run+'"]');click(dialog+'[data-revisit="'+info.round+'"]');
expect($(review+'[data-paper-notes]').value==='Review: the common denominator is 24.','The review scratchpad did not reopen independently');
expect(save().xp===info.earnedXp&&save().stats.count===info.credit,'Review or paper awarded new timed XP');
click(dialog+'.dp-close');
click('[data-panel=settings]');click(dialog+'[data-setting=music]');click(dialog+'[data-setting=timer]');click(dialog+'.dp-close');
expect(audio.paused&&!save().settings.music&&!save().settings.timer,'Optional music or timer did not turn off');
click('[data-panel=map]');click(dialog+'[data-lesson-practice=decimal-tenths]');
click(host+'[data-paper-toggle]');click(host+'[data-paper-mode=type]');write(host+'[data-paper-notes]','Tenths work');
expect($('#battle-timer').hidden&&save().round.draft.paper.notes==='Tenths work','Decimal arithmetic must retain scratch paper with the timer off');
nativeMath.solveOrdinary(save().round.problem);
expect(!save().round.receipt.critical&&save().round.receipt.damage===save().round.receipt.baseDamage,'An untimed solution was incorrectly given critical power');
return 'Relaunch kept one critical award; original and review paper stayed separate; effects, music and timer switched independently; decimal scratch paper and ordinary untimed credit verified.';
