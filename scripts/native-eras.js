// All country selections happen through the actual map; stores are isolated from the player's save.
const $=s=>document.querySelector(s);
const all=s=>[...document.querySelectorAll(s)];
const expect=(ok,message)=>{if(!ok) throw Error(message);};
const state=()=>JSON.parse(DungeonNativeStorage.getItem('decimal-dungeon.adventure.v1'));
const view=()=>DungeonAdventure.open().campaignView();
const click=s=>{const b=$(s);expect(b?.getClientRects().length&&!b.disabled,'Unavailable control '+s);b.click();};
const select=(selector,value)=>{
  const s=$(selector); expect(s?.getClientRects().length,'Unavailable selector '+selector);
  s.value=String(value); expect(s.value===String(value),'Unavailable option '+value);
  s.dispatchEvent(new Event('change',{bubbles:true}));
};
function era(id) {
  select('[data-campaign-era]',id);
  const v=view();
  expect(v.eraId===id && $('[data-campaign-era]').value===id,'Map era was not switched to '+id);
  expect(all('[data-territory-id]').length===v.nations.length,'Country boundaries do not match the active era');
  return v;
}
function findBritishIndia() {
  const input=$('#campaign-host [data-search]');
  input.value='British India';
  input.dispatchEvent(new Event('input',{bubbles:true}));
  const hit=$('#campaign-host [data-match][data-dependency="British India"]');
  expect(hit?.textContent.includes('British India') && /British Empire/i.test(hit.textContent),'The historical search must identify the dependency and sovereign');
  const sovereign=Number(hit.dataset.match);
  hit.click();
  const label=$('#campaign-host [data-focused-territory]');
  expect(label?.textContent==='British India','The local holding is missing its historical place label');
  const svg=$('#campaign-host svg.cm-map'), frame=svg.viewBox.baseVal;
  const cx=frame.x+frame.width/2,cy=frame.y+frame.height/2;
  expect(Math.abs(cx-718)<38 && Math.abs(cy-214)<40 && Math.abs(Number(label.getAttribute('x'))-cx)<36 &&
    Math.abs(Number(label.getAttribute('y'))-cy)<36,'Searching British India must center the map over India');
  expect($('#campaign-host [data-territory-id="'+sovereign+'"]').getAttribute('aria-pressed')==='true','Indian dependency must select the British Empire');
}
function chooseHome(preferred) {
  const v=view();
  expect(v.needsCapital && !v.owned.length,'This era should begin without holdings');
  const home=v.nations.find(n=>preferred.test(n.name));
  expect(home,'Expected a recognizable period country in '+v.eraId);
  select('#campaign-host [data-pick]',home.id);
  click('#campaign-host [data-home]');
  expect(view().owned.length===1 && view().owned[0]===home.id,'Wrong founding country for '+v.eraId);
  return home;
}
function invade() {
  const v=view();
  const target=v.nations.find(n=>v.frontier.includes(n.id) && n.rank!=='boss') || v.nations[v.frontier[0]];
  expect(target,'A reachable country is needed for historical campaign practice');
  select('#campaign-host [data-pick]',target.id);
  const promised = nativeAtlas.dossierTitle();
  click('#campaign-host [data-invade]');
  nativeAtlas.checkDossier(promised);
  return target;
}
function checkSaved(holdings,id) {
  const v=era(id);
  const painted=all('[data-territory-id][data-status="owned"]').map(g=>Number(g.dataset.territoryId)).sort((a,b)=>a-b);
  const expected=holdings[id].slice().sort((a,b)=>a-b);
  expect(JSON.stringify(v.owned.slice().sort((a,b)=>a-b))===JSON.stringify(expected) &&
    JSON.stringify(painted)===JSON.stringify(expected),'Saved or painted holdings differ in '+id);
}
if(pass===0) {
  const picker=$('[data-campaign-era]');
  expect(picker && ['modern','ww1','ww2','1886'].every(id=>[...picker.options].some(o=>o.value===id)),'A requested historical map selector is missing');
  const holdings={};
  const modern=chooseHome(/United States/i);holdings.modern=[modern.id];
  era('ww1');
  findBritishIndia();
  const home=chooseHome(/Austria.Hungary|Austro.Hungarian|Ottoman/i);
  holdings.ww1=[home.id];
  const initial=view().plannedLesson;
  expect(view().mathMode==='curriculum' && initial.difficulty===2,'A new historical empire should begin with the grade 5 curriculum');
  let first,target;
  for(let n=0;n<3;n++) {
    const chosen=invade(),round=state().round;
    nativeAtlas.preview(view());
    nativeAtlas.headings(initial.lessonId,view());
    if(!first) {first=round;target=chosen;}
    expect(round.campaignMath==='curriculum' && round.problem.kind==='lesson' && round.lessonId===initial.lessonId,'Default country battle used the wrong curriculum lesson');
    round.problem.steps.forEach((step,i)=>nativeLesson.answer('#workbench',step,i));
    expect(state().round.receipt?.capture?.id===chosen.id,'A completed curriculum lesson did not capture its historical target');
    if($('#victory-film').open) click('#skip-victory');
    click($('#workbench [data-conquest-map]')?'#workbench [data-conquest-map]':'#workbench .next');
    holdings.ww1.push(chosen.id);
  }
  checkSaved(holdings,'ww1');
  click('[data-panel=progress]');
  const mastered=$('dialog[open] [data-tracked-lesson="'+initial.lessonId+'"]');
  expect(mastered?.dataset.masteryStatus==='Mastered' && mastered.textContent.includes('3 at Core or Challenge'),'Three independent curriculum captures failed to master the tracked lesson');
  click('dialog[open] .dp-close');
  const next=invade();
  const pending=state().round;
  expect(pending.lessonId!==initial.lessonId && pending.problem.kind==='lesson','The campaign did not move to its next grade 5 lesson after mastery');
  nativeAtlas.panels(pending.lessonId);
  const written=nativeLesson.answer('#workbench',pending.problem.steps[0],0,false);
  nativeAtlas.openPreview(view());
  era('ww2');const ww2=chooseHome(/Germany|Reich/i);holdings.ww2=[ww2.id];
  era('1886');const victorian=chooseHome(/Britain|British Empire|United Kingdom/i);holdings['1886']=[victorian.id];
  checkSaved(holdings,'modern');
  DungeonNativeStorage.setItem('era-test',JSON.stringify({holdings,run:first.lessonSessionId,first:first.id,
    solved:target.name,pending:pending.id,unfinished:next.name,written}));
  return 'Four era maps founded with independent territories; three WWI curriculum captures mastered the first tracked lesson and promoted the next frontier';
}
const info=JSON.parse(DungeonNativeStorage.getItem('era-test'));
if(pass===2) {
  click('[data-panel=sessions]');click('dialog[open] [data-view-session="'+info.run+'"]');
  click('dialog[open] [data-resume-problem="'+info.pending+'"]');
  expect(state().round.id===info.pending && view().eraId==='ww1','Relaunch restored the wrong historical battle');
  nativeAtlas.preview(view());
  nativeAtlas.headings(state().round.lessonId,view());
  return 'Restored the 1914 battle preview with its selected country, sovereign boundaries and historical seat';
}
for(const id of ['ww2','1886','ww1','modern']) checkSaved(info.holdings,id);
click('[data-panel=sessions]');click('dialog[open] [data-view-session="'+info.run+'"]');
const completed=$('dialog[open] [data-round-id="'+info.first+'"]');
expect(completed.textContent.includes(info.solved),'Review history resolved the historical country against the wrong map');
const b=$('dialog[open] [data-resume-problem="'+info.pending+'"]');
expect(b?.parentElement.textContent.includes(info.unfinished),'Pending historical country label was lost');
b.click();
expect(view().eraId==='ww1' && state().round.id===info.pending && $('#workbench [data-field=lesson-answer]')?.value===info.written,'Resuming a saved WWI exercise did not restore the historical era and the written digit');
nativeAtlas.openPreview(view());
checkSaved(info.holdings,'ww1');
findBritishIndia();
return 'All eras retained and painted their own holdings after relaunch; history named the original WWI country and restored the next grade-level battle from the modern map; British India search identified its sovereign and centered the local map label over India';
