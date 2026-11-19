// Three fresh WKWebViews share only this scenario's temporary save directory.
const $ = s => document.querySelector(s);
const all = s => [...document.querySelectorAll(s)];
const assert = (ok,message) => { if (!ok) throw Error(message); };
const state = () => JSON.parse(DungeonNativeStorage.getItem('decimal-dungeon.adventure.v1'));
const remember = value => DungeonNativeStorage.setItem('lesson-test',JSON.stringify(value));
const saved = () => JSON.parse(DungeonNativeStorage.getItem('lesson-test'));
const modal = 'dialog.dp-dialog[open] ';
function click(selector) {
  const b=$(selector);
  assert(b && !b.disabled && b.getClientRects().length,'Control unavailable: '+selector);
  b.click();
}
function enter(field,value) {
  field.value = value;
  field.dispatchEvent(new Event('input',{bubbles:true}));
}
const answer=nativeLesson.answer;
function openLesson(id,level,tutorial) {
  click('[data-panel=map]');
  const search=$(modal+'[data-lesson-search]'),def=DungeonLessons.get(id);
  assert(search && def,'Missing lesson library');
  const rec=$(modal+'[data-start-recommendation]');
  assert(rec && DungeonLessons.has(rec.dataset.startRecommendation) && [1,2,3].includes(Number(rec.dataset.recommendedLevel)) &&
    $(modal+'.ll-recommendation').textContent.includes('independent'),'Practice recommendation or its mastery target was missing');
  const game=DungeonAdventure.open(),view=game.lessonView(),campaign=game.campaignView();
  const expected=!view.active && campaign.mathMode==='curriculum' ? campaign.plannedLesson :
    DungeonLessons.nextPractice(view.sessions,view.active?.lessonId,view.active?.difficulty);
  assert(rec.dataset.startRecommendation===expected.lessonId && Number(rec.dataset.recommendedLevel)===expected.difficulty,
    'Library recommendation differs from selected campaign route or fixed-lesson progression');
  assert(all(modal+'[data-lesson-practice]').length===DungeonLessons.list.length,'The shelf omitted lessons on first open');
  assert(all(modal+'[data-lesson-practice]').every(b=>!b.disabled),'A lesson was locked');
  assert(all(modal+'[data-world]').length===7 && $(modal+'[data-lesson-practice=decimal-pairs]'),'Both schoolwork formats and all seven world entries must be available');
  enter(search,def.title);
  const practice=all(modal+'[data-lesson-practice]');
  assert(practice.some(b=>b.dataset.lessonPractice===id) && practice.length<DungeonLessons.list.length,'Search did not narrow the shelf');
  click(modal+'[data-difficulty="'+level+'"]');
  if (tutorial) {
    click(modal+'[data-learn-lesson="'+id+'"]');
    assert($(modal+'.ll-steps')?.children.length===def.tutorial.steps.length && $(modal+'.ll-intro')?.textContent.includes(def.title),'Tutorial is missing its worked example');
    assert($(modal+'[data-difficulty="'+level+'"]').checked,'Chosen difficulty was lost while reading the tutorial');
    click(modal+'[data-tutorial-start]');
  } else click(modal+'[data-lesson-practice="'+id+'"]');
  const round=state().round;
  assert(round.lessonId===id && round.difficulty===level && round.problem.level===level,'Wrong fixed lesson or difficulty');
  return round;
}
function openRecord(info) {
  click('[data-panel=sessions]');
  click(modal+'[data-view-session="'+info.run+'"]');
  const row=$(modal+'[data-round-id="'+info.first.id+'"]');
  assert(row && row.textContent.includes(info.first.problem.prompt) && row.textContent.includes('Answer '+info.final),'Saved original problem and answer missing in history');
  return row;
}
const fixed = 'prism-volume';
if (pass===0) {
  click('#battle-nav');
  nativeMath.align();
  nativeMath.set('digit','7');
  const automatic=state().round;
  const round=openLesson(fixed,3,true);
  nativeAtlas.panels(fixed);
  const info={automatic:automatic.id,first:round,run:round.lessonSessionId,final:''};
  assert(!state().pin && round.problem.kind==='lesson','Curriculum should start on a fresh child save');
  const before=JSON.stringify(state().round);
  click('[data-panel=tutorial]');
  assert($(modal+'.ll-intro').textContent.includes(DungeonLessons.get(fixed).title),'HUD tutorial was about another lesson');
  click(modal+'[data-tutorial-return]');
  assert(JSON.stringify(state().round)===before,'Reading a tutorial changed unfinished work');
  const steps=round.problem.steps;
  assert(steps.length>1,'Challenge should ask for intermediate work');
  const input=$('#workbench [data-field=lesson-answer]');
  assert(input,'Volume challenge must take a written response');
  enter(input,'incorrect');
  click('#workbench [data-action=check]');
  assert(!state().round.receipt && Number($('#workbench [data-lesson-step]').dataset.lessonStep)===0,'A wrong response advanced');
  steps.forEach((step,i)=>answer('#workbench',step,i));
  const complete=state();
  assert(complete.round.receipt?.fullyWorked && complete.stats.count===1,'Curriculum completion was not credited exactly once');
  info.final=complete.round.receipt.answer;
  click('#workbench .next');
  const next=state().round;
  answer('#workbench',next.problem.steps[0],0,false);
  info.next=state().round;
  const other=openLesson('decimal-subtract',1,false);
  nativeAtlas.headings('decimal-subtract');
  assert(other.lessonSessionId!==info.run && other.problem.op==='-','Foundation subtraction did not create a separate session');
  click('[data-panel=sessions]');
  click(modal+'[data-view-session="'+info.run+'"]');
  click(modal+'[data-resume-problem="'+next.id+'"]');
  assert(state().round.id===next.id && JSON.stringify(state().round.draft)===JSON.stringify(info.next.draft),'A saved lesson did not restore its exact pending response');
  remember(info);
  return 'Unlocked catalogue, topic search, worked tutorial, two difficulty levels, wrong-answer check, full volume spell and individual session resume verified';
}
const info=saved();
if (pass===1) {
  assert(state().round.id===info.next.id && JSON.stringify(info.next.draft)===JSON.stringify(state().round.draft),'Current lesson changed on relaunch');
  const row=openRecord(info);
  assert(row.querySelector('details.ll-work')?.textContent.includes(info.first.problem.steps[0].prompt),'Checked work was missing from session history');
  click(modal+'[data-revisit="'+info.first.id+'"]');
  const host=modal+'[data-review-board]';
  assert($(host).textContent.includes(info.first.problem.prompt),'Review generated a different problem');
  answer(host,info.first.problem.steps[0],0);
  assert(Number($(host+' [data-lesson-step]').dataset.lessonStep)===1,'First review step did not advance');
  info.xp=state().xp; info.coins=state().coins; info.turn=state().campaign.turn;
  remember(info);
  return 'Relaunch preserved the active lesson while an independent review opened the exact original problem and saved its first step';
}
const row=openRecord(info);
assert(row.querySelector('[data-revisit]').textContent.includes('Continue'),'History did not offer to continue the paused review');
click(modal+'[data-revisit="'+info.first.id+'"]');
const host=modal+'[data-review-board]';
for (let i=1;i<info.first.problem.steps.length;i++) answer(host,info.first.problem.steps[i],i);
assert($(modal+'[data-review-complete]'),'Review did not reach its own finish screen');
const after=state();
assert(after.stats.count===1 && after.xp===info.xp && after.coins===info.coins && after.campaign.turn===info.turn &&
  after.round.id===info.next.id && JSON.stringify(after.round.draft)===JSON.stringify(info.next.draft),'Replaying a problem altered credit, campaign or active work');
const record=after.lessonBook.runs.find(r=>r.id===info.run).history.find(h=>h.roundId===info.first.id);
assert(record.reviewCount===1 && !record.reviewDraft,'Completing a review was not recorded exactly once');
click(modal+'.dp-close');
click('[data-panel=map]');
click(modal+'[data-automatic]');
assert(state().round.id===info.automatic && nativeMath.field('digit')?.value==='7','Automatic progression did not recover the earlier battle and typed response');
click('[data-panel=map]');
const follow=$(modal+'[data-start-recommendation]');
const suggested=follow.dataset.startRecommendation, startingLevel=Number(follow.dataset.recommendedLevel);
follow.click();
assert(state().round.lessonId===suggested && state().round.difficulty===startingLevel,'Recommendation chose a different lesson or difficulty');
for(let n=1;n<=3;n++) {
  const problem=state().round.problem;
  problem.steps.forEach((step,i)=>answer('#workbench',step,i));
  assert(state().round.receipt?.fullyWorked,'Recommended lesson did not credit a verified problem');
  if(n<3){
    assert(!$('#workbench [data-next-lesson]'),'The level recommendation changed too soon');
    click('#workbench .next');
  }
}
click('#workbench [data-next-lesson]');
assert(state().round.lessonId===suggested && state().round.difficulty===startingLevel+1,'Three independent solves did not advance the recommendation');
click('[data-panel=progress]');
const tracker='dialog[open] [data-tracked-lesson="'+suggested+'"]';
assert($(tracker)?.dataset.masteryStatus==='Mastered' && $(tracker).textContent.includes('3 independent'),'Three independent Core problems did not mark the lesson mastered');
assert(all(modal+'[data-tracked-lesson]').length===DungeonLessons.list.length,'Progress did not cover the full catalogue');
const worked=$(modal+'[data-tracked-lesson="'+fixed+'"]');
assert(worked.dataset.masteryStatus==='In progress' && worked.textContent.includes('1 review'),'Reviewed lesson did not show its separate review count');
click(modal+'[data-difficulty="1"]');
click(tracker+' [data-tracker-practice]');
const extra=state().round;
assert(extra.lessonId===suggested && extra.difficulty===1,'Extra practice did not use the chosen level');
extra.problem.steps.forEach((step,i)=>answer('#workbench',step,i));
click('[data-panel=map]');
click(modal+'[data-open-progress]');
assert($(tracker).textContent.includes('1 extra problem') && $(tracker).textContent.includes('3 at Core or Challenge'),'Extra Foundation practice changed mastery or did not count separately');
click(tracker+' [data-tracker-revisit]');
assert($(modal+'[data-review-board]').textContent.includes(extra.problem.prompt),'Tracker did not revisit the most recent solved problem');
click(modal+'[data-lesson-back]');
return 'Reward-free review and old automatic draft restored; three independent recommended problems earned the next difficulty and opened it from the receipt; tracker counted separate reviews, mastery and extra practice';
